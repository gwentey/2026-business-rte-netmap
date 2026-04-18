import { describe, it, expect, beforeAll } from 'vitest';
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

  describe('resolveComponent', () => {
    it('resolves an RTE endpoint from the overlay precisely', () => {
      const res = service.resolveComponent('17V000000498771C', 'RTE');
      expect(res.displayName).toBe('INTERNET-2');
      expect(res.lat).toBeCloseTo(48.8918);
      expect(res.isDefaultPosition).toBe(false);
    });

    it('resolves the RTE CD from the overlay', () => {
      const res = service.resolveComponent('17V000002014106G', 'RTE');
      expect(res.displayName).toBe('CD RTE');
      expect(res.isDefaultPosition).toBe(false);
    });

    it('uses organization geocode when EIC is known to ENTSO-E', () => {
      const res = service.resolveComponent('10X1001A1001A345', 'Terna');
      expect(res.country).toBe('IT');
      expect(res.lat).toBeCloseTo(41.9028);
      expect(res.isDefaultPosition).toBe(false);
    });

    it('falls back to country geocode if organization is unknown', () => {
      const res = service.resolveComponent('10X1001A1001A248', 'Energinet');
      expect(res.country).toBe('DK');
      expect(res.isDefaultPosition).toBe(false);
    });

    it('falls back to default (Brussels) when EIC is totally unknown', () => {
      const res = service.resolveComponent('XXUNKNOWN_EIC', 'NoOrg');
      expect(res.isDefaultPosition).toBe(true);
      expect(res.lat).toBeCloseTo(50.8503);
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
});
