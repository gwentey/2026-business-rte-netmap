import { useEffect, useState } from 'react';
import type { RegistryRteEndpointRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

export function RteEndpointsTable({
  onEdit,
}: {
  onEdit: (eic: string) => void;
}): JSX.Element {
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
              <th>EIC</th>
              <th>Code</th>
              <th>Nom affiché</th>
              <th>Ville</th>
              <th>Coord</th>
              <th>Statut</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.eic}>
                <td className="mono" style={{ color: 'var(--cyan-1)' }}>
                  {row.eic}
                </td>
                <td className="mono" style={{ color: 'var(--ink-2)' }}>
                  {row.code}
                </td>
                <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>
                  {row.displayName}
                </td>
                <td style={{ color: 'var(--ink-2)' }}>{row.city}</td>
                <td className="mono" style={{ color: 'var(--ink-2)', fontSize: 11 }}>
                  {row.lat.toFixed(3)}, {row.lng.toFixed(3)}
                </td>
                <td>
                  {row.hasOverride ? (
                    <span className="badge badge--override">surchargé</span>
                  ) : (
                    <span className="badge badge--muted">défaut</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => onEdit(row.eic)}
                    aria-label={`Modifier ${row.eic}`}
                  >
                    Modifier →
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={7}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Aucun endpoint RTE chargé.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td
                  colSpan={7}
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
