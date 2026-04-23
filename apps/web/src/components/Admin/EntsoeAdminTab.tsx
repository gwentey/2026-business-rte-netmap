import { useEffect, useState } from 'react';
import type { EntsoeStatus } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import styles from './EntsoeAdminTab.module.scss';

export function EntsoeAdminTab(): JSX.Element {
  const [status, setStatus] = useState<EntsoeStatus | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    try {
      const s = await api.getEntsoeStatus();
      setStatus(s);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const handleUpload = async (): Promise<void> => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await api.uploadEntsoe(file);
      setLastResult(
        `${result.count} entrées importées à ${new Date(result.refreshedAt).toLocaleString('fr-FR')}`,
      );
      setFile(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Annuaire ENTSO-E</h2>

      <div className={styles.statusBox}>
        {status === null ? (
          <span className={styles.statusMuted}>Chargement du statut…</span>
        ) : status.count === 0 ? (
          <span>Annuaire vide — uploadez un fichier CSV ENTSO-E pour commencer.</span>
        ) : (
          <span>
            <strong>{status.count}</strong> entrées EIC — dernier refresh :{' '}
            <strong>
              {status.refreshedAt !== null
                ? new Date(status.refreshedAt).toLocaleString('fr-FR')
                : '—'}
            </strong>
          </span>
        )}
      </div>

      <div className={styles.field}>
        <label htmlFor="entsoe-file-input" className={styles.label}>
          Fichier CSV ENTSO-E (format X_eicCodes.csv, max 5 MB)
        </label>
        <input
          id="entsoe-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className={styles.fileInput}
        />
        {file !== null ? (
          <p className={styles.fileInfo}>
            {file.name} — {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => {
          void handleUpload();
        }}
        disabled={!file || uploading}
        className={styles.submitButton}
      >
        {uploading ? 'Upload en cours…' : 'Uploader le fichier'}
      </button>

      {error ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}
      {lastResult ? <p className={styles.alertSuccess}>{lastResult}</p> : null}
    </div>
  );
}
