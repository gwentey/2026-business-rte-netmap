import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SnapshotPersisterService } from './snapshot-persister.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { NetworkSnapshot } from './types.js';

const { mkdirMock, writeFileMock, unlinkMock } = vi.hoisted(() => ({
  mkdirMock: vi.fn(),
  writeFileMock: vi.fn(),
  unlinkMock: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  mkdir: mkdirMock,
  writeFile: writeFileMock,
  unlink: unlinkMock,
}));

function buildMinimalNetworkSnapshot(): NetworkSnapshot {
  return {
    meta: {
      componentType: 'ENDPOINT',
      sourceComponentCode: 'SRC-EIC',
      cdCode: 'CD-EIC',
      envName: 'TEST',
      organization: 'RTE',
      networks: ['TP'],
    },
    components: [
      {
        eic: '17V000000498771C',
        type: 'ENDPOINT',
        organization: 'RTE',
        personName: null,
        email: null,
        phone: null,
        homeCdCode: 'CD-EIC',
        networks: ['TP'],
        creationTs: new Date('2025-01-01T00:00:00Z'),
        modificationTs: new Date('2025-01-02T00:00:00Z'),
        displayName: 'INTERNET-2',
        country: 'FR',
        lat: 48.89,
        lng: 2.34,
        isDefaultPosition: false,
        process: 'TP',
        sourceType: 'XML_CD',
        urls: [],
      },
    ],
    messagePaths: [],
    messagingStats: [],
    appProperties: [],
    warnings: [],
  };
}

function makePrismaMock(transactionBehavior: 'resolve' | 'reject' = 'resolve') {
  const txSnapshot = { create: vi.fn().mockResolvedValue({}) };
  const txComponent = { create: vi.fn().mockResolvedValue({}) };
  const txMessagePath = { createMany: vi.fn().mockResolvedValue({}) };
  const txMessagingStatistic = { createMany: vi.fn().mockResolvedValue({}) };
  const txAppProperty = { createMany: vi.fn().mockResolvedValue({}) };
  const tx = {
    snapshot: txSnapshot,
    component: txComponent,
    messagePath: txMessagePath,
    messagingStatistic: txMessagingStatistic,
    appProperty: txAppProperty,
  };
  const $transaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    if (transactionBehavior === 'reject') {
      throw new Error('DB transaction failed');
    }
    return cb(tx);
  });
  return { $transaction, _tx: tx };
}

describe('SnapshotPersisterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('nominal : writes zip and runs transaction, returns IngestionResult', async () => {
    const prismaMock = makePrismaMock('resolve');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    const result = await service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-1');

    expect(mkdirMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(unlinkMock).not.toHaveBeenCalled();
    expect(result.componentType).toBe('ENDPOINT');
    expect(result.sourceComponentCode).toBe('SRC-EIC');
    expect(typeof result.snapshotId).toBe('string');
  });

  it('transaction failure : unlinks zip and rethrows the transaction error', async () => {
    const prismaMock = makePrismaMock('reject');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    await expect(
      service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-2'),
    ).rejects.toThrow('DB transaction failed');

    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(unlinkMock).toHaveBeenCalledTimes(1);
  });

  it('cleanup failure : logs warning but rethrows the ORIGINAL transaction error', async () => {
    const prismaMock = makePrismaMock('reject');
    const service = new SnapshotPersisterService(prismaMock as unknown as PrismaService);
    const snap = buildMinimalNetworkSnapshot();

    const warnSpy = vi.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
    unlinkMock.mockRejectedValueOnce(new Error('cleanup boom'));

    await expect(
      service.persist(snap, Buffer.from([0x50, 0x4b, 0x03, 0x04]), 'label-3'),
    ).rejects.toThrow('DB transaction failed');

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to cleanup orphaned zip'),
    );
  });
});
