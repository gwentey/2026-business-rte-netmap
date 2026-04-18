import { describe, it, expect } from 'vitest';
import { parseEcpDate } from './date-parser.js';

describe('parseEcpDate', () => {
  it('parses ISO nano CSV format (without Z)', () => {
    const d = parseEcpDate('2025-03-12T15:34:48.560980651');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-03-12T15:34:48.560Z');
  });

  it('parses ISO Z millisecond XML format', () => {
    const d = parseEcpDate('2025-03-18T15:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2025-03-18T15:00:00.000Z');
  });

  it('returns null for null input', () => {
    expect(parseEcpDate(null)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEcpDate('')).toBeNull();
  });

  it('returns null for NULL_VALUE_PLACEHOLDER', () => {
    expect(parseEcpDate('NULL_VALUE_PLACEHOLDER')).toBeNull();
  });

  it('returns null for unparsable input', () => {
    expect(parseEcpDate('not-a-date')).toBeNull();
  });

  it('truncates nanoseconds to milliseconds precision', () => {
    const d = parseEcpDate('2025-03-12T15:34:48.999999999');
    expect(d?.getUTCMilliseconds()).toBe(999);
  });
});
