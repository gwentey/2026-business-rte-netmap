import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { PROCESS_COLORS } from './process-colors';

const OVERLAY_PATH = resolve(
  import.meta.dirname,
  '../../../../packages/registry/eic-rte-overlay.json',
);

describe('process-colors sync with registry overlay', () => {
  const overlay = JSON.parse(readFileSync(OVERLAY_PATH, 'utf-8')) as {
    processColors: Record<string, string>;
  };

  it('has identical keys in JSON and TS', () => {
    expect(Object.keys(PROCESS_COLORS).sort()).toEqual(
      Object.keys(overlay.processColors).sort(),
    );
  });

  it('has identical hex values for each key', () => {
    for (const [key, value] of Object.entries(overlay.processColors)) {
      expect(PROCESS_COLORS[key as keyof typeof PROCESS_COLORS]).toBe(value);
    }
  });
});
