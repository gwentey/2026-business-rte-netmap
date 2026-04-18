import { describe, it, expect } from 'vitest';
import { normalizeNull, NULL_VALUE_PLACEHOLDER } from './null-value-normalizer.js';

describe('normalizeNull', () => {
  it('converts NULL_VALUE_PLACEHOLDER string to null', () => {
    expect(normalizeNull('NULL_VALUE_PLACEHOLDER')).toBeNull();
  });

  it('preserves non-placeholder strings as-is', () => {
    expect(normalizeNull('hello')).toBe('hello');
    expect(normalizeNull('')).toBe('');
    expect(normalizeNull('NULL')).toBe('NULL');
    expect(normalizeNull('null')).toBe('null');
  });

  it('preserves wildcard `*` unchanged', () => {
    expect(normalizeNull('*')).toBe('*');
  });

  it('preserves number and boolean values unchanged', () => {
    expect(normalizeNull(42)).toBe(42);
    expect(normalizeNull(true)).toBe(true);
  });

  it('exposes the placeholder constant', () => {
    expect(NULL_VALUE_PLACEHOLDER).toBe('NULL_VALUE_PLACEHOLDER');
  });
});
