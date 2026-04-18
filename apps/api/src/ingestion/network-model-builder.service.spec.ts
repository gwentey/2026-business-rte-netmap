import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { RegistryService } from '../registry/registry.service.js';
import { NetworkModelBuilderService } from './network-model-builder.service.js';
import type {
  AppPropertyRow,
  MadesTree,
} from './types.js';

const endpointAppProps: AppPropertyRow[] = [
  { key: 'ecp.componentCode', value: '17V000000498771C', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.projectName', value: 'ECP-INTERNET-2', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.envName', value: 'OPF', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.company.organization', value: 'RTE', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.networks', value: 'internet', changedBy: null, createdDate: null, modifiedDate: null },
  {
    key: 'ecp.directory.client.synchronization.homeComponentDirectoryPrimaryCode',
    value: '17V000002014106G',
    changedBy: null, createdDate: null, modifiedDate: null,
  },
];

const cdAppProps: AppPropertyRow[] = [
  { key: 'ecp.componentCode', value: '17V000002014106G', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.envName', value: 'OPF', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.company.organization', value: 'RTE', changedBy: null, createdDate: null, modifiedDate: null },
  { key: 'ecp.networks', value: 'internet', changedBy: null, createdDate: null, modifiedDate: null },
];

function madesTreeStub(): MadesTree {
  return {
    cdCode: '17V000002014106G',
    contentId: 1,
    ttl: 60000,
    brokers: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17VRTE-BROKER-01', type: 'BROKER', networks: ['internet'],
        urls: [{ network: 'internet', url: 'amqps://10.0.0.1:5671' }],
        certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [],
      },
    ],
    endpoints: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17V000000498771C', type: 'ENDPOINT', networks: ['internet'],
        urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [
          { senderComponent: null, messageType: 'RSMD', transportPattern: 'DIRECT', brokerCode: null, validFrom: new Date('2025-01-01'), validTo: null },
        ],
      },
      {
        organization: 'Terna', personName: 'y', email: 'y@terna.it', phone: '0',
        code: '10X1001A1001A345', type: 'ENDPOINT', networks: ['internet'],
        urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G',
        paths: [
          { senderComponent: null, messageType: 'CGM', transportPattern: 'INDIRECT', brokerCode: '17VRTE-BROKER-01', validFrom: new Date('2025-01-01'), validTo: null },
        ],
      },
    ],
    componentDirectories: [
      {
        organization: 'RTE', personName: 'x', email: 'x@rte.fr', phone: '0',
        code: '17V000002014106G', type: 'COMPONENT_DIRECTORY',
        networks: ['internet'], urls: [], certificates: [],
        creationTs: new Date('2025-01-01'), modificationTs: new Date('2025-01-01'),
        homeCdCode: '17V000002014106G', paths: [],
      },
    ],
  };
}

describe('NetworkModelBuilderService', () => {
  let service: NetworkModelBuilderService;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({
      providers: [NetworkModelBuilderService, RegistryService],
    }).compile();
    service = ref.get(NetworkModelBuilderService);
    await ref.get(RegistryService).onModuleInit();
  });

  it('detects componentType=ENDPOINT from appProperties', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.meta.componentType).toBe('ENDPOINT');
    expect(snap.meta.sourceComponentCode).toBe('17V000000498771C');
    expect(snap.meta.cdCode).toBe('17V000002014106G');
    expect(snap.meta.organization).toBe('RTE');
  });

  it('detects componentType=COMPONENT_DIRECTORY', () => {
    const tree = madesTreeStub();
    const snap = service.build({
      appProperties: cdAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.meta.componentType).toBe('COMPONENT_DIRECTORY');
    expect(snap.meta.sourceComponentCode).toBe('17V000002014106G');
    expect(snap.meta.cdCode).toBe('17V000002014106G');
  });

  it('enriches RTE endpoint with overlay coordinates (precise, not default)', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    const rte = snap.components.find((c) => c.eic === '17V000000498771C');
    expect(rte?.isDefaultPosition).toBe(false);
    expect(rte?.lat).toBeCloseTo(48.8918);
  });

  it('assigns direction=IN when receiver is a RTE endpoint, OUT otherwise', () => {
    const tree = madesTreeStub();
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    const rsmdPath = snap.messagePaths.find((p) => p.messageType === 'RSMD');
    expect(rsmdPath?.direction).toBe('IN');
    const cgmPath = snap.messagePaths.find((p) => p.messageType === 'CGM');
    expect(cgmPath?.direction).toBe('OUT');
  });

  it('classifies messageType via registry cascade', () => {
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: madesTreeStub(),
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.messagePaths.find((p) => p.messageType === 'RSMD')?.process).toBe('VP');
    expect(snap.messagePaths.find((p) => p.messageType === 'CGM')?.process).toBe('CORE');
  });

  it('emits a warning when an EIC falls back to default position', () => {
    const tree = madesTreeStub();
    tree.endpoints.push({
      organization: 'UnknownOrg', personName: 'x', email: '', phone: '',
      code: 'XX-TOTALLY-UNKNOWN', type: 'ENDPOINT', networks: [],
      urls: [], certificates: [],
      creationTs: null, modificationTs: null, homeCdCode: '17V000002014106G',
      paths: [],
    });
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.warnings.some((w) => w.code === 'EIC_UNKNOWN_IN_REGISTRY')).toBe(true);
  });

  it('tags a MessagePath as expired when validTo < current time', () => {
    const tree = madesTreeStub();
    tree.endpoints[0].paths = [
      { senderComponent: null, messageType: 'RSMD', transportPattern: 'DIRECT', brokerCode: null, validFrom: new Date('2020-01-01'), validTo: new Date('2021-01-01') },
    ];
    const snap = service.build({
      appProperties: endpointAppProps,
      madesTree: tree,
      messagingStats: [],
      localMessagePaths: [],
      envName: 'OPF',
    });
    expect(snap.messagePaths[0].isExpired).toBe(true);
  });
});
