import { describe, it, expect } from 'vitest';
import { normalizeOrgName } from './normalize-org-name.js';

describe('normalizeOrgName', () => {
  it('retourne null pour null/undefined/vide/whitespace', () => {
    expect(normalizeOrgName(null)).toBeNull();
    expect(normalizeOrgName(undefined)).toBeNull();
    expect(normalizeOrgName('')).toBeNull();
    expect(normalizeOrgName('   ')).toBeNull();
    expect(normalizeOrgName('\t\n ')).toBeNull();
  });

  it('lowercase + trim', () => {
    expect(normalizeOrgName('Swissgrid')).toBe('swissgrid');
    expect(normalizeOrgName(' RTE ')).toBe('rte');
    expect(normalizeOrgName('ELIA')).toBe('elia');
  });

  it('collapse les espaces multiples', () => {
    expect(normalizeOrgName('TenneT  TSO   BV')).toBe('tennet tso bv');
    expect(normalizeOrgName('PSE    S.A.')).toBe('pse s.a.');
  });

  it('preserve les caracteres speciaux et accents', () => {
    expect(normalizeOrgName('ČEPS, a.s.')).toBe('čeps, a.s.');
    expect(normalizeOrgName('TEİAŞ')).toBe('tei̇aş');
    expect(normalizeOrgName('RTE (Réseau)')).toBe('rte (réseau)');
  });
});
