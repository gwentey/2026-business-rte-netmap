import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store.js';
import styles from './TimelineSlider.module.scss';

export function TimelineSlider(): JSX.Element | null {
  const imports = useAppStore((s) => s.imports);
  const refDate = useAppStore((s) => s.refDate);
  const setRefDate = useAppStore((s) => s.setRefDate);

  const distinctDates = useMemo(() => {
    const set = new Set(imports.map((i) => i.effectiveDate));
    return Array.from(set).sort();
  }, [imports]);

  if (distinctDates.length < 2) return null;

  const nMax = distinctDates.length;
  const currentIndex =
    refDate === null ? nMax : distinctDates.findIndex((iso) => iso === refDate.toISOString());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const idx = Number(e.target.value);
    if (idx === nMax) {
      void setRefDate(null);
    } else {
      const iso = distinctDates[idx];
      if (iso !== undefined) {
        void setRefDate(new Date(iso));
      }
    }
  };

  const currentLabel =
    refDate === null
      ? 'maintenant'
      : new Date(refDate).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

  const includedCount =
    refDate === null
      ? nMax
      : distinctDates.filter((d) => d <= refDate.toISOString()).length;

  return (
    <div className={styles.container}>
      <div className={styles.row}>
        <label className={styles.labelWrapper}>
          <span className={styles.labelText}>Date de référence :</span>
          <input
            type="range"
            min={0}
            max={nMax}
            value={currentIndex >= 0 ? currentIndex : nMax}
            onChange={handleChange}
            className={styles.slider}
            aria-label="Date de référence timeline"
          />
          <span className={styles.currentLabel}>{currentLabel}</span>
        </label>
        {refDate !== null ? (
          <button
            type="button"
            onClick={() => {
              void setRefDate(null);
            }}
            className={styles.resetButton}
          >
            ⟲ Retour au présent
          </button>
        ) : null}
      </div>
      <div className={styles.hint}>
        {nMax} dates distinctes · {includedCount} inclus{' '}
        {refDate === null ? '(état actuel)' : `jusqu'à ${currentLabel}`}
      </div>
    </div>
  );
}
