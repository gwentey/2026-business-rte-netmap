import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store.js';

const ClockIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M8 4v4l2.5 2.5 M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z" />
  </svg>
);

const formatScaleLabel = (iso: string): string =>
  new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
  });

const formatThumbLabel = (iso: string): string =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const formatTimeLabel = (iso: string): string =>
  new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }) + ' UTC';

/**
 * TimelineSlider — bandeau temps (ADR-040). Markup `.timeline*`.
 * Refonte visuelle, logique store identique : nMax dates distinctes, le dernier
 * cran (`nMax`) = "présent" (refDate=null), les autres = snapshots historiques.
 */
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
    refDate === null
      ? nMax
      : Math.max(0, distinctDates.findIndex((iso) => iso === refDate.toISOString()));

  const isPresent = refDate === null;
  const currentIso =
    isPresent || currentIndex === nMax
      ? distinctDates[nMax - 1]!
      : distinctDates[currentIndex] ?? distinctDates[nMax - 1]!;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const idx = Number(e.target.value);
    if (idx === nMax) {
      void setRefDate(null);
    } else {
      const iso = distinctDates[idx];
      if (iso !== undefined) void setRefDate(new Date(iso));
    }
  };

  // 7 ticks d'échelle (premier, dernier + 5 intermédiaires) sur l'intervalle
  // [premier snapshot, présent].
  const TICK_COUNT = 13;
  const SCALE_COUNT = 7;
  const scaleLabels: string[] = Array.from({ length: SCALE_COUNT }, (_, i) => {
    const ratio = i / (SCALE_COUNT - 1);
    const idx = Math.round(ratio * (nMax - 1));
    return formatScaleLabel(distinctDates[idx]!);
  });

  const percent = (currentIndex / nMax) * 100;

  return (
    <div className="timeline">
      <div className="timeline__left">
        <span className="timeline__icon">
          <ClockIcon />
        </span>
        <span className="timeline__label">Snapshot</span>
        <span className="mono timeline__date">
          {isPresent ? 'présent' : formatThumbLabel(currentIso)}
        </span>
        <span className="mono timeline__time">{formatTimeLabel(currentIso)}</span>
      </div>

      <div className="timeline__track-wrap">
        <div className="timeline__track">
          <div className="timeline__progress" style={{ width: `${percent}%` }} />
          <div className="timeline__ticks" aria-hidden>
            {Array.from({ length: TICK_COUNT }).map((_, i) => (
              <span key={i} style={{ left: `${(i / (TICK_COUNT - 1)) * 100}%` }} />
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={nMax}
            value={currentIndex}
            onChange={handleChange}
            className="timeline__range"
            aria-label="Date de référence timeline"
          />
          <div className="timeline__thumb" style={{ left: `${percent}%` }} />
          <div className="timeline__thumb-label mono" style={{ left: `${percent}%` }}>
            {isPresent ? 'présent' : formatScaleLabel(currentIso)}
          </div>
        </div>
        <div className="timeline__scale mono" aria-hidden>
          {scaleLabels.map((label, i) => (
            <span key={i}>{label}</span>
          ))}
        </div>
      </div>

      <div className="timeline__right">
        {!isPresent && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              void setRefDate(null);
            }}
          >
            <span style={{ fontSize: 13, marginTop: -1 }}>⟲</span>
            Retour au présent
          </button>
        )}
      </div>
    </div>
  );
}
