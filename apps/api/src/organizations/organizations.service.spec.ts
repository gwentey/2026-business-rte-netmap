import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { OrganizationsService } from './organizations.service.js';

const registryMock = {
  resolveByCountry: (country: string | null | undefined) => {
    if (country === 'FR') return { lat: 48.8566, lng: 2.3522 };
    return null;
  },
};

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationsService,
        PrismaService,
        { provide: RegistryService, useValue: registryMock },
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OrganizationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.organizationEntry.deleteMany({
      where: { organizationName: { startsWith: 'test-svc-' } },
    });
  });

  afterEach(async () => {
    await prisma.organizationEntry.deleteMany({
      where: { organizationName: { startsWith: 'test-svc-' } },
    });
  });

  describe('create', () => {
    it('cree une nouvelle entry avec userEdited=true', async () => {
      const created = await service.create({
        displayName: 'Test-Svc-Alpha',
        country: 'FR',
        typeHint: 'TSO',
      });
      expect(created.organizationName).toBe('test-svc-alpha');
      expect(created.country).toBe('FR');
      expect(created.userEdited).toBe(true);
      expect(created.seedVersion).toBe(0);
    });

    it('utilise organizationName explicite si fourni', async () => {
      const created = await service.create({
        organizationName: 'test-svc-beta-custom',
        displayName: 'Beta Display',
      });
      expect(created.organizationName).toBe('test-svc-beta-custom');
    });
  });

  describe('update', () => {
    it('met a jour les champs fournis et marque userEdited=true', async () => {
      const created = await service.create({ displayName: 'Test-Svc-Gamma', country: 'DE' });
      const updated = await service.update(created.id, { country: 'CH', address: 'Zurich' });
      expect(updated.country).toBe('CH');
      expect(updated.address).toBe('Zurich');
      expect(updated.userEdited).toBe(true);
    });

    it('jette si id inconnu', async () => {
      await expect(service.update('00000000-0000-0000-0000-000000000000', {})).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('delete', () => {
    it('supprime une entry existante', async () => {
      const created = await service.create({ displayName: 'Test-Svc-Delta' });
      await service.delete(created.id);
      await expect(service.getById(created.id)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('jette si id inconnu', async () => {
      await expect(service.delete('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('resolveByOrganization', () => {
    it('retourne null pour orgName null/vide', async () => {
      expect(await service.resolveByOrganization(null)).toBeNull();
      expect(await service.resolveByOrganization('')).toBeNull();
      expect(await service.resolveByOrganization('  ')).toBeNull();
    });

    it('retourne null pour orgName inconnu', async () => {
      expect(await service.resolveByOrganization('test-svc-unknown-xyz')).toBeNull();
    });

    it('trouve par nom normalise (case insensitive + trim)', async () => {
      await service.create({ displayName: 'Test-Svc-Epsilon', country: 'BE' });
      const found1 = await service.resolveByOrganization('Test-Svc-Epsilon');
      const found2 = await service.resolveByOrganization('  TEST-SVC-EPSILON  ');
      expect(found1).toEqual({
        country: 'BE',
        address: null,
        displayName: 'Test-Svc-Epsilon',
        lat: null,
        lng: null,
      });
      expect(found2).toEqual({
        country: 'BE',
        address: null,
        displayName: 'Test-Svc-Epsilon',
        lat: null,
        lng: null,
      });
    });
  });

  describe('loadAsMap', () => {
    it('charge toutes les entries indexees par organizationName', async () => {
      await service.create({ displayName: 'Test-Svc-Map-A', country: 'FR' });
      await service.create({ displayName: 'Test-Svc-Map-B', country: 'DE' });
      const map = await service.loadAsMap();
      expect(map.get('test-svc-map-a')?.country).toBe('FR');
      expect(map.get('test-svc-map-b')?.country).toBe('DE');
    });
  });

  describe('importJson', () => {
    it('insere les nouvelles entries et update les existantes', async () => {
      await service.create({ displayName: 'Test-Svc-Existing', country: 'FR' });
      const buffer = Buffer.from(JSON.stringify({
        version: 1,
        entries: [
          { organizationName: 'test-svc-existing', displayName: 'Test-Svc-Existing', country: 'BE' },
          { organizationName: 'test-svc-new', displayName: 'Test-Svc-New', country: 'DE' },
        ],
      }));
      const result = await service.importJson(buffer);
      expect(result.inserted).toBe(1);
      expect(result.updated).toBe(1);
      expect(result.skipped).toBe(0);

      const existing = await service.resolveByOrganization('test-svc-existing');
      expect(existing?.country).toBe('BE');
    });

    it('skip les entrees avec organizationName vide et trace les erreurs', async () => {
      const buffer = Buffer.from(JSON.stringify({
        version: 1,
        entries: [
          { organizationName: '', displayName: 'Empty' },
          { organizationName: 'test-svc-zeta', displayName: '' },
          { organizationName: 'test-svc-eta', displayName: 'Valid' },
        ],
      }));
      const result = await service.importJson(buffer);
      expect(result.inserted).toBe(1);
      expect(result.skipped).toBe(2);
      expect(result.errors).toHaveLength(2);
    });

    it('retourne une erreur pour un JSON invalide', async () => {
      const buffer = Buffer.from('{ not json');
      const result = await service.importJson(buffer);
      expect(result.inserted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.reason).toMatch(/JSON invalide/);
    });
  });

  describe('exportJson', () => {
    it('exporte toutes les entries au format versionne', async () => {
      await service.create({
        displayName: 'Test-Svc-Theta',
        country: 'NL',
        typeHint: 'TSO',
        lat: 52.37,
        lng: 4.89,
      });
      const buffer = await service.exportJson();
      const parsed = JSON.parse(buffer.toString('utf-8'));
      expect(parsed.version).toBe(2);
      expect(Array.isArray(parsed.entries)).toBe(true);
      const ours = parsed.entries.find((e: { organizationName: string }) =>
        e.organizationName === 'test-svc-theta',
      );
      expect(ours).toBeDefined();
      expect(ours.country).toBe('NL');
      expect(ours.typeHint).toBe('TSO');
      expect(ours.lat).toBe(52.37);
      expect(ours.lng).toBe(4.89);
    });
  });
});
