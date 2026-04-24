import { useEffect, useRef, useState } from 'react';
import type { EntsoeStatus } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

export function EntsoeAdminTab(): JSX.Element {
  const [status, setStatus] = useState<EntsoeStatus | null>(null);
  const [search, setSearch] = useState('RTE');
  const [roleFilter, setRoleFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [showUploadCard, setShowUploadCard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const formatRefreshed = (iso: string | null): string => {
    if (iso === null) return '—';
    const d = new Date(iso);
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isEmpty = status === null || status.count === 0;

  return (
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div style={{ flex: 1 }}>
          <b style={{ color: 'var(--cyan-1)' }}>Annuaire ENTSO-E — lecture seule.</b>{' '}
          Source d'autorité pour les codes EIC européens. Resynchronisation automatique
          chaque nuit à 06:00 UTC ·{' '}
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--cyan-2)',
              textDecoration: 'underline',
              cursor: 'pointer',
              font: 'inherit',
            }}
            onClick={() => setShowUploadCard((v) => !v)}
          >
            {showUploadCard ? 'Masquer la synchro manuelle' : 'Lancer une synchro manuelle'}
          </button>
        </div>
      </div>

      {showUploadCard && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
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
              ref={fileInputRef}
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
          {lastResult !== null && (
            <div className="banner banner--ok" style={{ marginTop: 12 }}>
              <div className="banner__ico">✓</div>
              <div>{lastResult}</div>
            </div>
          )}
        </div>
      )}

      <div className="admin-toolbar">
        <input
          className="input grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par code EIC, nom, pays…"
          aria-label="Recherche annuaire"
        />
        <select
          className="select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filtre rôle"
        >
          <option value="">Tous les rôles</option>
          <option value="TSO">TSO</option>
          <option value="Balancing Group">Balancing Group</option>
          <option value="Control Area">Control Area</option>
        </select>
        <select
          className="select"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          aria-label="Filtre pays"
        >
          <option value="">Tous les pays</option>
          <option value="FR">FR</option>
          <option value="DE">DE</option>
          <option value="BE">BE</option>
          <option value="ES">ES</option>
          <option value="GB">GB</option>
        </select>
      </div>

      {error !== null && (
        <div className="banner banner--err" role="alert" style={{ marginBottom: 12 }}>
          <div className="banner__ico">!</div>
          <div>{error}</div>
        </div>
      )}

      <div className="tab-content">
        <table className="tbl">
          <thead>
            <tr>
              <th>Code EIC</th>
              <th>Nom</th>
              <th>Pays</th>
              <th>Rôle</th>
              <th>Validité</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={6}
                style={{
                  textAlign: 'center',
                  color: 'var(--ink-3)',
                  padding: 32,
                  fontSize: 13,
                }}
              >
                {isEmpty ? (
                  <>
                    Annuaire vide — uploadez un fichier CSV ENTSO-E via «&nbsp;Lancer une
                    synchro manuelle&nbsp;».
                  </>
                ) : (
                  <>
                    <strong style={{ color: 'var(--ink-0)' }}>{status.count}</strong>{' '}
                    entrées en base — dernier refresh :{' '}
                    <strong style={{ color: 'var(--ink-0)' }}>
                      {formatRefreshed(status.refreshedAt)}
                    </strong>
                    .
                    <br />
                    <span style={{ color: 'var(--ink-4)' }}>
                      (Endpoint de listing à venir —{' '}
                      <span className="mono">GET /api/entsoe/entries</span>.)
                    </span>
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {!isEmpty && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 12,
            color: 'var(--ink-3)',
            fontSize: 12,
          }}
        >
          <span>
            Affichage de 0 sur <strong style={{ color: 'var(--ink-1)' }}>{status.count}</strong>
          </span>
        </div>
      )}
    </>
  );
}
