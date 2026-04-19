import { describe, expect, it } from 'vitest';
import { parseDumpFilename } from './filename-parser.js';

describe('parseDumpFilename', () => {
  it('extracts EIC and timestamp from canonical ECP dump filename', () => {
    const result = parseDumpFilename('17V000000498771C_2026-04-17T21_27_17Z.zip');
    expect(result.sourceComponentEic).toBe('17V000000498771C');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-04-17T21:27:17.000Z');
  });

  it('handles the CD dump naming pattern', () => {
    const result = parseDumpFilename('17V000002014106G_2026-04-17T22_11_50Z.zip');
    expect(result.sourceComponentEic).toBe('17V000002014106G');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-04-17T22:11:50.000Z');
  });

  it('returns nulls for an unrecognizable filename', () => {
    const result = parseDumpFilename('random-backup.zip');
    expect(result.sourceComponentEic).toBeNull();
    expect(result.sourceDumpTimestamp).toBeNull();
  });

  it('returns nulls if the timestamp is malformed', () => {
    const result = parseDumpFilename('17V000000498771C_not-a-date.zip');
    expect(result.sourceComponentEic).toBeNull();
    expect(result.sourceDumpTimestamp).toBeNull();
  });

  it('accepts 10V EICs too (non-RTE, non-17V prefix)', () => {
    const result = parseDumpFilename('10XAT-APG------Z_2026-03-01T00_00_00Z.zip');
    expect(result.sourceComponentEic).toBe('10XAT-APG------Z');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});
