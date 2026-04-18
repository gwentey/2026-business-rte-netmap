import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { GraphService } from './graph.service.js';
import type { Component, MessagePath, MessagingStatistic, Snapshot } from '@prisma/client';

function makeComponent(overrides: Partial<Component>): Component {
  return {
    id: overrides.id ?? 'c1',
    snapshotId: overrides.snapshotId ?? 's1',
    eic: overrides.eic ?? 'EIC1',
    type: overrides.type ?? 'ENDPOINT',
    organization: overrides.organization ?? 'RTE',
    personName: overrides.personName ?? null,
    email: overrides.email ?? null,
    phone: overrides.phone ?? null,
    homeCdCode: overrides.homeCdCode ?? '',
    networksCsv: overrides.networksCsv ?? 'internet',
    creationTs: overrides.creationTs ?? new Date('2025-01-01'),
    modificationTs: overrides.modificationTs ?? new Date('2025-01-01'),
    displayName: overrides.displayName ?? 'X',
    country: overrides.country ?? 'FR',
    lat: overrides.lat ?? 48.9,
    lng: overrides.lng ?? 2.2,
    isDefaultPosition: overrides.isDefaultPosition ?? false,
    process: overrides.process ?? null,
    sourceType: overrides.sourceType ?? 'XML_CD',
  };
}

function makeMessagePath(overrides: Partial<MessagePath>): MessagePath {
  return {
    id: overrides.id ?? 'p1',
    snapshotId: overrides.snapshotId ?? 's1',
    receiverEic: overrides.receiverEic ?? 'EIC1',
    senderEicOrWildcard: overrides.senderEicOrWildcard ?? '*',
    messageType: overrides.messageType ?? 'RSMD',
    transportPattern: overrides.transportPattern ?? 'DIRECT',
    intermediateBrokerEic: overrides.intermediateBrokerEic ?? null,
    validFrom: overrides.validFrom ?? new Date('2025-01-01'),
    validTo: overrides.validTo ?? null,
    process: overrides.process ?? 'VP',
    direction: overrides.direction ?? 'IN',
    source: overrides.source ?? 'XML_CD_PATHS',
    isExpired: overrides.isExpired ?? false,
  };
}

describe('GraphService', () => {
  let service: GraphService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      providers: [
        GraphService,
        RegistryService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    service = ref.get(GraphService);
    await ref.get(RegistryService).onModuleInit();
  });

  it('aggregates 2 paths with same process into 1 edge', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A', displayName: 'A' }),
      makeComponent({ eic: 'B', displayName: 'B' }),
    ];
    const paths = [
      makeMessagePath({ receiverEic: 'A', messageType: 'RSMD', process: 'VP', senderEicOrWildcard: 'B' }),
      makeMessagePath({ receiverEic: 'A', messageType: 'CAPVP', process: 'VP', senderEicOrWildcard: 'B' }),
    ];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.process).toBe('VP');
    expect(graph.edges[0]!.messageTypes.sort()).toEqual(['CAPVP', 'RSMD']);
  });

  it('skips paths where sender or receiver is a wildcard', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [makeComponent({ eic: 'A' })];
    const paths = [makeMessagePath({ receiverEic: 'A', senderEicOrWildcard: '*' })];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(0);
  });

  it('marks edge as MIXTE when multiple processes coexist for same pair', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A' }),
      makeComponent({ eic: 'B' }),
    ];
    const paths = [
      makeMessagePath({ receiverEic: 'A', messageType: 'RSMD', process: 'VP', senderEicOrWildcard: 'B' }),
      makeMessagePath({ receiverEic: 'A', messageType: 'CGM', process: 'CORE', senderEicOrWildcard: 'B' }),
    ];
    const graph = service.buildGraph(snap, components, paths, []);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]!.process).toBe('MIXTE');
  });

  it('sets isRecent=true when lastMessageUp is within 24h of snapshot date', () => {
    const snapDate = new Date('2026-04-17T12:00:00.000Z');
    const snap = { id: 's1', uploadedAt: snapDate } as Snapshot;
    const components = [makeComponent({ eic: 'A' }), makeComponent({ eic: 'B' })];
    const paths = [makeMessagePath({ receiverEic: 'A', senderEicOrWildcard: 'B' })];
    const stats: MessagingStatistic[] = [
      {
        id: 's1-stat',
        snapshotId: 's1',
        sourceEndpointCode: 'A',
        remoteComponentCode: 'B',
        connectionStatus: 'CONNECTED',
        lastMessageUp: new Date('2026-04-17T08:00:00.000Z'),
        lastMessageDown: null,
        sumMessagesUp: 10,
        sumMessagesDown: 0,
        deleted: false,
      },
    ];
    const graph = service.buildGraph(snap, components, paths, stats);
    expect(graph.edges[0]!.activity.isRecent).toBe(true);
  });

  it('computes bounds from component positions with padding', () => {
    const snap = { id: 's1', uploadedAt: new Date() } as Snapshot;
    const components = [
      makeComponent({ eic: 'A', lat: 48.9, lng: 2.2 }),
      makeComponent({ eic: 'B', lat: 41.9, lng: 12.5 }),
    ];
    const graph = service.buildGraph(snap, components, [], []);
    expect(graph.bounds.north).toBeGreaterThanOrEqual(48.9);
    expect(graph.bounds.south).toBeLessThanOrEqual(41.9);
    expect(graph.bounds.east).toBeGreaterThanOrEqual(12.5);
    expect(graph.bounds.west).toBeLessThanOrEqual(2.2);
  });
});
