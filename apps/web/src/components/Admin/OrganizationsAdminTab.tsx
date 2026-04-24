import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  OrganizationEntryRow,
  OrganizationImportResult,
} from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { OrganizationEditModal } from './OrganizationEditModal.js';

const EditIcon = (): JSX.Element => (
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
    <path d="M11 2l3 3-8 8H3v-3l8-8z" />
  </svg>
);

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

  const handleImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
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
    <>
      <div className="admin-toolbar">
        <input
          type="text"
          className="input grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher (nom, pays, type, adresse)…"
          aria-label="Recherche"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => fileInputRef.current?.click()}
        >
          ⬆ Importer JSON
        </button>
        <button
          type="button"
          className="btn btn--outline"
          onClick={() => {
            void handleExport();
          }}
        >
          ⬇ Exporter JSON
        </button>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setCreating(true)}
        >
          + Nouvelle organisation
        </button>
      </div>

      {error !== null && (
        <div className="banner banner--err" role="alert" style={{ marginBottom: 12 }}>
          <div className="banner__ico">!</div>
          <div>{error}</div>
        </div>
      )}

      {importResult !== null && (
        <div
          className={
            importResult.errors.length > 0 ? 'banner banner--warn' : 'banner banner--ok'
          }
          style={{ marginBottom: 12 }}
        >
          <div className="banner__ico">{importResult.errors.length > 0 ? '!' : '✓'}</div>
          <div style={{ flex: 1 }}>
            <div>
              Import terminé : <strong>{importResult.inserted}</strong> inséré(s) ·{' '}
              <strong>{importResult.updated}</strong> mis à jour ·{' '}
              <strong>{importResult.skipped}</strong> ignoré(s)
              {importResult.errors.length > 0 && (
                <> · <strong>{importResult.errors.length}</strong> erreur(s)</>
              )}
            </div>
            {importResult.errors.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 18, fontSize: 12 }}>
                {importResult.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>
                    {err.organizationName} : {err.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setImportResult(null)}
            aria-label="Masquer"
          >
            ✕
          </button>
        </div>
      )}

      <p style={{ color: 'var(--ink-3)', fontSize: 12, marginBottom: 12 }}>
        {filtered.length} / {rows.length} organisations · {editedCount} éditée(s) par
        l'utilisateur
      </p>

      <div className="tab-content" style={{ padding: 0 }}>
        <div className="org-row__head">
          <span>EIC · Nom</span>
          <span>Pays</span>
          <span>Adresse</span>
          <span>Type</span>
          <span style={{ textAlign: 'right' }}>Actions</span>
        </div>

        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            Chargement…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--ink-3)' }}>
            {rows.length === 0
              ? 'Aucune organisation en mémoire.'
              : 'Aucun résultat pour la recherche.'}
          </div>
        )}

        {!loading &&
          filtered.map((row) => (
            <div className="org-row" key={row.id}>
              <div>
                <div style={{ color: 'var(--ink-0)', fontWeight: 600, fontSize: 13 }}>
                  {row.displayName}
                </div>
                <div className="mono" style={{ color: 'var(--cyan-1)', fontSize: 11, marginTop: 2 }}>
                  {row.organizationName}
                </div>
              </div>
              <div>
                {row.country !== null && row.country !== undefined ? (
                  <span className="badge badge--muted mono">{row.country}</span>
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                )}
              </div>
              <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                {row.address ?? <span style={{ color: 'var(--ink-4)' }}>—</span>}
              </div>
              <div>
                {row.typeHint !== null && row.typeHint !== undefined ? (
                  <span className="badge badge--teal">{row.typeHint}</span>
                ) : (
                  <span style={{ color: 'var(--ink-4)' }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {row.userEdited && (
                  <span
                    className="badge badge--cyan"
                    title={`Édité · seedVersion ${row.seedVersion}`}
                  >
                    ✓
                  </span>
                )}
                <button
                  type="button"
                  className="icon-btn"
                  title="Modifier"
                  aria-label={`Modifier ${row.displayName}`}
                  onClick={() => setEditing(row)}
                >
                  <EditIcon />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Supprimer"
                  aria-label={`Supprimer ${row.displayName}`}
                  onClick={async () => {
                    if (
                      window.confirm(
                        `Supprimer « ${row.displayName} » de la mémoire interne ?`,
                      )
                    ) {
                      try {
                        await api.deleteOrganization(row.id);
                        await reload();
                      } catch (err) {
                        setError((err as Error).message);
                      }
                    }
                  }}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}
      </div>

      {editing !== null && (
        <OrganizationEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await reload();
          }}
        />
      )}
      {creating && (
        <OrganizationEditModal
          entry={null}
          onClose={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await reload();
          }}
        />
      )}
    </>
  );
}
