/* app.jsx — wires DesignCanvas with all pages and tweakable state toggles */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#00bded",
  "mapState": "success",
  "uploadState": "idle",
  "adminTab": "imports",
  "baFilter": "ALL",
  "showHierarchy": true,
  "showOverlays": true,
  "showModal": false,
  "env": "PROD"
}/*EDITMODE-END*/;

function wrappedMapPage({ state, env, baFilter, showHierarchy, showOverlays }) {
  if (state === 'loading') {
    return (
      <div className="app">
        <AppHeader active="map" env={env} />
        <SubMapHeader env={env} />
        <div style={{ flex: 1, position: 'relative', background: 'var(--dark-0)' }}>
          <div className="map-overlay-state">
            <div className="state-card">
              <div className="dot-pulse" style={{ margin: '0 auto 16px', width: 14, height: 14 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 6 }}>Chargement du snapshot…</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Récupération de la topologie au <span className="mono" style={{ color: 'var(--cyan-1)' }}>29 août 2025 · 14:32 UTC</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="app">
        <AppHeader active="map" env={env} />
        <SubMapHeader env={env} />
        <div style={{ flex: 1, position: 'relative', background: 'var(--dark-0)' }}>
          <div className="map-overlay-state">
            <div className="state-card" style={{ borderColor: 'rgba(231,76,76,.35)' }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(231,76,76,.15)', color: 'var(--err)', display: 'grid', placeItems: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 800 }}>!</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#f4b4b4', marginBottom: 6 }}>Impossible de charger le snapshot</div>
              <div style={{ color: '#d49999', fontSize: 13, marginBottom: 18 }}>L'API <span className="mono">/v2/topology</span> a répondu 503 après 30 s. Le service de snapshot est probablement indisponible.</div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="btn btn--outline">Voir le journal</button>
                <button className="btn btn--primary">Réessayer</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div className="app">
        <AppHeader active="map" env={env} />
        <SubMapHeader env={env} />
        <div style={{ flex: 1, position: 'relative', background: 'var(--dark-sunken)' }}>
          <div className="map-overlay-state" style={{ background: 'var(--dark-sunken)' }}>
            <div className="state-card">
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,189,237,.1)', border: '1px solid rgba(0,189,237,.3)', color: 'var(--cyan-2)', display: 'grid', placeItems: 'center', margin: '0 auto 16px', fontSize: 22, fontWeight: 700 }}>∅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink-0)', marginBottom: 6 }}>Aucun snapshot disponible</div>
              <div style={{ color: 'var(--ink-3)', fontSize: 13, marginBottom: 20, lineHeight: 1.5 }}>
                Cet environnement n'a pas encore reçu de dump ECP. Importez un premier ZIP pour démarrer la visualisation.
              </div>
              <a className="btn btn--primary btn--lg" href="#/upload">Importer un dump →</a>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <AppHeader active="map" env={env} />
      <SubMapHeader env={env} />
      <MapPage baFilter={baFilter} showHierarchy={showHierarchy} showOverlays={showOverlays} selectedId="paris-hub" />
    </div>
  );
}

function SubMapHeader({ env }) {
  return (
    <div className="sub-header">
      <span className="badge badge--teal">{env}</span>
      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Topologie ECP · snapshot actuel</span>
      <div className="sh-right">
        <button className="btn btn--ghost btn--sm"><span style={{ fontSize: 13, marginTop: -1 }}>⟲</span>Rafraîchir</button>
        <button className="btn btn--outline btn--sm">Exporter la carte</button>
        <button className="btn btn--primary btn--sm">+ Charger un snapshot</button>
      </div>
    </div>
  );
}

