import { describe, it, expect } from 'vitest';
import type { GraphEdge } from '@carto-ecp/shared';
import { buildInterlocutorsByEic } from './build-interlocutors.js';

const businessEdge = (overrides: Partial<GraphEdge>): GraphEdge => ({
  id: 'edge-' + Math.random().toString(36).slice(2),
  kind: 'BUSINESS',
  fromEic: 'A',
  toEic: 'B',
  direction: 'OUT',
  process: 'CORE',
  messageTypes: ['CORE-FB-A16A48'],
  transportPatterns: ['INDIRECT'],
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
  validFrom: new Date(0).toISOString(),
  validTo: null,
  peering: null,
  ...overrides,
});

describe('buildInterlocutorsByEic', () => {
  it('Map vide si aucune edge', () => {
    const out = buildInterlocutorsByEic([]);
    expect(out.size).toBe(0);
  });

  it('noeud A avec 1 edge OUT vers B : A a B en OUT, B a A en IN', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', messageTypes: ['CGM'] }),
    ]);
    expect(out.get('A')).toEqual([
      { eic: 'B', messageTypes: ['CGM'], direction: 'OUT' },
    ]);
    expect(out.get('B')).toEqual([
      { eic: 'A', messageTypes: ['CGM'], direction: 'IN' },
    ]);
  });

  it('2 edges A-B bidirectionnelles : les deux noeuds se voient en BIDI, messageTypes unis tries', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', messageTypes: ['CGM', 'RSMD'] }),
      businessEdge({ fromEic: 'B', toEic: 'A', messageTypes: ['ACK', 'CGM'] }),
    ]);
    expect(out.get('A')).toEqual([
      { eic: 'B', messageTypes: ['ACK', 'CGM', 'RSMD'], direction: 'BIDI' },
    ]);
    expect(out.get('B')).toEqual([
      { eic: 'A', messageTypes: ['ACK', 'CGM', 'RSMD'], direction: 'BIDI' },
    ]);
  });

  it('noeud X avec 3 interlocuteurs : tri BIDI > OUT > IN', () => {
    // X OUT vers A, X IN depuis B, X BIDI avec C
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'B', toEic: 'X', messageTypes: ['T2'] }),
      businessEdge({ fromEic: 'X', toEic: 'C', messageTypes: ['T3'] }),
      businessEdge({ fromEic: 'C', toEic: 'X', messageTypes: ['T4'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['C', 'A', 'B']);
    expect(xList[0]!.direction).toBe('BIDI');
    expect(xList[1]!.direction).toBe('OUT');
    expect(xList[2]!.direction).toBe('IN');
  });

  it('tri secondaire : nombre de messageTypes decroissant entre 2 OUT', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'X', toEic: 'B', messageTypes: ['T1', 'T2', 'T3', 'T4', 'T5'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['B', 'A']);
  });

  it('tri tertiaire : EIC croissant pour les ex-aequo', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'Z', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['A', 'Z']);
  });

  it('ignore les PEERING edges', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', kind: 'PEERING' }),
    ]);
    expect(out.size).toBe(0);
  });

  it('un noeud ne peut pas etre son propre interlocuteur (self-edge ignoree)', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'A', messageTypes: ['T1'] }),
    ]);
    expect(out.get('A') ?? []).toEqual([]);
  });
});
