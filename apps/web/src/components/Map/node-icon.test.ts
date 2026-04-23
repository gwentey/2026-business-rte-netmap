import { describe, expect, it } from 'vitest';
import { buildNodeDivIcon, healthStatusFromLastSync } from './node-icon.js';

describe('buildNodeDivIcon', () => {
  it('embeds the correct kind, icon, and bg color for RTE_ENDPOINT', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', false, false);
    const html = (icon.options.html ?? '') as string;
    expect(html).toContain('data-kind="RTE_ENDPOINT"');
    expect(html).toContain('#e30613');           // RTE red
    expect(html).toContain('<svg');              // Lucide SVG present
    expect(html).not.toContain('⚠');             // No warning badge
    expect(html).not.toContain('box-shadow');    // No halo
  });

  it('renders the warning badge when isDefaultPosition is true', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', true, false);
    const html = icon.options.html as string;
    expect(html).toContain('⚠');
    expect(html).toContain('#f97316');  // Badge orange
    expect(html).toContain('data-default="true"');
  });

  it('renders the selection halo when selected is true', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', false, true);
    const html = icon.options.html as string;
    expect(html).toContain('box-shadow');
    expect(html).toContain('data-selected="true"');
  });

  it('uses correct config per kind', () => {
    const kinds: Array<[
      'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT',
      string,
      string,
    ]> = [
      ['RTE_ENDPOINT', '#e30613', 'Endpoint RTE'],
      ['RTE_CD', '#b91c1c', 'CD RTE'],
      ['BROKER', '#111827', 'Broker'],
      ['EXTERNAL_CD', '#1f2937', 'CD externe'],
      ['EXTERNAL_ENDPOINT', '#6b7280', 'Endpoint externe'],
    ];
    for (const [kind, color, label] of kinds) {
      const icon = buildNodeDivIcon(kind, false, false);
      const html = icon.options.html as string;
      expect(html).toContain(color);
      expect(html).toContain(label);
    }
  });

  it('renders a health badge in the top-right when status is known (slice 2n)', () => {
    const now = Date.parse('2026-04-23T10:00:00Z');
    const iconHealthy = buildNodeDivIcon('RTE_ENDPOINT', false, false, 'healthy');
    const iconWarning = buildNodeDivIcon('RTE_ENDPOINT', false, false, 'warning');
    const iconStale = buildNodeDivIcon('RTE_ENDPOINT', false, false, 'stale');
    const iconUnknown = buildNodeDivIcon('RTE_ENDPOINT', false, false, 'unknown');

    expect((iconHealthy.options.html as string)).toContain('#10b981');
    expect((iconHealthy.options.html as string)).toContain('data-health="healthy"');
    expect((iconWarning.options.html as string)).toContain('#f59e0b');
    expect((iconStale.options.html as string)).toContain('#dc2626');
    // unknown : pas de badge coloré
    expect((iconUnknown.options.html as string)).not.toContain('#10b981');
    expect((iconUnknown.options.html as string)).not.toContain('#f59e0b');
    expect((iconUnknown.options.html as string)).not.toContain('#dc2626');
    // Dummy use of `now` to keep TS happy in case the timestamps become useful
    expect(now).toBeGreaterThan(0);
  });
});

describe('healthStatusFromLastSync', () => {
  const now = Date.parse('2026-04-23T10:00:00Z');

  it('returns unknown for null input', () => {
    expect(healthStatusFromLastSync(null, now)).toBe('unknown');
  });

  it('returns unknown for an unparseable timestamp', () => {
    expect(healthStatusFromLastSync('not a date', now)).toBe('unknown');
  });

  it('returns healthy when delta is below 1 hour', () => {
    expect(healthStatusFromLastSync('2026-04-23T09:30:00Z', now)).toBe('healthy');
  });

  it('returns warning when delta is between 1h and 24h', () => {
    expect(healthStatusFromLastSync('2026-04-23T05:00:00Z', now)).toBe('warning');
    expect(healthStatusFromLastSync('2026-04-22T11:00:00Z', now)).toBe('warning');
  });

  it('returns stale when delta is over 24h', () => {
    expect(healthStatusFromLastSync('2026-04-21T09:00:00Z', now)).toBe('stale');
  });
});
