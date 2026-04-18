import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotsService } from './snapshots.service.js';
import { SnapshotNotFoundException } from '../common/errors/ingestion-errors.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makePrismaMock() {
  return {
    snapshot: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

describe('SnapshotsService', () => {
  let prismaMock: ReturnType<typeof makePrismaMock>;
  let service: SnapshotsService;

  beforeEach(() => {
    prismaMock = makePrismaMock();
    service = new SnapshotsService(prismaMock as unknown as PrismaService);
  });

  describe('list', () => {
    it('queries without filter when envName is undefined', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
      await service.list();
      expect(prismaMock.snapshot.findMany).toHaveBeenCalledWith({
        where: undefined,
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('queries with envName filter when provided', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([]);
      await service.list('OPF');
      expect(prismaMock.snapshot.findMany).toHaveBeenCalledWith({
        where: { envName: 'OPF' },
        orderBy: { uploadedAt: 'desc' },
      });
    });

    it('maps warningsJson to warningCount in each summary', async () => {
      prismaMock.snapshot.findMany.mockResolvedValueOnce([
        {
          id: 'a',
          label: 'Snap A',
          envName: 'OPF',
          componentType: 'ENDPOINT',
          sourceComponentCode: 'X',
          cdCode: 'Y',
          uploadedAt: new Date('2026-04-18T12:00:00Z'),
          warningsJson: JSON.stringify([
            { code: 'UNKNOWN_EIC', message: 'a' },
            { code: 'UNKNOWN_EIC', message: 'b' },
          ]),
        },
      ]);
      const rows = await service.list();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.warningCount).toBe(2);
    });
  });

  describe('detail', () => {
    it('returns SnapshotDetail with stats from _count', async () => {
      prismaMock.snapshot.findUnique.mockResolvedValueOnce({
        id: 'abc',
        label: 'Snap X',
        envName: 'PROD',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'SRC',
        cdCode: 'CD',
        uploadedAt: new Date('2026-04-18T12:00:00Z'),
        warningsJson: '[]',
        organization: 'RTE',
        _count: { components: 42, messagePaths: 10, messagingStats: 5 },
      });
      const d = await service.detail('abc');
      expect(d.id).toBe('abc');
      expect(d.stats.componentsCount).toBe(42);
      expect(d.stats.pathsCount).toBe(10);
      expect(d.stats.statsCount).toBe(5);
      expect(d.warnings).toEqual([]);
    });

    it('throws SnapshotNotFoundException when id is not found', async () => {
      prismaMock.snapshot.findUnique.mockResolvedValueOnce(null);
      await expect(service.detail('bogus')).rejects.toThrow(SnapshotNotFoundException);
    });
  });
});
