/* admin-page.jsx — all 6 tabs */

function AdminPage({ tab = 'imports', env = 'PROD', showModal = false }) {
  return (
    <div className="app">
      <AppHeader active="admin" env={env} />
      <SubHeader breadcrumb={['Administration', labelForTab(tab)]} right={
        <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Dernière synchro ENTSO-E: <span className="mono" style={{ color: 'var(--ink-1)' }}>29/08 · 06:00 UTC</span>
        </span>
      } />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }} className="scroll">
        <div className="admin-page">
          <h1 className="page-title">Administration</h1>
          <p className="page-subtitle">Gestion interne — composants, imports, organisations, annuaires, zone danger</p>

          <AdminTabs active={tab} />

          {tab === 'imports' && <TabImports />}
          {tab === 'components' && <TabComponents />}
          {tab === 'organisations' && <TabOrganisations />}
          {tab === 'entsoe' && <TabEntsoe />}
          {tab === 'registry' && <TabRegistry />}
          {tab === 'danger' && <TabDanger />}
        </div>
        {showModal && <ComponentConfigModal />}
      </div>
    </div>
  );
}

function labelForTab(t) {
  return ({
    imports: 'Imports',
    components: 'Composants',
    organisations: 'Organisations',
    entsoe: 'Annuaire ENTSO-E',
    registry: 'Registry RTE',
    danger: 'Zone danger',
  })[t] || t;
}

function AdminTabs({ active }) {
  const tabs = [
    { id: 'imports', label: 'Imports', count: 218 },
    { id: 'components', label: 'Composants', count: 1842 },
    { id: 'organisations', label: 'Organisations', count: 47 },
    { id: 'entsoe', label: 'Annuaire ENTSO-E' },
    { id: 'registry', label: 'Registry RTE' },
    { id: 'danger', label: '⚠ Zone danger', danger: true },
  ];
  return (
    <div className="admin-tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={
            'admin-tabs__trigger' +
            (active === t.id ? ' is-active' : '') +
            (t.danger ? ' admin-tabs__trigger--danger' : '')
          }
        >
          {t.label}
          {t.count != null && <span className="count">{t.count.toLocaleString('fr-FR')}</span>}
        </button>
      ))}
    </div>
  );
}

/* ── Tab 1: Imports ───────────────────────────────────────── */
function TabImports() {
  const rows = [
    { date: '2025-08-29 14:32', file: 'ECP_10XFR-RTE-01_20250829.zip', eic: '10XFR-RTE-01',  type: 'full dump', state: 'ok',  user: 'M. Caron' },
    { date: '2025-08-29 14:32', file: 'ECP_10XDE-TEN-04_20250829.zip', eic: '10XDE-TEN-04',  type: 'full dump', state: 'ok',  user: 'M. Caron' },
    { date: '2025-08-29 14:32', file: 'ECP_10XBE-ELIA-02_20250829.zip', eic: '10XBE-ELIA-02', type: 'full dump', state: 'replaced', user: 'M. Caron' },
    { date: '2025-08-28 09:14', file: 'ECP_10XFR-RTE-01_20250828.zip', eic: '10XFR-RTE-01',  type: 'full dump', state: 'override', user: 'H. Dupont' },
    { date: '2025-08-27 18:02', file: 'rte-prod.properties',           eic: '—',             type: 'config',    state: 'ok',  user: 'auto' },
    { date: '2025-08-27 11:40', file: 'ECP_10XES-REE-07_20250827.zip', eic: '10XES-REE-07',  type: 'full dump', state: 'ok',  user: 'H. Dupont' },
    { date: '2025-08-26 15:55', file: 'ECP_10XDE-TEN-04_20250826.zip', eic: '10XDE-TEN-04',  type: 'full dump', state: 'failed', user: 'auto' },
    { date: '2025-08-25 08:00', file: 'ECP_10XFR-RTE-01_20250825.zip', eic: '10XFR-RTE-01',  type: 'full dump', state: 'ok',  user: 'auto' },
  ];
  return (
    <>
      <div className="admin-toolbar">
        <input className="input grow" placeholder="Rechercher un fichier, une EIC, un opérateur…" />
        <select className="select"><option>Tous les types</option><option>full dump</option><option>incremental</option><option>config</option></select>
        <select className="select"><option>Toutes les sources</option><option>Manuel</option><option>Auto (CRON)</option></select>
        <button className="btn btn--outline">Export CSV</button>
      </div>
      <div className="tab-content">
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Fichier</th><th>EIC</th><th>Type</th><th>Opérateur</th><th>État</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>{r.date}</td>
                <td className="mono" style={{ color: 'var(--ink-0)' }}>{r.file}</td>
                <td className="mono" style={{ color: 'var(--ink-2)' }}>{r.eic}</td>
                <td>{r.type}</td>
                <td style={{ color: 'var(--ink-2)' }}>{r.user}</td>
                <td><ImportStatusBadge s={r.state} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: 'var(--ink-3)', fontSize: 12 }}>
        <span>Affichage de 1–8 sur 218</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn--outline btn--sm">← Préc.</button>
          <button className="btn btn--outline btn--sm">Suiv. →</button>
        </div>
      </div>
    </>
  );
}
function ImportStatusBadge({ s }) {
  if (s === 'ok') return <span className="badge badge--ok">Succès</span>;
  if (s === 'replaced') return <span className="badge badge--warn">Remplacé</span>;
  if (s === 'override') return <span className="badge badge--override">Surchargé</span>;
  if (s === 'failed') return <span className="badge badge--err">Échec</span>;
  return <span className="badge badge--muted">{s}</span>;
}

