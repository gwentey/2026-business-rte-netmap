import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store.js';

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
  const currentIndex = refDate === null
    ? nMax
    : distinctDates.findIndex((iso) => iso === refDate.toISOString());

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

  const currentLabel = refDate === null
    ? 'maintenant'
    : new Date(refDate).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });

  const includedCount = refDate === null
    ? nMax
    : distinctDates.filter((d) => d <= refDate.toISOString()).length;

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-3 text-sm">
          <span className="whitespace-nowrap text-gray-700">Date de référence :</span>
          <input
            type="range"
            min={0}
            max={nMax}
            value={currentIndex >= 0 ? currentIndex : nMax}
            onChange={handleChange}
            className="flex-1"
            aria-label="Date de référence timeline"
          />
          <span className="w-36 text-right font-mono text-xs text-gray-900">{currentLabel}</span>
        </label>
        {refDate !== null ? (
          <button
            type="button"
            onClick={() => { void setRefDate(null); }}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            ⟲ Retour au présent
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {nMax} dates distinctes · {includedCount} inclus {refDate === null ? '(état actuel)' : `jusqu'à ${currentLabel}`}
      </div>
    </div>
  );
}
