import { useMemo, useState } from 'react';
import type { BusinessApplicationSummary, GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store.js';

/**
 * Filtre « par Business Application » (Slice 3c). Bouton repliable en haut
 * à gauche de la carte. Quand ≥1 BA est sélectionnée, la carte ne montre
 * que les endpoints qui la portent + leurs interlocuteurs directs.
 */
export function BaFilter({ graph }: { graph: GraphResponse | null }): JSX.Element | null {
  const selectedBaCodes = useAppStore((s) => s.selectedBaCodes);
  const toggleBaFilter = useAppStore((s) => s.toggleBaFilter);
  const clearBaFilter = useAppStore((s) => s.clearBaFilter);
  const [open, setOpen] = useState(false);

  // Collecte l'ensemble des BAs présentes dans le graph courant (ordre
  // déterministe : tri P1 > P2 > P3 puis alpha, appliqué une seule fois).
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
  const label = activeCount === 0 ? 'BA' : `BA (${activeCount})`;

  return (
    <div className="absolute left-3 top-3 z-[1000]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-pressed={activeCount > 0}
        className={`rounded border px-3 py-1.5 text-xs font-medium shadow-sm ${
          activeCount > 0
            ? 'border-violet-500 bg-violet-600 text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        title="Filtrer les noeuds par Business Application"
      >
        {activeCount > 0 ? `✓ ${label}` : `Filtre ${label}`}
      </button>
      {open ? (
        <div className="mt-1 w-64 rounded border border-gray-200 bg-white p-2 shadow-md">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold text-gray-700">Business Applications</h4>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => clearBaFilter()}
                className="text-[10px] text-gray-500 underline underline-offset-2 hover:text-gray-800"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
          <ul className="space-y-1">
            {bas.map((ba) => {
              const isOn = selectedBaCodes.includes(ba.code);
              return (
                <li key={ba.code}>
                  <button
                    type="button"
                    onClick={() => toggleBaFilter(ba.code)}
                    aria-pressed={isOn}
                    className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs ${
                      isOn
                        ? 'bg-violet-100 text-violet-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="font-mono">{ba.code}</span>
                    <span
                      className={`ml-1 rounded px-1 text-[9px] font-bold ${
                        ba.criticality === 'P1'
                          ? 'bg-red-100 text-red-800'
                          : ba.criticality === 'P2'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {ba.criticality}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
