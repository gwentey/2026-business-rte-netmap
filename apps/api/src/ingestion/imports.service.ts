import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import type { ImportDetail, ImportSummary, InspectResult, Warning } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { PropertiesParserService } from './properties-parser.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { detectDumpType } from './dump-type-detector.js';
import { parseDumpFilename } from './filename-parser.js';
import type { DumpType } from './dump-type-detector.js';
import type {
  BuiltImport,
  BuiltImportedComponent,
  BuiltImportedDirectorySync,
  BuiltImportedPath,
  BuiltImportedMessagingStat,
} from './types.js';

export type CreateImportInput = {
  file: { originalname: string; buffer: Buffer };
  envName: string;
  label: string;
  dumpType?: DumpType;
  replaceImportId?: string;
  configurationProperties?: { originalname: string; buffer: Buffer };
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
  hasConfigurationProperties: boolean;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zipExtractor: ZipExtractorService,
    private readonly csvReader: CsvReaderService,
    private readonly xmlParser: XmlMadesParserService,
    private readonly builder: ImportBuilderService,
    private readonly propertiesParser: PropertiesParserService,
    private readonly persister: RawPersisterService,
  ) {}

  async createImport(input: CreateImportInput): Promise<ImportDetail> {
    // --- 1. Handle replace: validate and delete old import BEFORE pipeline ---
    if (input.replaceImportId) {
      const old = await this.prisma.import.findUnique({ where: { id: input.replaceImportId } });
      if (!old) {
        throw new BadRequestException({
          code: 'IMPORT_NOT_FOUND',
          message: `Import ${input.replaceImportId} not found`,
        });
      }
      if (old.envName !== input.envName) {
        throw new BadRequestException({
          code: 'REPLACE_IMPORT_MISMATCH',
          message: `Cannot replace import ${input.replaceImportId} (env=${old.envName}) from env=${input.envName}`,
        });
      }
      await this.deleteImport(input.replaceImportId);
    }

    const { file, envName, label } = input;
    const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    // --- 2. Détection de type (avant extract pour éviter l'erreur REQUIRED_CSV sur BROKER) ---
    const zipEntries = this.zipExtractor.listEntries(file.buffer);
    const detection = detectDumpType(zipEntries, input.dumpType);
    const dumpType = detection.dumpType;

    const warnings: Warning[] = [];
    let components: BuiltImportedComponent[] = [];
    let paths: BuiltImportedPath[] = [];
    let messagingStats: BuiltImportedMessagingStat[] = [];
    let appProperties: Array<{ key: string; value: string }> = [];
    let directorySyncs: BuiltImportedDirectorySync[] = [];

    // --- 2.bis. Parsing du .properties externe (optionnel) ---
    // Clés issues du `<EIC>-configuration.properties` exporté par l'admin ECP.
    // Si présent, elles écrasent les clés homonymes lues depuis
    // `application_property.csv` (état courant au moment de l'export).
    let externalProperties: Record<string, string> = {};
    const hasConfigurationProperties = input.configurationProperties != null;
    if (input.configurationProperties) {
      try {
        externalProperties = this.propertiesParser.parse(
          input.configurationProperties.buffer,
        );
      } catch (err) {
        warnings.push({
          code: 'CONFIGURATION_PROPERTIES_PARSE_ERROR',
          message: `Parse error on ${input.configurationProperties.originalname}: ${
            (err as Error).message
          }`,
        });
      }
    } else {
      warnings.push({
        code: 'CONFIGURATION_PROPERTIES_MISSING',
        message:
          "Fichier <EIC>-configuration.properties non fourni. Exportez-le via " +
          "Admin ECP > Settings > Runtime Configuration > Export Configuration pour " +
          'des valeurs projectName / envName / NAT fidèles au composant.',
      });
    }

    // --- 3. Routing selon dumpType ---
    if (dumpType === 'ENDPOINT') {
      // Pipeline v2a inchangé : CSV + XML blob
      const extracted = this.zipExtractor.extract(file.buffer);

      const cdBuffer = extracted.files.get('component_directory.csv')!;
      const cdRows = this.csvReader.readComponentDirectory(cdBuffer, warnings);

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

      // Fusion CSV interne + .properties externe (external gagne sur les clés
      // en conflit car le .properties reflète l'état courant au moment de
      // l'export admin).
      const csvPairs = appPropRows
        .filter((r) => r.value != null)
        .map((r) => ({ key: r.key, value: r.value! }));
      const externalPairs = Object.entries(externalProperties).map(([key, value]) => ({
        key,
        value,
      }));
      const mergedPairs = new Map<string, string>();
      for (const p of csvPairs) mergedPairs.set(p.key, p.value);
      for (const p of externalPairs) mergedPairs.set(p.key, p.value); // external écrase
      appProperties = this.builder.buildAppProperties(
        Array.from(mergedPairs.entries()).map(([key, value]) => ({ key, value })),
      );

      // Determine local source EIC for messaging stats (from app props, merged
      // map donc .properties écrase si renseigné, ou filename en fallback).
      const appsMap = mergedPairs;
      const localEic = appsMap.get('ecp.componentCode') ?? sourceComponentEic ?? '';

      // Read messaging_statistics.csv (optional)
      const statsBuf = extracted.files.get('messaging_statistics.csv');
      const statRows = statsBuf
        ? this.csvReader.readMessagingStatistics(statsBuf, warnings)
        : [];

      messagingStats = this.builder.buildMessagingStats(
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
      components = Array.from(componentsByEic.values());
      paths = xmlPaths;

      // Injecte ecp.projectName uniquement sur le composant dont le dump est issu.
      // Les autres composants (vus via le XML) n'ont pas leur projectName dans ce dump.
      const projectName = appsMap.get('ecp.projectName') ?? null;
      if (projectName && localEic) {
        const src = componentsByEic.get(localEic);
        if (src) src.projectName = projectName;
      }
    } else if (dumpType === 'COMPONENT_DIRECTORY') {
      // Pipeline 2b : CSVs only, pas de XML blob
      const extracted = this.zipExtractor.extract(file.buffer);

      // Convert Map to Record for readMessagePaths
      const extractedRecord: Record<string, Buffer> = {};
      for (const [k, v] of extracted.files.entries()) {
        extractedRecord[k] = v;
      }

      // Lecture précoce de application_property.csv pour récupérer le vrai EIC
      // du CD : `component_directory.csv` n'expose qu'un id interne séquentiel
      // (ex. "1"), pas l'EIC réel du composant directory.
      const appPropBuffer = extracted.files.get('application_property.csv')!;
      const appPropRows = this.csvReader.readApplicationProperties(appPropBuffer, warnings);
      const appsMapCd = new Map<string, string | null>(
        appPropRows.map((r) => [r.key, r.value] as const),
      );
      // External .properties écrase les clés homonymes du CSV
      for (const [key, value] of Object.entries(externalProperties)) {
        appsMapCd.set(key, value);
      }
      const cdRealEic = (appsMapCd.get('ecp.componentCode') ?? sourceComponentEic ?? '') as string;
      const projectNameCd = appsMapCd.get('ecp.projectName') ?? null;

      const cdBuffer = extracted.files.get('component_directory.csv')!;
      const cdRawRows = this.csvReader.readComponentDirectory(cdBuffer, warnings);
      // Adapter : on substitue l'EIC réel à l'id interne du CSV (sinon le CD
      // serait persisté avec un EIC bidon type "1" sans lien avec le graph).
      const cdComponentRows = cdRawRows.map((r) => ({
        id: cdRealEic || r.id,
        componentCode: cdRealEic || r.id,
        directoryContent: r.directoryContent,
        organization: null,
      }));
      const cdPathRows = this.csvReader.readMessagePaths(extractedRecord, warnings);
      const cdBuilt = this.builder.buildFromCdCsv(cdComponentRows, cdPathRows);
      components = cdBuilt.components;
      paths = cdBuilt.paths;
      warnings.push(...cdBuilt.warnings);

      // Fusion CSV + .properties externe : external gagne, propagé à appProperties
      const csvCdPairs = appPropRows
        .filter((r) => r.value != null)
        .map((r) => ({ key: r.key, value: r.value! }));
      const mergedCdPairs = new Map<string, string>();
      for (const p of csvCdPairs) mergedCdPairs.set(p.key, p.value);
      for (const [key, value] of Object.entries(externalProperties)) {
        mergedCdPairs.set(key, value);
      }
      appProperties = this.builder.buildAppProperties(
        Array.from(mergedCdPairs.entries()).map(([key, value]) => ({ key, value })),
      );

      // Injecte ecp.projectName sur le composant CD lui-même (source du dump).
      if (projectNameCd && cdRealEic) {
        const src = components.find((c) => c.eic === cdRealEic);
        if (src) src.projectName = projectNameCd;
      }

      // Slice 2m : parse synchronized_directories.csv si présent (uniquement CD).
      const syncBuf = extracted.files.get('synchronized_directories.csv');
      if (syncBuf) {
        const syncRows = this.csvReader.readSynchronizedDirectories(syncBuf, warnings);
        directorySyncs = this.builder.buildDirectorySyncs(syncRows);
      }
      // Pas de messaging_statistics côté CD (tableau vide par défaut)
    } else {
      // BROKER : metadata-only — pas d'extraction CSV (zip ne contient pas les CSVs requis)
      warnings.push({
        code: 'BROKER_DUMP_METADATA_ONLY',
        message: 'Dump BROKER accepté sans extraction de composants/paths (pas de base SQL côté broker).',
      });
      // components, paths, messagingStats, appProperties restent vides
    }

    // --- 4. Build + persist ---
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
      hasConfigurationProperties,
      components,
      paths,
      messagingStats,
      appProperties,
      directorySyncs,
      warnings,
    };

    const persisted = await this.persister.persist(built, file.buffer);
    return this.toDetail(persisted.id);
  }

  async inspectBatch(
    files: Array<{ originalname: string; buffer: Buffer }>,
    envName: string | undefined,
  ): Promise<InspectResult[]> {
    const results: InspectResult[] = [];
    for (const file of files) {
      const result = await this.inspectOne(file, envName);
      results.push(result);
    }
    return results;
  }

  private async inspectOne(
    file: { originalname: string; buffer: Buffer },
    envName: string | undefined,
  ): Promise<InspectResult> {
    const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    let dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
    let confidence: 'HIGH' | 'FALLBACK';
    let reason: string;
    const warnings: Warning[] = [];
    try {
      const entries = this.zipExtractor.listEntries(file.buffer);
      const detection = detectDumpType(entries);
      dumpType = detection.dumpType;
      confidence = detection.confidence;
      reason = detection.reason;
    } catch (err) {
      warnings.push({ code: 'INVALID_ZIP', message: (err as Error).message });
      dumpType = 'COMPONENT_DIRECTORY';
      confidence = 'FALLBACK';
      reason = 'ZIP invalide';
    }

    const duplicateOf = await this.findDuplicateForInspect({
      sourceComponentEic,
      sourceDumpTimestamp,
      fileHash,
      envName,
    });

    return {
      fileName: file.originalname,
      fileSize: file.buffer.length,
      fileHash,
      sourceComponentEic,
      sourceDumpTimestamp: sourceDumpTimestamp?.toISOString() ?? null,
      dumpType,
      confidence,
      reason,
      duplicateOf,
      warnings,
    };
  }

  private async findDuplicateForInspect(args: {
    sourceComponentEic: string | null;
    sourceDumpTimestamp: Date | null;
    fileHash: string;
    envName: string | undefined;
  }): Promise<InspectResult['duplicateOf']> {
    const baseWhere: Record<string, unknown> = {};
    if (args.envName) baseWhere['envName'] = args.envName;

    // Priority 1: match by (sourceComponentEic, sourceDumpTimestamp) if both available
    if (args.sourceComponentEic && args.sourceDumpTimestamp) {
      const match = await this.prisma.import.findFirst({
        where: {
          ...baseWhere,
          sourceComponentEic: args.sourceComponentEic,
          sourceDumpTimestamp: args.sourceDumpTimestamp,
        },
      });
      if (match) {
        return { importId: match.id, label: match.label, uploadedAt: match.uploadedAt.toISOString() };
      }
    }

    // Priority 2: fallback on fileHash
    const hashMatch = await this.prisma.import.findFirst({
      where: { ...baseWhere, fileHash: args.fileHash },
    });
    if (hashMatch) {
      return { importId: hashMatch.id, label: hashMatch.label, uploadedAt: hashMatch.uploadedAt.toISOString() };
    }

    return null;
  }

  async listImports(envFilter?: string): Promise<ImportDetail[]> {
    const where = envFilter ? { envName: envFilter } : {};
    const rows = await this.prisma.import.findMany({
      where,
      orderBy: { effectiveDate: 'desc' },
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
    return rows.map((r) => ({
      ...this.toSummary(r),
      warnings: JSON.parse(r.warningsJson) as Warning[],
      stats: {
        componentsCount: r._count.importedComponents,
        pathsCount: r._count.importedPaths,
        messagingStatsCount: r._count.importedStats,
      },
    }));
  }

  async updateImport(
    id: string,
    patch: { label?: string; effectiveDate?: string },
  ): Promise<ImportDetail> {
    const existing = await this.prisma.import.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: `Import ${id} not found` });
    }

    const data: { label?: string; effectiveDate?: Date } = {};
    if (patch.label !== undefined) data.label = patch.label;
    if (patch.effectiveDate !== undefined) data.effectiveDate = new Date(patch.effectiveDate);

    await this.prisma.import.update({ where: { id }, data });
    return this.toDetail(id);
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
      hasConfigurationProperties: r.hasConfigurationProperties,
    };
  }
}
