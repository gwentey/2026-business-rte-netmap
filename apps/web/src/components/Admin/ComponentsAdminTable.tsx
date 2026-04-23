import { useEffect, useMemo, useState } from 'react';
import type { AdminComponentRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';
import { ComponentConfigModal } from './ComponentConfigModal.js';
import { OrganizationEditModal } from './OrganizationEditModal.js';

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
  const [configEic, setConfigEic] = useState<string | null>(null);
  /** Slice 3d : organisation à pré-remplir dans OrganizationEditModal. */
  const [orgToCreate, setOrgToCreate] = useState<string | null>(null);

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

  const handleExportJson = (): void => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      filter: {
        search: search.trim() || null,
        onlyOverridden,
      },
      totals: { filtered: filtered.length, total: rows.length },
      components: filtered.map((r) => ({
        eic: r.eic,
        displayName: r.current.displayName,
        type: r.current.type,
        organization: r.current.organization,
        country: r.current.country,
        lat: r.current.isDefaultPosition ? null : r.current.lat,
        lng: r.current.isDefaultPosition ? null : r.current.lng,
        isDefaultPosition: r.current.isDefaultPosition,
        importsCount: r.importsCount,
        hasOverride: r.override !== null,
        override: r.override,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `components-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
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
        <button
          type="button"
          onClick={handleExportJson}
          disabled={filtered.length === 0}
          className="ml-auto rounded border border-gray-300 px-3 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
          title="Télécharger les lignes affichées au format JSON"
        >
          ⬇ Exporter JSON ({filtered.length})
        </button>
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
              <td className="px-2 py-1 text-xs">
                {row.current.country ? (
                  row.current.country
                ) : row.current.organization ? (
                  <button
                    type="button"
                    onClick={() => setOrgToCreate(row.current.organization)}
                    className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800 hover:bg-orange-200"
                    title={`Pays manquant — cliquer pour ajouter « ${row.current.organization} » à la mémoire interne`}
                  >
                    ⚠ Manquant <span className="text-[9px]">[+]</span>
                  </button>
                ) : (
                  <span className="text-orange-600" title="Pays et organisation inconnus">
                    ⚠
                  </span>
                )}
              </td>
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
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                    aria-label={`Éditer ${row.eic}`}
                  >
                    🖊 Éditer
                  </button>
                  {row.importsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setConfigEic(row.eic)}
                      className="text-slate-700 hover:text-slate-900 text-xs"
                      aria-label={`Voir la config ECP de ${row.eic}`}
                    >
                      ⚙ Config
                    </button>
                  ) : null}
                </div>
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

      {configEic !== null ? (
        <ComponentConfigModal eic={configEic} onClose={() => setConfigEic(null)} />
      ) : null}

      {orgToCreate !== null ? (
        <OrganizationEditModal
          entry={null}
          prefillDisplayName={orgToCreate}
          onClose={() => setOrgToCreate(null)}
          onSaved={async () => {
            setOrgToCreate(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}
