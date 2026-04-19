import { describe, expect, it } from 'vitest';
import { detectDumpType } from './dump-type-detector.js';

describe('detectDumpType', () => {
  it('returns ENDPOINT when component_directory.csv rows contain XML blobs', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '<?xml version="1.0"?><root/>' }];
    expect(detectDumpType(csvRows, undefined)).toBe('ENDPOINT');
  });

  it('returns COMPONENT_DIRECTORY when no rows contain XML blobs', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '' }];
    expect(detectDumpType(csvRows, undefined)).toBe('COMPONENT_DIRECTORY');
  });

  it('returns COMPONENT_DIRECTORY when csv is empty', () => {
    expect(detectDumpType([], undefined)).toBe('COMPONENT_DIRECTORY');
  });

  it('respects explicit override (priority)', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '<?xml?><root/>' }];
    expect(detectDumpType(csvRows, 'BROKER')).toBe('BROKER');
  });
});
