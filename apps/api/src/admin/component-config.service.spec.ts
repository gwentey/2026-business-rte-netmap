import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ComponentConfigService } from './component-config.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { randomUUID } from 'node:crypto';

describe('ComponentConfigService', () => {
  let service: ComponentConfigService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ComponentConfigService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ComponentConfigService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_CONFIG' } } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_CONFIG' } } });
  });

  it('returns source=null and empty sections when no Import has this EIC as source', async () => {
    const result = await service.getConfig('17V000000000000X');
    expect(result.source).toBeNull();
    expect(result.sections).toEqual([]);
    expect(result.eic).toBe('17V000000000000X');
  });

  it('groups properties by section and orders keys alphabetically inside each section', async () => {
    const id = randomUUID();
    await prisma.import.create({
      data: {
        id,
        envName: 'TEST_CONFIG_GROUP',
        label: 'test',
        fileName: 'x.zip',
        fileHash: 'h'.repeat(64),
        sourceComponentEic: '17V000000498771C',
        dumpType: 'ENDPOINT',
        zipPath: 'storage/test.zip',
        effectiveDate: new Date(),
        hasConfigurationProperties: true,
        importedProps: {
          create: [
            { key: 'ecp.projectName', value: 'INTERNET-EP2' },
            { key: 'ecp.envName', value: 'PFRFI' },
            { key: 'ecp.company.organization', value: 'RTE' },
            { key: 'ecp.company.contactEmail', value: 'ops@rte-france.com' },
            { key: 'ecp.endpoint.antivirus.antivirusEnabled', value: 'false' },
            { key: 'ecp.endpoint.archive.binaryPathExpression', value: '/tmp' },
            { key: 'ecp.natEnabled', value: 'true' },
            { key: 'something.weird.outside.ecp', value: 'will-be-misc' },
          ],
        },
      },
    });

    const result = await service.getConfig('17V000000498771C');

    expect(result.source).not.toBeNull();
    expect(result.source!.hasConfigurationProperties).toBe(true);
    expect(result.source!.envName).toBe('TEST_CONFIG_GROUP');

    const slugs = result.sections.map((s) => s.slug);
    expect(slugs).toContain('identification'); // projectName + envName
    expect(slugs).toContain('contact'); // company.*
    expect(slugs).toContain('antivirus');
    expect(slugs).toContain('archive');
    expect(slugs).toContain('network'); // natEnabled
    expect(slugs).toContain('misc');    // clé inconnue

    const identification = result.sections.find((s) => s.slug === 'identification')!;
    // Keys sorted alphabetically
    expect(identification.properties.map((p) => p.key)).toEqual([
      'ecp.envName',
      'ecp.projectName',
    ]);

    const contact = result.sections.find((s) => s.slug === 'contact')!;
    expect(contact.properties).toHaveLength(2);

    const misc = result.sections.find((s) => s.slug === 'misc')!;
    expect(misc.properties).toHaveLength(1);
    expect(misc.properties[0]!.key).toBe('something.weird.outside.ecp');
  });

  it('picks the most recent Import (by effectiveDate desc) when multiple imports share the source EIC', async () => {
    const older = randomUUID();
    const newer = randomUUID();
    await prisma.import.createMany({
      data: [
        {
          id: older,
          envName: 'TEST_CONFIG_MULTI',
          label: 'older',
          fileName: 'o.zip',
          fileHash: 'a'.repeat(64),
          sourceComponentEic: '17V000000498771C',
          dumpType: 'ENDPOINT',
          zipPath: 'storage/o.zip',
          effectiveDate: new Date('2026-04-01T00:00:00Z'),
        },
        {
          id: newer,
          envName: 'TEST_CONFIG_MULTI',
          label: 'newer',
          fileName: 'n.zip',
          fileHash: 'b'.repeat(64),
          sourceComponentEic: '17V000000498771C',
          dumpType: 'ENDPOINT',
          zipPath: 'storage/n.zip',
          effectiveDate: new Date('2026-04-20T00:00:00Z'),
        },
      ],
    });
    await prisma.importedAppProperty.createMany({
      data: [
        { importId: older, key: 'ecp.projectName', value: 'OLD-NAME' },
        { importId: newer, key: 'ecp.projectName', value: 'NEW-NAME' },
      ],
    });

    const result = await service.getConfig('17V000000498771C');
    expect(result.source!.label).toBe('newer');
    const id = result.sections.find((s) => s.slug === 'identification')!;
    expect(id.properties[0]!.value).toBe('NEW-NAME');
  });
});
