import { Injectable } from '@nestjs/common';
import type { Warning } from '@carto-ecp/shared';
import type {
  BuiltImportedComponent,
  BuiltImportedComponentStat,
  BuiltImportedDirectorySync,
  BuiltImportedMessagingStat,
  BuiltImportedPath,
  BuiltImportedUploadRoute,
  ComponentStatisticRow,
  MadesComponent,
  MadesTree,
  SynchronizedDirectoryRow,
  UploadRouteRow,
} from './types.js';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { CdMessagePathRow } from './csv-reader.service.js';

/**
 * Regex d'IP privée RFC 1918 : 10.x / 172.16-31.x / 192.168.x.
 * Usage : on masque le 4e octet pour ne pas exposer la topologie interne RTE
 * dans les URLs des CDs partenaires persistées en base / exposées au frontend.
 */
const PRIVATE_IPV4_REGEX =
  /\b(10\.\d{1,3}\.\d{1,3}\.)(\d{1,3})\b|\b(192\.168\.\d{1,3}\.)(\d{1,3})\b|\b(172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.)(\d{1,3})\b/g;

/**
 * Masque les derniers octets d'une IPv4 privée dans une URL.
 * Les URLs publiques (IPs routables ou DNS) sont laissées intactes.
 */
export function maskPrivateIp(url: string | null): string | null {
  if (url == null) return null;
  return url.replace(PRIVATE_IPV4_REGEX, (_, a, _b, c, _d, e, _f) => {
    if (a) return `${a}xxx`;
    if (c) return `${c}xxx`;
    if (e) return `${e}xxx`;
    return 'xxx';
  });
}

type LocalCsvRow = {
  eic: string;
  componentCode: string;
  organization?: string | null;
  personName?: string | null;
  email?: string | null;
  phone?: string | null;
  homeCdCode?: string | null;
  networks?: string | null;
  xml?: string | null;
  creationTs?: string | null;
  modificationTs?: string | null;
};

@Injectable()
export class ImportBuilderService {
  constructor(private readonly csvPathReader: CsvPathReaderService) {}
  buildFromLocalCsv(rows: LocalCsvRow[]): {
    components: BuiltImportedComponent[];
    warnings: Warning[];
  } {
    const components: BuiltImportedComponent[] = [];
    const warnings: Warning[] = [];
    for (const row of rows) {
      if (!row.eic) {
        warnings.push({
          code: 'CSV_ROW_MISSING_EIC',
          message: `Row skipped: ${row.componentCode ?? '<no code>'}`,
        });
        continue;
      }
      components.push({
        eic: row.eic,
        type: this.inferType(row),
        organization: nonEmpty(row.organization),
        personName: nonEmpty(row.personName),
        email: nonEmpty(row.email),
        phone: nonEmpty(row.phone),
        homeCdCode: nonEmpty(row.homeCdCode),
        networksCsv: nonEmpty(row.networks),
        displayName: null,
        projectName: null,
        country: null,
        lat: null,
        lng: null,
        isDefaultPosition: true,
        sourceType: 'LOCAL_CSV',
        creationTs: parseDateOrNull(row.creationTs),
        modificationTs: parseDateOrNull(row.modificationTs),
        urls: [],
      });
    }
    return { components, warnings };
  }

