import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrganizationSeederService } from './organization-seeder.service.js';

describe('OrganizationSeederService.applySeed', () => {
  let service: OrganizationSeederService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OrganizationSeederService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OrganizationSeederService);
    prisma = moduleRef.get(PrismaService);
    await prisma.organizationEntry.deleteMany({
      where: { organizationName: { startsWith: 'test-seed-' } },
    });
  });

  afterEach(async () => {
    await prisma.organizationEntry.deleteMany({
      where: { organizationName: { startsWith: 'test-seed-' } },
    });
  });

  it('premier seed : insere toutes les entrees absentes', async () => {
    const result = await service.applySeed({
      version: 1,
      entries: [
        { organizationName: 'test-seed-alpha', displayName: 'Alpha Org', country: 'FR', typeHint: 'TSO' },
        { organizationName: 'test-seed-beta', displayName: 'Beta Org', country: 'DE', typeHint: 'NEMO' },
      ],
    });
    expect(result).toEqual({ inserted: 2, refreshed: 0, preserved: 0 });

    const alpha = await prisma.organizationEntry.findUnique({
      where: { organizationName: 'test-seed-alpha' },
    });
    expect(alpha).not.toBeNull();
    expect(alpha!.country).toBe('FR');
    expect(alpha!.seedVersion).toBe(1);
    expect(alpha!.userEdited).toBe(false);
  });

  it('re-seed meme version : no-op', async () => {
    await service.applySeed({
      version: 1,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha', country: 'FR' }],
    });
    const result = await service.applySeed({
      version: 1,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha modifie', country: 'DE' }],
    });
    expect(result).toEqual({ inserted: 0, refreshed: 0, preserved: 0 });
    const row = await prisma.organizationEntry.findUnique({
      where: { organizationName: 'test-seed-alpha' },
    });
    expect(row!.displayName).toBe('Alpha');
    expect(row!.country).toBe('FR');
  });

  it('re-seed version superieure + userEdited=false : refresh les champs', async () => {
    await service.applySeed({
      version: 1,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha v1', country: 'FR', typeHint: 'TSO' }],
    });
    const result = await service.applySeed({
      version: 2,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha v2', country: 'BE', typeHint: 'NEMO' }],
    });
    expect(result).toEqual({ inserted: 0, refreshed: 1, preserved: 0 });
    const row = await prisma.organizationEntry.findUnique({
      where: { organizationName: 'test-seed-alpha' },
    });
    expect(row!.displayName).toBe('Alpha v2');
    expect(row!.country).toBe('BE');
    expect(row!.typeHint).toBe('NEMO');
    expect(row!.seedVersion).toBe(2);
  });

  it('re-seed version superieure + userEdited=true : PRESERVE les champs', async () => {
    await service.applySeed({
      version: 1,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha v1', country: 'FR' }],
    });
    // Simule une edition utilisateur
    await prisma.organizationEntry.update({
      where: { organizationName: 'test-seed-alpha' },
      data: { country: 'CH', address: 'Edited by user', userEdited: true },
    });

    const result = await service.applySeed({
      version: 2,
      entries: [{ organizationName: 'test-seed-alpha', displayName: 'Alpha v2', country: 'DE' }],
    });
    expect(result).toEqual({ inserted: 0, refreshed: 0, preserved: 1 });
    const row = await prisma.organizationEntry.findUnique({
      where: { organizationName: 'test-seed-alpha' },
    });
    // Champs utilisateur preserves
    expect(row!.country).toBe('CH');
    expect(row!.address).toBe('Edited by user');
    expect(row!.displayName).toBe('Alpha v1');
    // seedVersion bumpe malgre tout
    expect(row!.seedVersion).toBe(2);
    expect(row!.userEdited).toBe(true);
  });

  it('ignore les entrees avec organizationName vide', async () => {
    const result = await service.applySeed({
      version: 1,
      entries: [
        { organizationName: '', displayName: 'Empty' },
        { organizationName: '   ', displayName: 'Whitespace' },
        { organizationName: 'test-seed-valid', displayName: 'Valid' },
      ],
    });
    expect(result).toEqual({ inserted: 1, refreshed: 0, preserved: 0 });
  });

  it('normalise organizationName au seed (lowercase + trim)', async () => {
    await service.applySeed({
      version: 1,
      entries: [{ organizationName: '  Test-Seed-Mixed-Case  ', displayName: 'Mixed' }],
    });
    const row = await prisma.organizationEntry.findUnique({
      where: { organizationName: 'test-seed-mixed-case' },
    });
    expect(row).not.toBeNull();
    expect(row!.displayName).toBe('Mixed');
  });
});
