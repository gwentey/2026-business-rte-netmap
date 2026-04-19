import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { EntsoeService } from './entsoe.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const CSV_SAMPLE = [
  'EicCode;EicDisplayName;EicLongName;EicParent;EicResponsibleParty;EicStatus;MarketParticipantPostalCode;MarketParticipantIsoCountryCode;MarketParticipantVatCode;EicTypeFunctionList;type',
  '10X1001A1001A094;ELIA;Elia Transmission Belgium;;;Active;1000;BE;BE0731852231;System Operator;X',
  '10XAT-APG------Z;APG;Austrian Power Grid;;;Active;;AT;;System Operator;X',
  '10XFI-CONNECT-P;FINGRID;Fingrid Oyj;;;Active;;FI;;System Operator;X',
].join('\n');

describe('EntsoeService', () => {
  let service: EntsoeService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EntsoeService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(EntsoeService);
    prisma = moduleRef.get(PrismaService);
    await prisma.entsoeEntry.deleteMany();
  });

  afterEach(async () => {
    await prisma.entsoeEntry.deleteMany();
  });

  it('upload parses CSV and populates EntsoeEntry', async () => {
    const result = await service.upload(Buffer.from(CSV_SAMPLE, 'utf-8'));
    expect(result.count).toBe(3);
    const rows = await prisma.entsoeEntry.findMany();
    expect(rows).toHaveLength(3);
    const elia = rows.find((r) => r.eic === '10X1001A1001A094');
    expect(elia?.displayName).toBe('Elia Transmission Belgium');
    expect(elia?.country).toBe('BE');
    expect(elia?.function).toBe('System Operator');
  });

  it('upload replaces existing entries', async () => {
    await service.upload(Buffer.from(CSV_SAMPLE, 'utf-8'));
    const firstCount = await prisma.entsoeEntry.count();
    expect(firstCount).toBe(3);
    // Re-upload with only 1 row
    const smaller = [
      'EicCode;EicDisplayName;EicLongName;EicParent;EicResponsibleParty;EicStatus;MarketParticipantPostalCode;MarketParticipantIsoCountryCode;MarketParticipantVatCode;EicTypeFunctionList;type',
      '10XDE-VNG-------;VNG;VNG Gas;;;Active;;DE;;System Operator;X',
    ].join('\n');
    await service.upload(Buffer.from(smaller, 'utf-8'));
    expect(await prisma.entsoeEntry.count()).toBe(1);
    const row = await prisma.entsoeEntry.findUnique({ where: { eic: '10XDE-VNG-------' } });
    expect(row?.country).toBe('DE');
  });

  it('status returns empty when table is empty', async () => {
    const status = await service.status();
    expect(status.count).toBe(0);
    expect(status.refreshedAt).toBeNull();
  });

  it('status returns count and refreshedAt after upload', async () => {
    await service.upload(Buffer.from(CSV_SAMPLE, 'utf-8'));
    const status = await service.status();
    expect(status.count).toBe(3);
    expect(status.refreshedAt).not.toBeNull();
    expect(new Date(status.refreshedAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });
});
