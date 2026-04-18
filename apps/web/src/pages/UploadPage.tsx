import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import type { SnapshotDetail, Warning } from '@carto-ecp/shared';
import { api } from '../lib/api.js';
import { useAppStore } from '../store/app-store.js';

const MAX_UPLOAD = 50 * 1024 * 1024;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const setActive = useAppStore((s) => s.setActiveSnapshot);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [envName, setEnvName] = useState('OPF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SnapshotDetail | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxSize: MAX_UPLOAD,
    multiple: false,
    onDrop: (accepted) => {
      setFile(accepted[0] ?? null);
      setError(null);
    },
    onDropRejected: (rejections) => {
      setError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté');
    },
  });

  const submit = async (): Promise<void> => {
    if (!file || !label.trim() || !envName.trim()) {
      setError('Fichier, label et environnement sont requis');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.createSnapshot(file, label.trim(), envName.trim());
      setResult(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openMap = async (): Promise<void> => {
    if (!result) return;
    await setActive(result.id);
    navigate('/map');
  };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Charger un snapshot ECP</h1>
      <p className="mb-6 text-sm text-gray-600">
        Déposez un zip de backup ECP (Endpoint ou Component Directory).
      </p>

      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
          isDragActive ? 'border-rte bg-red-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {file ? (
          <p>
            <strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB
          </p>
        ) : (
          <p>{isDragActive ? 'Déposez ici' : 'Cliquez ou déposez un .zip'}</p>
        )}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Label</span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="ex: Snapshot hebdo PROD 17/04"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Environnement</span>
          <input
            type="text"
            value={envName}
            onChange={(e) => setEnvName(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
            placeholder="OPF / PROD / PFRFI"
          />
        </label>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading}
        className="rounded bg-rte px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Envoi en cours…' : 'Envoyer'}
      </button>

      {error && (
        <p className="mt-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm text-gray-700">
            Snapshot créé : <strong>{result.label}</strong> — {result.componentType} —{' '}
            {result.stats.componentsCount} composants / {result.stats.pathsCount} paths
          </p>
          {result.warnings.length > 0 && (
            <details className="mb-3 text-sm text-gray-600">
              <summary>{result.warnings.length} avertissement(s)</summary>
              <ul className="mt-2 space-y-1">
                {result.warnings.slice(0, 20).map((w: Warning, idx) => (
                  <li key={idx}>
                    <code>{w.code}</code> — {w.message}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <button
            type="button"
            onClick={openMap}
            className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Voir sur la carte →
          </button>
        </div>
      )}
    </div>
  );
}
