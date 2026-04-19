import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { OverridesService } from './overrides.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('OverridesService', () => {
  let service: OverridesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OverridesService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OverridesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  afterEach(async () => {
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  describe('upsert', () => {
    it('creates a new override row on first call', async () => {
      const result = await service.upsert('TEST_OV_A', { displayName: 'Test A', lat: 48.8, lng: 2.3 });
      expect(result.eic).toBe('TEST_OV_A');
      expect(result.displayName).toBe('Test A');
      expect(result.lat).toBe(48.8);
      expect(result.lng).toBe(2.3);
    });

    it('updates existing override on second call', async () => {
      await service.upsert('TEST_OV_B', { displayName: 'First' });
      const updated = await service.upsert('TEST_OV_B', { displayName: 'Second', country: 'FR' });
      expect(updated.displayName).toBe('Second');
      expect(updated.country).toBe('FR');
    });

    it('sets field to null explicitly', async () => {
      await service.upsert('TEST_OV_C', { displayName: 'Set', lat: 48 });
      const cleared = await service.upsert('TEST_OV_C', { lat: null });
      expect(cleared.lat).toBeNull();
      expect(cleared.displayName).toBe('Set');
    });
  });

  describe('delete', () => {
    it('removes an existing override', async () => {
      await service.upsert('TEST_OV_D', { displayName: 'To delete' });
      await service.delete('TEST_OV_D');
      const found = await prisma.componentOverride.findUnique({ where: { eic: 'TEST_OV_D' } });
      expect(found).toBeNull();
    });

    it('throws NotFoundException if override does not exist', async () => {
      await expect(service.delete('TEST_OV_UNKNOWN')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'OVERRIDE_NOT_FOUND' }),
      });
    });
  });
});
