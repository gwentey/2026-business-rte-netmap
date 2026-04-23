import { useEffect, useState } from 'react';
import type { RegistryRteEndpointRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import styles from './RteEndpointsTable.module.scss';

type Props = {
  onEdit: (eic: string) => void;
};

export function RteEndpointsTable({ onEdit }: Props): JSX.Element {
  const [rows, setRows] = useState<RegistryRteEndpointRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRteEndpoints()
      .then((fresh) => {
        if (!cancelled) setRows(fresh);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.container}>
      {error ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className={styles.loading}>Chargement…</p> : null}
      <table className={styles.table}>
        <thead>
          <tr>
            <th>EIC</th>
            <th>Code</th>
            <th>Nom affiché</th>
            <th>Ville</th>
            <th>Coord</th>
            <th>Statut</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.eic}>
              <td className={styles.mono}>{row.eic}</td>
              <td className={styles.small}>{row.code}</td>
              <td className={styles.small}>{row.displayName}</td>
              <td className={styles.small}>{row.city}</td>
              <td className={styles.small}>
                {row.lat.toFixed(3)}, {row.lng.toFixed(3)}
              </td>
              <td>
                {row.hasOverride ? (
                  <span className={styles.badgeOverride}>surchargé</span>
                ) : (
                  <span className={styles.badgeDefault}>défaut</span>
                )}
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => onEdit(row.eic)}
                  className={styles.editButton}
                  aria-label={`Modifier ${row.eic}`}
                >
                  Modifier
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading ? (
            <tr>
              <td colSpan={7} className={styles.emptyRow}>
                Aucun endpoint RTE chargé.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
