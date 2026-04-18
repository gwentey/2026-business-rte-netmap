import { Injectable } from '@nestjs/common';
import type { ComponentType, Warning } from '@carto-ecp/shared';
import { RegistryService } from '../registry/registry.service.js';
import type {
  AppPropertyRow,
  ComponentRecord,
  MadesComponent,
  MadesTree,
  MessagePathRecord,
  MessagePathRow,
  MessagingStatisticRow,
  NetworkSnapshot,
} from './types.js';

type BuilderInput = {
  appProperties: AppPropertyRow[];
  madesTree: MadesTree;
  messagingStats: MessagingStatisticRow[];
  localMessagePaths: MessagePathRow[];
  envName: string;
};

@Injectable()
export class NetworkModelBuilderService {
  constructor(private readonly registry: RegistryService) {}

  build(input: BuilderInput): NetworkSnapshot {
    const warnings: Warning[] = [];
    const appsMap = new Map(input.appProperties.map((r) => [r.key, r.value] as const));

    const sourceCode = appsMap.get('ecp.componentCode') ?? '';
    const organization = appsMap.get('ecp.company.organization') ?? '';
    const networks = (appsMap.get('ecp.networks') ?? '').split(',').filter(Boolean);
    const cdFromAppProps =
      appsMap.get('ecp.directory.client.synchronization.homeComponentDirectoryPrimaryCode') ??
      null;

    const isCd =
      input.madesTree.componentDirectories.some((c) => c.code === sourceCode) ||
      sourceCode === input.madesTree.cdCode;
    const componentType: ComponentType = isCd ? 'COMPONENT_DIRECTORY' : 'ENDPOINT';
    const cdFallback = cdFromAppProps !== null ? cdFromAppProps : (input.madesTree.cdCode || null);
    const cdCode = isCd ? sourceCode : cdFallback;

    const allMades: MadesComponent[] = [
      ...input.madesTree.brokers,
      ...input.madesTree.endpoints,
      ...input.madesTree.componentDirectories,
    ];

    const rteEicSet = new Set(
      allMades.filter((c) => c.organization === 'RTE' && c.code.startsWith('17V')).map((c) => c.code),
    );

    const components: ComponentRecord[] = allMades.map((raw) => {
      const loc = this.registry.resolveComponent(raw.code, raw.organization);
      if (loc.isDefaultPosition) {
        warnings.push({
          code: 'EIC_UNKNOWN_IN_REGISTRY',
          message: `EIC ${raw.code} (org ${raw.organization}) non trouvé dans le registry, position par défaut Bruxelles`,
          context: { eic: raw.code, organization: raw.organization },
        });
      }
      const overlayRte = this.registry.getOverlay().rteEndpoints.find((e) => e.eic === raw.code);
      return {
        eic: raw.code,
        type: raw.type,
        organization: raw.organization,
        personName: raw.personName || null,
        email: raw.email || null,
        phone: raw.phone || null,
        homeCdCode: raw.homeCdCode,
        networks: raw.networks,
        urls: raw.urls,
        creationTs: raw.creationTs,
        modificationTs: raw.modificationTs,
        displayName: loc.displayName,
        country: loc.country,
        lat: loc.lat,
        lng: loc.lng,
        isDefaultPosition: loc.isDefaultPosition,
        process: overlayRte ? overlayRte.process : null,
        sourceType: 'XML_CD',
      };
    });

    const snapshotTime = Date.now();
    const xmlPaths: MessagePathRecord[] = [];
    for (const ep of input.madesTree.endpoints) {
      for (const p of ep.paths) {
        const process = this.registry.classifyMessageType(p.messageType);
        if (process === 'UNKNOWN' && p.messageType !== '*') {
          warnings.push({
            code: 'MESSAGE_TYPE_UNCLASSIFIED',
            message: `messageType "${p.messageType}" non classé, fallback UNKNOWN`,
            context: { messageType: p.messageType },
          });
        }
        const direction: 'IN' | 'OUT' = rteEicSet.has(ep.code) ? 'IN' : 'OUT';
        const isExpired = p.validTo != null && p.validTo.getTime() < snapshotTime;
        xmlPaths.push({
          receiverEic: ep.code,
          senderEicOrWildcard: p.senderComponent ?? '*',
          messageType: p.messageType,
          transportPattern: p.transportPattern,
          intermediateBrokerEic: p.brokerCode,
          validFrom: p.validFrom,
          validTo: p.validTo,
          process,
          direction,
          source: 'XML_CD_PATHS',
          isExpired,
        });
      }
    }

    const localPaths: MessagePathRecord[] = input.localMessagePaths
      .filter((r) => r.receiver != null && r.messageType != null && r.transportPattern != null)
      .map((r) => {
        const process = this.registry.classifyMessageType(r.messageType ?? '*');
        const direction: 'IN' | 'OUT' = rteEicSet.has(r.receiver ?? '') ? 'IN' : 'OUT';
        const isExpired = r.validTo != null && r.validTo.getTime() < snapshotTime;
        return {
          receiverEic: r.receiver ?? '',
          senderEicOrWildcard: r.allowedSenders ?? '*',
          messageType: r.messageType ?? '*',
          transportPattern: r.transportPattern ?? 'DIRECT',
          intermediateBrokerEic: r.intermediateBrokerCode,
          validFrom: r.validFrom,
          validTo: r.validTo,
          process,
          direction,
          source: 'LOCAL_CSV_PATHS' as const,
          isExpired,
        };
      });

    return {
      meta: {
        envName: input.envName,
        componentType,
        sourceComponentCode: sourceCode,
        cdCode,
        organization,
        networks,
      },
      components,
      messagePaths: [...xmlPaths, ...localPaths],
      messagingStats: input.messagingStats,
      appProperties: input.appProperties,
      warnings,
    };
  }
}
