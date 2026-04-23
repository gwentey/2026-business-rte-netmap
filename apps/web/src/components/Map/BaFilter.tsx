import { useMemo } from 'react';
import type { BusinessApplicationSummary, GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store.js';

/**
 * BaFilter — filtre Business Applications dans le bandeau map-overlay top-right.
 * Refonte ADR-040 : intégré directement dans `MapOverlaysTopRight`. Utilise
 * `<select multiple>` natif (.select) pour rester accessible et compact.
 */
export function BaFilter({ graph }: { graph: GraphResponse | null }): JSX.Element | null {
  const selectedBaCodes = useAppStore((s) => s.selectedBaCodes);
  const toggleBaFilter = useAppStore((s) => s.toggleBaFilter);
  const clearBaFilter = useAppStore((s) => s.clearBaFilter);

  const bas = useMemo<BusinessApplicationSummary[]>(() => {
    if (!graph) return [];
    const seen = new Map<string, BusinessApplicationSummary>();
    for (const n of graph.nodes) {
      for (const ba of n.businessApplications) {
        if (!seen.has(ba.code)) seen.set(ba.code, ba);
      }
    }
    const rank: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
    return Array.from(seen.values()).sort((a, b) => {
      const dr = (rank[a.criticality] ?? 9) - (rank[b.criticality] ?? 9);
      if (dr !== 0) return dr;
      return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
    });
  }, [graph]);

  if (bas.length === 0) return null;

  const activeCount = selectedBaCodes.length;

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>Filtre BA {activeCount > 0 ? `(${activeCount})` : ''}</span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => clearBaFilter()}
            className="btn btn--ghost btn--sm"
            style={{ height: 22, padding: '0 8px', fontSize: 10 }}
          >
            Réinitialiser
          </button>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxHeight: 180,
          overflow: 'auto',
        }}
        className="scroll"
      >
        {bas.map((ba) => {
          const isOn = selectedBaCodes.includes(ba.code);
          return (
            <label
              key={ba.code}
              className="check"
              style={{
                fontSize: 12,
                color: isOn ? 'var(--ink-0)' : 'var(--ink-2)',
              }}
            >
              <input
                type="checkbox"
                checked={isOn}
                onChange={() => toggleBaFilter(ba.code)}
                aria-label={`Filtrer ${ba.code}`}
              />
              <span className="box" />
              <span className="mono" style={{ flex: 1 }}>
                {ba.code}
              </span>
              <span
                className="badge"
                style={{
                  marginLeft: 'auto',
                  padding: '0 6px',
                  fontSize: 9,
                  background:
                    ba.criticality === 'P1'
                      ? 'rgba(231,76,76,0.15)'
                      : ba.criticality === 'P2'
                        ? 'rgba(230,162,60,0.15)'
                        : 'rgba(110,133,145,0.15)',
                  color:
                    ba.criticality === 'P1'
                      ? 'var(--err)'
                      : ba.criticality === 'P2'
                        ? 'var(--warn)'
                        : 'var(--ink-3)',
                  borderColor: 'transparent',
                }}
              >
                {ba.criticality}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
