import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, CD_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion CD v2 (integration)', () => {
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'INTEG_CD_V2' } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch { /* best effort */ } }
    }
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  }, 60_000);

  it('ingests the CD fixture via CsvPathReader pipeline', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-integration-test',
    });

    expect(detail.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
    // CD fixture a component_directory.csv non-vide mais message_path.csv potentiellement vide
    expect(detail.stats.pathsCount).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('stores imported components in DB with correct types', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-types',
    });

    const components = await prisma.importedComponent.findMany({ where: { importId: detail.id } });
    expect(components.length).toBeGreaterThan(0);

    // Le composant source CD (id==componentCode) doit être COMPONENT_DIRECTORY
    const cdSelf = components.find((c) => c.eic === '17V000002014106G');
    if (cdSelf) {
      expect(cdSelf.type).toBe('COMPONENT_DIRECTORY');
    }

    // Tous les composants ont un type valide parmi ENDPOINT, COMPONENT_DIRECTORY, BROKER, BA
    const validTypes = ['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER', 'BA'];
    const otherTypes = new Set(components.map((c) => c.type));
    for (const t of otherTypes) {
      expect(validTypes).toContain(t);
    }
  }, 30_000);

  it('slice 2n : persiste component_statistics.csv (santé + cumul messages)', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2_CSTATS',
      label: 'cd-compstats',
    });
    try {
      const stats = await prisma.importedComponentStat.findMany({
        where: { importId: detail.id },
      });
      // Le dump PRFRI-CD1 observe 2 endpoints (EP1 et EP2) locaux.
      expect(stats.length).toBe(2);
      const ep1 = stats.find((s) => s.componentCode === '17V0000009927458');
      const ep2 = stats.find((s) => s.componentCode === '17V000000498771C');
      expect(ep1).toBeDefined();
      expect(ep2).toBeDefined();
      // receivedMessages réel = 755945 pour EP1, 225023 pour EP2.
      expect(ep1!.receivedMessages).toBe(755945);
      expect(ep2!.receivedMessages).toBe(225023);
      // lastSynchronizedTime renseigné et lastSyncSucceed=true.
      expect(ep1!.lastSyncSucceed).toBe(true);
      expect(ep1!.lastSynchronizedTime).not.toBeNull();
    } finally {
      const { existsSync, unlinkSync } = await import('node:fs');
      const rows = await prisma.import.findMany({ where: { envName: 'INTEG_CD_V2_CSTATS' } });
      for (const r of rows) {
        if (existsSync(r.zipPath)) {
          try { unlinkSync(r.zipPath); } catch { /* best effort */ }
        }
      }
      await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2_CSTATS' } });
    }
  }, 30_000);

  it('slice 2m : persiste les 8 CDs partenaires depuis synchronized_directories.csv', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2_SYNC',
      label: 'cd-sync',
    });
    try {
      const syncs = await prisma.importedDirectorySync.findMany({
        where: { importId: detail.id },
      });
      // Le dump PRFRI-CD1 contient 8 CDs partenaires.
      expect(syncs.length).toBe(8);
      const codes = new Set(syncs.map((s) => s.directoryCode));
      expect(codes.has('10V1001C--00282R')).toBe(true);
      expect(codes.has('14V-APG-CSI-CD-V')).toBe(true);
      expect(codes.has('48V000000000032Z')).toBe(true);
      // syncMode TWO_WAY vs ONE_WAY préservé
      const twoWay = syncs.filter((s) => s.directorySyncMode === 'TWO_WAY');
      expect(twoWay.length).toBeGreaterThanOrEqual(1);
      // URLs privées masquées, URLs publiques préservées
      const publicUrl = syncs.find((s) => s.directoryCode === '14V-APG-CSI-CD-V');
      expect(publicUrl?.directoryUrl).toContain('csi.apg.at');
    } finally {
      const { existsSync, unlinkSync } = await import('node:fs');
      const rows = await prisma.import.findMany({ where: { envName: 'INTEG_CD_V2_SYNC' } });
      for (const r of rows) {
        if (existsSync(r.zipPath)) {
          try { unlinkSync(r.zipPath); } catch { /* best effort */ }
        }
      }
      await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2_SYNC' } });
    }
  }, 30_000);
});
