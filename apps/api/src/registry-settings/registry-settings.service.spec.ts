import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { RegistrySettingsService } from './registry-settings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';

describe('RegistrySettingsService', () => {
  let service: RegistrySettingsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RegistrySettingsService, PrismaService, RegistryService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(RegistrySettingsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.processColorOverride.deleteMany();
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: '17VRTE-TEST' } } });
  });

  afterEach(async () => {
    await prisma.processColorOverride.deleteMany();
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: '17VRTE-TEST' } } });
  });

  describe('listProcessColors', () => {
    it('returns 8 rows with default colors and isOverride=false when DB is empty', async () => {
      const rows = await service.listProcessColors();
      expect(rows).toHaveLength(8);
      const processes = rows.map((r) => r.process).sort();
      expect(processes).toEqual(
        ['CORE', 'MARI', 'MIXTE', 'PICASSO', 'TP', 'UK-CC-IN', 'UNKNOWN', 'VP'].sort(),
      );
      for (const row of rows) {
        expect(row.isOverride).toBe(false);
        expect(row.color).toBe(row.default);
        expect(row.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('returns isOverride=true and override color when a DB row exists', async () => {
      await prisma.processColorOverride.create({ data: { process: 'TP', color: '#123456' } });
      const rows = await service.listProcessColors();
      const tp = rows.find((r) => r.process === 'TP');
      expect(tp).toBeDefined();
      expect(tp!.isOverride).toBe(true);
      expect(tp!.color).toBe('#123456');
      expect(tp!.default).not.toBe('#123456');
      const core = rows.find((r) => r.process === 'CORE');
      expect(core!.isOverride).toBe(false);
    });
  });

  describe('upsertProcessColor', () => {
    it('creates a new override row on first call', async () => {
      await service.upsertProcessColor('VP', '#abcdef');
      const saved = await prisma.processColorOverride.findUnique({ where: { process: 'VP' } });
      expect(saved?.color).toBe('#abcdef');
    });

    it('updates an existing override row on second call', async () => {
      await service.upsertProcessColor('VP', '#abcdef');
      await service.upsertProcessColor('VP', '#111111');
      const saved = await prisma.processColorOverride.findUnique({ where: { process: 'VP' } });
      expect(saved?.color).toBe('#111111');
    });

    it('rejects an unknown process with INVALID_PROCESS', async () => {
      await expect(service.upsertProcessColor('UNKNOWN_PROC', '#abcdef')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_PROCESS' }),
      });
    });

    it('rejects an invalid color format with INVALID_COLOR', async () => {
      await expect(service.upsertProcessColor('TP', 'red')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_COLOR' }),
      });
      await expect(service.upsertProcessColor('TP', '#FFF')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_COLOR' }),
      });
    });
  });

  describe('resetProcessColor', () => {
    it('removes an existing override', async () => {
      await service.upsertProcessColor('MARI', '#abcdef');
      await service.resetProcessColor('MARI');
      const saved = await prisma.processColorOverride.findUnique({ where: { process: 'MARI' } });
      expect(saved).toBeNull();
    });

    it('is idempotent on non-existent override', async () => {
      await expect(service.resetProcessColor('CORE')).resolves.toBeUndefined();
    });

    it('rejects an unknown process with INVALID_PROCESS', async () => {
      await expect(service.resetProcessColor('NOPE')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'INVALID_PROCESS' }),
      });
    });
  });

  describe('getEffectiveProcessColors', () => {
    it('returns a ProcessColorMap with override applied and defaults elsewhere', async () => {
      await service.upsertProcessColor('TP', '#aabbcc');
      const map = await service.getEffectiveProcessColors();
      expect(map.TP).toBe('#aabbcc');
      expect(Object.keys(map).sort()).toEqual(
        ['CORE', 'MARI', 'MIXTE', 'PICASSO', 'TP', 'UK-CC-IN', 'UNKNOWN', 'VP'].sort(),
      );
      for (const [key, color] of Object.entries(map)) {
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
        if (key !== 'TP') {
          // default color from overlay
          expect(color).toBeDefined();
        }
      }
    });
  });

  describe('listRteEndpoints', () => {
    it('returns one row per overlay RTE endpoint with hasOverride=false by default', async () => {
      const rows = await service.listRteEndpoints();
      expect(rows.length).toBeGreaterThanOrEqual(6);
      for (const row of rows) {
        expect(row.eic).toMatch(/^[0-9]{2}/);
        expect(row.code).toBeTruthy();
        expect(row.displayName).toBeTruthy();
        expect(typeof row.lat).toBe('number');
        expect(typeof row.lng).toBe('number');
        expect(row.hasOverride).toBe(false);
      }
    });

    it('merges ComponentOverride when present: hasOverride=true and fields take override values', async () => {
      // Use the first overlay endpoint EIC as target
      const rows0 = await service.listRteEndpoints();
      const target = rows0[0]!;
      await prisma.componentOverride.create({
        data: {
          eic: target.eic,
          displayName: 'OVERRIDDEN_NAME',
          lat: 40.0,
          lng: 10.0,
        },
      });
      try {
        const rows = await service.listRteEndpoints();
        const hit = rows.find((r) => r.eic === target.eic);
        expect(hit).toBeDefined();
        expect(hit!.hasOverride).toBe(true);
        expect(hit!.displayName).toBe('OVERRIDDEN_NAME');
        expect(hit!.lat).toBe(40.0);
        expect(hit!.lng).toBe(10.0);
      } finally {
        await prisma.componentOverride.deleteMany({ where: { eic: target.eic } });
      }
    });
  });
});
