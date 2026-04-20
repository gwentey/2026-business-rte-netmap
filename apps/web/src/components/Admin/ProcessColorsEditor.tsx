import { useEffect, useState } from 'react';
import type { ProcessKey, RegistryColorRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';

export function ProcessColorsEditor(): JSX.Element {
  const [rows, setRows] = useState<RegistryColorRow[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const activeEnv = useAppStore((s) => s.activeEnv);

  const reload = async (): Promise<void> => {
    try {
      const fresh = await api.getProcessColors();
      setRows(fresh);
      const next: Record<string, string> = {};
      for (const row of fresh) next[row.process] = row.color;
      setDraft(next);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async (process: ProcessKey, color: string): Promise<void> => {
    setBusy(process);
    setError(null);
    try {
      await api.setProcessColor(process, color);
      await reload();
      if (activeEnv) await loadGraph(activeEnv);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const reset = async (process: ProcessKey): Promise<void> => {
    setBusy(process);
    setError(null);
    try {
      await api.resetProcessColor(process);
      await reload();
      if (activeEnv) await loadGraph(activeEnv);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">Process</th>
            <th className="px-2 py-1 text-left">Couleur actuelle</th>
            <th className="px-2 py-1 text-left">Choisir</th>
            <th className="px-2 py-1 text-left">Défaut</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const inputId = `process-color-${row.process}`;
            const current = draft[row.process] ?? row.color;
            const changed = current.toLowerCase() !== row.color.toLowerCase();
            const isBusy = busy === row.process;
            return (
              <tr key={row.process} className="border-t border-gray-200">
                <td className="px-2 py-1 font-mono text-xs">{row.process}</td>
                <td className="px-2 py-1">
                  <span
                    className="inline-block h-4 w-8 rounded border border-gray-300"
                    style={{ backgroundColor: row.color }}
                    aria-label={`Couleur actuelle ${row.color}`}
                  />
                  <span className="ml-2 font-mono text-xs text-gray-600">{row.color}</span>
                </td>
                <td className="px-2 py-1">
                  <label htmlFor={inputId} className="sr-only">
                    Choisir la couleur pour {row.process}
                  </label>
                  <input
                    id={inputId}
                    type="color"
                    value={current}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [row.process]: e.target.value }))
                    }
                    className="h-7 w-12 cursor-pointer rounded border border-gray-300"
                  />
                </td>
                <td className="px-2 py-1 font-mono text-xs text-gray-500">{row.default}</td>
                <td className="px-2 py-1 text-xs">
                  {row.isOverride ? (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                      surchargé
                    </span>
                  ) : (
                    <span className="text-gray-400">défaut</span>
                  )}
                </td>
                <td className="px-2 py-1">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { void save(row.process, current); }}
                      disabled={!changed || isBusy}
                      className="rounded bg-rte px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-40"
                    >
                      {isBusy ? '…' : 'Enregistrer'}
                    </button>
                    {row.isOverride ? (
                      <button
                        type="button"
                        onClick={() => { void reset(row.process); }}
                        disabled={isBusy}
                        className="rounded border border-gray-400 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      >
                        Réinitialiser
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="p-4 text-center text-sm text-gray-500">
                Chargement…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
