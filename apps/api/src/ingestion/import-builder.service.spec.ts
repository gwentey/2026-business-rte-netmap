import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { ImportBuilderService } from './import-builder.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';

describe('ImportBuilderService — composants', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('builds ImportedComponent with raw CSV fields and no cascade resolution', () => {
    const csvRow = {
      eic: '17V000000498771C',
      componentCode: 'ECP-INTERNET-2',
      organization: 'RTE',
      personName: 'John Doe',
      email: 'john@rte-france.com',
      phone: '+33-1-00-00-00-00',
      homeCdCode: '17V000002014106G',
      networks: 'PUBLIC_NETWORK,INTERNET',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components).toHaveLength(1);
    const c = result.components[0]!;
    expect(c.eic).toBe('17V000000498771C');
    expect(c.type).toBe('ENDPOINT');
    expect(c.organization).toBe('RTE');
    expect(c.email).toBe('john@rte-france.com');
    expect(c.networksCsv).toBe('PUBLIC_NETWORK,INTERNET');
    expect(c.lat).toBeNull();
    expect(c.lng).toBeNull();
    expect(c.isDefaultPosition).toBe(true);
    expect(c.sourceType).toBe('LOCAL_CSV');
  });

  it('types the component as COMPONENT_DIRECTORY when componentCode equals the eic (CD self-reference)', () => {
    const csvRow = {
      eic: '17V000002014106G',
      componentCode: '17V000002014106G',
      organization: 'RTE',
      networks: '',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components[0]!.type).toBe('COMPONENT_DIRECTORY');
  });

  it('accumulates multiple rows into the components array', () => {
    const rows = [
      { eic: 'A', componentCode: 'A', organization: 'RTE', networks: '', xml: '' },
      { eic: 'B', componentCode: 'ECP-X', organization: 'OTHER_TSO', networks: '', xml: '' },
    ];
    const result = builder.buildFromLocalCsv(rows);
    expect(result.components).toHaveLength(2);
    expect(result.components[0]!.type).toBe('COMPONENT_DIRECTORY');
    expect(result.components[1]!.type).toBe('ENDPOINT');
  });
});

// XML with broker, endpoint (with 2 paths: one INDIRECT via broker, one DIRECT)
const VALID_XML_WITH_PATHS = `<?xml version="1.0" encoding="UTF-8"?>
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
      <paths/>
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

// XML where a path references an unknown broker (17VUNKNOWN-BROKER-99) not in componentList
const XML_WITH_UNKNOWN_BROKER = `<?xml version="1.0" encoding="UTF-8"?>
<ns2:components xmlns:ns2="http://mades.entsoe.eu/componentDirectory">
  <componentList>
    <endpoint>
      <organization>Elia</organization>
      <person>OPS</person>
      <email>b@elia.be</email>
      <phone>000</phone>
      <code>10X1001A1001A094</code>
      <type>ENDPOINT</type>
      <networks><network>internet</network></networks>
      <urls/>
      <certificates/>
      <creationTimestamp>2025-02-01T00:00:00.000Z</creationTimestamp>
      <modificationTimestamp>2025-02-01T00:00:00.000Z</modificationTimestamp>
      <componentDirectory>17V000002014106G</componentDirectory>
      <paths>
        <path>
          <senderComponent/>
          <messageType>ACK</messageType>
          <path>INDIRECT:17VUNKNOWN-BROKER-99</path>
          <validFrom>2025-01-01T00:00:00.000Z</validFrom>
        </path>
      </paths>
    </endpoint>
  </componentList>
  <metadata>
    <componentDirectoryMetadata>
      <componentDirectory>17V000002014106G</componentDirectory>
      <ttl>86400000</ttl>
      <contentID>1</contentID>
    </componentDirectoryMetadata>
  </metadata>
</ns2:components>`;

describe('ImportBuilderService — XML', () => {
  let builder: ImportBuilderService;
  let parser: XmlMadesParserService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, XmlMadesParserService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
    parser = moduleRef.get(XmlMadesParserService);
  });

  it('extracts components from XML CD blob with sourceType XML_CD', () => {
    const parsed = parser.parse(VALID_XML_WITH_PATHS);
    const result = builder.buildFromXml(parsed);
    // broker + endpoint = 2 components
    expect(result.components.length).toBeGreaterThanOrEqual(1);
    for (const comp of result.components) {
      expect(comp.sourceType).toBe('XML_CD');
      expect(comp.isDefaultPosition).toBe(true);
    }
    // verify the broker component is present
    const broker = result.components.find((c) => c.type === 'BROKER');
    expect(broker).toBeDefined();
    expect(broker!.eic).toBe('17VRTE-BROKER-01');
    expect(broker!.organization).toBe('RTE');
    expect(broker!.urls).toHaveLength(1);
  });

  it('extracts paths with 5-field identity from XML (receiver, sender, messageType, transportPattern, brokerCode)', () => {
    const parsed = parser.parse(VALID_XML_WITH_PATHS);
    const result = builder.buildFromXml(parsed);
    // endpoint has 2 paths
    expect(result.paths.length).toBeGreaterThanOrEqual(1);
    const indirect = result.paths.find((p) => p.transportPattern === 'INDIRECT');
    expect(indirect).toBeDefined();
    expect(indirect!.receiverEic).toBe('10X1001A1001A361');
    expect(indirect!.messageType).toBe('RSMD');
    expect(indirect!.intermediateBrokerEic).toBe('17VRTE-BROKER-01');
    const direct = result.paths.find((p) => p.transportPattern === 'DIRECT');
    expect(direct).toBeDefined();
    expect(direct!.senderEic).toBe('17V000000498771C');
    expect(direct!.intermediateBrokerEic).toBeNull();
  });

  it('creates a BROKER stub component when a path references an unknown broker EIC', () => {
    const parsed = parser.parse(XML_WITH_UNKNOWN_BROKER);
    const result = builder.buildFromXml(parsed);
    const stub = result.components.find((c) => c.eic === '17VUNKNOWN-BROKER-99');
    expect(stub).toBeDefined();
    expect(stub!.type).toBe('BROKER');
    expect(stub!.sourceType).toBe('XML_CD');
    expect(stub!.lat).toBeNull();
    expect(stub!.lng).toBeNull();
    expect(stub!.organization).toBeNull();
  });
});
