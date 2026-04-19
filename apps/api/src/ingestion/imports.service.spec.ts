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
import { buildZipFromFixture, ENDPOINT_FIXTURE } from '../../test/fixtures-loader.js';

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