  buildFromXml(parsed: MadesTree): {
    components: BuiltImportedComponent[];
    paths: BuiltImportedPath[];
    warnings: Warning[];
  } {
    const components: BuiltImportedComponent[] = [];
    const paths: BuiltImportedPath[] = [];
    const warnings: Warning[] = [];
    const knownEics = new Set<string>();

    // Combine all component types from the MadesTree into a flat list
    const allMadesComponents: MadesComponent[] = [
      ...parsed.brokers,
      ...parsed.endpoints,
      ...parsed.componentDirectories,
    ];

    // 1. Extract components from XML
    for (const c of allMadesComponents) {
      if (!c.code) continue;
      components.push(this.fromXmlComponent(c));
      knownEics.add(c.code);
    }

    // 2. Extract paths from each component, create BROKER stubs for unknown brokers
    for (const c of allMadesComponents) {
      if (!c.code) continue;
      for (const mp of c.paths) {
        const intermediateBrokerEic = mp.brokerCode ?? null;
        paths.push({
          receiverEic: c.code,
          senderEic: mp.senderComponent ?? '*',
          messageType: mp.messageType,
          transportPattern: mp.transportPattern,
          intermediateBrokerEic,
          validFrom: mp.validFrom,
          validTo: mp.validTo,
          isExpired: mp.validTo != null && mp.validTo.getTime() < Date.now(),
        });
        if (intermediateBrokerEic && !knownEics.has(intermediateBrokerEic)) {
          components.push(brokerStub(intermediateBrokerEic));
          knownEics.add(intermediateBrokerEic);
        }
      }
    }

    return { components, paths, warnings };
  }

  private static readonly SENSITIVE_KEY_REGEX = /password|secret|keystore\.password|privateKey|credentials/i;

  buildMessagingStats(rows: Array<{
    sourceEndpointCode: string;
    remoteComponentCode: string;
    connectionStatus?: string | null;
    lastMessageUp?: string | null;
    lastMessageDown?: string | null;
    sumMessagesUp?: number | string | null;
    sumMessagesDown?: number | string | null;
    deleted?: boolean | string | null;
  }>): BuiltImportedMessagingStat[] {
    return rows.map((r) => ({
      sourceEndpointCode: r.sourceEndpointCode,
      remoteComponentCode: r.remoteComponentCode,
      connectionStatus: nonEmpty(r.connectionStatus ?? null),
      lastMessageUp: parseDateOrNull(r.lastMessageUp ?? null),
      lastMessageDown: parseDateOrNull(r.lastMessageDown ?? null),
      sumMessagesUp: Number(r.sumMessagesUp ?? 0),
      sumMessagesDown: Number(r.sumMessagesDown ?? 0),
      deleted: r.deleted === true || r.deleted === 'true',
    }));
  }

  buildAppProperties(rows: Array<{ key: string; value: string }>): Array<{ key: string; value: string }> {
    return rows.filter((r) => !ImportBuilderService.SENSITIVE_KEY_REGEX.test(r.key));
  }

  buildDirectorySyncs(
    rows: ReadonlyArray<SynchronizedDirectoryRow>,
  ): BuiltImportedDirectorySync[] {
    return rows
      .filter((r) => r.directoryCode.length > 0)
      .map((r) => ({
        directoryCode: r.directoryCode,
        directorySyncMode:
          r.directorySyncMode === 'TWO_WAY' ? 'TWO_WAY' : 'ONE_WAY',
        directoryType: r.directoryType,
        directoryUrl: maskPrivateIp(r.directoryUrls),
        synchronizationStatus: r.synchronizationStatus,
        synchronizationTimestamp: r.synchronizationTimeStamp,
      }));
  }

  buildComponentStats(rows: ReadonlyArray<ComponentStatisticRow>): BuiltImportedComponentStat[] {
    return rows
      .filter((r) => r.componentCode.length > 0)
      .map((r) => ({
        componentCode: r.componentCode,
        lastSyncSucceed: r.lastSynchronizationSucceed,
        lastSynchronizedTime: r.lastSynchronizedTime,
        modifiedDate: r.modifiedDate,
        receivedMessages: r.receivedMessages ?? 0,
        sentMessages: r.sentMessages ?? 0,
        waitingToDeliverMessages: r.waitingToDeliverMessages ?? 0,
        waitingToReceiveMessages: r.waitingToReceiveMessages ?? 0,
      }));
  }

