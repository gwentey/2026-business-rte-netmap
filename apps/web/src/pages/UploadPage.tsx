import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { SubHeader } from '../components/SubHeader/SubHeader.js';
import { UploadBatchTable } from '../components/UploadBatchTable/UploadBatchTable.js';

const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 20;

interface DropReport {
  total: number;
  zips: string[];
  propsAccepted: string[];
  propsRejected: string[];
  extRejected: string[];
}

export function UploadPage(): JSX.Element {
  const [searchParams] = useSearchParams();

  const batch = useAppStore((s) => s.uploadBatch);
  const propertiesFiles = useAppStore((s) => s.propertiesFiles);
  const uploadInProgress = useAppStore((s) => s.uploadInProgress);
  const addBatchFiles = useAppStore((s) => s.addBatchFiles);
  const submitBatch = useAppStore((s) => s.submitBatch);
  const clearBatch = useAppStore((s) => s.clearBatch);

  const [envName, setEnvName] = useState(searchParams.get('env') ?? 'OPF');
  const [comment, setComment] = useState('');
  const [dropError, setDropError] = useState<string | null>(null);
  const [lastDrop, setLastDrop] = useState<DropReport | null>(null);

  const ingestFiles = (files: File[]): void => {
    setDropError(null);
    const valid: File[] = [];
    const zips: string[] = [];
    const propsAccepted: string[] = [];
    const extRejected: string[] = [];
    for (const f of files) {
      if (/\.zip$/i.test(f.name)) {
        valid.push(f);
        zips.push(f.name);
      } else if (/\.properties$/i.test(f.name)) {
        valid.push(f);
        propsAccepted.push(f.name);
      } else {
        extRejected.push(f.name);
      }
    }
    setLastDrop({
      total: files.length,
      zips,
      propsAccepted,
      propsRejected: [],
      extRejected,
    });
    if (extRejected.length > 0) {
      setDropError(
        `Extension non supportée (.zip ou .properties attendu) : ${extRejected.join(', ')}`,
      );
    }
    if (valid.length > 0) {
      void addBatchFiles(valid).then(({ propertiesRejected }) => {
        setLastDrop((prev) =>
          prev
            ? {
                ...prev,
                propsRejected: propertiesRejected,
                propsAccepted: prev.propsAccepted.filter(
                  (n) => !propertiesRejected.includes(n),
                ),
              }
            : prev,
        );
        if (propertiesRejected.length > 0) {
          setDropError(
            `Nom de .properties invalide (attendu <EIC>-configuration.properties) : ${propertiesRejected.join(', ')}`,
          );
        }
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    maxSize: MAX_UPLOAD,
    multiple: true,
    maxFiles: MAX_FILES_PER_BATCH * 2,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted) => ingestFiles(accepted),
    onDropRejected: (rejections) => {
      setDropError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté');
    },
  });

  const summary = useMemo(() => {
    const done = batch.filter((i) => i.state === 'done').length;
    const skipped = batch.filter((i) => i.state === 'skipped').length;
    const errors = batch.filter((i) => i.state === 'error').length;
    const actionable = batch.filter(
      (i) => i.state === 'inspected' && (!i.duplicateOf || i.forceReplace),
    ).length;
    const duplicates = batch.filter((i) => i.duplicateOf !== null && i.duplicateOf !== undefined).length;
    const inspecting = batch.filter((i) => i.state === 'pending-inspect').length;
    const processed = done + skipped + errors;
    const total = batch.length;
    const hasFinished = processed > 0 && !uploadInProgress && actionable === 0 && inspecting === 0;
    return {
      done,
      skipped,
      errors,
      actionable,
      duplicates,
      inspecting,
      processed,
      total,
      hasFinished,
    };
  }, [batch, uploadInProgress]);

  const handleSubmit = async (): Promise<void> => {
    if (!envName.trim()) return;
    await submitBatch(envName.trim());
  };

  const dropzoneClass = isDragActive ? 'dropzone dropzone--active' : 'dropzone';

  return (
    <>
      <SubHeader
        breadcrumb={['Administration', 'Import']}
        right={
          <span className="badge badge--muted mono">
            CLI: rte-ecp import --env {envName || '—'}
          </span>
        }
      />
      <div
        className="scroll"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: 'var(--dark-0)',
        }}
      >
        <div className="upload-page">
          <h1 className="page-title">Importer des dumps ECP</h1>
          <p className="page-subtitle">
            Glissez jusqu'à {MAX_FILES_PER_BATCH} archives ZIP +
            fichiers <span className="mono">.properties</span>. Les doublons
            sont détectés par empreinte EIC + date de snapshot.
          </p>

          <div className="upload-form-row">
            <div className="field" style={{ width: 220 }}>
              <label htmlFor="env-name">Environnement</label>
              <input
                id="env-name"
                className="input"
                value={envName}
                onChange={(e) => setEnvName(e.target.value)}
                disabled={uploadInProgress}
                placeholder="OPF / PROD / PFRFI"
              />
            </div>
            <div className="field" style={{ flex: 1, minWidth: 220 }}>
              <label htmlFor="batch-comment">Commentaire du lot (optionnel)</label>
              <input
                id="batch-comment"
                className="input"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="ex : pré-migration Q3 2025"
              />
            </div>
          </div>

          {summary.duplicates > 0 && (
            <div className="banner banner--warn" style={{ marginBottom: 14 }}>
              <div className="banner__ico">!</div>
              <div>
                <b style={{ color: 'var(--warn-strong)' }}>
                  {summary.duplicates} doublon{summary.duplicates > 1 ? 's' : ''} détecté
                  {summary.duplicates > 1 ? 's' : ''}.
                </b>{' '}
                Cochez <i>Remplacer</i> dans le tableau pour écraser le snapshot existant,
                ou retirez le fichier.
              </div>
            </div>
          )}

          <div {...getRootProps()} className={dropzoneClass}>
            <input {...getInputProps()} />
            <div className="dropzone__icon" aria-hidden>
              ↓
            </div>
            <div className="dropzone__title">
              {isDragActive
                ? 'Déposez ici'
                : 'Glissez-déposez vos fichiers ici'}
            </div>
            <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>
              jusqu'à {MAX_FILES_PER_BATCH} fichiers ·{' '}
              <span className="mono">.zip</span> ou{' '}
              <span className="mono">.properties</span> uniquement
            </div>
            <div style={{ marginTop: 18 }}>
              <button
                type="button"
                className="btn btn--outline"
                onClick={open}
              >
                Parcourir les fichiers…
              </button>
              <span className="dropzone__or">ou</span>
              <label
                className="btn btn--ghost"
                style={{ cursor: 'pointer' }}
              >
                <input
                  type="file"
                  multiple
                  accept=".zip,.properties"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = Array.from(e.currentTarget.files ?? []);
                    if (files.length > 0) ingestFiles(files);
                    e.currentTarget.value = '';
                  }}
                />
                Sélecteur natif (fallback)
              </label>
            </div>
            <div className="dropzone__hint">
              Format attendu :{' '}
              <span className="mono">
                ECP_&lt;EIC&gt;_&lt;YYYYMMDD&gt;.zip
              </span>{' '}
              + <span className="mono">&lt;EIC&gt;-configuration.properties</span> —
              taille max 50 Mo par fichier
            </div>
          </div>

          {dropError !== null && (
            <div className="banner banner--err" style={{ marginTop: 14 }} role="alert">
              <div className="banner__ico">✕</div>
              <div>{dropError}</div>
            </div>
          )}

          {lastDrop !== null && (lastDrop.zips.length > 0 || lastDrop.propsAccepted.length > 0) && (
            <div className="banner banner--info" style={{ marginTop: 14 }}>
              <div className="banner__ico">i</div>
              <div style={{ flex: 1 }}>
                <div>
                  <b>Dernier drop :</b> {lastDrop.zips.length} zip ·{' '}
                  {lastDrop.propsAccepted.length} properties
                  {lastDrop.propsRejected.length > 0 && (
                    <> · {lastDrop.propsRejected.length} properties rejetés</>
                  )}
                </div>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setLastDrop(null)}
                aria-label="Masquer"
              >
                ✕
              </button>
            </div>
          )}

          {Object.keys(propertiesFiles).length > 0 && (
            <div className="banner banner--ok" style={{ marginTop: 14 }}>
              <div className="banner__ico">✓</div>
              <div>
                {Object.keys(propertiesFiles).length} fichier(s){' '}
                <span className="mono">.properties</span> en attente d'association :{' '}
                <span className="mono">{Object.keys(propertiesFiles).join(', ')}</span>
              </div>
            </div>
          )}

          <div className="divider" />

          <UploadBatchTable />

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <button
              type="button"
              className="btn btn--ghost"
              onClick={clearBatch}
              disabled={uploadInProgress || batch.length === 0}
            >
              Vider le batch
            </button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={
                  uploadInProgress || summary.actionable === 0 || !envName.trim()
                }
              >
                {uploadInProgress
                  ? `Envoi… (${summary.processed}/${summary.total})`
                  : `Importer tout (${summary.actionable} prêt${summary.actionable > 1 ? 's' : ''})`}
              </button>
            </div>
          </div>

          {summary.hasFinished && (
            <>
              <div className="banner banner--ok" style={{ marginTop: 18 }}>
                <div className="banner__ico">✓</div>
                <div>
                  <b style={{ color: 'var(--ok-strong)' }}>Import terminé.</b>{' '}
                  {summary.done} créé{summary.done > 1 ? 's' : ''},{' '}
                  {summary.skipped} ignoré{summary.skipped > 1 ? 's' : ''},{' '}
                  {summary.errors} échec{summary.errors > 1 ? 's' : ''}.
                </div>
              </div>

              <div className="summary-grid" style={{ marginTop: 16 }}>
                <div className="summary-stat summary-stat--ok">
                  <div className="summary-stat__num">{summary.done}</div>
                  <div className="summary-stat__label">Snapshots créés</div>
                </div>
                <div className="summary-stat summary-stat--warn">
                  <div className="summary-stat__num">{summary.skipped}</div>
                  <div className="summary-stat__label">Ignorés (doublons)</div>
                </div>
                <div className="summary-stat summary-stat--err">
                  <div className="summary-stat__num">{summary.errors}</div>
                  <div className="summary-stat__label">Échecs</div>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 18,
                }}
              >
                <button type="button" className="btn btn--ghost" onClick={clearBatch}>
                  Vider le batch
                </button>
                <Link
                  className="btn btn--primary"
                  to={`/?env=${encodeURIComponent(envName)}`}
                >
                  Voir sur la carte →
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
