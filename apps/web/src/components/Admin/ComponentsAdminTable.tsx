import { useEffect, useMemo, useState } from 'react';
import type { AdminComponentRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';

type Props = {
  autoOpenEic?: string | null;
  onAutoOpenHandled?: () => void;
};

export function ComponentsAdminTable({ autoOpenEic, onAutoOpenHandled }: Props = {}): JSX.Element {
  const [rows, setRows] = useState<AdminComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [editing, setEditing] = useState<AdminComponentRow | null>(null);

  const reload = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listAdminComponents();
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  useEffect(() => {
    if (!autoOpenEic || rows.length === 0) return;
    const match = rows.find((r) => r.eic === autoOpenEic);
    if (match) {
      setEditing(match);
      setSearch(autoOpenEic);
    } else {
      // EIC pas dans les imports — on pré-remplit le filtre pour montrer l'absence,
      // et on ouvre une ligne synthétique pour permettre la surcharge directe.
      const synthetic: AdminComponentRow = {
        eic: autoOpenEic,
        current: {
          displayName: autoOpenEic,
          type: 'ENDPOINT',
          organization: 'RTE',
          country: 'FR',
          lat: 0,
          lng: 0,
          isDefaultPosition: true,
        },
        override: null,
        importsCount: 0,
      };
      setEditing(synthetic);
      setSearch(autoOpenEic);
    }
    onAutoOpenHandled?.();
  }, [autoOpenEic, rows, onAutoOpenHandled]);

  const filtered = useMemo(() => {
    let result = rows;
    if (onlyOverridden) result = result.filter((r) => r.override !== null);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        r.eic.toLowerCase().includes(q) ||
        r.current.displayName.toLowerCase().includes(q) ||
        (r.current.organization ?? '').toLowerCase().includes(q) ||
        (r.current.country ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, search, onlyOverridden]);

  const handleModalSaved = async (): Promise<void> => {
    setEditing(null);
    await reload();
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="EIC, nom, organisation, pays…"
          className="max-w-md flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyOverridden}
            onChange={(e) => setOnlyOverridden(e.target.checked)}
          />
          Seulement surchargés
        </label>
        <span className="text-sm text-gray-500">{filtered.length} / {rows.length} composants</span>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}
      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">EIC</th>
            <th className="px-2 py-1 text-left">Nom</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Organisation</th>
            <th className="px-2 py-1 text-left">Pays</th>
            <th className="px-2 py-1 text-left">Coord</th>
            <th className="px-2 py-1 text-left">Imports</th>
            <th className="px-2 py-1 text-left">Surchargé</th>
            <th className="px-2 py-1 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.eic} className="border-t border-gray-200 hover:bg-gray-50">
              <td className="px-2 py-1 font-mono text-xs">{row.eic}</td>
              <td className="px-2 py-1 text-xs">{row.current.displayName}</td>
              <td className="px-2 py-1 text-xs">{row.current.type}</td>
              <td className="px-2 py-1 text-xs">{row.current.organization ?? '—'}</td>
              <td className="px-2 py-1 text-xs">{row.current.country ?? '—'}</td>
              <td className="px-2 py-1 text-xs">
                {row.current.isDefaultPosition ? (
                  <span className="text-orange-600">⚠ défaut</span>
                ) : (
                  `${row.current.lat.toFixed(3)}, ${row.current.lng.toFixed(3)}`
                )}
              </td>
              <td className="px-2 py-1 text-xs">{row.importsCount}</td>
              <td className="px-2 py-1 text-xs">{row.override !== null ? '🏷' : '—'}</td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                  aria-label={`Éditer ${row.eic}`}
                >
                  🖊 Éditer
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && !loading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
                Aucun composant.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {editing !== null ? (
        <ComponentOverrideModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={handleModalSaved}
        />
      ) : null}
    </div>
  );
}
