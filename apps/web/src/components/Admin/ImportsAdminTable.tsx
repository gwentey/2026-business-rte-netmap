import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ImportDetail } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';
import { debounce } from '../../lib/debounce.js';
import styles from './ImportsAdminTable.module.scss';

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
    confirmDeleteId !== null ? imports.find((i) => i.id === confirmDeleteId) ?? null : null;

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <label className={styles.filterLabel}>
          <span>Env :</span>
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className={styles.select}
            aria-label="Env"
          >
            <option value="">Tous</option>
            {envs.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.searchWrapper}>
          <span>Recherche :</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="label, filename, EIC..."
            className={`${styles.input} ${styles.searchInput}`}
          />
        </label>

        <Link
          to={`/upload${envFilter ? `?env=${encodeURIComponent(envFilter)}` : ''}`}
          className={styles.primaryLink}
        >
          + Importer des dumps
        </Link>
      </div>

      {error ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className={styles.loading}>Chargement…</p> : null}

      <table className={styles.table}>
        <thead>
          <tr>
            <th>Fichier</th>
            <th>Source EIC</th>
            <th>Label</th>
            <th>Type</th>
            <th>Props</th>
            <th>Effective date</th>
            <th>Uploaded at</th>
            <th>Stats</th>
            <th>Warn.</th>
            <th>Action</th>
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
              <td colSpan={10} className={styles.emptyRow}>
                Aucun import pour ce filtre.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {deletingItem !== null ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Supprimer l'import ?</h3>
            <p className={styles.modalDescription}>
              L'import « {deletingItem.label} » sera définitivement supprimé. Les composants
              et paths qu'il apportait seront retirés du graph (sauf s'ils sont apportés
              aussi par un autre import).
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className={styles.cancelButton}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleDeleteConfirmed();
                }}
                className={styles.confirmDeleteButton}
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

  const statsLabel = `${item.stats.componentsCount} comp · ${item.stats.pathsCount} paths · ${item.stats.messagingStatsCount} stats`;
  const uploadedDisplay = formatDateTime(item.uploadedAt);

  return (
    <tr>
      <td>
        <div className={styles.fileName} title={item.fileName}>
          {item.fileName.length > 36 ? `${item.fileName.slice(0, 33)}…` : item.fileName}
        </div>
      </td>
      <td className={styles.mono}>{item.sourceComponentEic ?? '—'}</td>
      <td>
        <input
          type="text"
          value={labelValue}
          onChange={(e) => {
            setLabelValue(e.target.value);
            saveLabel(e.target.value);
          }}
          className={styles.labelInput}
        />
        {saving ? <span className={styles.savingIndicator}>…</span> : null}
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
          className={styles.dateInput}
        />
      </td>
      <td className={styles.small}>{uploadedDisplay}</td>
      <td className={`${styles.small} ${styles.muted}`}>{statsLabel}</td>
      <td>
        {item.warnings.length > 0 ? (
          <span
            className={styles.warningBadge}
            title={item.warnings.map((w) => w.code).join(', ')}
          >
            {item.warnings.length}
          </span>
        ) : (
          <span className={`${styles.small} ${styles.muted}`}>0</span>
        )}
      </td>
      <td>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer import ${item.label}`}
          className={styles.deleteButton}
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

function PropertiesBadge({ present }: { present: boolean }): JSX.Element {
  if (present) {
    return (
      <span
        className={`${styles.propsBadge} ${styles.propsBadgeOk}`}
        title="Fichier <EIC>-configuration.properties fourni à l'ingestion"
      >
        ✓
      </span>
    );
  }
  return (
    <span
      className={`${styles.propsBadge} ${styles.propsBadgeMissing}`}
      title="Aucun fichier .properties fourni : valeurs projectName/envName/NAT issues uniquement du CSV interne au zip."
    >
      ✗
    </span>
  );
}

function TypeBadge({ dumpType }: { dumpType: ImportDetail['dumpType'] }): JSX.Element {
  let typeClass = styles.typeEndpoint;
  let short = 'ENDPOINT';
  if (dumpType === 'COMPONENT_DIRECTORY') {
    typeClass = styles.typeCd;
    short = 'CD';
  } else if (dumpType === 'BROKER') {
    typeClass = styles.typeBroker;
    short = 'BROKER';
  }
  return <span className={`${styles.typeBadge} ${typeClass}`}>{short}</span>;
}

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
