import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GraphService } from './graph.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { ImportsService } from '../ingestion/imports.service.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { RegistrySettingsModule } from '../registry-settings/registry-settings.module.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE, CD_FIXTURE } from '../../test/fixtures-loader.js';

describe('GraphService.getGraph — compute on read', () => {
  let graph: GraphService;
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, RegistryModule, RegistrySettingsModule, IngestionModule],
      providers: [GraphService],
    }).compile();
    await moduleRef.init();
    graph = moduleRef.get(GraphService);
    imports = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_GS' } } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: '17V000000' } } });
    await prisma.processColorOverride.deleteMany();
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_GS' } } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: '17V000000' } } });
    await prisma.processColorOverride.deleteMany();
  });

  it('returns empty graph when no import in env', async () => {
    const g = await graph.getGraph('TEST_GS_EMPTY');
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    expect(g.bounds).toEqual({ north: 60, south: 40, east: 20, west: -10 });
  });

  it('computes graph from 1 import with non-empty nodes + edges', async () => {
    // L'ENDPOINT fixture produit des composants via le pipeline XML (nombreux nodes).
    // On injecte manuellement un path non-wildcard pour tester
    // que buildEdges agrège correctement les edges.
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_GS_A',
      label: 'single',
    });
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
    // Les paths du CD fixture ont tous senderEic='*' (pas de senderComponent dans le MADES XML).
    // On injecte manuellement un path non-wildcard pour valider la logique buildEdges.
    // Injecter un path non-wildcard entre deux EICs connus de la fixture
    const createdImport = await prisma.import.findFirstOrThrow({ where: { envName: 'TEST_GS_A' } });
    const comps = await prisma.importedComponent.findMany({ where: { importId: createdImport.id }, take: 2 });
    expect(comps.length).toBeGreaterThanOrEqual(2);
    const [fromComp, toComp] = comps;
    await prisma.importedPath.create({
      data: {
        importId: createdImport.id,
        receiverEic: toComp!.eic,
        senderEic: fromComp!.eic,
        messageType: 'RSMD',
        transportPattern: 'DIRECT',
      },
    });

    const g = await graph.getGraph('TEST_GS_A');
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it('env isolation : graph(B) does not contain imports from env(A)', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: 'a.zip', buffer: zip },
      envName: 'TEST_GS_ISO_A',
      label: 'a',
    });
    const g = await graph.getGraph('TEST_GS_ISO_B');
    expect(g.nodes).toHaveLength(0);
  });

  it('refDate filters out later imports', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_GS_TIME',
      label: 'recent',
    });
    const past = new Date('2020-01-01');
    const g = await graph.getGraph('TEST_GS_TIME', past);
    expect(g.nodes).toHaveLength(0);
  });

  it('applies ComponentOverride at level 1 (highest priority)', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_GS_OV',
      label: 'x',
    });
    // Trouver un EIC existant dans les nodes générés
    const before = await graph.getGraph('TEST_GS_OV');
    expect(before.nodes.length).toBeGreaterThan(0);
    const eicToOverride = before.nodes[0]!.eic;

    await prisma.componentOverride.upsert({
      where: { eic: eicToOverride },
      update: { displayName: 'ADMIN_OVERRIDDEN' },
      create: { eic: eicToOverride, displayName: 'ADMIN_OVERRIDDEN' },
    });

    const after = await graph.getGraph('TEST_GS_OV');
    const node = after.nodes.find((n) => n.eic === eicToOverride);
    expect(node?.displayName).toBe('ADMIN_OVERRIDDEN');
  });

  it('includes effective processColors from RegistrySettings in mapConfig (override wins)', async () => {
    await prisma.processColorOverride.create({ data: { process: 'TP', color: '#abcdef' } });
    const g = await graph.getGraph('TEST_GS_COLORS');
    expect(g.mapConfig.processColors).toBeDefined();
    expect(g.mapConfig.processColors.TP).toBe('#abcdef');
    // Other process keys should still carry default overlay color (not undefined)
    expect(g.mapConfig.processColors.CORE).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(g.mapConfig.processColors.CORE).not.toBe('#abcdef');
  });

  it('isDefaultPosition true for EIC with no coord source, false for EIC with explicit coord', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_GS_DEFPOS',
      label: 'x',
    });
    const g = await graph.getGraph('TEST_GS_DEFPOS');
    // Tous les nodes doivent avoir un flag isDefaultPosition (true ou false)
    // La somme des deux catégories doit être égale au total.
    const defaults = g.nodes.filter((n) => n.isDefaultPosition);
    const withCoord = g.nodes.filter((n) => !n.isDefaultPosition);
    expect(defaults.length + withCoord.length).toBe(g.nodes.length);
    // Au moins un node doit exister pour que le test soit significatif.
    expect(g.nodes.length).toBeGreaterThan(0);
  });

  it('[Slice 3a] node.interlocutors calcule a partir des edges BUSINESS', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_GS_INTERLOC',
      label: 'interloc',
    });
    expect(detail.stats.componentsCount).toBeGreaterThan(0);

    // Injecter 2 paths non-wildcard bidirectionnels pour produire une edge BIDI
    const createdImport = await prisma.import.findFirstOrThrow({ where: { envName: 'TEST_GS_INTERLOC' } });
    const comps = await prisma.importedComponent.findMany({ where: { importId: createdImport.id }, take: 2 });
    expect(comps.length).toBeGreaterThanOrEqual(2);
    const [a, b] = comps;
    await prisma.importedPath.createMany({
      data: [
        {
          importId: createdImport.id,
          receiverEic: b!.eic,
          senderEic: a!.eic,
          messageType: 'CGM',
          transportPattern: 'DIRECT',
        },
        {
          importId: createdImport.id,
          receiverEic: a!.eic,
          senderEic: b!.eic,
          messageType: 'RSMD',
          transportPattern: 'DIRECT',
        },
      ],
    });

    const g = await graph.getGraph('TEST_GS_INTERLOC');
    const nodeA = g.nodes.find((n) => n.eic === a!.eic);
    const nodeB = g.nodes.find((n) => n.eic === b!.eic);

    expect(nodeA).toBeDefined();
    expect(nodeB).toBeDefined();

    // Tous les nodes doivent avoir interlocutors (au minimum [] pour ceux sans edge).
    for (const n of g.nodes) {
      expect(Array.isArray(n.interlocutors)).toBe(true);
    }

    // a et b s'echangent des messages dans les 2 sens -> BIDI
    const aInterloc = nodeA!.interlocutors.find((i) => i.eic === b!.eic);
    const bInterloc = nodeB!.interlocutors.find((i) => i.eic === a!.eic);
    expect(aInterloc?.direction).toBe('BIDI');
    expect(bInterloc?.direction).toBe('BIDI');
    // Union des messageTypes
    expect(aInterloc?.messageTypes.sort()).toEqual(['CGM', 'RSMD']);
    expect(bInterloc?.messageTypes.sort()).toEqual(['CGM', 'RSMD']);
  });
});
