import { useEffect, useState } from 'react';
import type { ProcessKey, RegistryColorRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';
import styles from './ProcessColorsEditor.module.scss';

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
    <div className={styles.container}>
      {error ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Process</th>
            <th>Couleur actuelle</th>
            <th>Choisir</th>
            <th>Défaut</th>
            <th>Statut</th>
            <th>Actions</th>
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
                <td className={styles.processName}>{row.process}</td>
                <td>
                  <span className={styles.currentColor}>
                    <span
                      className={styles.swatch}
                      style={{ backgroundColor: row.color }}
                      aria-label={`Couleur actuelle ${row.color}`}
                    />
                    <span className={styles.hex}>{row.color}</span>
                  </span>
                </td>
                <td>
                  <label htmlFor={inputId} className={styles.srOnly}>
                    Choisir la couleur pour {row.process}
                  </label>
                  <input
                    id={inputId}
                    type="color"
                    value={current}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [row.process]: e.target.value }))
                    }
                    className={styles.picker}
                  />
                </td>
                <td className={styles.defaultColor}>{row.default}</td>
                <td className={styles.status}>
                  {row.isOverride ? (
                    <span className={styles.badgeOverride}>surchargé</span>
                  ) : (
                    <span className={styles.badgeDefault}>défaut</span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      onClick={() => {
                        void save(row.process, current);
                      }}
                      disabled={!changed || isBusy}
                      className={styles.saveButton}
                    >
                      {isBusy ? '…' : 'Enregistrer'}
                    </button>
                    {row.isOverride ? (
                      <button
                        type="button"
                        onClick={() => {
                          void reset(row.process);
                        }}
                        disabled={isBusy}
                        className={styles.resetButton}
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
              <td colSpan={6} className={styles.emptyRow}>
                Chargement…
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
