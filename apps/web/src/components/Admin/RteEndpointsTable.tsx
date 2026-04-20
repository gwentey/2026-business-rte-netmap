import { useEffect, useState } from 'react';
import type { RegistryRteEndpointRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

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
    <div>
      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="mb-2 text-sm text-gray-500">Chargement…</p> : null}
      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">EIC</th>
            <th className="px-2 py-1 text-left">Code</th>
            <th className="px-2 py-1 text-left">Nom affiché</th>
            <th className="px-2 py-1 text-left">Ville</th>
            <th className="px-2 py-1 text-left">Coord</th>
            <th className="px-2 py-1 text-left">Statut</th>
            <th className="px-2 py-1 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.eic} className="border-t border-gray-200 hover:bg-gray-50">
              <td className="px-2 py-1 font-mono text-xs">{row.eic}</td>
              <td className="px-2 py-1 text-xs">{row.code}</td>
              <td className="px-2 py-1 text-xs">{row.displayName}</td>
              <td className="px-2 py-1 text-xs">{row.city}</td>
              <td className="px-2 py-1 text-xs">
                {row.lat.toFixed(3)}, {row.lng.toFixed(3)}
              </td>
              <td className="px-2 py-1 text-xs">
                {row.hasOverride ? (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                    surchargé
                  </span>
                ) : (
                  <span className="text-gray-400">défaut</span>
                )}
              </td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => onEdit(row.eic)}
                  className="rounded border border-blue-600 px-2 py-1 text-xs text-blue-700 hover:bg-blue-50"
                  aria-label={`Modifier ${row.eic}`}
                >
                  Modifier
                </button>
              </td>
            </tr>
          ))}
          {rows.length === 0 && !loading ? (
            <tr>
              <td colSpan={7} className="p-4 text-center text-sm text-gray-500">
                Aucun endpoint RTE chargé.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
