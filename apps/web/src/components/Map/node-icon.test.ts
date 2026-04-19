import { describe, expect, it } from 'vitest';
import { buildNodeDivIcon } from './node-icon.js';

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
});
