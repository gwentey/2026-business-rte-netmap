import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import type { ImportDetail, ImportSummary } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { detectDumpType } from './dump-type-detector.js';
import { parseDumpFilename } from './filename-parser.js';
import type { DumpType } from './dump-type-detector.js';
import type { BuiltImport, BuiltImportedComponent, BuiltImportedPath } from './types.js';
import type { Warning } from '@carto-ecp/shared';

export type CreateImportInput = {
  file: { originalname: string; buffer: Buffer };
  envName: string;
  label: string;
  dumpType?: DumpType;
};

type ImportRow = {
  id: string;
  envName: string;
  label: string;
  fileName: string;
  dumpType: string;
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
  uploadedAt: Date;
  effectiveDate: Date;
  zipPath: string;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zipExtractor: ZipExtractorService,
    private readonly csvReader: CsvReaderService,
    private readonly xmlParser: XmlMadesParserService,
    private readonly builder: ImportBuilderService,
    private readonly persister: RawPersisterService,
  ) {}

  async createImport(input: CreateImportInput): Promise<ImportDetail> {
    const { file, envName, label } = input;
    const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    const warnings: Warning[] = [];

    const extracted = this.zipExtractor.extract(file.buffer);

    // Read component_directory.csv
    const cdBuffer = extracted.files.get('component_directory.csv')!;
    const cdRows = this.csvReader.readComponentDirectory(cdBuffer, warnings);

    // Detect dump type from XML blobs in directoryContent
    // ComponentDirectoryRow has `directoryContent` (XML) and `id` (EIC)
    const rowsForDetection = cdRows.map((r) => ({ xml: r.directoryContent }));
    const dumpType = detectDumpType(rowsForDetection, input.dumpType);

    // Build components from CSV — ComponentDirectoryRow.id is the EIC
    const csvComponentRows = cdRows.map((r) => ({
      eic: r.id,
      componentCode: r.id,
      xml: r.directoryContent,
    }));
    const fromCsv = this.builder.buildFromLocalCsv(csvComponentRows);
    warnings.push(...fromCsv.warnings);

    // Parse XML blobs from directoryContent and extract components/paths
    const xmlComponents: BuiltImportedComponent[] = [];
    const xmlPaths: BuiltImportedPath[] = [];
    const xmlWarnings: Warning[] = [];

    for (const row of cdRows) {
      const xml = row.directoryContent;
      if (typeof xml !== 'string' || !xml.includes('<?xml')) continue;
      try {
        const parsed = this.xmlParser.parse(xml);
        const xmlBuilt = this.builder.buildFromXml(parsed);
        xmlComponents.push(...xmlBuilt.components);
        xmlPaths.push(...xmlBuilt.paths);
        xmlWarnings.push(...xmlBuilt.warnings);
      } catch (err) {
        warnings.push({
          code: 'XML_PARSE_ERROR',
          message: `XML blob parse error: ${(err as Error).message}`,
        });
      }
    }
    warnings.push(...xmlWarnings);

    // Read application_property.csv
    const appPropBuffer = extracted.files.get('application_property.csv')!;
    const appPropRows = this.csvReader.readApplicationProperties(appPropBuffer, warnings);
    const appProperties = this.builder.buildAppProperties(
      appPropRows
        .filter((r) => r.value != null)
        .map((r) => ({ key: r.key, value: r.value! })),
    );

    // Determine local source EIC for messaging stats (from app props or filename)
    const appsMap = new Map(appPropRows.map((r) => [r.key, r.value] as const));
    const localEic =
      appsMap.get('ecp.componentCode') ?? sourceComponentEic ?? '';

    // Read messaging_statistics.csv (optional)
    const statsBuf = extracted.files.get('messaging_statistics.csv');
    const statRows = statsBuf
      ? this.csvReader.readMessagingStatistics(statsBuf, warnings)
      : [];

    const messagingStats = this.builder.buildMessagingStats(
      statRows
        .filter((r) => r.remoteComponentCode != null)
        .map((r) => ({
          sourceEndpointCode: r.localEcpInstanceId ?? localEic,
          remoteComponentCode: r.remoteComponentCode!,
          connectionStatus: r.connectionStatus,
          lastMessageUp: r.lastMessageUp?.toISOString() ?? null,
          lastMessageDown: r.lastMessageDown?.toISOString() ?? null,
          sumMessagesUp: r.sumMessagesUp ?? 0,
          sumMessagesDown: r.sumMessagesDown ?? 0,
          deleted: r.deleted ?? false,
        })),
    );

    // Dedup components CSV↔XML by EIC: XML takes precedence (richer data)
    const componentsByEic = new Map<string, BuiltImportedComponent>();
    for (const c of fromCsv.components) componentsByEic.set(c.eic, c);
    for (const c of xmlComponents) componentsByEic.set(c.eic, c);
    const components = Array.from(componentsByEic.values());

    const effectiveDate = sourceDumpTimestamp ?? new Date();

    const built: BuiltImport = {
      envName,
      label,
      fileName: file.originalname,
      fileHash,
      dumpType,
      sourceComponentEic,
      sourceDumpTimestamp,
      effectiveDate,
      components,
      paths: xmlPaths,
      messagingStats,
      appProperties,
      warnings,
    };

    const persisted = await this.persister.persist(built, file.buffer);
    return this.toDetail(persisted.id);
  }

  async listImports(envFilter?: string): Promise<ImportSummary[]> {
    const where = envFilter ? { envName: envFilter } : {};
    const rows = await this.prisma.import.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async deleteImport(id: string): Promise<void> {
    const existing = await this.prisma.import.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: `Import ${id} not found` });
    }
    await this.prisma.import.delete({ where: { id } });
    if (existsSync(existing.zipPath)) {
      try {
        unlinkSync(existing.zipPath);
      } catch {
        // best effort
      }
    }
  }

  private async toDetail(id: string): Promise<ImportDetail> {
    const row = await this.prisma.import.findUniqueOrThrow({
      where: { id },
      include: {
        _count: {
          select: {
            importedComponents: true,
            importedPaths: true,
            importedStats: true,
          },
        },
      },
    });
    return {
      ...this.toSummary(row),
      warnings: JSON.parse(row.warningsJson) as Warning[],
      stats: {
        componentsCount: row._count.importedComponents,
        pathsCount: row._count.importedPaths,
        messagingStatsCount: row._count.importedStats,
      },
    };
  }

  private toSummary(r: ImportRow): ImportSummary {
    return {
      id: r.id,
      envName: r.envName,
      label: r.label,
      fileName: r.fileName,
      dumpType: r.dumpType as 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER',
      sourceComponentEic: r.sourceComponentEic,
      sourceDumpTimestamp: r.sourceDumpTimestamp?.toISOString() ?? null,
      uploadedAt: r.uploadedAt.toISOString(),
      effectiveDate: r.effectiveDate.toISOString(),
    };
  }
}
