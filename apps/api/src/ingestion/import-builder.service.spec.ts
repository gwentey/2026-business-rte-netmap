import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { ImportBuilderService, maskPrivateIp } from './import-builder.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { MessagePathRow, SynchronizedDirectoryRow } from './types.js';
import type { CdMessagePathRow } from './csv-reader.service.js';

describe('ImportBuilderService — composants', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
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
      providers: [ImportBuilderService, CsvPathReaderService, XmlMadesParserService],
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

describe('ImportBuilderService — stats & app properties', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('extracts messaging stats with correct parsing of dates, numbers, and deleted flag', () => {
    const rows = [{
      sourceEndpointCode: '17V...A',
      remoteComponentCode: '10X...Z',
      connectionStatus: 'CONNECTED',
      lastMessageUp: '2026-04-17T10:00:00.000Z',
      lastMessageDown: null,
      sumMessagesUp: '42',
      sumMessagesDown: '0',
      deleted: 'false',
    }];
    const result = builder.buildMessagingStats(rows);
    expect(result).toHaveLength(1);
    const s = result[0]!;
    expect(s.sourceEndpointCode).toBe('17V...A');
    expect(s.remoteComponentCode).toBe('10X...Z');
    expect(s.connectionStatus).toBe('CONNECTED');
    expect(s.lastMessageUp?.toISOString()).toBe('2026-04-17T10:00:00.000Z');
    expect(s.lastMessageDown).toBeNull();
    expect(s.sumMessagesUp).toBe(42);
    expect(s.sumMessagesDown).toBe(0);
    expect(s.deleted).toBe(false);
  });

  it('handles "true" string and boolean true for deleted field', () => {
    const rows = [
      { sourceEndpointCode: 'A', remoteComponentCode: 'B', deleted: 'true' },
      { sourceEndpointCode: 'C', remoteComponentCode: 'D', deleted: true },
      { sourceEndpointCode: 'E', remoteComponentCode: 'F', deleted: 'false' },
    ];
    const result = builder.buildMessagingStats(rows);
    expect(result.map((s) => s.deleted)).toEqual([true, true, false]);
  });

  it('filters sensitive keys from app properties (case-insensitive)', () => {
    const rows = [
      { key: 'keystore.password', value: 'secret' },
      { key: 'ecp.version', value: '4.5.0' },
      { key: 'private.credentials', value: 'X' },
      { key: 'normal.key', value: 'ok' },
      { key: 'KEYSTORE.PASSWORD', value: 'SECRET-UPPER' },
      { key: 'USER.PRIVATEKEY', value: 'pem' },
    ];
    const result = builder.buildAppProperties(rows);
    expect(result.map((r) => r.key).sort()).toEqual(['ecp.version', 'normal.key']);
  });
});

