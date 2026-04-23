import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { UploadBatchTable } from '../components/UploadBatchTable/UploadBatchTable.js';
import styles from './UploadPage.module.scss';

const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 20;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const batch = useAppStore((s) => s.uploadBatch);
  const propertiesFiles = useAppStore((s) => s.propertiesFiles);
  const uploadInProgress = useAppStore((s) => s.uploadInProgress);
  const addBatchFiles = useAppStore((s) => s.addBatchFiles);
  const submitBatch = useAppStore((s) => s.submitBatch);
  const clearBatch = useAppStore((s) => s.clearBatch);

  const [envName, setEnvName] = useState(searchParams.get('env') ?? 'OPF');
  const [dropError, setDropError] = useState<string | null>(null);
  const [lastDrop, setLastDrop] = useState<{
    total: number;
    zips: string[];
    propsAccepted: string[];
    propsRejected: string[];
    extRejected: string[];
  } | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    maxSize: MAX_UPLOAD,
    multiple: true,
    maxFiles: MAX_FILES_PER_BATCH * 2,
    onDrop: (accepted) => {
      setDropError(null);
      const valid: File[] = [];
      const zips: string[] = [];
      const propsAccepted: string[] = [];
      const extRejected: string[] = [];
      for (const f of accepted) {
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
        total: accepted.length,
        zips,
        propsAccepted,
        propsRejected: [],
        extRejected,
      });
      const errors: string[] = [];
      if (extRejected.length > 0) {
        errors.push(
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
      if (errors.length > 0) setDropError(errors.join(' · '));
    },
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
    const processed = done + skipped + errors;
    const total = batch.length;
    const hasFinished = processed > 0 && !uploadInProgress;
    return { done, skipped, errors, actionable, processed, total, hasFinished };
  }, [batch, uploadInProgress]);

  const handleSubmit = async (): Promise<void> => {
    if (!envName.trim()) return;
    await submitBatch(envName.trim());
  };

  const dropzoneClass = isDragActive
    ? `${styles.dropzone} ${styles.dropzoneActive}`
    : styles.dropzone;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Importer des dumps ECP</h1>
        <p className={styles.subtitle}>
          Glissez N fichiers ZIP (Endpoint, CD ou Broker). Le type est détecté automatiquement à
          partir des fichiers présents dans le ZIP.
        </p>

        <label className={styles.fieldBlock}>
          <span className={styles.fieldLabel}>Environnement</span>
          <input
            type="text"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            disabled={uploadInProgress}
            className={styles.envInput}
            placeholder="OPF / PROD / PFRFI"
            aria-label="Environnement"
          />
        </label>

        <div {...getRootProps()} className={dropzoneClass}>
          <input {...getInputProps()} />
          <p>
            {isDragActive
              ? 'Déposez ici'
              : `Glissez jusqu'à ${MAX_FILES_PER_BATCH} dumps .zip + leurs <EIC>-configuration.properties, ou cliquez`}
          </p>
        </div>
        <p className={styles.dropzoneHint}>
          Chaque dump zip peut être accompagné de son fichier{' '}
          <code>&lt;EIC&gt;-configuration.properties</code> exporté via{' '}
          <em>Admin ECP › Settings › Runtime Configuration › Export Configuration</em> :
          projectName, envName, NAT et autres métadonnées officielles seront alors utilisés à
          l'ingestion.
        </p>

        {dropError ? (
          <p className={styles.alertError} role="alert">
            {dropError}
          </p>
        ) : null}

        {lastDrop ? (
          <div className={styles.lastDrop}>
            <div className={styles.lastDropHeader}>
              Dernier drop — {lastDrop.total} fichier(s) reçu(s)
              <button
                type="button"
                onClick={() => setLastDrop(null)}
                className={styles.lastDropClose}
                aria-label="Masquer"
              >
                ✕
              </button>
            </div>
            <ul className={styles.lastDropList}>
              {lastDrop.zips.map((n) => (
                <li key={`z-${n}`} className={styles.lineOk}>
                  ✓ zip · {n}
                </li>
              ))}
              {lastDrop.propsAccepted.map((n) => (
                <li key={`pa-${n}`} className={styles.lineProp}>
                  ✓ properties · {n}
                </li>
              ))}
              {lastDrop.propsRejected.map((n) => (
                <li key={`pr-${n}`} className={styles.lineError}>
                  ✗ properties (nom invalide) · {n}
                </li>
              ))}
              {lastDrop.extRejected.map((n) => (
                <li key={`e-${n}`} className={styles.lineError}>
                  ✗ extension · {n}
                </li>
              ))}
              {lastDrop.total === 0 ? (
                <li className={styles.lineError}>
                  ⚠ 0 fichier reçu par le dropzone — react-dropzone a filtré le drop (MIME ?
                  permission ?). Essayez le sélecteur natif ci-dessous.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <label className={styles.fallbackLabel}>
          <span>Alternative — sélecteur natif (bypass react-dropzone) :</span>
          <input
            type="file"
            multiple
            accept=".zip,.properties"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? []);
              if (files.length === 0) return;
              const zips: string[] = [];
              const propsAccepted: string[] = [];
              const extRejected: string[] = [];
              const valid: File[] = [];
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
                });
              }
              e.currentTarget.value = '';
            }}
          />
        </label>

        {Object.keys(propertiesFiles).length > 0 ? (
          <p className={styles.propertiesNotice}>
            {Object.keys(propertiesFiles).length} fichier(s) .properties en attente
            d'association : {Object.keys(propertiesFiles).join(', ')}
          </p>
        ) : null}

        <UploadBatchTable />

        <div className={styles.submitToolbar}>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={uploadInProgress || summary.actionable === 0 || !envName.trim()}
            className={styles.submitButton}
          >
            {uploadInProgress
              ? `Envoi en cours (${summary.processed}/${summary.total})…`
              : `Importer tout (${summary.actionable} prêts)`}
          </button>
          <button
            type="button"
            onClick={clearBatch}
            disabled={uploadInProgress || batch.length === 0}
            className={styles.clearButton}
          >
            Vider le batch
          </button>
        </div>

        {summary.hasFinished ? (
          <div className={styles.summary}>
            <p className={styles.summaryText}>
              Batch terminé :{' '}
              <strong>
                {summary.done} créé{summary.done > 1 ? 's' : ''}
              </strong>{' '}
              · <span>{summary.skipped} ignoré{summary.skipped > 1 ? 's' : ''}</span> ·{' '}
              <span>
                {summary.errors} échec{summary.errors > 1 ? 's' : ''}
              </span>
            </p>
            <Link
              to={`/?env=${encodeURIComponent(envName)}`}
              onClick={() => navigate('/')}
              className={styles.mapLink}
            >
              Voir sur la carte →
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
