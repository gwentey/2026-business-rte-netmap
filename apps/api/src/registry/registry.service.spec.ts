import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { resolve } from 'node:path';
import { Test } from '@nestjs/testing';
import { RegistryService } from './registry.service.js';

describe('RegistryService', () => {
  let service: RegistryService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RegistryService],
    }).compile();
    service = moduleRef.get(RegistryService);
    await service.onModuleInit();
  });

  describe('ENTSO-E index', () => {
    it('loads the ENTSO-E CSV with expected row count', () => {
      expect(service.entsoeSize()).toBeGreaterThan(14000);
    });

    it('resolves Terna by EIC', () => {
      const entry = service.lookupEntsoe('10X1001A1001A345');
      expect(entry?.displayName).toBe('ITALY_TSO');
      expect(entry?.country).toBe('IT');
    });

    it('returns null for unknown EIC', () => {
      expect(service.lookupEntsoe('XXNOTAREALCODE')).toBeNull();
    });
  });

  describe('classifyMessageType', () => {
    it('uses exact mapping first', () => {
      expect(service.classifyMessageType('RSMD')).toBe('VP');
      expect(service.classifyMessageType('IDCCOR')).toBe('CORE');
    });

    it('uses regex patterns as fallback', () => {
      expect(service.classifyMessageType('VP-CUSTOM-123')).toBe('VP');
      expect(service.classifyMessageType('UK-CC-SOMETHING')).toBe('UK-CC-IN');
    });

    it('returns UNKNOWN when no rule matches', () => {
      expect(service.classifyMessageType('TOTALLY-RANDOM-XYZ')).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for wildcards', () => {
      expect(service.classifyMessageType('*')).toBe('UNKNOWN');
    });
  });

  describe('processColor', () => {
    it('returns hex color for each process', () => {
      expect(service.processColor('VP')).toBe('#ec4899');
      expect(service.processColor('MIXTE')).toBe('#4b5563');
    });
  });

  describe('getMapConfig (P3-4)', () => {
    it('returns the 4 map config fields with expected values', () => {
      const cfg = service.getMapConfig();
      expect(cfg.rteClusterLat).toBeCloseTo(48.8918);
      expect(cfg.rteClusterLng).toBeCloseTo(2.2378);
      expect(cfg.rteClusterOffsetDeg).toBeCloseTo(0.6);
      expect(cfg.rteClusterProximityDeg).toBeCloseTo(0.01);
    });
  });

  describe('getRteEicSet', () => {
    it('returns a Set containing all rteEndpoints EICs plus the rteComponentDirectory EIC', () => {
      const set = service.getRteEicSet();
      expect(set).toBeInstanceOf(Set);
      expect(set.has('17V000000498771C')).toBe(true);
      expect(set.has('17V000002014106G')).toBe(true);
    });
  });

  describe('registry path resolution', () => {
    const ORIGINAL_ENV = process.env.REGISTRY_PATH;
    const ORIGINAL_CWD = process.cwd();

    afterEach(() => {
      if (ORIGINAL_ENV === undefined) {
        delete process.env.REGISTRY_PATH;
      } else {
        process.env.REGISTRY_PATH = ORIGINAL_ENV;
      }
      process.chdir(ORIGINAL_CWD);
    });

    it('loads the registry from REGISTRY_PATH env var when set', async () => {
      process.env.REGISTRY_PATH = resolve(ORIGINAL_CWD, '../../packages/registry');
      const moduleRef = await Test.createTestingModule({
        providers: [RegistryService],
      }).compile();
      const svc = moduleRef.get(RegistryService);
      await svc.onModuleInit();
      expect(svc.entsoeSize()).toBeGreaterThan(14000);
    });

    it('throws ENOENT when REGISTRY_PATH points to a nonexistent directory', async () => {
      process.env.REGISTRY_PATH = '/tmp/nonexistent-registry-xyz-abc';
      const moduleRef = await Test.createTestingModule({
        providers: [RegistryService],
      }).compile();
      const svc = moduleRef.get(RegistryService);
      await expect(svc.onModuleInit()).rejects.toThrow(/ENOENT/);
    });
  });
});
