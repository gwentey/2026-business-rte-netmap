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
    <>
      <div className="admin-toolbar">
        <input
          type="text"
          className="input grow"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par EIC, nom, organisation, pays…"
          aria-label="Recherche"
        />
        <label className="check">
          <input
            type="checkbox"
            checked={onlyOverridden}
            onChange={(e) => setOnlyOverridden(e.target.checked)}
          />
          <span className="box" />
          Seulement surchargés
        </label>
        <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {filtered.length} / {rows.length}
        </span>
        <button
          type="button"
          className="btn btn--outline"
          onClick={handleExportJson}
          disabled={rows.length === 0}
          title="Télécharger l'intégralité du tableau (ignore les filtres actifs)"
        >
          ⬇ Tout exporter ({rows.length})
        </button>
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
              <th>EIC</th>
              <th>Nom affiché</th>
              <th>Type</th>
              <th>Organisation</th>
              <th>Pays</th>
              <th>Coord</th>
              <th>Imports</th>
              <th style={{ textAlign: 'center' }}>Override</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.eic}>
                <td className="mono" style={{ color: 'var(--cyan-1)' }}>
                  {row.eic}
                </td>
                <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>
                  {row.current.displayName}
                </td>
                <td>
                  <span className="badge badge--muted">{row.current.type}</span>
                </td>
                <td style={{ color: 'var(--ink-2)' }}>{row.current.organization ?? '—'}</td>
                <td>
                  {row.current.country ? (
                    <span className="badge badge--muted mono">{row.current.country}</span>
                  ) : row.current.organization ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      onClick={() => setOrgToCreate(row.current.organization)}
                      title={`Cliquer pour ajouter « ${row.current.organization} » à la mémoire`}
                      style={{ color: 'var(--warn)', height: 22, fontSize: 11 }}
                    >
                      ⚠ Manquant
                    </button>
                  ) : (
                    <span style={{ color: 'var(--warn)' }}>⚠</span>
                  )}
                </td>
                <td className="mono" style={{ fontSize: 11, color: 'var(--ink-2)' }}>
                  {row.current.isDefaultPosition ? (
                    <span style={{ color: 'var(--warn)' }}>⚠ défaut</span>
                  ) : (
                    `${row.current.lat.toFixed(3)}, ${row.current.lng.toFixed(3)}`
                  )}
                </td>
                <td className="mono" style={{ color: 'var(--ink-2)' }}>
                  {row.importsCount}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {row.override !== null ? (
                    <span className="badge badge--override">Override</span>
                  ) : (
                    <span style={{ color: 'var(--ink-4)' }}>—</span>
                  )}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn--outline btn--sm"
                      onClick={() => setEditing(row)}
                      aria-label={`Éditer ${row.eic}`}
                    >
                      Éditer
                    </button>
                    {row.importsCount > 0 && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => setConfigEic(row.eic)}
                        aria-label={`Voir la config ECP de ${row.eic}`}
                      >
                        Config
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Aucun composant.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td
                  colSpan={9}
                  style={{ textAlign: 'center', color: 'var(--ink-3)', padding: 24 }}
                >
                  Chargement…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing !== null && (
        <ComponentOverrideModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={handleModalSaved}
        />
      )}

      {configEic !== null && (
        <ComponentConfigModal eic={configEic} onClose={() => setConfigEic(null)} />
      )}

      {orgToCreate !== null && (
        <OrganizationEditModal
          entry={null}
          prefillDisplayName={orgToCreate}
          onClose={() => setOrgToCreate(null)}
          onSaved={async () => {
            setOrgToCreate(null);
            await reload();
          }}
        />
      )}
    </>
  );
}
