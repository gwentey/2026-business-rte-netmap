import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { parse as parseCsv } from 'csv-parse/sync';
import type { MapConfig, ProcessKey } from '@carto-ecp/shared';
import type {
  EntsoeEntry,
  ResolvedLocation,
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

  resolveComponent(eic: string, organization: string): ResolvedLocation {
    const rteEndpoint = this.overlay.rteEndpoints.find((e) => e.eic === eic);
    if (rteEndpoint) {
      return {
        displayName: rteEndpoint.displayName,
        country: 'FR',
        lat: rteEndpoint.lat,
        lng: rteEndpoint.lng,
        isDefaultPosition: false,
      };
    }

    if (this.overlay.rteComponentDirectory.eic === eic) {
      return {
        displayName: this.overlay.rteComponentDirectory.displayName,
        country: 'FR',
        lat: this.overlay.rteComponentDirectory.lat,
        lng: this.overlay.rteComponentDirectory.lng,
        isDefaultPosition: false,
      };
    }

    const entsoe = this.eicIndex.get(eic);
    if (entsoe) {
      const orgGeo = this.overlay.organizationGeocode[organization];
      if (orgGeo) {
        return {
          displayName: entsoe.displayName,
          country: orgGeo.country,
          lat: orgGeo.lat,
          lng: orgGeo.lng,
          isDefaultPosition: false,
        };
      }
      if (entsoe.country) {
        const ctryGeo = this.overlay.countryGeocode[entsoe.country];
        if (ctryGeo) {
          return {
            displayName: entsoe.displayName,
            country: entsoe.country,
            lat: ctryGeo.lat,
            lng: ctryGeo.lng,
            isDefaultPosition: false,
          };
        }
      }
    }

    const def = this.overlay.countryGeocode['DEFAULT'];
    if (!def) throw new Error('Registry overlay missing countryGeocode.DEFAULT');
    return {
      displayName: entsoe?.displayName ?? organization ?? eic,
      country: entsoe?.country ?? null,
      lat: def.lat,
      lng: def.lng,
      isDefaultPosition: true,
    };
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

  getMapConfig(): MapConfig {
    return this.overlay.mapConfig;
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
