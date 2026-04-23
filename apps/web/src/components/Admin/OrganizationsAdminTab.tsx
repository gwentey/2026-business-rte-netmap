import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrganizationEntryRow,
  OrganizationImportResult,
} from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { OrganizationEditModal } from './OrganizationEditModal.js';
import styles from './OrganizationsAdminTab.module.scss';

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
    e.target.value = '';
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
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, pays, type, adresse)…"
            className={styles.searchInput}
          />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={styles.primaryButton}
          >
            + Nouvelle organisation
          </button>
        </div>
        <div className={styles.toolbarRight}>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className={styles.hiddenInput}
          />
          <button type="button" onClick={handleImportClick} className={styles.secondaryButton}>
            ⬆ Importer JSON
          </button>
          <button
            type="button"
            onClick={() => {
              void handleExport();
            }}
            className={styles.secondaryButton}
          >
            ⬇ Exporter JSON
          </button>
        </div>
      </div>

      {error ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}

      {importResult ? (
        <div className={styles.importResult}>
          <div className={styles.importResultHeader}>
            <div>
              Import terminé : <strong>{importResult.inserted}</strong> inséré(s) ·{' '}
              <strong>{importResult.updated}</strong> mis à jour ·{' '}
              <strong>{importResult.skipped}</strong> ignoré(s)
              {importResult.errors.length > 0 ? (
                <span className={styles.importErrorCount}>
                  {importResult.errors.length} erreur(s)
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setImportResult(null)}
              className={styles.importResultClose}
              aria-label="Masquer"
            >
              ✕
            </button>
          </div>
          {importResult.errors.length > 0 ? (
            <ul className={styles.importResultErrors}>
              {importResult.errors.slice(0, 10).map((err, i) => (
                <li key={i}>
                  {err.organizationName} : {err.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className={styles.counter}>
        {filtered.length} / {rows.length} organisations affichées · {editedCount} éditée(s)
        par l'utilisateur
      </div>

      {loading ? (
        <p className={styles.loading}>Chargement…</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Pays</th>
                <th>Type</th>
                <th>Adresse</th>
                <th>Position</th>
                <th>Édité</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div>{row.displayName}</div>
                    <div className={styles.normalizedName}>{row.organizationName}</div>
                  </td>
                  <td className={styles.mono}>
                    {row.country ?? <span className={styles.muted}>—</span>}
                  </td>
                  <td>{row.typeHint ?? <span className={styles.muted}>—</span>}</td>
                  <td className={styles.address}>
                    {row.address ?? <span className={styles.muted}>—</span>}
                  </td>
                  <td className={styles.coord}>
                    {row.lat != null && row.lng != null ? (
                      `${row.lat.toFixed(3)}, ${row.lng.toFixed(3)}`
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {row.userEdited ? (
                      <span
                        className={styles.editedBadge}
                        title={`Édité · seedVersion ${row.seedVersion}`}
                      >
                        ✓
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => setEditing(row)}
                      className={styles.editButton}
                    >
                      🖊 Éditer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className={styles.emptyMessage}>
              {rows.length === 0
                ? 'Aucune organisation en mémoire.'
                : 'Aucun résultat pour la recherche.'}
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