/* ── App ── */
function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  return (
    <>
      <DesignCanvas>
        <DCSection id="map" title="1 — MapPage" subtitle="Visualisation de la topologie ECP sur fond dark Leaflet. 4 états: Success (par défaut), Loading, Error, Empty.">
          <DCArtboard id="map-main" label={`Success · BA ${t.baFilter} · ${t.env}`} width={1440} height={900}>
            {wrappedMapPage({ state: 'success', env: t.env, baFilter: t.baFilter, showHierarchy: t.showHierarchy, showOverlays: t.showOverlays })}
          </DCArtboard>
          <DCArtboard id="map-loading" label="Loading" width={1440} height={900}>
            {wrappedMapPage({ state: 'loading', env: t.env })}
          </DCArtboard>
          <DCArtboard id="map-error" label="Error" width={1440} height={900}>
            {wrappedMapPage({ state: 'error', env: t.env })}
          </DCArtboard>
          <DCArtboard id="map-empty" label="Empty" width={1440} height={900}>
            {wrappedMapPage({ state: 'empty', env: t.env })}
          </DCArtboard>
        </DCSection>

        <DCSection id="upload" title="2 — UploadPage" subtitle="Ingestion batch jusqu'à 20 dumps. Les 5 états du flow complet.">
          <DCArtboard id="up-idle"       label="Idle" width={1280} height={900}>
            <UploadPage state="idle" env={t.env} />
          </DCArtboard>
          <DCArtboard id="up-inspecting" label="Inspecting" width={1280} height={900}>
            <UploadPage state="inspecting" env={t.env} />
          </DCArtboard>
          <DCArtboard id="up-duplicate"  label="Duplicate detected" width={1280} height={900}>
            <UploadPage state="duplicate" env={t.env} />
          </DCArtboard>
          <DCArtboard id="up-uploading"  label="Uploading" width={1280} height={900}>
            <UploadPage state="uploading" env={t.env} />
          </DCArtboard>
          <DCArtboard id="up-complete"   label="Complete" width={1280} height={900}>
            <UploadPage state="complete" env={t.env} />
          </DCArtboard>
        </DCSection>

        <DCSection id="admin" title="3 — AdminPage" subtitle="6 onglets — Imports, Composants, Organisations, Annuaire ENTSO-E, Registry RTE, Zone danger (seule zone rouge autorisée · ADR-039).">
          <DCArtboard id="ad-imports"   label="Imports" width={1360} height={900}>
            <AdminPage tab="imports" env={t.env} />
          </DCArtboard>
          <DCArtboard id="ad-components" label="Composants + modal" width={1360} height={900}>
            <AdminPage tab="components" env={t.env} showModal={t.showModal} />
          </DCArtboard>
          <DCArtboard id="ad-orgs"      label="Organisations" width={1360} height={900}>
            <AdminPage tab="organisations" env={t.env} />
          </DCArtboard>
          <DCArtboard id="ad-entsoe"    label="Annuaire ENTSO-E" width={1360} height={900}>
            <AdminPage tab="entsoe" env={t.env} />
          </DCArtboard>
          <DCArtboard id="ad-registry"  label="Registry RTE" width={1360} height={900}>
            <AdminPage tab="registry" env={t.env} />
          </DCArtboard>
          <DCArtboard id="ad-danger"    label="⚠ Zone danger" width={1360} height={900}>
            <AdminPage tab="danger" env={t.env} />
          </DCArtboard>
        </DCSection>
      </DesignCanvas>

      <TweaksPanel title="Tweaks · Carto ECP">
        <TweakSection label="Environnement actif" />
        <TweakRadio label="Env" value={t.env} options={['OPF', 'PROD', 'PFRFI']} onChange={(v) => setTweak('env', v)} />

        <TweakSection label="MapPage" />
        <TweakToggle label="Hiérarchie CD" value={t.showHierarchy} onChange={(v) => setTweak('showHierarchy', v)} />
        <TweakToggle label="Overlays visibles" value={t.showOverlays} onChange={(v) => setTweak('showOverlays', v)} />
        <TweakSelect label="Filtre Business App"
          value={t.baFilter}
          options={[
            { label: 'Toutes', value: 'ALL' },
            { label: 'P1 — Critique', value: 'P1' },
            { label: 'P2 — Standard', value: 'P2' },
            { label: 'P3 — Dev', value: 'P3' },
          ]}
          onChange={(v) => setTweak('baFilter', v)} />

        <TweakSection label="Admin" />
        <TweakToggle label="Afficher modale Composant" value={t.showModal} onChange={(v) => setTweak('showModal', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
