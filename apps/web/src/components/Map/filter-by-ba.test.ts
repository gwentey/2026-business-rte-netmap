import { describe, it, expect } from 'vitest';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { filterGraphByBa } from './filter-by-ba';

const node = (overrides: Partial<GraphNode>): GraphNode => ({
  id: overrides.eic ?? 'n',
  eic: overrides.eic ?? 'n',
  kind: 'RTE_ENDPOINT',
  displayName: overrides.eic ?? 'n',
  projectName: null,
  envName: 'X',
  organization: 'RTE',
  personName: null,
  email: null,
  phone: null,
  homeCdCode: null,
  status: null,
  appTheme: null,
  lastSync: null,
  sentMessages: null,
  receivedMessages: null,
  uploadTargets: [],
  interlocutors: [],
  businessApplications: [],
  country: 'FR',
  lat: 48,
  lng: 2,
  isDefaultPosition: false,
  networks: [],
  process: null,
  urls: [],
  creationTs: '2026-01-01T00:00:00Z',
  modificationTs: '2026-01-01T00:00:00Z',
  ...overrides,
});

const edge = (overrides: Partial<GraphEdge>): GraphEdge => ({
  id: overrides.id ?? 'e',
  kind: 'BUSINESS',
  fromEic: overrides.fromEic ?? 'A',
  toEic: overrides.toEic ?? 'B',
  direction: 'OUT',
  process: 'CORE',
  messageTypes: [],
  transportPatterns: [],
  intermediateBrokerEic: null,
  activity: {
    connectionStatus: null,
    lastMessageUp: null,
    lastMessageDown: null,
    isRecent: false,
    sumMessagesUp: 0,
    sumMessagesDown: 0,
    totalVolume: 0,
  },
  validFrom: '2026-01-01T00:00:00Z',
  validTo: null,
  peering: null,
  ...overrides,
});

describe('filterGraphByBa', () => {
  it('retourne tout quand aucune BA selectionnee', () => {
    const nodes = [node({ eic: 'A' }), node({ eic: 'B' })];
    const edges = [edge({ id: 'e1', fromEic: 'A', toEic: 'B' })];
    const out = filterGraphByBa(nodes, edges, []);
    expect(out.nodes).toHaveLength(2);
    expect(out.edges).toHaveLength(1);
  });

  it('garde seulement les endpoints RTE qui portent une BA selectionnee', () => {
    const nodes = [
      node({ eic: 'RTE1', businessApplications: [{ code: 'OCAPPI', criticality: 'P1' }] }),
      node({ eic: 'RTE2', businessApplications: [{ code: 'PLANET', criticality: 'P2' }] }),
    ];
    const out = filterGraphByBa(nodes, [], ['OCAPPI']);
    expect(out.nodes.map((n) => n.eic)).toEqual(['RTE1']);
  });

  it('inclut les externes connectes a une ancre via une edge BUSINESS', () => {
    const nodes = [
      node({ eic: 'RTE1', businessApplications: [{ code: 'OCAPPI', criticality: 'P1' }] }),
      node({ eic: 'EXT', kind: 'EXTERNAL_ENDPOINT', businessApplications: [] }),
      node({ eic: 'ORPHAN', kind: 'EXTERNAL_ENDPOINT', businessApplications: [] }),
    ];
    const edges = [
      edge({ id: 'e1', fromEic: 'RTE1', toEic: 'EXT' }),
    ];
    const out = filterGraphByBa(nodes, edges, ['OCAPPI']);
    expect(out.nodes.map((n) => n.eic).sort()).toEqual(['EXT', 'RTE1']);
    expect(out.edges).toHaveLength(1);
  });

  it('ignore les edges PEERING pour determiner les contacts', () => {
    const nodes = [
      node({ eic: 'RTE1', businessApplications: [{ code: 'OCAPPI', criticality: 'P1' }] }),
      node({ eic: 'CD_EXT', kind: 'EXTERNAL_CD', businessApplications: [] }),
    ];
    const edges = [edge({ id: 'e1', kind: 'PEERING', fromEic: 'RTE1', toEic: 'CD_EXT' })];
    const out = filterGraphByBa(nodes, edges, ['OCAPPI']);
    // CD_EXT n'est PAS un contact BUSINESS, donc exclu
    expect(out.nodes.map((n) => n.eic)).toEqual(['RTE1']);
    expect(out.edges).toHaveLength(0);
  });

  it('multi-BA : union des ancres', () => {
    const nodes = [
      node({ eic: 'RTE1', businessApplications: [{ code: 'OCAPPI', criticality: 'P1' }] }),
      node({ eic: 'RTE2', businessApplications: [{ code: 'PLANET', criticality: 'P2' }] }),
      node({ eic: 'RTE3', businessApplications: [{ code: 'KIWI', criticality: 'P3' }] }),
    ];
    const out = filterGraphByBa(nodes, [], ['OCAPPI', 'PLANET']);
    expect(out.nodes.map((n) => n.eic).sort()).toEqual(['RTE1', 'RTE2']);
  });

  it('edge visible seulement si les deux extremites sont visibles', () => {
    const nodes = [
      node({ eic: 'RTE1', businessApplications: [{ code: 'OCAPPI', criticality: 'P1' }] }),
      node({ eic: 'EXT1', kind: 'EXTERNAL_ENDPOINT', businessApplications: [] }),
      node({ eic: 'EXT2', kind: 'EXTERNAL_ENDPOINT', businessApplications: [] }),
    ];
    const edges = [
      edge({ id: 'e1', fromEic: 'RTE1', toEic: 'EXT1' }),
      edge({ id: 'e2', fromEic: 'EXT1', toEic: 'EXT2' }),
    ];
    const out = filterGraphByBa(nodes, edges, ['OCAPPI']);
    // RTE1 + EXT1 visibles. EXT2 n'est PAS contact d'une ancre => invisible.
    // edge e2 doit etre filtree (EXT2 invisible)
    expect(out.nodes.map((n) => n.eic).sort()).toEqual(['EXT1', 'RTE1']);
    expect(out.edges.map((e) => e.id)).toEqual(['e1']);
  });
});
