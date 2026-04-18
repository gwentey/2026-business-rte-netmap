import { Injectable } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { parseEcpDate } from '../common/date-parser.js';
import { UnknownMadesNamespaceException } from '../common/errors/ingestion-errors.js';
import type {
  MadesCertificate,
  MadesComponent,
  MadesPath,
  MadesTree,
} from './types.js';

const MADES_NS = 'http://mades.entsoe.eu/componentDirectory';

type AnyXml = Record<string, unknown>;

@Injectable()
export class XmlMadesParserService {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
    parseTagValue: true,
    isArray: (name) =>
      ['broker', 'endpoint', 'componentDirectory', 'network', 'url', 'certificate', 'path'].includes(name),
    trimValues: true,
  });

  parse(xml: string): MadesTree {
    if (!xml.includes(MADES_NS)) {
      throw new UnknownMadesNamespaceException(this.extractNamespace(xml));
    }

    let doc: AnyXml;
    try {
      doc = this.parser.parse(xml) as AnyXml;
    } catch {
      throw new UnknownMadesNamespaceException(null);
    }

    const components = (doc.components ?? {}) as AnyXml;
    const componentList = (components.componentList ?? {}) as AnyXml;
    const metadata = ((components.metadata as AnyXml)?.componentDirectoryMetadata ??
      {}) as AnyXml;

    const brokersRaw = (componentList.broker as AnyXml[] | undefined) ?? [];
    const endpointsRaw = (componentList.endpoint as AnyXml[] | undefined) ?? [];
    const cdsRaw = (componentList.componentDirectory as AnyXml[] | undefined) ?? [];

    return {
      cdCode: String(metadata.componentDirectory ?? ''),
      contentId: Number(metadata.contentID ?? 0),
      ttl: Number(metadata.ttl ?? 0),
      brokers: brokersRaw.map((b) => this.toComponent(b, 'BROKER')),
      endpoints: endpointsRaw.map((e) => this.toComponent(e, 'ENDPOINT')),
      componentDirectories: cdsRaw.map((c) => this.toComponent(c, 'COMPONENT_DIRECTORY')),
    };
  }

  private toComponent(
    raw: AnyXml,
    type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY',
  ): MadesComponent {
    const networks = ((raw.networks as AnyXml)?.network as string[] | undefined) ?? [];
    const urlEntries = ((raw.urls as AnyXml)?.url as AnyXml[] | undefined) ?? [];
    const certEntries =
      ((raw.certificates as AnyXml)?.certificate as AnyXml[] | undefined) ?? [];
    const pathEntries = ((raw.paths as AnyXml)?.path as AnyXml[] | undefined) ?? [];

    return {
      organization: String(raw.organization ?? ''),
      personName: String(raw.person ?? ''),
      email: String(raw.email ?? ''),
      phone: String(raw.phone ?? ''),
      code: String(raw.code ?? ''),
      type,
      networks: networks.map(String),
      urls: urlEntries.map((u) => ({
        network: String(u['@_network'] ?? ''),
        url: String(u['#text'] ?? u),
      })),
      certificates: certEntries.map((c) => this.toCertificate(c)),
      creationTs: parseEcpDate(String(raw.creationTimestamp ?? '') || null),
      modificationTs: parseEcpDate(String(raw.modificationTimestamp ?? '') || null),
      homeCdCode: String(raw.componentDirectory ?? ''),
      paths: pathEntries.map((p) => this.toPath(p)),
    };
  }

  private toCertificate(raw: AnyXml): MadesCertificate {
    return {
      certificateID: String(raw.certificateID ?? ''),
      type: String(raw.type ?? ''),
      validFrom: parseEcpDate(String(raw.validFrom ?? '') || null),
      validTo: parseEcpDate(String(raw.validTo ?? '') || null),
    };
  }

  private toPath(raw: AnyXml): MadesPath {
    const pathValue = String(raw.path ?? '').trim();
    let transportPattern: 'DIRECT' | 'INDIRECT' = 'DIRECT';
    let brokerCode: string | null = null;
    if (pathValue.startsWith('INDIRECT:')) {
      transportPattern = 'INDIRECT';
      brokerCode = pathValue.slice('INDIRECT:'.length) || null;
    } else if (pathValue === 'INDIRECT') {
      transportPattern = 'INDIRECT';
    }

    const senderRaw = raw.senderComponent;
    const sender =
      senderRaw == null || senderRaw === '' || typeof senderRaw === 'object'
        ? null
        : String(senderRaw);

    return {
      senderComponent: sender,
      messageType: String(raw.messageType ?? '*'),
      transportPattern,
      brokerCode,
      validFrom: parseEcpDate(String(raw.validFrom ?? '') || null),
      validTo: parseEcpDate(String(raw.validTo ?? '') || null),
    };
  }

  private extractNamespace(xml: string): string | null {
    const m = xml.match(/xmlns(?::[^=]+)?="([^"]+)"/);
    return m ? m[1] : null;
  }
}
