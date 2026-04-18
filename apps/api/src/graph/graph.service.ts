import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

const DEFAULT_ISRECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function parseThreshold(): number {
  const raw = process.env.ISRECENT_THRESHOLD_MS;
  if (!raw) return DEFAULT_ISRECENT_THRESHOLD_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ISRECENT_THRESHOLD_MS;
}

import type {
  GraphBounds,
  GraphEdge,
  GraphNode,
  GraphResponse,
  NodeKind,
  ProcessKey,
} from '@carto-ecp/shared';
import type { Component, MessagePath, MessagingStatistic, Snapshot } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';

@Injectable()
export class GraphService {
  private readonly isRecentThreshold = parseThreshold();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async getGraph(snapshotId: string): Promise<GraphResponse> {
    const snapshot = await this.prisma.snapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new SnapshotNotFoundException(snapshotId);

    const [components, paths, stats] = await Promise.all([
      this.prisma.component.findMany({
        where: { snapshotId },
        include: { urls: true },
      }),
      this.prisma.messagePath.findMany({ where: { snapshotId } }),
      this.prisma.messagingStatistic.findMany({ where: { snapshotId } }),
    ]);

    return this.buildGraph(snapshot, components, paths, stats);
  }

  buildGraph(
    snapshot: Snapshot,
    components: (Component & { urls?: { network: string; url: string }[] })[],
    paths: MessagePath[],
    stats: MessagingStatistic[],
  ): GraphResponse {
    const nodes = components.map((c) => this.toNode(c));
    const statKey = (source: string, remote: string) => `${source}::${remote}`;
    const statsMap = new Map<string, MessagingStatistic>();
    for (const s of stats) {
      statsMap.set(statKey(s.sourceEndpointCode, s.remoteComponentCode), s);
    }

    type Group = {
      fromEic: string;
      toEic: string;
      direction: 'IN' | 'OUT';
      processes: Set<ProcessKey>;
      messageTypes: Set<string>;
      transports: Set<'DIRECT' | 'INDIRECT'>;
      intermediateBroker: string | null;
      validFrom: Date | null;
      validTo: Date | null;
    };
    const groups = new Map<string, Group>();

    for (const p of paths) {
      const fromEic = p.direction === 'IN' ? p.senderEicOrWildcard : p.receiverEic;
      const toEic = p.direction === 'IN' ? p.receiverEic : p.senderEicOrWildcard;
      if (fromEic === '*' || toEic === '*') continue;
      const key = `${fromEic}::${toEic}`;
      const existing = groups.get(key);
      const process = p.process as ProcessKey;
      if (existing) {
        existing.processes.add(process);
        existing.messageTypes.add(p.messageType);
        existing.transports.add(p.transportPattern as 'DIRECT' | 'INDIRECT');
      } else {
        groups.set(key, {
          fromEic,
          toEic,
          direction: p.direction as 'IN' | 'OUT',
          processes: new Set([process]),
          messageTypes: new Set([p.messageType]),
          transports: new Set([p.transportPattern as 'DIRECT' | 'INDIRECT']),
          intermediateBroker: p.intermediateBrokerEic,
          validFrom: p.validFrom,
          validTo: p.validTo,
        });
      }
    }

    const edges: GraphEdge[] = Array.from(groups.values()).map((g) => {
      const processes = Array.from(g.processes);
      const process: ProcessKey = processes.length > 1 ? 'MIXTE' : (processes[0] ?? 'UNKNOWN');
      const hash = createHash('sha1')
        .update(`${g.fromEic}|${g.toEic}|${process}`)
        .digest('hex')
        .slice(0, 16);
      const stat =
        statsMap.get(statKey(g.fromEic, g.toEic)) ??
        statsMap.get(statKey(g.toEic, g.fromEic)) ??
        null;
      const snapshotTime = snapshot.uploadedAt.getTime();
      const isRecent =
        stat?.lastMessageUp != null &&
        snapshotTime - stat.lastMessageUp.getTime() < this.isRecentThreshold &&
        snapshotTime - stat.lastMessageUp.getTime() >= 0;

      return {
        id: hash,
        fromEic: g.fromEic,
        toEic: g.toEic,
        direction: g.direction,
        process,
        messageTypes: Array.from(g.messageTypes),
        transportPatterns: Array.from(g.transports),
        intermediateBrokerEic: g.intermediateBroker,
        activity: {
          connectionStatus: stat?.connectionStatus ?? null,
          lastMessageUp: stat?.lastMessageUp?.toISOString() ?? null,
          lastMessageDown: stat?.lastMessageDown?.toISOString() ?? null,
          isRecent: Boolean(isRecent),
        },
        validFrom: (g.validFrom ?? new Date(0)).toISOString(),
        validTo: g.validTo?.toISOString() ?? null,
      };
    });

    return { bounds: this.computeBounds(nodes), nodes, edges, mapConfig: this.registry.getMapConfig() };
  }

  private toNode(
    c: Component & { urls?: { network: string; url: string }[] },
  ): GraphNode {
    return {
      id: c.eic,
      eic: c.eic,
      kind: this.kindOf(c),
      displayName: c.displayName,
      organization: c.organization,
      country: c.country,
      lat: c.lat,
      lng: c.lng,
      isDefaultPosition: c.isDefaultPosition,
      networks: c.networksCsv ? c.networksCsv.split(',') : [],
      process: c.process as ProcessKey | null,
      urls: (c.urls ?? []).map((u) => ({ network: u.network, url: u.url })),
      creationTs: (c.creationTs ?? new Date(0)).toISOString(),
      modificationTs: (c.modificationTs ?? new Date(0)).toISOString(),
    };
  }

  private kindOf(c: Component): NodeKind {
    const isRte = c.organization === 'RTE' && c.eic.startsWith('17V');
    if (c.type === 'BROKER') return 'BROKER';
    if (c.type === 'COMPONENT_DIRECTORY') return isRte ? 'RTE_CD' : 'EXTERNAL_CD';
    return isRte ? 'RTE_ENDPOINT' : 'EXTERNAL_ENDPOINT';
  }

  private computeBounds(nodes: GraphNode[]): GraphBounds {
    if (nodes.length === 0) {
      return { north: 60, south: 40, east: 20, west: -10 };
    }
    let north = -90, south = 90, east = -180, west = 180;
    for (const n of nodes) {
      if (n.lat > north) north = n.lat;
      if (n.lat < south) south = n.lat;
      if (n.lng > east) east = n.lng;
      if (n.lng < west) west = n.lng;
    }
    const pad = 2;
    return { north: north + pad, south: south - pad, east: east + pad, west: west - pad };
  }
}
