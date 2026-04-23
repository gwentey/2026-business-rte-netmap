import { Injectable } from '@nestjs/common';
import type {
  ComponentConfigProperty,
  ComponentConfigResponse,
  ComponentConfigSection,
} from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Règles de classification des clés `ecp.*` en sections lisibles.
 * Ordre évalué séquentiellement — la première regex qui match gagne.
 * Les clés qui ne matchent rien tombent dans la section "Autres" (slug `misc`).
 */
const SECTION_RULES: Array<{ pattern: RegExp; name: string; slug: string }> = [
  { pattern: /^ecp\.company\./, name: 'Contact', slug: 'contact' },
  { pattern: /^ecp\.projectName|^ecp\.envName|^ecp\.componentCode|^ecp\.internal\.status|^ecp\.timezone|^ecp\.appTheme/, name: 'Identification', slug: 'identification' },
  { pattern: /^ecp\.directory\.client\.synchronization/, name: 'Synchronisation CD', slug: 'sync' },
  { pattern: /^ecp\.endpoint\.antivirus/, name: 'Antivirus', slug: 'antivirus' },
  { pattern: /^ecp\.endpoint\.archive|^ecp\.endpoint\.archiveHandler/, name: 'Archivage', slug: 'archive' },
  { pattern: /^ecp\.endpoint\.compression|^ecp\.endpoint\.messageTypes(To|Skip)Compress/, name: 'Compression', slug: 'compression' },
  { pattern: /^ecp\.endpoint\.amqpApi|^ecp\.endpoint\.routes|^ecp\.endpoint\.directMessagingEnabled/, name: 'AMQP & Direct', slug: 'amqp' },
  { pattern: /^ecp\.endpoint\.connectivityCheck/, name: 'Connectivité', slug: 'connectivity' },
  { pattern: /^ecp\.endpoint\.messagePath/, name: 'Message paths', slug: 'messagepath' },
  { pattern: /^ecp\.endpoint\.priorityConfiguration|^ecp\.endpoint\.messageTtl|^ecp\.messagebox/, name: 'Messages', slug: 'messages' },
  { pattern: /^ecp\.security/, name: 'Sécurité', slug: 'security' },
  { pattern: /^ecp\.endpoint\.jmsHeaders|^ecp\.endpoint\.fssf/, name: 'JMS / FSSF', slug: 'jms' },
  { pattern: /^ecp\.endpoint\.sendHandler|^ecp\.endpoint\.receiveHandler/, name: 'Handlers custom', slug: 'handlers' },
  { pattern: /^ecp\.broker/, name: 'Broker', slug: 'broker' },
  { pattern: /^ecp\.networks|^ecp\.urls|^ecp\.natEnabled|^ecp\.natTable/, name: 'Réseau', slug: 'network' },
  { pattern: /^ecp\.metricsSyncThreshold|^ecp\.directory\.ttl/, name: 'Admin', slug: 'admin' },
];

const MISC_SECTION = { name: 'Autres', slug: 'misc' };

function classifyKey(key: string): { name: string; slug: string } {
  for (const rule of SECTION_RULES) {
    if (rule.pattern.test(key)) return { name: rule.name, slug: rule.slug };
  }
  return MISC_SECTION;
}

@Injectable()
export class ComponentConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Renvoie les `ecp.*` properties consolidées pour un EIC, groupées par section.
   * Source : le **dernier Import** (par `effectiveDate` desc) dont
   * `sourceComponentEic` correspond. Si aucun import n'a ce composant comme source,
   * renvoie `source: null` avec `sections: []`.
   */
  async getConfig(eic: string): Promise<ComponentConfigResponse> {
    const latestImport = await this.prisma.import.findFirst({
      where: { sourceComponentEic: eic },
      orderBy: { effectiveDate: 'desc' },
      include: { importedProps: true },
    });

    if (!latestImport) {
      return { eic, source: null, sections: [] };
    }

    const bySection = new Map<string, ComponentConfigProperty[]>();
    const sectionMeta = new Map<string, string>();
    for (const prop of latestImport.importedProps) {
      const { name, slug } = classifyKey(prop.key);
      sectionMeta.set(slug, name);
      const list = bySection.get(slug) ?? [];
      list.push({ key: prop.key, value: prop.value });
      bySection.set(slug, list);
    }

    // Ordre stable : suit l'ordre des SECTION_RULES puis 'misc' en queue.
    const orderedSlugs = [
      ...SECTION_RULES.map((r) => r.slug),
      MISC_SECTION.slug,
    ];
    const sections: ComponentConfigSection[] = [];
    for (const slug of orderedSlugs) {
      const props = bySection.get(slug);
      if (!props || props.length === 0) continue;
      sections.push({
        slug,
        name: sectionMeta.get(slug) ?? slug,
        properties: props.sort((a, b) => a.key.localeCompare(b.key)),
      });
    }

    return {
      eic,
      source: {
        importId: latestImport.id,
        label: latestImport.label,
        envName: latestImport.envName,
        uploadedAt: latestImport.uploadedAt.toISOString(),
        hasConfigurationProperties: latestImport.hasConfigurationProperties,
      },
      sections,
    };
  }
}