  buildUploadRoutes(rows: ReadonlyArray<UploadRouteRow>): BuiltImportedUploadRoute[] {
    return rows.map((r) => ({
      targetComponentCode: r.targetComponentCode,
      createdDate: r.createdDate,
    }));
  }

  private fromXmlComponent(c: MadesComponent): BuiltImportedComponent {
    return {
      eic: c.code,
      type: c.type,
      organization: nonEmpty(c.organization),
      personName: nonEmpty(c.personName),
      email: nonEmpty(c.email),
      phone: nonEmpty(c.phone),
      homeCdCode: nonEmpty(c.homeCdCode),
      networksCsv: c.networks.length > 0 ? c.networks.join(',') : null,
      displayName: null,
      projectName: null,
      country: null,
      lat: null,
      lng: null,
      isDefaultPosition: true,
      sourceType: 'XML_CD',
      creationTs: c.creationTs,
      modificationTs: c.modificationTs,
      urls: c.urls.map((u) => ({ network: u.network, url: u.url })),
    };
  }

  private inferType(row: LocalCsvRow): BuiltImportedComponent['type'] {
    if (row.componentCode === row.eic) return 'COMPONENT_DIRECTORY';
    return 'ENDPOINT';
  }

  buildFromCdCsv(
    cdComponentRows: ReadonlyArray<{
      id: string;
      componentCode: string;
      organization?: string | null;
      directoryContent?: string | null;
    }>,
    cdPathRows: ReadonlyArray<CdMessagePathRow>,
  ): {
    components: BuiltImportedComponent[];
    paths: BuiltImportedPath[];
    warnings: Warning[];
  } {
    const warnings: Warning[] = [];
    const components: BuiltImportedComponent[] = [];
    const knownEics = new Set<string>();

    for (const row of cdComponentRows) {
      if (!row.id) {
        warnings.push({
          code: 'CSV_ROW_MISSING_EIC',
          message: `CD row skipped: ${row.componentCode ?? '<no code>'}`,
        });
        continue;
      }
      const type = row.componentCode === row.id ? 'COMPONENT_DIRECTORY' : 'ENDPOINT';
      components.push({
        eic: row.id,
        type,
        organization: nonEmpty(row.organization),
        personName: null,
        email: null,
        phone: null,
        homeCdCode: null,
        networksCsv: null,
        displayName: null,
        projectName: null,
        country: null,
        lat: null,
        lng: null,
        isDefaultPosition: true,
        sourceType: 'LOCAL_CSV',
        creationTs: null,
        modificationTs: null,
        urls: [],
      });
      knownEics.add(row.id);
    }

    const pathResult = this.csvPathReader.readCdMessagePaths(cdPathRows, warnings);

    // Stubs BROKER pour intermediateBrokerEic inconnus
    for (const p of pathResult.paths) {
      if (p.intermediateBrokerEic && !knownEics.has(p.intermediateBrokerEic)) {
        components.push({
          eic: p.intermediateBrokerEic,
          type: 'BROKER',
          organization: null,
          personName: null,
          email: null,
          phone: null,
          homeCdCode: null,
          networksCsv: null,
          displayName: null,
          projectName: null,
          country: null,
          lat: null,
          lng: null,
          isDefaultPosition: true,
          sourceType: 'LOCAL_CSV',
          creationTs: null,
          modificationTs: null,
          urls: [],
        });
        knownEics.add(p.intermediateBrokerEic);
      }
    }

    return { components, paths: pathResult.paths, warnings };
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function brokerStub(eic: string): BuiltImportedComponent {
  return {
    eic,
    type: 'BROKER',
    organization: null,
    personName: null,
    email: null,
    phone: null,
    homeCdCode: null,
    networksCsv: null,
    displayName: null,
    projectName: null,
    country: null,
    lat: null,
    lng: null,
    isDefaultPosition: true,
    sourceType: 'XML_CD',
    creationTs: null,
    modificationTs: null,
    urls: [],
  };
}
