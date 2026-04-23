import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrganizationEntryRow,
  OrganizationImportResult,
} from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { OrganizationEditModal } from './OrganizationEditModal.js';

export function OrganizationsAdminTab(): JSX.Element {
  const [rows, setRows] = useState<OrganizationEntryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<OrganizationEntryRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [importResult, setImportResult] = useState<OrganizationImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listOrganizations();
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr');
    if (q.length === 0) return rows;
    return rows.filter(
      (r) =>
        r.displayName.toLocaleLowerCase('fr').includes(q) ||
        r.organizationName.includes(q) ||
        (r.country ?? '').toLocaleLowerCase('fr').includes(q) ||
        (r.typeHint ?? '').toLocaleLowerCase('fr').includes(q) ||
        (r.address ?? '').toLocaleLowerCase('fr').includes(q),
    );
  }, [rows, search]);

  const editedCount = rows.filter((r) => r.userEdited).length;

  const handleExport = async (): Promise<void> => {
    try {
      const blob = await api.exportOrganizations();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'organization-memory.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset pour pouvoir re-importer le même fichier
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.importOrganizations(file);
      setImportResult(result);
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, pays, type, adresse)…"
            className="w-72 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded bg-rte px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            + Nouvelle organisation
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleImportClick}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ⬆ Importer JSON
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
          >
            ⬇ Exporter JSON
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {importResult ? (
        <div className="mb-3 rounded bg-emerald-50 p-3 text-xs text-emerald-800">
          <div className="flex items-center justify-between">
            <div>
              Import terminé : <strong>{importResult.inserted}</strong> inséré(s) ·{' '}
              <strong>{importResult.updated}</strong> mis à jour ·{' '}
              <strong>{importResult.skipped}</strong> ignoré(s)
              {importResult.errors.length > 0 ? (
                <span className="ml-2 text-red-600">
                  {importResult.errors.length} erreur(s)
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className="text-emerald-600 hover:text-emerald-900"
              aria-label="Masquer"
            >
              ✕
            </button>
          </div>
          {importResult.errors.length > 0 ? (
            <ul className="mt-1 space-y-0.5">
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i} className="font-mono text-red-700">
                  {err.organizationName} : {err.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mb-2 text-xs text-gray-500">
        {filtered.length} / {rows.length} organisations affichées · {editedCount} éditée(s)
        par l'utilisateur
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold">Nom</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold">Pays</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold">Type</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold">Adresse</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold">Position</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold text-center">Édité</th>
                <th className="border-b border-gray-300 px-2 py-1.5 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    <div>{row.displayName}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{row.organizationName}</div>
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 font-mono">
                    {row.country ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5">
                    {row.typeHint ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-gray-600">
                    {row.address ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 font-mono text-[10px] text-gray-600">
                    {row.lat != null && row.lng != null ? (
                      `${row.lat.toFixed(3)}, ${row.lng.toFixed(3)}`
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-center">
                    {row.userEdited ? (
                      <span
                        className="inline-block rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800"
                        title={`Édité · seedVersion ${row.seedVersion}`}
                      >
                        ✓
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="border-b border-gray-200 px-2 py-1.5 text-right">
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className="rounded px-2 py-0.5 text-xs text-rte hover:bg-red-50"
                    >
                      🖊 Éditer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {rows.length === 0 ? 'Aucune organisation en mémoire.' : 'Aucun résultat pour la recherche.'}
            </p>
          ) : null}
        </div>
      )}

      {editing ? (
        <OrganizationEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      ) : null}
      {creating ? (
        <OrganizationEditModal
          entry={null}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
}
