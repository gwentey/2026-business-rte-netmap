import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DangerService } from './danger.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportsService } from '../ingestion/imports.service.js';
import { ZipExtractorService } from '../ingestion/zip-extractor.service.js';
import { CsvReaderService } from '../ingestion/csv-reader.service.js';
import { XmlMadesParserService } from '../ingestion/xml-mades-parser.service.js';
import { ImportBuilderService } from '../ingestion/import-builder.service.js';
import { CsvPathReaderService } from '../ingestion/csv-path-reader.service.js';
import { RawPersisterService } from '../ingestion/raw-persister.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from '../../test/fixtures-loader.js';

describe('DangerService', () => {
  let service: DangerService;
  let prisma: PrismaService;
  let imports: ImportsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DangerService, PrismaService, ImportsService,
        ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(DangerService);
    prisma = moduleRef.get(PrismaService);
    imports = moduleRef.get(ImportsService);
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany();
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany();
    await prisma.componentOverride.deleteMany();
    await prisma.entsoeEntry.deleteMany();
  });

  it('purgeImports deletes all imports and unlinks zips', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'PURGE_TEST', label: 'to purge',
    });
    const row = await prisma.import.findUnique({ where: { id: created.id } });
    const { existsSync } = await import('node:fs');
    expect(existsSync(row!.zipPath)).toBe(true);

    const result = await service.purgeImports();
    expect(result.deletedCount).toBeGreaterThanOrEqual(1);
    const after = await prisma.import.findMany();
    expect(after).toHaveLength(0);
    expect(existsSync(row!.zipPath)).toBe(false);
  });

  it('purgeOverrides deletes all overrides', async () => {
    await prisma.componentOverride.createMany({
      data: [{ eic: 'PURGE_OV_A', displayName: 'A' }, { eic: 'PURGE_OV_B', displayName: 'B' }],
    });
    const result = await service.purgeOverrides();
    expect(result.deletedCount).toBe(2);
    expect(await prisma.componentOverride.count()).toBe(0);
  });

  it('purgeAll deletes imports + overrides + entsoe', async () => {
    await prisma.componentOverride.createMany({
      data: [{ eic: 'PURGE_ALL_OV', displayName: 'X' }],
    });
    await prisma.entsoeEntry.create({
      data: { eic: 'PURGE_ALL_EN', displayName: 'Entsoe', refreshedAt: new Date() },
    });
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'PURGE_ALL', label: 'to purge',
    });

    const result = await service.purgeAll();
    expect(result.imports).toBeGreaterThanOrEqual(1);
    expect(result.overrides).toBe(1);
    expect(result.entsoe).toBe(1);
    expect(await prisma.import.count()).toBe(0);
    expect(await prisma.componentOverride.count()).toBe(0);
    expect(await prisma.entsoeEntry.count()).toBe(0);
  });
});
