import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import {
  buildZipFromFixture,
  ENDPOINT_FIXTURE,
  CD_FIXTURE,
  readFixtureProperties,
} from './fixtures-loader.js';

const TEST_ENV = 'INTEG_OPF_V2';

describe('Full ingestion v2 (integration)', () => {
  let imports: ImportsService;
  let graph: GraphService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    graph = app.get(GraphService);
    prisma = app.get(PrismaService);

    // Clean up any leftover rows from a previous failed run
    await prisma.import.deleteMany({ where: { envName: TEST_ENV } });
  }, 60_000);

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: TEST_ENV } });
    for (const r of rows) {
      if (existsSync(r.zipPath)) {
        try { unlinkSync(r.zipPath); } catch { /* best effort */ }
      }
    }
    await prisma.import.deleteMany({ where: { envName: TEST_ENV } });
  }, 60_000);

  it('uploads 2 fixtures into the same env and aggregates the graph', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipCd = buildZipFromFixture(CD_FIXTURE);

    const d1 = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
      envName: TEST_ENV,
      label: 'endpoint-fixture',
    });
    const d2 = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
      envName: TEST_ENV,
      label: 'cd-fixture',
    });

    expect(d1.id).toBeTruthy();
    expect(d2.id).toBeTruthy();

    const g = await graph.getGraph(TEST_ENV);

    // At least the endpoint fixture produces nodes
    expect(g.nodes.length).toBeGreaterThanOrEqual(1);

    // No duplicate EICs in nodes — cascade+merge must produce one node per unique EIC
    const eics = new Set(g.nodes.map((n) => n.eic));
    expect(eics.size).toBe(g.nodes.length);

    // Bounds must be coherent (north > south, east > west)
    expect(g.bounds.north).toBeGreaterThan(g.bounds.south);
    expect(g.bounds.east).toBeGreaterThan(g.bounds.west);

    // Slice 2j : projectName du dump endpoint PRFRI-EP2 doit remonter sur le node source.
    // ecp.projectName dans 17V000000498771C/application_property.csv vaut "INTERNET-EP2".
    const endpointNode = g.nodes.find((n) => n.eic === '17V000000498771C');
    expect(endpointNode).toBeDefined();
    expect(endpointNode!.projectName).toBe('INTERNET-EP2');
    expect(endpointNode!.displayName).toBe('INTERNET-EP2');
    expect(endpointNode!.envName).toBe(TEST_ENV);

    // Slice 2j : projectName du CD PRFRI-CD1 = "INTERNET-CD" (dans application_property.csv).
    const cdNode = g.nodes.find((n) => n.eic === '17V000002014106G');
    expect(cdNode).toBeDefined();
    expect(cdNode!.projectName).toBe('INTERNET-CD');

    // Les autres nodes (vus via XML dans le dump EP2) n'ont pas leur projectName
    // puisqu'ils n'ont pas fait l'objet d'un dump dédié : projectName = null.
    const otherNode = g.nodes.find(
      (n) => n.eic !== '17V000000498771C' && n.eic !== '17V000002014106G',
    );
    if (otherNode) expect(otherNode.projectName).toBeNull();

    // At least 2 imports listed for this env
    const list = await imports.listImports(TEST_ENV);
    expect(list).toHaveLength(2);
  }, 30_000);

  it('list of envs includes TEST_ENV after the imports', async () => {
    const envs = await prisma.import.findMany({
      distinct: ['envName'],
      select: { envName: true },
    });
    expect(envs.map((e) => e.envName)).toContain(TEST_ENV);
  });

  it('slice 2i : accepte un .properties externe et marque hasConfigurationProperties=true', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const properties = readFixtureProperties(ENDPOINT_FIXTURE);
    const propsEnv = 'INTEG_PROPS_V2';

    try {
      const detail = await imports.createImport({
        file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
        envName: propsEnv,
        label: 'ep with properties',
        configurationProperties: {
          originalname: '17V000000498771C-configuration.properties',
          buffer: properties,
        },
      });

      expect(detail.hasConfigurationProperties).toBe(true);
      // Pas de warning CONFIGURATION_PROPERTIES_MISSING attendu
      expect(detail.warnings.some((w) => w.code === 'CONFIGURATION_PROPERTIES_MISSING')).toBe(false);

      // Les clés du .properties externe sont persistées dans ImportedAppProperty
      // (après filtrage des clés sensibles).
      const props = await prisma.importedAppProperty.findMany({
        where: { importId: detail.id },
      });
      const keys = new Set(props.map((p) => p.key));
      expect(keys.has('ecp.projectName')).toBe(true);
      expect(keys.has('ecp.envName')).toBe(true);
      expect(keys.has('ecp.directory.client.synchronization.homeComponentDirectoryPrimaryUrl')).toBe(true);
    } finally {
      const rows = await prisma.import.findMany({ where: { envName: propsEnv } });
      for (const r of rows) {
        if (existsSync(r.zipPath)) {
          try { unlinkSync(r.zipPath); } catch { /* best effort */ }
        }
      }
      await prisma.import.deleteMany({ where: { envName: propsEnv } });
    }
  }, 30_000);

  it('slice 2i : sans .properties, ajoute le warning CONFIGURATION_PROPERTIES_MISSING', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const envLegacy = 'INTEG_PROPS_LEGACY';
    try {
      const detail = await imports.createImport({
        file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
        envName: envLegacy,
        label: 'legacy without properties',
      });
      expect(detail.hasConfigurationProperties).toBe(false);
      expect(
        detail.warnings.some((w) => w.code === 'CONFIGURATION_PROPERTIES_MISSING'),
      ).toBe(true);
    } finally {
      const rows = await prisma.import.findMany({ where: { envName: envLegacy } });
      for (const r of rows) {
        if (existsSync(r.zipPath)) {
          try { unlinkSync(r.zipPath); } catch { /* best effort */ }
        }
      }
      await prisma.import.deleteMany({ where: { envName: envLegacy } });
    }
  }, 30_000);
});
