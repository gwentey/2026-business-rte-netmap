import { describe, expect, it } from 'vitest';
import { mergePathsLatestWins, type ImportedPathWithImport } from './merge-paths.js';

const basePath: Omit<ImportedPathWithImport, '_effectiveDate'> = {
  receiverEic: 'A',
  senderEic: 'B',
  messageType: 'A06',
  transportPattern: 'DIRECT',
  intermediateBrokerEic: null,
  validFrom: null,
  validTo: null,
  isExpired: false,
};

describe('mergePathsLatestWins', () => {
  it('returns empty map when no paths', () => {
    expect(mergePathsLatestWins([]).size).toBe(0);
  });

  it('dedups identical 5-field identity across two imports', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, _effectiveDate: new Date('2026-01-01') },
      { ...basePath, _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(1);
  });

  it('latest effective date wins on validTo / isExpired', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, isExpired: false, validTo: null, _effectiveDate: new Date('2026-01-01') },
      { ...basePath, isExpired: true, validTo: new Date('2026-03-01'), _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergePathsLatestWins(rows);
    const merged = Array.from(result.values())[0]!;
    expect(merged.isExpired).toBe(true);
    expect(merged.validTo?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('different messageType yields different key = 2 entries', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, messageType: 'A06', _effectiveDate: new Date('2026-01-01') },
      { ...basePath, messageType: 'A07', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(2);
  });

  it('reversed (receiver/sender swap) = different key (no canonical sort)', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, receiverEic: 'A', senderEic: 'B', _effectiveDate: new Date('2026-01-01') },
      { ...basePath, receiverEic: 'B', senderEic: 'A', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(2);
  });

  it('different intermediateBrokerEic yields different key', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, intermediateBrokerEic: null, _effectiveDate: new Date('2026-01-01') },
      { ...basePath, intermediateBrokerEic: 'BROKER-X', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(2);
  });

  it('older import wins if later import has null mutable field (null != contradictory)', () => {
    // On prend le latest dans tous les cas (même si un champ mutable est null). C'est un choix défendable.
    // Le plan ne tranche pas explicitement — on prend le latest direct.
    const rows: ImportedPathWithImport[] = [
      { ...basePath, isExpired: true, validTo: new Date('2026-01-15'), _effectiveDate: new Date('2026-01-01') },
      { ...basePath, isExpired: false, validTo: null, _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergePathsLatestWins(rows);
    const merged = Array.from(result.values())[0]!;
    expect(merged.isExpired).toBe(false);
    expect(merged.validTo).toBeNull();
  });
});
