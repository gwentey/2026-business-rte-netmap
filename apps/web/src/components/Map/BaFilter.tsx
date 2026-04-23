import { useMemo, useState } from 'react';
import type { BusinessApplicationSummary, GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store.js';
import styles from './BaFilter.module.scss';

export function BaFilter({ graph }: { graph: GraphResponse | null }): JSX.Element | null {
  const selectedBaCodes = useAppStore((s) => s.selectedBaCodes);
  const toggleBaFilter = useAppStore((s) => s.toggleBaFilter);
  const clearBaFilter = useAppStore((s) => s.clearBaFilter);
  const [open, setOpen] = useState(false);

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

  const toggleClass =
    activeCount > 0 ? `${styles.toggle} ${styles.toggleActive}` : styles.toggle;

  const getCritClass = (crit: string): string => {
    if (crit === 'P1') return `${styles.criticality} ${styles.critP1}`;
    if (crit === 'P2') return `${styles.criticality} ${styles.critP2}`;
    return `${styles.criticality} ${styles.critP3}`;
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-pressed={activeCount > 0}
        className={toggleClass}
        title="Filtrer les noeuds par Business Application"
      >
        {activeCount > 0 ? `✓ ${label}` : `Filtre ${label}`}
      </button>
      {open ? (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <h4 className={styles.headerTitle}>Business Applications</h4>
            {activeCount > 0 ? (
              <button
                type="button"
                onClick={() => clearBaFilter()}
                className={styles.resetLink}
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
          <ul className={styles.list}>
            {bas.map((ba) => {
              const isOn = selectedBaCodes.includes(ba.code);
              const itemClass = isOn
                ? `${styles.item} ${styles.itemActive}`
                : styles.item;
              return (
                <li key={ba.code}>
                  <button
                    type="button"
                    onClick={() => toggleBaFilter(ba.code)}
                    aria-pressed={isOn}
                    className={itemClass}
                  >
                    <span className={styles.code}>{ba.code}</span>
                    <span className={getCritClass(ba.criticality)}>{ba.criticality}</span>
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
