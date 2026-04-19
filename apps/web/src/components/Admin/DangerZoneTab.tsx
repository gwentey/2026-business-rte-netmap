import { useState } from 'react';
import { api } from '../../lib/api.js';

type Action = 'purge-imports' | 'purge-overrides' | 'purge-all';

const ACTION_CONFIG: Record<Action, { label: string; description: string; keyword: string }> = {
  'purge-imports': {
    label: 'Purger tous les imports',
    description: 'Supprime TOUS les imports (tous envs), tous les composants et paths associés, et les zips stockés sur disque. Les overrides et l\'annuaire ENTSO-E ne sont pas touchés.',
    keyword: 'PURGER',
  },
  'purge-overrides': {
    label: 'Purger toutes les surcharges',
    description: 'Supprime TOUS les ComponentOverride. Les imports et l\'annuaire ENTSO-E ne sont pas touchés.',
    keyword: 'PURGER',
  },
  'purge-all': {
    label: '⚠ Reset total (imports + overrides + ENTSO-E)',
    description: 'DÉTRUIT toutes les données applicatives : imports + composants + paths + overrides + entrées ENTSO-E. Le registry RTE (fichier JSON) n\'est pas touché.',
    keyword: 'RESET',
  },
};

export function DangerZoneTab(): JSX.Element {
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openConfirm = (action: Action): void => {
    setPending(action);
    setConfirmText('');
    setResult(null);
    setError(null);
  };

  const closeConfirm = (): void => {
    setPending(null);
    setConfirmText('');
  };

  const execute = async (): Promise<void> => {
    if (pending === null) return;
    setRunning(true);
    setError(null);
    try {
      if (pending === 'purge-imports') {
        const r = await api.purgeImportsAll();
        setResult(`${r.deletedCount} imports supprimés.`);
      } else if (pending === 'purge-overrides') {
        const r = await api.purgeOverridesAll();
        setResult(`${r.deletedCount} surcharges supprimées.`);
      } else if (pending === 'purge-all') {
        const r = await api.purgeAll();
        setResult(`Reset total : ${r.imports} imports + ${r.overrides} overrides + ${r.entsoe} entrées ENTSO-E.`);
      }
      closeConfirm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const pendingCfg = pending !== null ? ACTION_CONFIG[pending] : null;
  const canConfirm = pendingCfg !== null && confirmText === pendingCfg.keyword;

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-red-700">⚠ Zone danger</h2>
      <p className="mb-4 text-sm text-gray-600">
        Les actions ci-dessous sont <strong>irréversibles</strong>. Une confirmation par saisie
        de mot-clé est requise.
      </p>

      <div className="space-y-3">
        {(Object.keys(ACTION_CONFIG) as Action[]).map((action) => {
          const cfg = ACTION_CONFIG[action];
          return (
            <div key={action} className="rounded border border-red-200 bg-red-50 p-3">
              <p className="mb-2 text-sm font-medium text-red-900">{cfg.label}</p>
              <p className="mb-3 text-xs text-red-700">{cfg.description}</p>
              <button
                type="button"
                onClick={() => openConfirm(action)}
                className="rounded border border-red-600 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                {cfg.label}
              </button>
            </div>
          );
        })}
      </div>

      {result !== null ? (
        <p className="mt-4 rounded bg-green-100 p-3 text-sm text-green-800">{result}</p>
      ) : null}
      {error !== null ? (
        <p className="mt-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">{error}</p>
      ) : null}

      {pending !== null && pendingCfg !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold text-red-900">{pendingCfg.label}</h3>
            <p className="mb-3 text-sm text-gray-700">{pendingCfg.description}</p>
            <p className="mb-2 text-sm">
              Tapez exactement <code className="rounded bg-gray-100 px-1 font-mono text-red-700">{pendingCfg.keyword}</code> pour confirmer :
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mb-4 w-full rounded border border-gray-300 px-2 py-1 font-mono text-sm"
              aria-label="Confirmation"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirm}
                disabled={running}
                className="rounded px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { void execute(); }}
                disabled={!canConfirm || running}
                className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {running ? 'Exécution…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
