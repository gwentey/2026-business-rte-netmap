import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { RawPersisterService } from './raw-persister.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BuiltImport } from './types.js';
import { existsSync, unlinkSync } from 'node:fs';
import AdmZip from 'adm-zip';

function makeBuilt(): BuiltImport {
  return {
    envName: 'TEST_RAW_PERSIST',
    label: 'test-persist',
    fileName: 'fake.zip',
    fileHash: 'abc123',
    dumpType: 'ENDPOINT',
    sourceComponentEic: '17V000000TEST___A',
    sourceDumpTimestamp: new Date('2026-04-17T21:27:17Z'),
    effectiveDate: new Date('2026-04-17T21:27:17Z'),
    hasConfigurationProperties: false,
    components: [{
      eic: 'EIC-RP-1', type: 'ENDPOINT',
      organization: 'RTE', personName: null, email: null, phone: null,
      homeCdCode: null, networksCsv: null, displayName: 'E1', projectName: null, country: null,
      lat: null, lng: null, isDefaultPosition: true,
      sourceType: 'LOCAL_CSV', creationTs: null, modificationTs: null,
      urls: [{ network: 'PUBLIC_NETWORK', url: 'https://example.com' }],
    }],
    paths: [{
      receiverEic: 'EIC-RP-1', senderEic: 'EIC-RP-2',
      messageType: 'A06', transportPattern: 'DIRECT',
      intermediateBrokerEic: null,
      validFrom: null, validTo: null, isExpired: false,
    }],
    messagingStats: [],
    appProperties: [{ key: 'foo', value: 'bar' }],
    directorySyncs: [],
    warnings: [],
  };
}

function makeValidZipBuffer(): Buffer {
  const z = new AdmZip();
  z.addFile('application_property.csv', Buffer.from('key,value\nfoo,bar\n'));
  z.addFile('local_key_store.csv', Buffer.from('SENSITIVE_DATA\n'));
  return z.toBuffer();
}

describe('RawPersisterService', () => {
  let persister: RawPersisterService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RawPersisterService, PrismaService],
    }).compile();
    await moduleRef.init();
    persister = moduleRef.get(RawPersisterService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'TEST_RAW_PERSIST' } });
  });

  afterEach(async () => {
    const existing = await prisma.import.findMany({ where: { envName: 'TEST_RAW_PERSIST' } });
    for (const i of existing) {
      if (existsSync(i.zipPath)) { try { unlinkSync(i.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: 'TEST_RAW_PERSIST' } });
  });

  it('persists an import with components, paths, urls, and app properties in a transaction', async () => {
    const built = makeBuilt();
    const result = await persister.persist(built, makeValidZipBuffer());
    expect(result.id).toBeTruthy();
    expect(result.zipPath).toMatch(/storage[\/\\]imports[\/\\]/);
    expect(existsSync(result.zipPath)).toBe(true);

    const inDb = await prisma.import.findUnique({
      where: { id: result.id },
      include: {
        importedComponents: { include: { urls: true } },
        importedPaths: true,
        importedProps: true,
      },
    });
    expect(inDb).not.toBeNull();
    expect(inDb!.envName).toBe('TEST_RAW_PERSIST');
    expect(inDb!.importedComponents).toHaveLength(1);
    expect(inDb!.importedComponents[0]!.urls).toHaveLength(1);
    expect(inDb!.importedComponents[0]!.urls[0]!.network).toBe('PUBLIC_NETWORK');
    expect(inDb!.importedPaths).toHaveLength(1);
    expect(inDb!.importedProps).toHaveLength(1);
  });

  it('removes local_key_store.csv from the archived zip (repackaging sans sensibles)', async () => {
    const built = makeBuilt();
    const result = await persister.persist(built, makeValidZipBuffer());
    const archived = new AdmZip(result.zipPath);
    const entries = archived.getEntries().map((e) => e.entryName);
    expect(entries).toContain('application_property.csv');
    expect(entries).not.toContain('local_key_store.csv');
  });
});
