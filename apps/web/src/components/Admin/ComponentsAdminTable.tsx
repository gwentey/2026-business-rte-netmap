import { useEffect, useMemo, useState } from 'react';
import type { AdminComponentRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';
import { ComponentConfigModal } from './ComponentConfigModal.js';
import { OrganizationEditModal } from './OrganizationEditModal.js';
import styles from './ComponentsAdminTable.module.scss';

type Props = {
  autoOpenEic?: string | null;
  onAutoOpenHandled?: () => void;
};

export function ComponentsAdminTable({
  autoOpenEic,
  onAutoOpenHandled,
}: Props = {}): JSX.Element {
  const [rows, setRows] = useState<AdminComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [editing, setEditing] = useState<AdminComponentRow | null>(null);
  const [configEic, setConfigEic] = useState<string | null>(null);
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

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    if (!autoOpenEic || rows.length === 0) return;
    const match = rows.find((r) => r.eic === autoOpenEic);
    if (match) {
      setEditing(match);
      setSearch(autoOpenEic);
    } else {
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
      result = result.filter(
        (r) =>
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
      totals: { total: rows.length },
      components: rows.map((r) => ({
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
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="EIC, nom, organisation, pays…"
          className={styles.searchInput}
        />
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={onlyOverridden}
            onChange={(e) => setOnlyOverridden(e.target.checked)}
          />
          Seulement surchargés
        </label>
        <span className={styles.counter}>
          {filtered.length} / {rows.length} composants
        </span>
        <button
          type="button"
          onClick={handleExportJson}
          disabled={rows.length === 0}
          className={styles.exportButton}
          title="Télécharger l'intégralité du tableau (ignore les filtres actifs)"
        >
          ⬇ Tout exporter ({rows.length})
        </button>
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
            <th>EIC</th>
            <th>Nom</th>
            <th>Type</th>
            <th>Organisation</th>
            <th>Pays</th>
            <th>Coord</th>
            <th>Imports</th>
            <th>Surchargé</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.eic}>
              <td className={styles.mono}>{row.eic}</td>
              <td className={styles.small}>{row.current.displayName}</td>
              <td className={styles.small}>{row.current.type}</td>
              <td className={styles.small}>{row.current.organization ?? '—'}</td>
              <td className={styles.small}>
                {row.current.country ? (
                  row.current.country
                ) : row.current.organization ? (
                  <button
                    type="button"
                    onClick={() => setOrgToCreate(row.current.organization)}
                    className={styles.missingButton}
                    title={`Pays manquant — cliquer pour ajouter « ${row.current.organization} » à la mémoire interne`}
                  >
                    ⚠ Manquant <span className={styles.missingHint}>[+]</span>
                  </button>
                ) : (
                  <span className={styles.warning} title="Pays et organisation inconnus">
                    ⚠
                  </span>
                )}
              </td>
              <td className={styles.small}>
                {row.current.isDefaultPosition ? (
                  <span className={styles.warningSmall}>⚠ défaut</span>
                ) : (
                  `${row.current.lat.toFixed(3)}, ${row.current.lng.toFixed(3)}`
                )}
              </td>
              <td className={styles.small}>{row.importsCount}</td>
              <td className={styles.small}>{row.override !== null ? '🏷' : '—'}</td>
              <td>
                <div className={styles.actions}>
                  <button
                    type="button"
                    onClick={() => setEditing(row)}
                    className={styles.editLink}
                    aria-label={`Éditer ${row.eic}`}
                  >
                    🖊 Éditer
                  </button>
                  {row.importsCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setConfigEic(row.eic)}
                      className={styles.configLink}
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
              <td colSpan={9} className={styles.emptyRow}>
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
