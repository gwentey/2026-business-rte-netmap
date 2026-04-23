import { useState } from 'react';
import { useAppStore } from '../../store/app-store.js';

const TrashIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M3 4h10M6.5 4V2.5h3V4M5 4l1 9h4l1-9" />
  </svg>
);

const CheckIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M3 8l4 4 6-8" />
  </svg>
);

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
      className="inline-edit"
      placeholder="Étiquette…"
    />
  );
}

function StatusDot({ state }: { state: string }): JSX.Element {
  if (state === 'done')
    return (
      <span style={{ color: 'var(--ok)' }}>
        <CheckIcon />
      </span>
    );
  if (state === 'error')
    return (
      <span
        style={{
          color: 'var(--err)',
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        ✕
      </span>
    );
  if (state === 'skipped')
    return <span style={{ color: 'var(--ink-3)', fontSize: 14 }}>⤬</span>;
  if (state === 'uploading' || state === 'pending-inspect')
    return <span className="dot-pulse" aria-hidden />;
  if (state === 'inspected')
    return <span style={{ color: 'var(--cyan-2)', fontSize: 14 }}>•</span>;
  return <span style={{ color: 'var(--ink-4)', fontSize: 14 }}>·</span>;
}

const STATE_META: Record<string, string> = {
  'pending-inspect': 'Lecture du manifeste…',
  inspected: 'Empreinte validée · prêt',
  uploading: 'Transfert en cours…',
  done: 'Importé',
  skipped: 'Ignoré',
  error: 'Erreur',
};

export function UploadBatchTable(): JSX.Element | null {
  const batch = useAppStore((s) => s.uploadBatch);
  const removeItem = useAppStore((s) => s.removeBatchItem);
  const updateItem = useAppStore((s) => s.updateBatchItem);

  if (batch.length === 0) return null;

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="panel-header">
        <h2>
          Lot en préparation
          <span style={{ color: 'var(--ink-3)', fontWeight: 500, marginLeft: 6 }}>
            · {batch.length} fichier{batch.length > 1 ? 's' : ''}
          </span>
        </h2>
        <span className="sub">Éditez les étiquettes et types avant soumission</span>
      </div>
      <div>
        {batch.map((item) => {
          const isLocked = item.state === 'uploading' || item.state === 'done';
          const meta =
            item.state === 'error'
              ? `${item.errorCode ?? 'ERROR'} — ${item.errorMessage ?? ''}`
              : item.duplicateOf
                ? `Doublon · ${item.duplicateOf.label}`
                : (STATE_META[item.state] ?? item.state);
          const metaColor =
            item.state === 'error'
              ? 'var(--err)'
              : item.duplicateOf
                ? 'var(--warn)'
                : item.state === 'uploading'
                  ? 'var(--cyan-2)'
                  : 'var(--ink-3)';
          return (
            <div className="file-row" key={item.id}>
              <div className="file-row__status">
                <StatusDot state={item.state} />
              </div>
              <div className="file-row__label">
                <div className="name mono" style={{ fontSize: 12 }}>
                  {item.fileName}
                </div>
                <div className="meta" style={{ color: metaColor }}>
                  {item.sourceComponentEic !== null && item.sourceComponentEic !== undefined
                    ? `${item.sourceComponentEic} · `
                    : ''}
                  {(item.fileSize / 1024).toFixed(1)} KB · {meta}
                </div>
              </div>
              <div>
                <LabelInput
                  itemId={item.id}
                  initialLabel={item.label}
                  disabled={isLocked}
                  updateItem={updateItem}
                />
              </div>
              <div>
                <select
                  value={item.overrideDumpType ?? item.dumpType ?? 'COMPONENT_DIRECTORY'}
                  onChange={(e) =>
                    updateItem(item.id, {
                      overrideDumpType: e.target.value as
                        | 'ENDPOINT'
                        | 'COMPONENT_DIRECTORY'
                        | 'BROKER',
                    })
                  }
                  disabled={isLocked}
                  className="select"
                  style={{ height: 28 }}
                  aria-label="Type de dump"
                >
                  <option value="ENDPOINT">Endpoint</option>
                  <option value="COMPONENT_DIRECTORY">CD</option>
                  <option value="BROKER">Broker</option>
                </select>
                {item.confidence === 'FALLBACK' && (
                  <span
                    title="Détection incertaine"
                    style={{ marginLeft: 6, color: 'var(--warn)' }}
                  >
                    ⚠
                  </span>
                )}
              </div>
              <div>
                {item.duplicateOf ? (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={item.forceReplace}
                      onChange={(e) =>
                        updateItem(item.id, { forceReplace: e.target.checked })
                      }
                    />
                    <span className="box" />
                    Remplacer
                  </label>
                ) : item.state === 'done' ? (
                  <span className="badge badge--ok">Créé</span>
                ) : item.state === 'inspected' ? (
                  <span className="badge badge--ok">Prêt</span>
                ) : item.state === 'uploading' ? (
                  <div className="progress" style={{ width: 80 }}>
                    <div
                      className="progress__fill"
                      style={{ width: '60%', animation: 'indet 1.4s ease-in-out infinite' }}
                    />
                  </div>
                ) : item.state === 'error' ? (
                  <span className="badge badge--err">Échec</span>
                ) : item.state === 'skipped' ? (
                  <span className="badge badge--muted">Ignoré</span>
                ) : (
                  <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>—</span>
                )}
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => removeItem(item.id)}
                disabled={item.state === 'uploading'}
                aria-label={`Retirer ${item.fileName}`}
                title="Retirer du batch"
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