describe('ImportBuilderService.buildFromCdCsv', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('produces components from component_directory.csv rows (CD format)', () => {
    const cdComponentRows = [
      { id: '17V000002014106G', componentCode: '17V000002014106G', organization: 'RTE', directoryContent: '' },
      { id: '17V-PARTNER', componentCode: 'ENDPOINT-1', organization: 'APG', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [];

    const { components } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);

    expect(components).toHaveLength(2);
    const cd = components.find((c) => c.eic === '17V000002014106G')!;
    expect(cd.type).toBe('COMPONENT_DIRECTORY');
    expect(cd.organization).toBe('RTE');
    expect(cd.sourceType).toBe('LOCAL_CSV');

    const endpoint = components.find((c) => c.eic === '17V-PARTNER')!;
    expect(endpoint.type).toBe('ENDPOINT');
  });

  it('generates paths via CsvPathReader with explosion', () => {
    const cdComponentRows: any[] = [];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A|17V-B',
      intermediateBrokerCode: '',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'DIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { paths } = builder.buildFromCdCsv(cdComponentRows, cdPathRows);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.senderEic).sort()).toEqual(['17V-A', '17V-B']);
  });

  it('creates BROKER stubs for intermediateBrokerCode not in component list', () => {
    const cdComponentRows = [
      { id: '17V-A', componentCode: 'EP1', organization: 'OrgA', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A',
      intermediateBrokerCode: '17V-UNKNOWN-BROKER',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'INDIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { components } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);
    const broker = components.find((c) => c.eic === '17V-UNKNOWN-BROKER');
    expect(broker).toBeDefined();
    expect(broker!.type).toBe('BROKER');
    expect(broker!.sourceType).toBe('LOCAL_CSV');
    expect(broker!.isDefaultPosition).toBe(true);
  });

  it('does not duplicate a BROKER stub if already in component list', () => {
    const cdComponentRows = [
      { id: '17V-A', componentCode: 'EP1', organization: 'OrgA', directoryContent: '' },
      { id: '17V-BROKER-KNOWN', componentCode: '17V-BROKER-KNOWN', organization: 'BrkOrg', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A',
      intermediateBrokerCode: '17V-BROKER-KNOWN',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'INDIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { components } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);
    const brokers = components.filter((c) => c.eic === '17V-BROKER-KNOWN');
    expect(brokers).toHaveLength(1);
  });
});

describe('maskPrivateIp (slice 2m)', () => {
  it('masks RFC 1918 10.x addresses', () => {
    expect(maskPrivateIp('https://10.144.0.148:8443/ECP_MODULE/')).toBe(
      'https://10.144.0.xxx:8443/ECP_MODULE/',
    );
  });

  it('masks RFC 1918 192.168.x addresses', () => {
    expect(maskPrivateIp('https://192.168.100.162:8443/ECP_MODULE')).toBe(
      'https://192.168.100.xxx:8443/ECP_MODULE',
    );
  });

  it('masks RFC 1918 172.16-31.x addresses', () => {
    expect(maskPrivateIp('https://172.20.5.42:8443/ECP_MODULE')).toBe(
      'https://172.20.5.xxx:8443/ECP_MODULE',
    );
  });

  it('does NOT mask public IPs (20.x is Microsoft Azure, routable)', () => {
    expect(maskPrivateIp('https://20.31.194.118:8443/ECP_MODULE/')).toBe(
      'https://20.31.194.118:8443/ECP_MODULE/',
    );
  });

  it('does NOT mask DNS-based URLs', () => {
    expect(maskPrivateIp('https://csi.apg.at/ECP_MODULE')).toBe(
      'https://csi.apg.at/ECP_MODULE',
    );
  });

  it('returns null for null input', () => {
    expect(maskPrivateIp(null)).toBeNull();
  });
});

describe('ImportBuilderService.buildDirectorySyncs (slice 2m)', () => {
  let builder: ImportBuilderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('normalizes syncMode to ONE_WAY when value is unknown', () => {
    const rows: SynchronizedDirectoryRow[] = [
      {
        directoryCode: '10V1001C--00282R',
        directorySyncMode: 'WEIRD_MODE',
        directoryType: 'COMMON',
        directoryUrls: 'https://20.31.194.118:8443/ECP_MODULE/',
        synchronizationStatus: 'SUCCESS',
        synchronizationTimeStamp: new Date('2026-04-22T08:11:01Z'),
      },
    ];
    const result = builder.buildDirectorySyncs(rows);
    expect(result[0]!.directorySyncMode).toBe('ONE_WAY');
  });

  it('keeps TWO_WAY when explicitly provided', () => {
    const rows: SynchronizedDirectoryRow[] = [
      {
        directoryCode: '26V000000000012T',
        directorySyncMode: 'TWO_WAY',
        directoryType: 'COMMON',
        directoryUrls: 'https://193.108.204.195:8443/ECP_MODULE',
        synchronizationStatus: 'SUCCESS',
        synchronizationTimeStamp: null,
      },
    ];
    const result = builder.buildDirectorySyncs(rows);
    expect(result[0]!.directorySyncMode).toBe('TWO_WAY');
  });

  it('masks private IPs in directoryUrl before persistence', () => {
    const rows: SynchronizedDirectoryRow[] = [
      {
        directoryCode: 'X',
        directorySyncMode: 'ONE_WAY',
        directoryType: 'COMMON',
        directoryUrls: 'https://10.4.72.13:8443/ECP_MODULE',
        synchronizationStatus: 'SUCCESS',
        synchronizationTimeStamp: null,
      },
    ];
    const result = builder.buildDirectorySyncs(rows);
    expect(result[0]!.directoryUrl).toBe('https://10.4.72.xxx:8443/ECP_MODULE');
  });

  it('skips rows with empty directoryCode', () => {
    const rows: SynchronizedDirectoryRow[] = [
      {
        directoryCode: '',
        directorySyncMode: 'ONE_WAY',
        directoryType: null,
        directoryUrls: null,
        synchronizationStatus: null,
        synchronizationTimeStamp: null,
      },
      {
        directoryCode: 'VALID',
        directorySyncMode: 'ONE_WAY',
        directoryType: null,
        directoryUrls: null,
        synchronizationStatus: null,
        synchronizationTimeStamp: null,
      },
    ];
    const result = builder.buildDirectorySyncs(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.directoryCode).toBe('VALID');
  });
});

describe('ImportBuilderService — buildEndpointPaths — filtres', () => {
  let builder: ImportBuilderService;
  const effectiveDate = new Date('2026-04-01T00:00:00.000Z');
  const localEic = '17V0000009823063';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  const baseRow = (overrides: Partial<MessagePathRow>): MessagePathRow => ({
    allowedSenders: '17V0000015538278',
    applied: true,
    intermediateBrokerCode: null,
    intermediateComponent: null,
    messagePathType: 'BUSINESS',
    messageType: 'CORE-FB-A16A48-443-NOT',
    receiver: localEic,
    remote: false,
    status: 'ACTIVE',
    transportPattern: 'INDIRECT',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: null,
    ...overrides,
  });

  it('skip les paths ACKNOWLEDGEMENT', () => {
    const rows = [baseRow({ messagePathType: 'ACKNOWLEDGEMENT' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths status=INVALID', () => {
    const rows = [baseRow({ status: 'INVALID' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths applied=false', () => {
    const rows = [baseRow({ applied: false })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths wildcard sender uniquement', () => {
    const rows = [baseRow({ allowedSenders: '*' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths wildcard receiver', () => {
    const rows = [baseRow({ receiver: '*' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les rows malformees + produit un warning', () => {
    const rows = [baseRow({ receiver: null })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
    expect(out.warnings).toContainEqual(
      expect.objectContaining({ code: 'MESSAGE_PATH_ROW_INCOMPLETE' }),
    );
  });

  it('skip les rows avec allowedSenders vide/null', () => {
    expect(
      builder.buildEndpointPaths([baseRow({ allowedSenders: null })], localEic, effectiveDate).paths,
    ).toEqual([]);
    expect(
      builder.buildEndpointPaths([baseRow({ allowedSenders: '' })], localEic, effectiveDate).paths,
    ).toEqual([]);
  });
});

describe('ImportBuilderService — buildEndpointPaths — expansion et mapping', () => {
  let builder: ImportBuilderService;
  const effectiveDate = new Date('2026-04-01T00:00:00.000Z');
  const localEic = '17V0000009823063';

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  const baseRow = (overrides: Partial<MessagePathRow>): MessagePathRow => ({
    allowedSenders: '17V0000015538278',
    applied: true,
    intermediateBrokerCode: null,
    intermediateComponent: null,
    messagePathType: 'BUSINESS',
    messageType: 'CORE-FB-A16A48-443-NOT',
    receiver: localEic,
    remote: false,
    status: 'ACTIVE',
    transportPattern: 'INDIRECT',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: null,
    ...overrides,
  });

  it('expanse allowedSenders multi-EIC en N paths', () => {
    const rows = [baseRow({ allowedSenders: '10V000000000012O;10V000000000013M;10V1001C--00004I' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(3);
    expect(out.paths.map((p) => p.senderEic).sort()).toEqual([
      '10V000000000012O',
      '10V000000000013M',
      '10V1001C--00004I',
    ]);
  });

  it('ignore les entrees * et vides au milieu d une liste', () => {
    const rows = [baseRow({ allowedSenders: '10V000000000012O;*;;10V000000000013M' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(2);
    expect(out.paths.map((p) => p.senderEic).sort()).toEqual([
      '10V000000000012O',
      '10V000000000013M',
    ]);
  });

  it('isExpired=true si validTo < effectiveDate', () => {
    const rows = [baseRow({ validTo: new Date('2025-12-19T22:00:00.000Z') })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(1);
    expect(out.paths[0]!.isExpired).toBe(true);
  });

  it('isExpired=false si validTo >= effectiveDate ou null', () => {
    const futur = baseRow({ validTo: new Date('2027-01-01T00:00:00.000Z') });
    const nul = baseRow({ validTo: null });
    const out = builder.buildEndpointPaths([futur, nul], localEic, effectiveDate);
    expect(out.paths).toHaveLength(2);
    expect(out.paths.every((p) => !p.isExpired)).toBe(true);
  });

  it('mappe correctement tous les champs', () => {
    const rows = [baseRow({
      allowedSenders: '17V0000015538278',
      intermediateBrokerCode: '10V1001C--00087P',
      transportPattern: 'INDIRECT',
      messageType: 'MRC-XBID-A01A19-511',
      validFrom: new Date('2025-12-19T23:00:00.000Z'),
      validTo: null,
    })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths[0]).toEqual({
      receiverEic: localEic,
      senderEic: '17V0000015538278',
      messageType: 'MRC-XBID-A01A19-511',
      transportPattern: 'INDIRECT',
      intermediateBrokerEic: '10V1001C--00087P',
      validFrom: new Date('2025-12-19T23:00:00.000Z'),
      validTo: null,
      isExpired: false,
    });
  });

  it('intermediateBrokerCode null -> intermediateBrokerEic null', () => {
    const rows = [baseRow({ transportPattern: 'DIRECT', intermediateBrokerCode: null })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths[0]!.intermediateBrokerEic).toBeNull();
  });
});
