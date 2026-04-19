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

  useEffect(() => { void reload(); }, []);

  const handleUpload = async (): Promise<void> => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await api.uploadEntsoe(file);
      setLastResult(`${result.count} entrées importées à ${new Date(result.refreshedAt).toLocaleString('fr-FR')}`);
      setFile(null);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold">Annuaire ENTSO-E</h2>

      <div className="mb-4 rounded border border-gray-200 bg-gray-50 p-3 text-sm">
        {status === null ? (
          <span className="text-gray-500">Chargement du statut…</span>
        ) : status.count === 0 ? (
          <span className="text-gray-700">Annuaire vide — uploadez un fichier CSV ENTSO-E pour commencer.</span>
        ) : (
          <span className="text-gray-700">
            <strong>{status.count}</strong> entrées EIC —
            dernier refresh : <strong>{status.refreshedAt !== null ? new Date(status.refreshedAt).toLocaleString('fr-FR') : '—'}</strong>
          </span>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="entsoe-file-input" className="block text-sm font-medium">Fichier CSV ENTSO-E (format X_eicCodes.csv, max 5 MB)</label>
        <input
          id="entsoe-file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1 block text-sm"
        />
        {file !== null ? (
          <p className="mt-1 text-xs text-gray-500">{file.name} — {(file.size / 1024).toFixed(1)} KB</p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => { void handleUpload(); }}
        disabled={!file || uploading}
        className="rounded bg-rte px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {uploading ? 'Upload en cours…' : 'Uploader le fichier'}
      </button>

      {error ? (
        <p className="mt-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}
      {lastResult ? (
        <p className="mt-3 rounded bg-green-100 p-2 text-sm text-green-800">{lastResult}</p>
      ) : null}
    </div>
  );
}
