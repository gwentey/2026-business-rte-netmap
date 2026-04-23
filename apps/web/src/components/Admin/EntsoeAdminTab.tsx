import { useEffect, useState } from 'react';
import type { EntsoeStatus } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

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
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div>
          <b style={{ color: 'var(--cyan-1)' }}>Annuaire ENTSO-E.</b> Source d'autorité
          pour les codes EIC européens. Uploadez le fichier{' '}
          <span className="mono">X_eicCodes.csv</span> récupéré sur le portail ENTSO-E
          pour rafraîchir la mémoire.
        </div>
      </div>

      <div className="card" style={{ padding: 18, marginBottom: 16 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--ink-1)',
            marginBottom: 8,
          }}
        >
          Statut courant
        </h3>
        <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          {status === null ? (
            'Chargement…'
          ) : status.count === 0 ? (
            <>Annuaire vide — uploadez un fichier CSV ENTSO-E pour commencer.</>
          ) : (
            <>
              <strong style={{ color: 'var(--ink-0)' }}>{status.count}</strong> entrées
              EIC — dernier refresh :{' '}
              <strong style={{ color: 'var(--ink-0)' }}>
                {status.refreshedAt !== null
                  ? new Date(status.refreshedAt).toLocaleString('fr-FR')
                  : '—'}
              </strong>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 18 }}>
        <h3
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--ink-1)',
            marginBottom: 12,
          }}
        >
          Re-synchronisation manuelle
        </h3>

        <div className="field" style={{ marginBottom: 12 }}>
          <label htmlFor="entsoe-file-input">
            Fichier CSV ENTSO-E (X_eicCodes.csv, max 5 MB)
          </label>
          <input
            id="entsoe-file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="input"
            style={{ height: 'auto', padding: 6 }}
          />
          {file !== null && (
            <p style={{ color: 'var(--ink-3)', fontSize: 12, margin: 0 }}>
              {file.name} — {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            void handleUpload();
          }}
          disabled={!file || uploading}
        >
          {uploading ? 'Upload en cours…' : 'Uploader le fichier'}
        </button>

        {error !== null && (
          <div className="banner banner--err" role="alert" style={{ marginTop: 12 }}>
            <div className="banner__ico">!</div>
            <div>{error}</div>
          </div>
        )}
        {lastResult !== null && (
          <div className="banner banner--ok" style={{ marginTop: 12 }}>
            <div className="banner__ico">✓</div>
            <div>{lastResult}</div>
          </div>
        )}
      </div>
    </>
  );
}
