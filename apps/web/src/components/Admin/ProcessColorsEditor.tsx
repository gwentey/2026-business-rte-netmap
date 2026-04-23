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
    <>
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
              <th>Process</th>
              <th>Couleur actuelle</th>
              <th>Choisir</th>
              <th>Défaut</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const inputId = `process-color-${row.process}`;
              const current = draft[row.process] ?? row.color;
              const changed = current.toLowerCase() !== row.color.toLowerCase();
              const isBusy = busy === row.process;
              return (
                <tr key={row.process}>
                  <td className="mono" style={{ fontWeight: 700, color: 'var(--ink-0)' }}>
                    {row.process}
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <span
                        className="swatch"
                        style={{
                          background: row.color,
                          width: 14,
                          height: 14,
                          border: '1px solid var(--border-strong)',
                        }}
                        aria-label={`Couleur actuelle ${row.color}`}
                      />
                      <span className="mono">{row.color}</span>
                    </span>
                  </td>
                  <td>
                    <label htmlFor={inputId} style={{ position: 'absolute', left: -9999 }}>
                      Choisir la couleur pour {row.process}
                    </label>
                    <input
                      id={inputId}
                      type="color"
                      value={current}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [row.process]: e.target.value }))
                      }
                      style={{
                        width: 36,
                        height: 28,
                        border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--dark-1)',
                        cursor: 'pointer',
                      }}
                    />
                  </td>
                  <td className="mono" style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                    {row.default}
                  </td>
                  <td>
                    {row.isOverride ? (
                      <span className="badge badge--override">surchargé</span>
                    ) : (
                      <span className="badge badge--muted">défaut</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => {
                          void save(row.process, current);
                        }}
                        disabled={!changed || isBusy}
                      >
                        {isBusy ? '…' : 'Enregistrer'}
                      </button>
                      {row.isOverride && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={() => {
                            void reset(row.process);
                          }}
                          disabled={isBusy}
                        >
                          Réinitialiser
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Chargement…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