/* ── Tab 2: Components ────────────────────────────────────── */
function TabComponents() {
  const comps = [
    { eic: '10XFR-RTE-P01', name: 'PAR-HUB-01', type: 'CD Hub', org: 'RTE France', pays: 'FR', imports: 218, override: true },
    { eic: '10XFR-RTE-L02', name: 'LYO-CD-02',  type: 'CD',     org: 'RTE France', pays: 'FR', imports: 218, override: false },
    { eic: '10XFR-RTE-M03', name: 'MRS-CD-03',  type: 'CD',     org: 'RTE France', pays: 'FR', imports: 218, override: false },
    { eic: '10XFR-RTE-T11', name: 'TLS-ECP-11', type: 'ECP',    org: 'RTE France', pays: 'FR', imports: 214, override: true },
    { eic: '10XDE-TEN-A04', name: 'FRA-XB-04',  type: 'X-Border', org: 'TenneT TSO GmbH', pays: 'DE', imports: 182, override: false },
    { eic: '10XBE-ELIA-02', name: 'BRU-XB-02',  type: 'X-Border', org: 'Elia',         pays: 'BE', imports: 196, override: true },
    { eic: '10XES-REE-07',  name: 'MAD-XB-06',  type: 'X-Border', org: 'Red Eléctrica', pays: 'ES', imports: 204, override: false },
    { eic: '10XUK-NG-A01',  name: 'LDN-XB-01',  type: 'X-Border', org: 'National Grid ESO', pays: 'GB', imports: 109, override: false },
    { eic: '10XCH-SWG-01',  name: 'GEN-XB-09',  type: 'X-Border', org: 'Swissgrid',    pays: 'CH', imports: 178, override: true },
  ];
  return (
    <>
      <div className="admin-toolbar">
        <input className="input grow" placeholder="Rechercher par nom, EIC, organisation…" defaultValue="" />
        <label className="check"><input type="checkbox" /><span className="box" />Seulement surchargés</label>
        <select className="select"><option>Tous les pays</option><option>FR</option><option>DE</option><option>BE</option><option>ES</option></select>
        <button className="btn btn--outline">Export JSON</button>
      </div>
      <div className="tab-content">
        <table className="tbl">
          <thead>
            <tr><th>EIC</th><th>Nom affiché</th><th>Type</th><th>Organisation</th><th>Pays</th><th>Imports</th><th style={{ textAlign: 'center' }}>Override</th></tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--cyan-1)' }}>{c.eic}</td>
                <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{c.name}</td>
                <td>{c.type}</td>
                <td style={{ color: 'var(--ink-2)' }}>{c.org}</td>
                <td className="mono">{c.pays}</td>
                <td className="mono" style={{ color: 'var(--ink-2)' }}>{c.imports}</td>
                <td style={{ textAlign: 'center' }}>
                  {c.override ? <span className="badge badge--override">Override</span> : <span style={{ color: 'var(--ink-4)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Tab 3: Organisations ─────────────────────────────────── */
function TabOrganisations() {
  const orgs = [
    { eic: '10X1001A1001A82', name: 'RTE — Réseau de Transport d\'Électricité', pays: 'FR', adresse: '1 Terrasse Bellini, 92919 Puteaux', type: 'TSO' },
    { eic: '10X1001A1001A85', name: 'TenneT TSO GmbH', pays: 'DE', adresse: 'Bernecker Str. 70, 95448 Bayreuth', type: 'TSO' },
    { eic: '10X1001A1001A96', name: 'Elia System Operator', pays: 'BE', adresse: 'Boulevard de l\'Empereur 20, 1000 Bruxelles', type: 'TSO' },
    { eic: '10X1001C--00010J', name: 'Red Eléctrica de España', pays: 'ES', adresse: 'Paseo del Conde de los Gaitanes, Madrid', type: 'TSO' },
    { eic: '10X1001A1001A39', name: 'National Grid ESO', pays: 'GB', adresse: 'Warwick Technology Park, Warwick', type: 'TSO' },
    { eic: '10XCH-SWISSGRIDZ', name: 'Swissgrid AG', pays: 'CH', adresse: 'Bleichemattstrasse 31, 5000 Aarau', type: 'TSO' },
    { eic: '10X1001A1001A73', name: 'TERNA S.p.A.', pays: 'IT', adresse: 'Viale Egidio Galbani 70, Roma', type: 'TSO' },
  ];
  return (
    <>
      <div className="admin-toolbar">
        <input className="input grow" placeholder="Filtrer par nom, EIC, pays…" />
        <button className="btn btn--outline">Importer CSV</button>
        <button className="btn btn--primary">+ Créer une organisation</button>
      </div>
      <div className="tab-content" style={{ padding: 0 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--dark-1)', display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 100px', gap: 14, fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: 'var(--ink-3)', letterSpacing: .5 }}>
          <span>EIC · Nom</span><span>Pays</span><span>Adresse</span><span>Type</span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {orgs.map((o, i) => (
          <div className="org-row" key={i}>
            <div>
              <div style={{ color: 'var(--ink-0)', fontWeight: 600, fontSize: 13 }}>{o.name}</div>
              <div className="mono" style={{ color: 'var(--cyan-1)', fontSize: 11, marginTop: 2 }}>{o.eic}</div>
            </div>
            <div><span className="badge badge--muted mono">{o.pays}</span></div>
            <div style={{ color: 'var(--ink-2)', fontSize: 12 }}>{o.adresse}</div>
            <div><span className="badge badge--teal">{o.type}</span></div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button className="icon-btn" title="Modifier"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M11 2l3 3-8 8H3v-3l8-8z" /></svg></button>
              <button className="icon-btn" title="Supprimer"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l1 9h4l1-9" /></svg></button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ── Tab 4: ENTSO-E directory ─────────────────────────────── */
function TabEntsoe() {
  const results = [
    { eic: '10X1001A1001A82', name: 'RTE', country: 'FR', role: 'Transmission System Operator', valid: true },
    { eic: '10YFR-RTE------C', name: 'France', country: 'FR', role: 'Control Area', valid: true },
    { eic: '17Y100A101R0036A', name: 'RTE-Nord', country: 'FR', role: 'Balancing Group', valid: true },
    { eic: '10X1001A1001A85', name: 'TenneT TSO GmbH', country: 'DE', role: 'Transmission System Operator', valid: true },
    { eic: '10X1001A1001A51', name: 'Amprion GmbH', country: 'DE', role: 'Transmission System Operator', valid: true },
  ];
  return (
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div>
          <b style={{ color: 'var(--cyan-1)' }}>Annuaire ENTSO-E — lecture seule.</b> Source d'autorité pour les codes EIC européens.
          Resynchronisation automatique chaque nuit à 06:00 UTC ·  <a href="#" style={{ color: 'var(--cyan-2)', textDecoration: 'underline' }}>Lancer une synchro manuelle</a>
        </div>
      </div>
      <div className="admin-toolbar">
        <input className="input grow" placeholder="Rechercher par code EIC, nom, pays…" defaultValue="RTE" />
        <select className="select"><option>Tous les rôles</option><option>TSO</option><option>Balancing Group</option><option>Control Area</option></select>
        <select className="select"><option>Tous les pays</option><option>FR</option><option>DE</option></select>
      </div>
      <div className="tab-content">
        <table className="tbl">
          <thead><tr><th>Code EIC</th><th>Nom</th><th>Pays</th><th>Rôle</th><th>Validité</th><th></th></tr></thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--cyan-1)' }}>{r.eic}</td>
                <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{r.name}</td>
                <td className="mono">{r.country}</td>
                <td style={{ color: 'var(--ink-2)' }}>{r.role}</td>
                <td><span className="badge badge--ok">Actif</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn--ghost btn--sm">→ Créer un composant</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Tab 5: Registry RTE ──────────────────────────────────── */
function TabRegistry() {
  const entries = [
    { eic: 'RTE-INT-PAR-001', name: 'Nœud PARIS ALMA',  linked: true,  target: 'PAR-HUB-01' },
    { eic: 'RTE-INT-LYO-002', name: 'Nœud LYON JONAGE', linked: true,  target: 'LYO-CD-02' },
    { eic: 'RTE-INT-MRS-003', name: 'Nœud MARSEILLE',   linked: true,  target: 'MRS-CD-03' },
    { eic: 'RTE-INT-BRD-014', name: 'Poste BORDEAUX',    linked: false },
    { eic: 'RTE-INT-NTE-019', name: 'Nœud NANTES CHEVIRÉ', linked: true, target: 'NTE-ECP-19' },
    { eic: 'RTE-INT-REN-022', name: 'Nœud RENNES NORD',   linked: true, target: 'REN-ECP-22' },
    { eic: 'RTE-INT-STR-031', name: 'Poste STRASBOURG',   linked: false },
    { eic: 'RTE-INT-NCE-035', name: 'Nœud NICE',          linked: false },
  ];
  return (
    <>
      <div className="banner banner--info" style={{ marginBottom: 16 }}>
        <div className="banner__ico">i</div>
        <div>
          <b style={{ color: 'var(--cyan-1)' }}>Registry interne RTE.</b> Cliquez une entrée pour ouvrir le composant correspondant dans l'onglet « Composants » avec sa modale d'édition pré-chargée.
        </div>
      </div>
      <div className="admin-toolbar">
        <input className="input grow" placeholder="Rechercher par référence interne, poste, EIC…" />
        <label className="check"><input type="checkbox" /><span className="box" />Non liés uniquement</label>
      </div>
      <div className="tab-content">
        <table className="tbl">
          <thead><tr><th>Référence RTE</th><th>Nom officiel</th><th>Lié à</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--cyan-1)' }}>{e.eic}</td>
                <td style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{e.name}</td>
                <td>
                  {e.linked
                    ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span className="swatch" style={{ background: 'var(--ok)' }} /><span className="mono" style={{ color: 'var(--ink-1)' }}>{e.target}</span></span>
                    : <span className="badge badge--warn">Non lié</span>}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn--ghost btn--sm">{e.linked ? 'Ouvrir la fiche →' : '+ Créer le lien'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ── Tab 6: Danger zone ──────────────────────────────────── */
function TabDanger() {
  return (
    <>
      <div className="banner banner--err" style={{ marginBottom: 20 }}>
        <div className="banner__ico">⚠</div>
        <div>
          <b style={{ color: '#f4b4b4' }}>Zone protégée — actions irréversibles.</b> Conformément à l'ADR-039, c'est la
          seule zone de l'application habilitée à utiliser le rouge d'alerte. Toute opération est tracée et notifiée aux
          administrateurs de production.
        </div>
      </div>

      <DangerCard
        icon="⟲"
        title="Rejouer l'intégralité des imports"
        desc="Purge la base puis rejoue tous les snapshots archivés dans l'ordre chronologique. Durée estimée : ~45 min. Rend la carte indisponible pendant l'opération."
        confirmText="REJOUER"
        variant="outline"
      />
      <DangerCard
        icon="✕"
        title="Purger l'historique des snapshots"
        desc="Supprime définitivement tous les snapshots antérieurs à une date. Les overrides manuels sont préservés. Opération non réversible."
        confirmText="PURGER"
        variant="outline"
      />
      <DangerCard
        icon="⟳"
        title="Réinitialiser les overrides manuels"
        desc="Remet tous les composants surchargés (displayName, lat/lng, org, pays) à leur valeur importée d'origine. Supprime 47 overrides actuels."
        confirmText="RÉINITIALISER"
        variant="outline"
      />
      <DangerCard
        icon="⏸"
        title="Activer le mode maintenance"
        desc="Met l'application en lecture seule. Bloque les imports et l'édition de composants pour tous les utilisateurs non-admin."
        confirmText="ACTIVER"
        variant="solid"
      />
      <DangerCard
        icon="💣"
        title="Détruire la base de données"
        desc="Supprime définitivement toutes les données (snapshots, composants, organisations, historique). Nécessite une double confirmation et le mot de passe maître."
        confirmText="JE COMPRENDS · DÉTRUIRE"
        variant="solid"
      />
    </>
  );
}

function DangerCard({ icon, title, desc, confirmText, variant }) {
  return (
    <div className="danger-card">
      <div className="danger-card__icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{desc}</p>
      </div>
      <button className={variant === 'solid' ? 'btn btn--danger' : 'btn btn--danger-outline'}>
        {confirmText}
      </button>
    </div>
  );
}

/* ── Component config modal (edit displayName, lat, lng, org, pays) ── */
function ComponentConfigModal() {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal__head">
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--cyan-2)', marginBottom: 2 }}>Édition de composant · override</div>
            <h3 className="mono">PAR-HUB-01 <span style={{ color: 'var(--cyan-1)', fontSize: 12 }}>· 10XFR-RTE-P01</span></h3>
          </div>
          <button className="icon-btn"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg></button>
        </div>
        <div className="modal__body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="field" style={{ gridColumn: '1/-1' }}>
            <label>Nom affiché (override)</label>
            <input className="input" defaultValue="PAR-HUB-01" />
          </div>
          <div className="field">
            <label>Latitude</label>
            <input className="input mono" defaultValue="48.8566" />
          </div>
          <div className="field">
            <label>Longitude</label>
            <input className="input mono" defaultValue="2.3522" />
          </div>
          <div className="field">
            <label>Organisation</label>
            <select className="select"><option>RTE France</option><option>TenneT</option><option>Elia</option></select>
          </div>
          <div className="field">
            <label>Pays</label>
            <select className="select"><option>FR</option><option>DE</option><option>BE</option></select>
          </div>
          <div className="banner banner--info" style={{ gridColumn: '1/-1', marginTop: 4 }}>
            <div className="banner__ico">i</div>
            <div style={{ fontSize: 12 }}>Ces valeurs surcharge­ront les données importées et seront conservées lors des prochains imports.</div>
          </div>
        </div>
        <div className="modal__foot">
          <button className="btn btn--ghost">Restaurer l'origine</button>
          <div style={{ flex: 1 }} />
          <button className="btn btn--outline">Annuler</button>
          <button className="btn btn--primary">Enregistrer l'override</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { AdminPage });
