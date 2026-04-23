import { useState } from 'react';
import { useAppStore } from '../../store/app-store.js';
import styles from './UploadBatchTable.module.scss';

const STATE_LABELS: Record<string, string> = {
  'pending-inspect': '⏳ Inspection…',
  inspected: '🟢 Prêt',
  uploading: '⬆ Envoi…',
  done: '✓ Créé',
  skipped: '🟡 Ignoré',
  error: '🔴 Erreur',
};

type LabelInputProps = {
  itemId: string;
  initialLabel: string;
  disabled: boolean;
  updateItem: (id: string, patch: { label: string }) => void;
};

function LabelInput({
  itemId,
  initialLabel,
  disabled,
  updateItem,
}: LabelInputProps): JSX.Element {
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
      className={styles.labelInput}
    />
  );
}

export function UploadBatchTable(): JSX.Element {
  const batch = useAppStore((s) => s.uploadBatch);
  const removeItem = useAppStore((s) => s.removeBatchItem);
  const updateItem = useAppStore((s) => s.updateBatchItem);

  if (batch.length === 0) {
    return <p className={styles.empty}>Aucun fichier dans le batch.</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Fichier</th>
          <th>EIC</th>
          <th>Type</th>
          <th>Label</th>
          <th>Statut</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {batch.map((item) => (
          <tr key={item.id}>
            <td>
              <div className={styles.fileName}>{item.fileName}</div>
              <div className={styles.fileSize}>
                {(item.fileSize / 1024).toFixed(1)} KB
              </div>
            </td>
            <td className={styles.mono}>{item.sourceComponentEic ?? '—'}</td>
            <td>
              <select
                value={item.overrideDumpType ?? item.dumpType ?? 'COMPONENT_DIRECTORY'}
                onChange={(e) =>
                  updateItem(item.id, {
                    overrideDumpType: e.target.value as 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER',
                  })
                }
                disabled={item.state === 'uploading' || item.state === 'done'}
                className={styles.typeSelect}
              >
                <option value="ENDPOINT">ENDPOINT</option>
                <option value="COMPONENT_DIRECTORY">CD</option>
                <option value="BROKER">BROKER</option>
              </select>
              {item.confidence === 'FALLBACK' ? (
                <span className={styles.fallbackWarn} title="Détection incertaine">
                  ⚠
                </span>
              ) : null}
            </td>
            <td>
              <LabelInput
                itemId={item.id}
                initialLabel={item.label}
                disabled={item.state === 'uploading' || item.state === 'done'}
                updateItem={updateItem}
              />
            </td>
            <td>
              <div>{STATE_LABELS[item.state] ?? item.state}</div>
              {item.duplicateOf ? (
                <div className={styles.duplicateNotice}>
                  Doublon (import : {item.duplicateOf.label})
                  <label className={styles.duplicateCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={item.forceReplace}
                      onChange={(e) =>
                        updateItem(item.id, { forceReplace: e.target.checked })
                      }
                    />
                    Remplacer
                  </label>
                </div>
              ) : null}
              {item.state === 'error' && item.errorCode ? (
                <div className={styles.errorMessage}>
                  <code>{item.errorCode}</code> {item.errorMessage ?? ''}
                </div>
              ) : null}
            </td>
            <td>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={item.state === 'uploading'}
                className={styles.removeButton}
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
