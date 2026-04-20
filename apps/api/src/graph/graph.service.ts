import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  GraphBounds,
  GraphEdge,
  GraphNode,
  GraphResponse,
  NodeKind,
  ProcessKey,
} from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { RegistrySettingsService } from '../registry-settings/registry-settings.service.js';
import {
  mergeComponentsLatestWins,
  type ImportedComponentWithImport,
} from './merge-components.js';
import { applyCascade, type GlobalComponent } from './apply-cascade.js';
import {
  mergePathsLatestWins,
  type ImportedPathWithImport,
  type MergedPath,
} from './merge-paths.js';

const DEFAULT_ISRECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function parseThreshold(): number {
  const raw = process.env.ISRECENT_THRESHOLD_MS;
  if (!raw) return DEFAULT_ISRECENT_THRESHOLD_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ISRECENT_THRESHOLD_MS;
}

@Injectable()
export class GraphService {
  private readonly isRecentThreshold = parseThreshold();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
    private readonly registrySettings: RegistrySettingsService,
  ) {}

  async getGraph(envName: string, refDate?: Date): Promise<GraphResponse> {
    const effectiveRef = refDate ?? new Date();

    const imports = await this.prisma.import.findMany({
      where: { envName, effectiveDate: { lte: effectiveRef } },
      orderBy: { effectiveDate: 'asc' },
      include: {
        importedComponents: { include: { urls: true } },
        importedPaths: true,
        importedStats: true,
      },
    });

    const [overrides, entsoeEntries, processColors] = await Promise.all([
      this.prisma.componentOverride.findMany(),
      this.prisma.entsoeEntry.findMany(),
      this.registrySettings.getEffectiveProcessColors(),
    ]);

    // 1. Merge ImportedComponent par EIC (T12)
    const componentRows: ImportedComponentWithImport[] = imports.flatMap((imp) =>
      imp.importedComponents.map((c) => ({
        eic: c.eic,
        type: c.type,
        organization: c.organization,
        personName: c.personName,
        email: c.email,
        phone: c.phone,
        homeCdCode: c.homeCdCode,
        networksCsv: c.networksCsv,
        displayName: c.displayName,
        country: c.country,
        lat: c.lat,
        lng: c.lng,
        isDefaultPosition: c.isDefaultPosition,
        sourceType: c.sourceType,
        creationTs: c.creationTs,
        modificationTs: c.modificationTs,
        urls: c.urls.map((u) => ({ network: u.network, url: u.url })),
        _effectiveDate: imp.effectiveDate,
      })),
    );
    const mergedByEic = mergeComponentsLatestWins(componentRows);

    // 2. Cascade 5 niveaux (T13)
    const overrideByEic = new Map(overrides.map((o) => [o.eic, o]));
    const entsoeByEic = new Map(entsoeEntries.map((e) => [e.eic, e]));
    const baseMapConfig = this.registry.getMapConfig();
    const mapConfig = { ...baseMapConfig, processColors };
    const defaultFallback = {
      lat: mapConfig.defaultLat,
      lng: mapConfig.defaultLng,
    };

    // L'ensemble des EICs est déterminé exclusivement par les composants importés
    // dans cet envName. Les overrides et entsoeEntries servent uniquement à enrichir,
    // pas à créer de nouveaux nœuds.
    const eicSet = new Set<string>(mergedByEic.keys());

    const globalComponents = new Map<string, GlobalComponent>();
    for (const eic of eicSet) {
      const merged = mergedByEic.get(eic) ?? null;
      const override = overrideByEic.get(eic) ?? null;
      const entsoe = entsoeByEic.get(eic) ?? null;
      const registryEntry = this.registry.resolveEic(eic);
      const global = applyCascade(
        eic,
        merged,
        { override, entsoe, registry: registryEntry },
        defaultFallback,
      );
      globalComponents.set(eic, global);
    }

    // 3. Merge paths par clé 5-champs (T14)
    const pathRows: ImportedPathWithImport[] = imports.flatMap((imp) =>
      imp.importedPaths.map((p) => ({
        receiverEic: p.receiverEic,
        senderEic: p.senderEic,
        messageType: p.messageType,
        transportPattern: p.transportPattern,
        intermediateBrokerEic: p.intermediateBrokerEic,
        validFrom: p.validFrom,
        validTo: p.validTo,
        isExpired: p.isExpired,
        _effectiveDate: imp.effectiveDate,
      })),
    );
    const mergedPaths = mergePathsLatestWins(pathRows);

    // 4. buildEdges : agrégation par (fromEic, toEic), MIXTE, direction, isRecent
    const rteEicSet = this.registry.getRteEicSet();
    const edges = this.buildEdges(Array.from(mergedPaths.values()), imports, rteEicSet);

    // 5. Nodes + bounds
    const nodes: GraphNode[] = Array.from(globalComponents.values()).map((g) =>
      this.toNode(g, rteEicSet),
    );

    return {
      bounds: this.computeBounds(nodes),
      nodes,
      edges,
      mapConfig,
    };
  }

  private toNode(g: GlobalComponent, rteEicSet: Set<string>): GraphNode {
    return {
      id: g.eic,
      eic: g.eic,
      kind: this.kindOf(g, rteEicSet),
      displayName: g.displayName,
      organization: g.organization ?? '',
      country: g.country,
      lat: g.lat,
      lng: g.lng,
      isDefaultPosition: g.isDefaultPosition,
      networks: g.networksCsv ? g.networksCsv.split(',') : [],
      process: g.process as ProcessKey | null,
      urls: g.urls,
      creationTs: (g.creationTs ?? new Date(0)).toISOString(),
      modificationTs: (g.modificationTs ?? new Date(0)).toISOString(),
    };
  }

  private kindOf(g: GlobalComponent, rteEicSet: Set<string>): NodeKind {
    const isRte = rteEicSet.has(g.eic);
    if (g.type === 'BROKER') return 'BROKER';
    if (g.type === 'COMPONENT_DIRECTORY') return isRte ? 'RTE_CD' : 'EXTERNAL_CD';
    return isRte ? 'RTE_ENDPOINT' : 'EXTERNAL_ENDPOINT';
  }

  private buildEdges(
    paths: MergedPath[],
    imports: Array<{
      importedStats: Array<{
        sourceEndpointCode: string;
        remoteComponentCode: string;
        connectionStatus: string | null;
        lastMessageUp: Date | null;
        lastMessageDown: Date | null;
      }>;
      effectiveDate: Date;
    }>,
    rteEicSet: Set<string>,
  ): GraphEdge[] {
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
      if (p.receiverEic === '*' || p.senderEic === '*') continue;
      const direction: 'IN' | 'OUT' = rteEicSet.has(p.receiverEic) ? 'IN' : 'OUT';
      const fromEic = direction === 'IN' ? p.senderEic : p.receiverEic;
      const toEic = direction === 'IN' ? p.receiverEic : p.senderEic;
      const process = this.registry.classifyMessageType(p.messageType) as ProcessKey;
      const key = `${fromEic}::${toEic}`;
      const existing = groups.get(key);
      if (existing) {
        existing.processes.add(process);
        existing.messageTypes.add(p.messageType);
        existing.transports.add(p.transportPattern as 'DIRECT' | 'INDIRECT');
      } else {
        groups.set(key, {
          fromEic,
          toEic,
          direction,
          processes: new Set([process]),
          messageTypes: new Set([p.messageType]),
          transports: new Set([p.transportPattern as 'DIRECT' | 'INDIRECT']),
          intermediateBroker: p.intermediateBrokerEic,
          validFrom: p.validFrom,
          validTo: p.validTo,
        });
      }
    }

    // Stats : latest-wins par (source, remote)
    const statsByKey = new Map<
      string,
      {
        stat: {
          connectionStatus: string | null;
          lastMessageUp: Date | null;
          lastMessageDown: Date | null;
        };
        effective: Date;
      }
    >();
    for (const imp of imports) {
      for (const s of imp.importedStats) {
        const k = `${s.sourceEndpointCode}::${s.remoteComponentCode}`;
        const prev = statsByKey.get(k);
        if (!prev || prev.effective < imp.effectiveDate) {
          statsByKey.set(k, { stat: s, effective: imp.effectiveDate });
        }
      }
    }

    const refTime =
      imports.length > 0
        ? imports[imports.length - 1]!.effectiveDate.getTime()
        : Date.now();

    return Array.from(groups.values()).map((g) => {
      const processes = Array.from(g.processes);
      const process: ProcessKey =
        processes.length > 1 ? 'MIXTE' : (processes[0] ?? 'UNKNOWN');
      const hash = createHash('sha1')
        .update(`${g.fromEic}|${g.toEic}|${process}`)
        .digest('hex')
        .slice(0, 16);
      const stat =
        statsByKey.get(`${g.fromEic}::${g.toEic}`) ??
        statsByKey.get(`${g.toEic}::${g.fromEic}`) ??
        null;
      const isRecent =
        stat?.stat.lastMessageUp != null &&
        refTime - stat.stat.lastMessageUp.getTime() < this.isRecentThreshold &&
        refTime - stat.stat.lastMessageUp.getTime() >= 0;

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
          connectionStatus: stat?.stat.connectionStatus ?? null,
          lastMessageUp: stat?.stat.lastMessageUp?.toISOString() ?? null,
          lastMessageDown: stat?.stat.lastMessageDown?.toISOString() ?? null,
          isRecent: Boolean(isRecent),
        },
        validFrom: (g.validFrom ?? new Date(0)).toISOString(),
        validTo: g.validTo?.toISOString() ?? null,
      };
    });
  }

  private computeBounds(nodes: GraphNode[]): GraphBounds {
    if (nodes.length === 0) {
      return { north: 60, south: 40, east: 20, west: -10 };
    }
    let north = -90,
      south = 90,
      east = -180,
      west = 180;
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
