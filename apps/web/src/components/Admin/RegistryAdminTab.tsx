import { useEffect, useMemo, useState } from 'react';
import type { RegistryRteEndpointRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { ProcessColorsEditor } from './ProcessColorsEditor.js';

type Props = {
  onEditComponent: (eic: string) => void;
};

type View = 'mapping' | 'colors';

/**
 * RegistryAdminTab — vue principale "mapping référence interne RTE ↔ composant"
 * (ADR-040, design carto-rte v2). Onglet secondaire "Couleurs des process" pour
 * la palette.
 */
export function RegistryAdminTab({ onEditComponent }: Props): JSX.Element {
  const [view, setView] = useState<View>('mapping');
  const [rows, setRows] = useState<RegistryRteEndpointRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getRteEndpoints()
      .then((fresh) => {
        if (!cancelled) setRows(fresh);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = rows;
    if (q) {
      result = result.filter(
        (r) =>
          r.eic.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          r.displayName.toLowerCase().includes(q) ||
          r.city.toLowerCase().includes(q),
      );
    }
    // unlinked = sans override (proxy raisonnable du « non lié »)
    if (unlinkedOnly) result = result.filter((r) => !r.hasOverride);
    return result;
  }, [rows, search, unlinkedOnly]);

  return (
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div>
          <b style={{ color: 'var(--cyan-1)' }}>Registry interne RTE.</b> Cliquez une
          entrée pour ouvrir le composant correspondant dans l'onglet «&nbsp;Composants&nbsp;»
          avec sa modale d'édition pré-chargée.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <button
          type="button"
          className={
            'admin-tabs__trigger' + (view === 'mapping' ? ' is-active' : '')
          }
          onClick={() => setView('mapping')}
        >
          Mapping endpoints
          <span className="count">{rows.length}</span>
        </button>
        <button
          type="button"
          className={
            'admin-tabs__trigger' + (view === 'colors' ? ' is-active' : '')
          }
          onClick={() => setView('colors')}
        >
          Couleurs des process
        </button>
      </div>

      {view === 'colors' ? (
        <ProcessColorsEditor />
      ) : (
        <>
          <div className="admin-toolbar">
            <input
              className="input grow"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par référence interne, poste, EIC…"
              aria-label="Recherche registry"
            />
            <label className="check">
              <input
                type="checkbox"
                checked={unlinkedOnly}
                onChange={(e) => setUnlinkedOnly(e.target.checked)}
              />
              <span className="box" />
              Non liés uniquement
            </label>
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
                  <th>Référence RTE</th>
                  <th>Nom officiel</th>
                  <th>Lié à</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.eic}>
                    <td className="mono" style={{ color: 'var(--cyan-1)' }}>
                      {r.code}
                    </td>
                    <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>
                      {r.displayName}{' '}
                      <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11 }}>
                        · {r.city}
                      </span>
                    </td>
                    <td>
                      {r.hasOverride ? (
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          <span
                            className="swatch"
                            style={{ background: 'var(--ok)' }}
                          />
                          <span className="mono" style={{ color: 'var(--ink-1)' }}>
                            {r.eic}
                          </span>
                        </span>
                      ) : (
                        <span className="badge badge--warn">Non lié</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => onEditComponent(r.eic)}
                      >
                        {r.hasOverride ? 'Ouvrir la fiche →' : '+ Créer le lien'}
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !loading && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: 'center',
                        color: 'var(--ink-3)',
                        padding: 24,
                      }}
                    >
                      Aucune entrée pour ce filtre.
                    </td>
                  </tr>
                )}
                {loading && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        textAlign: 'center',
                        color: 'var(--ink-3)',
                        padding: 24,
                      }}
                    >
                      Chargement…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
