import { describe, it, expect } from 'vitest';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { UnknownMadesNamespaceException } from '../common/errors/ingestion-errors.js';

const VALID_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:components xmlns:ns2="http://mades.entsoe.eu/componentDirectory">
  <componentList>
    <broker>
      <organization>RTE</organization>
      <person>DSIT</person>
      <email>x@rte.fr</email>
      <phone>000</phone>
      <code>17VRTE-BROKER-01</code>
      <type>BROKER</type>
      <networks><network>internet</network></networks>
      <urls><url network="internet">amqps://10.0.0.1:5671</url></urls>
      <certificates/>
      <creationTimestamp>2025-01-15T13:53:00.163Z</creationTimestamp>
      <modificationTimestamp>2025-01-15T13:53:00.163Z</modificationTimestamp>
      <componentDirectory>17V000002014106G</componentDirectory>
    </broker>
    <endpoint>
      <organization>SwissGrid</organization>
      <person>OPS</person>
      <email>a@sg.ch</email>
      <phone>000</phone>
      <code>10X1001A1001A361</code>
      <type>ENDPOINT</type>
      <networks><network>internet</network></networks>
      <urls/>
      <certificates/>
      <creationTimestamp>2025-01-15T13:53:00.163Z</creationTimestamp>
      <modificationTimestamp>2025-01-15T13:53:00.163Z</modificationTimestamp>
      <componentDirectory>17V000002014106G</componentDirectory>
      <paths>
        <path>
          <senderComponent/>
          <messageType>RSMD</messageType>
          <path>INDIRECT:17VRTE-BROKER-01</path>
          <validFrom>2025-01-01T00:00:00.000Z</validFrom>
          <validTo>2026-01-01T00:00:00.000Z</validTo>
        </path>
        <path>
          <senderComponent>17V000000498771C</senderComponent>
          <messageType>CGM</messageType>
          <path>DIRECT</path>
          <validFrom>2025-01-01T00:00:00.000Z</validFrom>
        </path>
      </paths>
    </endpoint>
  </componentList>
  <metadata>
    <componentDirectoryMetadata>
      <componentDirectory>17V000002014106G</componentDirectory>
      <ttl>86400000</ttl>
      <contentID>42</contentID>
    </componentDirectoryMetadata>
  </metadata>
</ns2:components>`;

describe('XmlMadesParserService', () => {
  const service = new XmlMadesParserService();

  it('parses a valid MADES tree with brokers and endpoints', () => {
    const tree = service.parse(VALID_XML);
    expect(tree.cdCode).toBe('17V000002014106G');
    expect(tree.contentId).toBe(42);
    expect(tree.ttl).toBe(86400000);
    expect(tree.brokers).toHaveLength(1);
    expect(tree.endpoints).toHaveLength(1);
  });

  it('splits INDIRECT:{broker} path correctly', () => {
    const tree = service.parse(VALID_XML);
    const path = tree.endpoints[0].paths[0];
    expect(path.transportPattern).toBe('INDIRECT');
    expect(path.brokerCode).toBe('17VRTE-BROKER-01');
  });

  it('sets brokerCode = null for DIRECT path', () => {
    const tree = service.parse(VALID_XML);
    const directPath = tree.endpoints[0].paths[1];
    expect(directPath.transportPattern).toBe('DIRECT');
    expect(directPath.brokerCode).toBeNull();
  });

  it('treats missing validTo as null (perpetual)', () => {
    const tree = service.parse(VALID_XML);
    const perpetual = tree.endpoints[0].paths[1];
    expect(perpetual.validTo).toBeNull();
  });

  it('treats empty senderComponent as null (equivalent to wildcard)', () => {
    const tree = service.parse(VALID_XML);
    expect(tree.endpoints[0].paths[0].senderComponent).toBeNull();
  });

  it('throws UnknownMadesNamespaceException for wrong namespace', () => {
    const bad = VALID_XML.replace('mades.entsoe.eu', 'other.example.com');
    expect(() => service.parse(bad)).toThrowError(UnknownMadesNamespaceException);
  });

  it('throws UnknownMadesNamespaceException for non-XML input', () => {
    expect(() => service.parse('not xml')).toThrowError(UnknownMadesNamespaceException);
  });

  it('returns empty arrays when componentList is empty', () => {
    const empty = VALID_XML.replace(
      /<componentList>[\s\S]*<\/componentList>/,
      '<componentList/>',
    );
    const tree = service.parse(empty);
    expect(tree.brokers).toEqual([]);
    expect(tree.endpoints).toEqual([]);
  });
});
