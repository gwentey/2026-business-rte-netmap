// STUB — sera remplacé par l'implémentation complète en Task 8 du plan slice 2c-2
import type { AdminComponentRow } from '@carto-ecp/shared';

type Props = {
  row: AdminComponentRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function ComponentOverrideModal({ row, onClose }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-w-md rounded-lg bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold">Surcharge pour {row.eic}</h3>
        <p className="text-sm text-gray-500">Stub — remplacé en Task 8</p>
        <button type="button" onClick={onClose} className="mt-4 rounded px-4 py-1.5 text-sm hover:bg-gray-100">
          Fermer
        </button>
      </div>
    </div>
  );
}
