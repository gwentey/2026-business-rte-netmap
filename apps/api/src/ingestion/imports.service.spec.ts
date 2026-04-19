import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { ImportsService } from './imports.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE, CD_FIXTURE } from '../../test/fixtures-loader.js';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService,
        ZipExtractorService,
        CsvReaderService,
        XmlMadesParserService,
        ImportBuilderService,
        CsvPathReaderService,
        RawPersisterService,
        PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);

    await prisma.import.deleteMany({
      where: { envName: { startsWith: 'TEST_IMPORTS_SVC' } },
    });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({
      where: { envName: { startsWith: 'TEST_IMPORTS_SVC' } },
    });
    for (const r of rows) {
      if (existsSync(r.zipPath)) {
        try {
          unlinkSync(r.zipPath);
        } catch {}
      }
    }
    await prisma.import.deleteMany({
      where: { envName: { startsWith: 'TEST_IMPORTS_SVC' } },
    });
  });

  it('creates an import from a real fixture zip', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const detail = await service.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_IMPORTS_SVC_A',
      label: 'smoke fixture',
    });
    expect(detail.id).toBeTruthy();
    expect(detail.envName).toBe('TEST_IMPORTS_SVC_A');
    expect(detail.dumpType).toBe('ENDPOINT');
    expect(detail.sourceComponentEic).toBe('17V000000498771C');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
  });

  it('lists imports filtered by env', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await service.createImport({
      file: { originalname: 'a.zip', buffer: zip },
      envName: 'TEST_IMPORTS_SVC_LIST',
      label: 'a',
    });
    await service.createImport({
      file: { originalname: 'b.zip', buffer: zip },
      envName: 'TEST_IMPORTS_SVC_LIST_OTHER',
      label: 'b',
    });
    const list = await service.listImports('TEST_IMPORTS_SVC_LIST');
    expect(list).toHaveLength(1);
    expect(list[0]!.label).toBe('a');
  });

  it('deletes an import and cascades rows + zip file', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await service.createImport({
      file: { originalname: 'x.zip', buffer: zip },
      envName: 'TEST_IMPORTS_SVC_DEL',
      label: 'x',
    });
    const imported = await prisma.importedComponent.findFirst({
      where: { importId: created.id },
    });
    expect(imported).not.toBeNull();
    const row = await prisma.import.findUnique({ where: { id: created.id } });
    const zipPath = row!.zipPath;
    expect(existsSync(zipPath)).toBe(true);

    await service.deleteImport(created.id);

    expect(existsSync(zipPath)).toBe(false);
    const orphan = await prisma.importedComponent.findFirst({
      where: { importId: created.id },
    });
    expect(orphan).toBeNull();
  });
});

describe('ImportsService.inspectBatch', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService,
        ZipExtractorService,
        CsvReaderService,
        XmlMadesParserService,
        ImportBuilderService,
        CsvPathReaderService,
        RawPersisterService,
        PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_INSPECT' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'TEST_INSPECT' } } });
    const { existsSync: fsExists, unlinkSync: fsUnlink } = await import('node:fs');
    for (const r of rows) {
      if (fsExists(r.zipPath)) { try { fsUnlink(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_INSPECT' } } });
  });

  it('inspects a real ENDPOINT fixture and returns HIGH confidence', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.dumpType).toBe('ENDPOINT');
    expect(result[0]!.confidence).toBe('HIGH');
    expect(result[0]!.sourceComponentEic).toBe('17V000000498771C');
    expect(result[0]!.sourceDumpTimestamp).toBe('2026-04-17T21:27:17.000Z');
    expect(result[0]!.duplicateOf).toBeNull();
    expect(result[0]!.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects duplicateOf when a matching import exists in the target env', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await service.createImport({
      file: { originalname: 'x.zip', buffer: zip },
      envName: 'TEST_INSPECT_DUP',
      label: 'original',
    });

    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      'TEST_INSPECT_DUP',
    );
    expect(result[0]!.duplicateOf).not.toBeNull();
    expect(result[0]!.duplicateOf!.importId).toBe(created.id);
    expect(result[0]!.duplicateOf!.label).toBe('original');
  });

  it('does not flag cross-env uploads as duplicates (env-scoped check)', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await service.createImport({
      file: { originalname: 'x.zip', buffer: zip },
      envName: 'TEST_INSPECT_CROSS_A',
      label: 'in env A',
    });

    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      'TEST_INSPECT_CROSS_B',
    );
    expect(result[0]!.duplicateOf).toBeNull();

    await prisma.import.deleteMany({ where: { envName: 'TEST_INSPECT_CROSS_A' } });
  });

  it('returns results for multiple files in a single call', async () => {
    const zipA = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipB = buildZipFromFixture(CD_FIXTURE);
    const result = await service.inspectBatch(
      [
        { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zipA },
        { originalname: '17V000002014106G_2026-04-17T22_11_50Z.zip', buffer: zipB },
      ],
      undefined,
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.dumpType).toBe('ENDPOINT');
    expect(result[1]!.dumpType).toBe('COMPONENT_DIRECTORY');
  });
});

describe('ImportsService.createImport — replaceImportId', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService,
        ZipExtractorService,
        CsvReaderService,
        XmlMadesParserService,
        ImportBuilderService,
        CsvPathReaderService,
        RawPersisterService,
        PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_REPLACE' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'TEST_REPLACE' } } });
    const { existsSync: fsExists, unlinkSync: fsUnlink } = await import('node:fs');
    for (const r of rows) {
      if (fsExists(r.zipPath)) { try { fsUnlink(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_REPLACE' } } });
  });

  it('deletes the old import and creates the new one', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const original = await service.createImport({
      file: { originalname: 'old.zip', buffer: zip },
      envName: 'TEST_REPLACE_OK',
      label: 'old label',
    });

    const replaced = await service.createImport({
      file: { originalname: 'new.zip', buffer: zip },
      envName: 'TEST_REPLACE_OK',
      label: 'new label',
      replaceImportId: original.id,
    });

    expect(replaced.id).not.toBe(original.id);
    expect(replaced.label).toBe('new label');

    const old = await prisma.import.findUnique({ where: { id: original.id } });
    expect(old).toBeNull();

    const list = await prisma.import.findMany({ where: { envName: 'TEST_REPLACE_OK' } });
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(replaced.id);
  });

  it('throws REPLACE_IMPORT_MISMATCH if replaceImportId is from another env', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const otherEnvImport = await service.createImport({
      file: { originalname: 'other.zip', buffer: zip },
      envName: 'TEST_REPLACE_OTHER',
      label: 'other env',
    });

    await expect(
      service.createImport({
        file: { originalname: 'x.zip', buffer: zip },
        envName: 'TEST_REPLACE_MAIN',
        label: 'x',
        replaceImportId: otherEnvImport.id,
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REPLACE_IMPORT_MISMATCH' }) });

    await prisma.import.deleteMany({ where: { envName: 'TEST_REPLACE_OTHER' } });
  });

  it('throws IMPORT_NOT_FOUND if replaceImportId does not exist', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await expect(
      service.createImport({
        file: { originalname: 'x.zip', buffer: zip },
        envName: 'TEST_REPLACE_MISSING',
        label: 'x',
        replaceImportId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'IMPORT_NOT_FOUND' }) });
  });
});
