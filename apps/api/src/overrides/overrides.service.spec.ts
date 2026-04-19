import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { OverridesService } from './overrides.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ImportsService } from '../ingestion/imports.service.js';
import { ZipExtractorService } from '../ingestion/zip-extractor.service.js';
import { CsvReaderService } from '../ingestion/csv-reader.service.js';
import { XmlMadesParserService } from '../ingestion/xml-mades-parser.service.js';
import { ImportBuilderService } from '../ingestion/import-builder.service.js';
import { CsvPathReaderService } from '../ingestion/csv-path-reader.service.js';
import { RawPersisterService } from '../ingestion/raw-persister.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from '../../test/fixtures-loader.js';

describe('OverridesService', () => {
  let service: OverridesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OverridesService, PrismaService, RegistryService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OverridesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  afterEach(async () => {
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  describe('upsert', () => {
    it('creates a new override row on first call', async () => {
      const result = await service.upsert('TEST_OV_A', { displayName: 'Test A', lat: 48.8, lng: 2.3 });
      expect(result.eic).toBe('TEST_OV_A');
      expect(result.displayName).toBe('Test A');
      expect(result.lat).toBe(48.8);
      expect(result.lng).toBe(2.3);
    });

    it('updates existing override on second call', async () => {
      await service.upsert('TEST_OV_B', { displayName: 'First' });
      const updated = await service.upsert('TEST_OV_B', { displayName: 'Second', country: 'FR' });
      expect(updated.displayName).toBe('Second');
      expect(updated.country).toBe('FR');
    });

    it('sets field to null explicitly', async () => {
      await service.upsert('TEST_OV_C', { displayName: 'Set', lat: 48 });
      const cleared = await service.upsert('TEST_OV_C', { lat: null });
      expect(cleared.lat).toBeNull();
      expect(cleared.displayName).toBe('Set');
    });
  });

  describe('delete', () => {
    it('removes an existing override', async () => {
      await service.upsert('TEST_OV_D', { displayName: 'To delete' });
      await service.delete('TEST_OV_D');
      const found = await prisma.componentOverride.findUnique({ where: { eic: 'TEST_OV_D' } });
      expect(found).toBeNull();
    });

    it('throws NotFoundException if override does not exist', async () => {
      await expect(service.delete('TEST_OV_UNKNOWN')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'OVERRIDE_NOT_FOUND' }),
      });
    });
  });
});

describe('listAdminComponents', () => {
  let service: OverridesService;
  let prisma: PrismaService;
  let imports: ImportsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OverridesService, ImportsService, PrismaService,
        ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService,
        RegistryService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OverridesService);
    prisma = moduleRef.get(PrismaService);
    imports = moduleRef.get(ImportsService);
    await prisma.import.deleteMany({ where: { envName: 'TEST_AC' } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'TEST_AC' } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: 'TEST_AC' } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  it('returns empty array when no imports exist', async () => {
    // Cleanup agressive pour ce test
    const fullCleanup = await prisma.import.findMany();
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of fullCleanup) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany();
    const list = await service.listAdminComponents();
    expect(list).toEqual([]);
  });

  it('returns one row per distinct EIC from imports', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_AC',
      label: 'fixture',
    });
    const list = await service.listAdminComponents();
    expect(list.length).toBeGreaterThan(0);
    const eics = list.map((r) => r.eic);
    expect(new Set(eics).size).toBe(eics.length);
    for (const row of list) {
      expect(row.current).toBeDefined();
      expect(row.current.displayName).toBeDefined();
      expect(row.importsCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('merges override into row.override field when override exists for EIC', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_AC',
      label: 'fixture',
    });
    const list0 = await service.listAdminComponents();
    const firstEic = list0[0]!.eic;
    await service.upsert(firstEic, { displayName: 'OverrideName', country: 'FR' });

    const list1 = await service.listAdminComponents();
    const row = list1.find((r) => r.eic === firstEic)!;
    expect(row.override).not.toBeNull();
    expect(row.override!.displayName).toBe('OverrideName');
    expect(row.override!.country).toBe('FR');
    expect(row.current.displayName).toBe('OverrideName');  // cascade applied
  });
});
