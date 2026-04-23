import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import type {
  BusinessApplicationCriticality,
  BusinessApplicationSummary,
  MapConfig,
  ProcessColorMap,
  ProcessKey,
} from '@carto-ecp/shared';
import type {
  EntsoeEntry,
  RteOverlay,
} from './types.js';

@Injectable()
export class RegistryService implements OnModuleInit {
  private readonly logger = new Logger(RegistryService.name);
  private eicIndex = new Map<string, EntsoeEntry>();
  private overlay!: RteOverlay;
  private patternRegexes: { regex: RegExp; process: ProcessKey }[] = [];
  private rteEicSet!: Set<string>;
  private registryRoot!: string;

  async onModuleInit(): Promise<void> {
    this.registryRoot = process.env.REGISTRY_PATH
      ? resolve(process.env.REGISTRY_PATH)
      : resolve(process.cwd(), '../../packages/registry');
    this.logger.log(`Registry root: ${this.registryRoot}`);
    await Promise.all([this.loadEntsoeIndex(), this.loadOverlay()]);
    this.rteEicSet = new Set<string>([
      ...this.overlay.rteEndpoints.map((e) => e.eic),
      this.overlay.rteComponentDirectory.eic,
    ]);
    this.logger.log(
      `Registry loaded: ${this.eicIndex.size} ENTSO-E entries, overlay ${this.overlay.version}`,
    );
  }

  entsoeSize(): number {
    return this.eicIndex.size;
  }

  lookupEntsoe(eic: string): EntsoeEntry | null {
    return this.eicIndex.get(eic) ?? null;
  }

  resolveEic(eic: string): {
    displayName?: string | null;
    organization?: string | null;
    country?: string | null;
    lat?: number | null;
    lng?: number | null;
    type?: string | null;
    process?: string | null;
  } | null {
    // Level 1 : RTE endpoints overlay
    const rteEndpoint = this.overlay.rteEndpoints.find((e) => e.eic === eic);
    if (rteEndpoint) {
      return {
        displayName: rteEndpoint.displayName,
        organization: 'RTE',
        country: 'FR',
        lat: rteEndpoint.lat,
        lng: rteEndpoint.lng,
        type: 'ENDPOINT',
        process: rteEndpoint.process ?? null,
      };
    }

    // Level 2 : RTE component directory overlay
    if (this.overlay.rteComponentDirectory.eic === eic) {
      return {
        displayName: this.overlay.rteComponentDirectory.displayName,
        organization: 'RTE',
        country: 'FR',
        lat: this.overlay.rteComponentDirectory.lat,
        lng: this.overlay.rteComponentDirectory.lng,
        type: 'COMPONENT_DIRECTORY',
        process: null,
      };
    }

    // Level 3 : ENTSO-E index — return fields without coords (cascade will add coords)
    const entsoe = this.eicIndex.get(eic);
    if (entsoe) {
      return {
        displayName: entsoe.displayName,
        organization: null,
        country: entsoe.country ?? null,
        lat: null,
        lng: null,
        type: null,
        process: null,
      };
    }

    return null;
  }

  classifyMessageType(messageType: string): ProcessKey {
    if (!messageType || messageType === '*') return 'UNKNOWN';
    const exact = this.overlay.messageTypeClassification.exact[messageType];
    if (exact) return exact;
    for (const { regex, process } of this.patternRegexes) {
      if (regex.test(messageType)) return process;
    }
    return 'UNKNOWN';
  }

  processColor(process: ProcessKey): string {
    return this.overlay.processColors[process];
  }

  getRteEicSet(): Set<string> {
    return this.rteEicSet;
  }

  /**
   * Résout les Business Applications RTE qui utilisent cet endpoint.
   * Mapping statique maintenu dans `eic-rte-overlay.json` par MCO.
   *
   * Retourne :
   *  - pour un endpoint RTE mappé : la liste des BAs triées par criticité
   *    (P1 > P2 > P3) puis par code alpha
   *  - pour un endpoint RTE non mappé : [] (endpoint connu mais sans BA
   *    déclarée, ex. broker RTE ou endpoint de test)
   *  - pour un EIC externe : [] (les BAs sont RTE-only)
   */
  resolveBusinessApplications(eic: string): BusinessApplicationSummary[] {
    if (!this.rteEicSet.has(eic)) return [];
    const bas = this.overlay.rteBusinessApplications
      .filter((ba) => ba.endpoints.includes(eic))
      .map((ba) => ({
        code: ba.code,
        criticality: ba.criticality as BusinessApplicationCriticality,
      }));
    const rank: Record<BusinessApplicationCriticality, number> = {
      P1: 0,
      P2: 1,
      P3: 2,
    };
    bas.sort((a, b) => {
      const dr = rank[a.criticality] - rank[b.criticality];
      if (dr !== 0) return dr;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
    return bas;
  }

  getMapConfig(): MapConfig {
    return { ...this.overlay.mapConfig, processColors: this.getProcessColorMap() };
  }

  getProcessColorMap(): ProcessColorMap {
    return { ...this.overlay.processColors };
  }

  getOverlay(): RteOverlay {
    return this.overlay;
  }

  private async loadEntsoeIndex(): Promise<void> {
    const csvPath = resolve(this.registryRoot, 'eic-entsoe.csv');
    const content = await readFile(csvPath, 'utf-8');
    const rows = parseCsv(content, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Record<string, string>[];

    for (const row of rows) {
      const eic = row['EicCode'];
      if (!eic) continue;
      this.eicIndex.set(eic, {
        eic,
        displayName: row['EicDisplayName'] ?? eic,
        longName: row['EicLongName'] ?? '',
        country: row['MarketParticipantIsoCountryCode']?.trim() || null,
        vatCode: row['MarketParticipantVatCode']?.trim() || null,
        functionList: row['EicTypeFunctionList'] ?? null,
      });
    }
  }

  private async loadOverlay(): Promise<void> {
    const jsonPath = resolve(this.registryRoot, 'eic-rte-overlay.json');
    const content = await readFile(jsonPath, 'utf-8');
    this.overlay = JSON.parse(content) as RteOverlay;
    this.patternRegexes = this.overlay.messageTypeClassification.patterns.map((p) => ({
      regex: new RegExp(p.match),
      process: p.process,
    }));
  }
}
