import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import type { Warning } from '@carto-ecp/shared';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { CdMessagePathRow } from './csv-reader.service.js';

function row(overrides: Partial<CdMessagePathRow> = {}): CdMessagePathRow {
  return {
    allowedSenders: '17V-A',
    intermediateBrokerCode: '',
    intermediateComponent: '',
    messageType: 'A06',
    receivers: '17V-X',
    transportPattern: 'DIRECT',
    validFrom: '',
    validTo: '',
    validUntil: '',
    ...overrides,
  };
}

describe('CsvPathReaderService', () => {
  let service: CsvPathReaderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CsvPathReaderService],
    }).compile();
    service = moduleRef.get(CsvPathReaderService);
  });

  it('explodes 1 sender × 1 receiver into 1 path', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths([row()], warnings);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.receiverEic).toBe('17V-X');
    expect(paths[0]!.senderEic).toBe('17V-A');
    expect(paths[0]!.messageType).toBe('A06');
    expect(paths[0]!.transportPattern).toBe('DIRECT');
    expect(paths[0]!.intermediateBrokerEic).toBeNull();
    expect(warnings).toHaveLength(0);
  });

  it('explodes 3 senders × 2 receivers into 6 paths (pipe separator)', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: 'A|B|C', receivers: 'X|Y' })],
      warnings,
    );
    expect(paths).toHaveLength(6);
    const pairs = new Set(paths.map((p) => `${p.senderEic}->${p.receiverEic}`));
    expect(pairs).toEqual(new Set(['A->X', 'A->Y', 'B->X', 'B->Y', 'C->X', 'C->Y']));
  });

  it('supports comma separator as fallback', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: 'A,B', receivers: 'X,Y' })],
      warnings,
    );
    expect(paths).toHaveLength(4);
  });

  it('treats empty allowedSenders as wildcard (single path with senderEic="*")', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: '', receivers: 'X|Y' })],
      warnings,
    );
    expect(paths).toHaveLength(2);
    expect(paths.every((p) => p.senderEic === '*')).toBe(true);
    expect(paths.map((p) => p.receiverEic).sort()).toEqual(['X', 'Y']);
  });

  it('treats "*" allowedSenders as wildcard', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: '*', receivers: 'X' })],
      warnings,
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]!.senderEic).toBe('*');
  });

  it('falls back validTo to validUntil if validTo empty', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ validTo: '', validUntil: '2099-12-31T00:00:00.000Z' })],
      warnings,
    );
    expect(paths[0]!.validTo?.toISOString()).toBe('2099-12-31T00:00:00.000Z');
  });

  it('sets isExpired=true when validTo is in the past', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ validTo: '2020-01-01T00:00:00.000Z' })],
      warnings,
    );
    expect(paths[0]!.isExpired).toBe(true);
  });

  it('forwards intermediateBrokerCode to intermediateBrokerEic', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ intermediateBrokerCode: 'BROKER-XYZ' })],
      warnings,
    );
    expect(paths[0]!.intermediateBrokerEic).toBe('BROKER-XYZ');
  });

  it('skips row with unknown transportPattern and emits warning', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ transportPattern: 'WEIRD' })],
      warnings,
    );
    expect(paths).toHaveLength(0);
    expect(warnings.some((w) => w.code === 'CSV_PATH_UNKNOWN_TRANSPORT')).toBe(true);
  });
});
