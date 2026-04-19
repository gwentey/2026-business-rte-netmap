import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ImportDetail } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';
import { debounce } from '../../lib/debounce.js';

export function ImportsAdminTable(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadEnvs = useAppStore((s) => s.loadEnvs);

  const [envFilter, setEnvFilter] = useState<string>(activeEnv ?? '');
  const [search, setSearch] = useState('');
  const [imports, setImports] = useState<ImportDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { void loadEnvs(); }, [loadEnvs]);

  const reloadImports = async (env: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listImports(env || undefined);
      setImports(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reloadImports(envFilter); }, [envFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return imports;
    return imports.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.fileName.toLowerCase().includes(q) ||
      (i.sourceComponentEic ?? '').toLowerCase().includes(q),
    );
  }, [imports, search]);

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.deleteImport(id);
      await reloadImports(envFilter);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deletingItem = confirmDeleteId !== null
    ? imports.find((i) => i.id === confirmDeleteId) ?? null
    : null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm">
          <span className="mr-2">Env :</span>
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="Env"
          >
            <option value="">Tous</option>
            {envs.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </label>

        <label className="flex-1 max-w-md text-sm">
          <span className="mr-2">Recherche :</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="label, filename, EIC..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <Link
          to={`/upload${envFilter ? `?env=${encodeURIComponent(envFilter)}` : ''}`}
          className="rounded bg-rte px-3 py-1.5 text-sm text-white hover:bg-red-700"
        >
          + Importer des dumps
        </Link>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">Fichier</th>
            <th className="px-2 py-1 text-left">Source EIC</th>
            <th className="px-2 py-1 text-left">Label</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Effective date</th>
            <th className="px-2 py-1 text-left">Uploaded at</th>
            <th className="px-2 py-1 text-left">Stats</th>
            <th className="px-2 py-1 text-left">Warn.</th>
            <th className="px-2 py-1 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <AdminImportRow
              key={item.id}
              item={item}
              onDelete={() => setConfirmDeleteId(item.id)}
              onReload={() => reloadImports(envFilter)}
            />
          ))}
          {filtered.length === 0 && !loading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
                Aucun import pour ce filtre.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {deletingItem !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold">Supprimer l'import ?</h3>
            <p className="mb-4 text-sm text-gray-600">
              L'import « {deletingItem.label} » sera définitivement supprimé. Les composants
              et paths qu'il apportait seront retirés du graph (sauf s'ils sont apportés
              aussi par un autre import).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteConfirmed(); }}
                className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RowProps = {
  item: ImportDetail;
  onDelete: () => void;
  onReload: () => Promise<void>;
};

function AdminImportRow({ item, onDelete, onReload }: RowProps): JSX.Element {
  const [labelValue, setLabelValue] = useState(item.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabelValue(item.label); }, [item.label]);

  const saveLabel = useMemo(
    () => debounce((newValue: string) => {
      const trimmed = newValue.trim();
      if (trimmed.length === 0 || trimmed === item.label) return;
      setSaving(true);
      void (async () => {
        try {
          await api.updateImport(item.id, { label: trimmed });
          await onReload();
        } finally {
          setSaving(false);
        }
      })();
    }, 500),
    [item.id, item.label, onReload],
  );

  const saveEffectiveDate = async (newValue: string): Promise<void> => {
    if (!newValue) return;
    const asDate = new Date(newValue);
    if (Number.isNaN(asDate.getTime())) return;
    const iso = asDate.toISOString();
    if (iso === item.effectiveDate) return;
    setSaving(true);
    try {
      await api.updateImport(item.id, { effectiveDate: iso });
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const statsLabel = `${item.stats.componentsCount} comp · ${item.stats.pathsCount} paths · ${item.stats.messagingStatsCount} stats`;
  const uploadedDisplay = formatDateTime(item.uploadedAt);

  return (
    <tr className="border-t border-gray-200">
      <td className="px-2 py-1">
        <div className="font-mono text-xs" title={item.fileName}>
          {item.fileName.length > 36 ? `${item.fileName.slice(0, 33)}…` : item.fileName}
        </div>
      </td>
      <td className="px-2 py-1 font-mono text-xs">{item.sourceComponentEic ?? '—'}</td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={labelValue}
          onChange={(e) => { setLabelValue(e.target.value); saveLabel(e.target.value); }}
          className="w-40 rounded border border-gray-300 px-1 py-0.5 text-xs"
        />
        {saving ? <span className="ml-1 text-xs text-gray-400">…</span> : null}
      </td>
      <td className="px-2 py-1">
        <TypeBadge dumpType={item.dumpType} />
      </td>
      <td className="px-2 py-1">
        <input
          type="datetime-local"
          defaultValue={toDatetimeLocalInput(item.effectiveDate)}
          onBlur={(e) => { void saveEffectiveDate(e.target.value); }}
          className="w-44 rounded border border-gray-300 px-1 py-0.5 text-xs"
        />
      </td>
      <td className="px-2 py-1 text-xs">{uploadedDisplay}</td>
      <td className="px-2 py-1 text-xs text-gray-700">{statsLabel}</td>
      <td className="px-2 py-1">
        {item.warnings.length > 0 ? (
          <span
            className="inline-block rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800"
            title={item.warnings.map((w) => w.code).join(', ')}
          >
            {item.warnings.length}
          </span>
        ) : (
          <span className="text-xs text-gray-400">0</span>
        )}
      </td>
      <td className="px-2 py-1">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer import ${item.label}`}
          className="text-red-600 hover:text-red-800"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

function TypeBadge({ dumpType }: { dumpType: ImportDetail['dumpType'] }): JSX.Element {
  const colorMap: Record<ImportDetail['dumpType'], string> = {
    ENDPOINT: 'bg-red-600',
    COMPONENT_DIRECTORY: 'bg-red-900',
    BROKER: 'bg-gray-900',
  };
  const shortMap: Record<ImportDetail['dumpType'], string> = {
    ENDPOINT: 'ENDPOINT',
    COMPONENT_DIRECTORY: 'CD',
    BROKER: 'BROKER',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs text-white ${colorMap[dumpType]}`}>
      {shortMap[dumpType]}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
