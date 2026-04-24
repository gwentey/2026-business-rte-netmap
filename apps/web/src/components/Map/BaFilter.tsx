import { useMemo } from 'react';
import type { BusinessApplicationSummary, GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store.js';

type Criticality = 'ALL' | 'P1' | 'P2' | 'P3';

const OPTIONS: Array<{ value: Criticality; label: string }> = [
  { value: 'ALL', label: 'Toutes les Business Apps' },
  { value: 'P1', label: 'P1 — Prod critique' },
  { value: 'P2', label: 'P2 — Prod standard' },
  { value: 'P3', label: 'P3 — Non-prod / Dev' },
];

/**
 * BaFilter — select simple par criticité (design carto-rte v2).
 * Sélectionner "P1" filtre la carte aux BAs avec criticality='P1' ; "ALL" efface
 * le filtre. Le store gère une liste de codes BA ; ici on bascule vers le set
 * des codes qui matchent la criticité choisie.
 */
export function BaFilter({ graph }: { graph: GraphResponse | null }): JSX.Element | null {
  const selectedBaCodes = useAppStore((s) => s.selectedBaCodes);
  const toggleBaFilter = useAppStore((s) => s.toggleBaFilter);
  const clearBaFilter = useAppStore((s) => s.clearBaFilter);

  const byCriticality = useMemo<Record<string, BusinessApplicationSummary[]>>(() => {
    const buckets: Record<string, BusinessApplicationSummary[]> = { P1: [], P2: [], P3: [] };
    if (!graph) return buckets;
    const seen = new Set<string>();
    for (const n of graph.nodes) {
      for (const ba of n.businessApplications) {
        if (seen.has(ba.code)) continue;
        seen.add(ba.code);
        const bucket = buckets[ba.criticality];
        if (bucket !== undefined) bucket.push(ba);
      }
    }
    return buckets;
  }, [graph]);

  const totalBas = (byCriticality.P1?.length ?? 0) + (byCriticality.P2?.length ?? 0) + (byCriticality.P3?.length ?? 0);
  if (totalBas === 0) return null;

  const current: Criticality = selectedBaCodes.length === 0 ? 'ALL' : (() => {
    for (const crit of ['P1', 'P2', 'P3'] as const) {
      const codes = byCriticality[crit] ?? [];
      if (codes.length > 0 && codes.every((ba) => selectedBaCodes.includes(ba.code))) {
        return crit;
      }
    }
    return 'ALL';
  })();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const value = e.target.value as Criticality;
    clearBaFilter();
    if (value === 'ALL') return;
    const codes = byCriticality[value] ?? [];
    codes.forEach((ba) => toggleBaFilter(ba.code));
  };

  return (
    <div className="map-overlay">
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        Filtre BA
      </div>
      <select
        className="select"
        value={current}
        onChange={handleChange}
        style={{ width: 180, height: 28 }}
        aria-label="Filtre par criticité Business App"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
