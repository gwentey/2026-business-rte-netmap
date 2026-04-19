import { describe, expect, it } from 'vitest';
import { mergeComponentsLatestWins, type ImportedComponentWithImport } from './merge-components.js';

const baseComp: Omit<ImportedComponentWithImport, '_effectiveDate'> = {
  eic: '10XAT-APG------Z',
  type: 'ENDPOINT',
  organization: null,
  personName: null,
  email: null,
  phone: null,
  homeCdCode: null,
  networksCsv: null,
  displayName: null,
  country: null,
  lat: null,
  lng: null,
  isDefaultPosition: true,
  sourceType: 'XML_CD',
  creationTs: null,
  modificationTs: null,
  urls: [],
};

describe('mergeComponentsLatestWins', () => {
  it('returns empty map when no imports', () => {
    const result = mergeComponentsLatestWins([]);
    expect(result.size).toBe(0);
  });

  it('takes fields from the single import', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, displayName: 'APG', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    expect(result.get('10XAT-APG------Z')!.displayName).toBe('APG');
  });

  it('latest effective date wins on contradictory field', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, displayName: 'APG old', _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, displayName: 'APG new', _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    expect(result.get('10XAT-APG------Z')!.displayName).toBe('APG new');
  });

  it('merges complementary fields (non-null from any import)', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, email: 'ops@apg.at', _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, phone: '+43-1-000', _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    const merged = result.get('10XAT-APG------Z')!;
    expect(merged.email).toBe('ops@apg.at');
    expect(merged.phone).toBe('+43-1-000');
  });

  it('preserves url deduplication with latest wins', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, urls: [{ network: 'PUBLIC_NETWORK', url: 'https://old.apg.at' }], _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, urls: [{ network: 'PUBLIC_NETWORK', url: 'https://new.apg.at' }], _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    const urls = result.get('10XAT-APG------Z')!.urls;
    expect(urls).toEqual([{ network: 'PUBLIC_NETWORK', url: 'https://new.apg.at' }]);
  });

  it('isDefaultPosition = false wins when any import has lat/lng', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, isDefaultPosition: true, _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, isDefaultPosition: false, lat: 48, lng: 16, _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    const merged = result.get('10XAT-APG------Z')!;
    expect(merged.isDefaultPosition).toBe(false);
    expect(merged.lat).toBe(48);
    expect(merged.lng).toBe(16);
  });
});
