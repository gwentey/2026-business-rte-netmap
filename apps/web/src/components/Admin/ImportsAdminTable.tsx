import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ImportDetail } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';
import { debounce } from '../../lib/debounce.js';

const TrashIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M3 4h10M6.5 4V2.5h3V4M5 4l1 9h4l1-9" />
  </svg>
);

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDatetimeLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function TypeBadge({ dumpType }: { dumpType: ImportDetail['dumpType'] }): JSX.Element {
  if (dumpType === 'COMPONENT_DIRECTORY')
    return <span className="badge badge--cyan">CD</span>;
  if (dumpType === 'BROKER') return <span className="badge badge--teal">BROKER</span>;
  return <span className="badge badge--ok">ENDPOINT</span>;
}

function PropertiesBadge({ present }: { present: boolean }): JSX.Element {
  if (present)
    return (
      <span
        className="badge badge--ok"
        title=".properties externe fourni à l'ingestion"
      >
        ✓
      </span>
    );
  return (
    <span
      className="badge badge--muted"
      title="Aucun .properties — valeurs depuis CSV interne"
    >
      ✗
    </span>
  );
}

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

  useEffect(() => {
    void loadEnvs();
  }, [loadEnvs]);

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

  useEffect(() => {
    void reloadImports(envFilter);
  }, [envFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return imports;
    return imports.filter(
      (i) =>
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

  const deletingItem =
    confirmDeleteId !== null
      ? (imports.find((i) => i.id === confirmDeleteId) ?? null)
      : null;

  return (
    <>
      <div className="admin-toolbar">
        <input
          type="text"
          className="input grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (label, filename, EIC)…"
          aria-label="Recherche"
        />
        <select
          className="select"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          aria-label="Environnement"
        >
          <option value="">Tous les envs</option>
          {envs.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <Link
          to={`/upload${envFilter ? `?env=${encodeURIComponent(envFilter)}` : ''}`}
          className="btn btn--primary"
        >
          + Importer des dumps
        </Link>
      </div>

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
              <th>Fichier</th>
              <th>EIC</th>
              <th>Label</th>
              <th>Type</th>
              <th>Props</th>
              <th>Effective date</th>
              <th>Uploaded</th>
              <th>Stats</th>
              <th>Warn.</th>
              <th></th>
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
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={10}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Aucun import pour ce filtre.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td
                  colSpan={10}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Chargement…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deletingItem !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__head">
              <h3>Supprimer l'import ?</h3>
            </div>
            <div className="modal__body">
              <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5 }}>
                L'import «&nbsp;<strong style={{ color: 'var(--ink-0)' }}>{deletingItem.label}</strong>&nbsp;»
                sera définitivement supprimé. Les composants et paths qu'il apportait seront
                retirés du graph (sauf s'ils sont apportés aussi par un autre import).
              </p>
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setConfirmDeleteId(null)}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  void handleDeleteConfirmed();
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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

  useEffect(() => {
    setLabelValue(item.label);
  }, [item.label]);

  const saveLabel = useMemo(
    () =>
      debounce((newValue: string) => {
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

  const statsLabel = `${item.stats.componentsCount} comp · ${item.stats.pathsCount} paths`;

  return (
    <tr>
      <td className="mono" title={item.fileName}>
        {item.fileName.length > 36 ? `${item.fileName.slice(0, 33)}…` : item.fileName}
      </td>
      <td className="mono" style={{ color: 'var(--cyan-1)' }}>
        {item.sourceComponentEic ?? '—'}
      </td>
      <td>
        <input
          type="text"
          value={labelValue}
          onChange={(e) => {
            setLabelValue(e.target.value);
            saveLabel(e.target.value);
          }}
          className="inline-edit"
        />
        {saving && <span style={{ color: 'var(--ink-3)', marginLeft: 4 }}>…</span>}
      </td>
      <td>
        <TypeBadge dumpType={item.dumpType} />
      </td>
      <td>
        <PropertiesBadge present={item.hasConfigurationProperties} />
      </td>
      <td>
        <input
          type="datetime-local"
          defaultValue={toDatetimeLocalInput(item.effectiveDate)}
          onBlur={(e) => {
            void saveEffectiveDate(e.target.value);
          }}
          className="input"
          style={{ height: 28, fontSize: 11.5, width: 170 }}
        />
      </td>
      <td className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
        {formatDateTime(item.uploadedAt)}
      </td>
      <td style={{ fontSize: 11, color: 'var(--ink-3)' }}>{statsLabel}</td>
      <td>
        {item.warnings.length > 0 ? (
          <span
            className="badge badge--warn"
            title={item.warnings.map((w) => w.code).join(', ')}
          >
            {item.warnings.length}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>0</span>
        )}
      </td>
      <td>
        <button
          type="button"
          className="icon-btn"
          onClick={onDelete}
          aria-label={`Supprimer import ${item.label}`}
          title="Supprimer"
        >
          <TrashIcon />
        </button>
      </td>
    </tr>
  );
}
