import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { UploadBatchTable } from '../components/UploadBatchTable/UploadBatchTable.js';

const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 20;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const batch = useAppStore((s) => s.uploadBatch);
  const uploadInProgress = useAppStore((s) => s.uploadInProgress);
  const addBatchFiles = useAppStore((s) => s.addBatchFiles);
  const submitBatch = useAppStore((s) => s.submitBatch);
  const clearBatch = useAppStore((s) => s.clearBatch);

  const [envName, setEnvName] = useState(searchParams.get('env') ?? 'OPF');
  const [dropError, setDropError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxSize: MAX_UPLOAD,
    multiple: true,
    maxFiles: MAX_FILES_PER_BATCH,
    onDrop: (accepted) => {
      setDropError(null);
      if (accepted.length > 0) {
        void addBatchFiles(accepted);
      }
    },
    onDropRejected: (rejections) => {
      setDropError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté');
    },
  });

  const summary = useMemo(() => {
    const done = batch.filter((i) => i.state === 'done').length;
    const skipped = batch.filter((i) => i.state === 'skipped').length;
    const errors = batch.filter((i) => i.state === 'error').length;
    const actionable = batch.filter((i) => i.state === 'inspected' && (!i.duplicateOf || i.forceReplace)).length;
    const processed = done + skipped + errors;
    const total = batch.length;
    const hasFinished = processed > 0 && !uploadInProgress;
    return { done, skipped, errors, actionable, processed, total, hasFinished };
  }, [batch, uploadInProgress]);

  const handleSubmit = async (): Promise<void> => {
    if (!envName.trim()) return;
    await submitBatch(envName.trim());
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Importer des dumps ECP</h1>
      <p className="mb-6 text-sm text-gray-600">
        Glissez N fichiers ZIP (Endpoint, CD ou Broker). Le type est détecté
        automatiquement à partir des fichiers présents dans le ZIP.
      </p>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Environnement</span>
        <input
          type="text"
          value={envName}
          onChange={(e) => setEnvName(e.target.value)}
          disabled={uploadInProgress}
          className="w-48 rounded border border-gray-300 px-3 py-2"
          placeholder="OPF / PROD / PFRFI"
          aria-label="Environnement"
        />
      </label>

      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
          isDragActive ? 'border-rte bg-red-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <p>{isDragActive ? 'Déposez ici' : `Glissez jusqu'à ${MAX_FILES_PER_BATCH} .zip ou cliquez`}</p>
      </div>

      {dropError ? (
        <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">{dropError}</p>
      ) : null}

      <UploadBatchTable />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          disabled={uploadInProgress || summary.actionable === 0 || !envName.trim()}
          className="rounded bg-rte px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {uploadInProgress
            ? `Envoi en cours (${summary.processed}/${summary.total})…`
            : `Importer tout (${summary.actionable} prêts)`}
        </button>
        <button
          type="button"
          onClick={clearBatch}
          disabled={uploadInProgress || batch.length === 0}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Vider le batch
        </button>
      </div>

      {summary.hasFinished ? (
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm text-gray-700">
            Batch terminé : <strong>{summary.done} créé{summary.done > 1 ? 's' : ''}</strong>
            {' · '}
            <span>{summary.skipped} ignoré{summary.skipped > 1 ? 's' : ''}</span>
            {' · '}
            <span>{summary.errors} échec{summary.errors > 1 ? 's' : ''}</span>
          </p>
          <Link
            to={`/?env=${encodeURIComponent(envName)}`}
            onClick={() => navigate('/')}
            className="inline-block rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Voir sur la carte →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
