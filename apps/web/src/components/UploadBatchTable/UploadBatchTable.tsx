import { useState } from 'react';
import { useAppStore } from '../../store/app-store.js';

const STATE_LABELS: Record<string, string> = {
  'pending-inspect': '⏳ Inspection…',
  'inspected': '🟢 Prêt',
  'uploading': '⬆ Envoi…',
  'done': '✓ Créé',
  'skipped': '🟡 Ignoré',
  'error': '🔴 Erreur',
};

type LabelInputProps = {
  itemId: string;
  initialLabel: string;
  disabled: boolean;
  updateItem: (id: string, patch: { label: string }) => void;
};

function LabelInput({ itemId, initialLabel, disabled, updateItem }: LabelInputProps): JSX.Element {
  const [value, setValue] = useState(initialLabel);

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        updateItem(itemId, { label: e.target.value });
      }}
      disabled={disabled}
      className="w-40 rounded border border-gray-300 px-1 py-0.5 text-xs"
    />
  );
}

export function UploadBatchTable(): JSX.Element {
  const batch = useAppStore((s) => s.uploadBatch);
  const removeItem = useAppStore((s) => s.removeBatchItem);
  const updateItem = useAppStore((s) => s.updateBatchItem);

  if (batch.length === 0) {
    return <p className="p-4 text-sm text-gray-500">Aucun fichier dans le batch.</p>;
  }

  return (
    <table className="w-full table-auto border border-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-2 py-1 text-left">Fichier</th>
          <th className="px-2 py-1 text-left">EIC</th>
          <th className="px-2 py-1 text-left">Type</th>
          <th className="px-2 py-1 text-left">Label</th>
          <th className="px-2 py-1 text-left">Statut</th>
          <th className="px-2 py-1 text-left">Action</th>
        </tr>
      </thead>
      <tbody>
        {batch.map((item) => (
          <tr key={item.id} className="border-t border-gray-200">
            <td className="px-2 py-1">
              <div className="font-mono text-xs">{item.fileName}</div>
              <div className="text-xs text-gray-500">{(item.fileSize / 1024).toFixed(1)} KB</div>
            </td>
            <td className="px-2 py-1 font-mono text-xs">{item.sourceComponentEic ?? '—'}</td>
            <td className="px-2 py-1">
              <select
                value={item.overrideDumpType ?? item.dumpType ?? 'COMPONENT_DIRECTORY'}
                onChange={(e) => updateItem(item.id, { overrideDumpType: e.target.value as any })}
                disabled={item.state === 'uploading' || item.state === 'done'}
                className="rounded border border-gray-300 px-1 py-0.5 text-xs"
              >
                <option value="ENDPOINT">ENDPOINT</option>
                <option value="COMPONENT_DIRECTORY">CD</option>
                <option value="BROKER">BROKER</option>
              </select>
              {item.confidence === 'FALLBACK' ? (
                <span className="ml-1 text-xs text-orange-600" title="Détection incertaine">⚠</span>
              ) : null}
            </td>
            <td className="px-2 py-1">
              <LabelInput
                itemId={item.id}
                initialLabel={item.label}
                disabled={item.state === 'uploading' || item.state === 'done'}
                updateItem={updateItem}
              />
            </td>
            <td className="px-2 py-1">
              <div>{STATE_LABELS[item.state] ?? item.state}</div>
              {item.duplicateOf ? (
                <div className="text-xs text-orange-700">
                  Doublon (import : {item.duplicateOf.label})
                  <label className="ml-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.forceReplace}
                      onChange={(e) => updateItem(item.id, { forceReplace: e.target.checked })}
                      className="mr-1"
                    />
                    Remplacer
                  </label>
                </div>
              ) : null}
              {item.state === 'error' && item.errorCode ? (
                <div className="text-xs text-red-700">
                  <code>{item.errorCode}</code> {item.errorMessage ?? ''}
                </div>
              ) : null}
            </td>
            <td className="px-2 py-1">
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={item.state === 'uploading'}
                className="text-red-600 hover:text-red-800"
                aria-label={`Retirer ${item.fileName}`}
              >
                🗑
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
