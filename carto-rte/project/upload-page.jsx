/* upload-page.jsx — 5 states: idle / inspecting / duplicate / uploading / complete */

function UploadPage({ state = 'idle', env = 'PROD' }) {
  return (
    <div className="app">
      <AppHeader active="upload" env={env} />
      <SubHeader
        breadcrumb={['Administration', 'Import']}
        right={<span className="badge badge--muted mono">CLI: rte-ecp import --env {env}</span>}
      />
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', background: 'var(--dark-0)' }} className="scroll">
        <div className="upload-page">
          <div style={{ marginBottom: 22 }}>
            <h1 className="page-title">Importer des dumps ECP</h1>
            <p className="page-subtitle">
              Glissez jusqu'à 20 archives ZIP + fichiers .properties. Les doublons sont détectés par empreinte EIC + date de snapshot.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 14, marginBottom: 20, alignItems: 'flex-end' }}>
            <div className="field" style={{ width: 220 }}>
              <label>Environnement</label>
              <input className="input" defaultValue={env} placeholder="OPF / PROD / PFRFI" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Commentaire du lot (optionnel)</label>
              <input className="input" placeholder="ex : pré-migration Q3 2025" />
            </div>
          </div>

          {state === 'idle'       && <UploadIdle />}
          {state === 'inspecting' && <UploadInspecting />}
          {state === 'duplicate'  && <UploadDuplicate />}
          {state === 'uploading'  && <UploadUploading />}
          {state === 'complete'   && <UploadComplete />}
        </div>
      </div>
    </div>
  );
}

function UploadIdle() {
  return (
    <>
      <div className="dropzone">
        <div className="dropzone__icon">↓</div>
        <div className="dropzone__title">Glissez-déposez vos fichiers ici</div>
        <div style={{ color: 'var(--ink-2)', fontSize: 13 }}>
          jusqu'à 20 fichiers ·  <span className="mono">.zip</span> ou <span className="mono">.properties</span> uniquement
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="btn btn--outline">Parcourir les fichiers…</button>
          <span className="dropzone__or">ou</span>
          <button className="btn btn--ghost">Coller un chemin réseau</button>
        </div>
        <div className="dropzone__hint">
          Format attendu : <span className="mono">ECP_&lt;EIC&gt;_&lt;YYYYMMDD&gt;.zip</span> — taille max 50&nbsp;Mo par fichier
        </div>
      </div>

      <div className="divider" />

      <div className="card">
        <div className="panel-header">
          <h2>Dernier lot déposé · 18 août 2025</h2>
          <span className="sub">12 acceptés · 2 rejetés</span>
        </div>
        <div>
          <LastBatchRow status="ok" name="ECP_10XFR-RTE-01_20250818.zip" meta="RTE France · 2.4 MB" />
          <LastBatchRow status="ok" name="ECP_10XDE-TEN-04_20250818.zip" meta="TenneT DE · 1.8 MB" />
          <LastBatchRow status="ok" name="ECP_10XBE-ELIA-02_20250818.zip" meta="Elia · 2.1 MB" />
          <LastBatchRow status="err" name="ECP_malformed.zip" meta="Archive corrompue · manifeste introuvable" />
        </div>
      </div>
    </>
  );
}

function LastBatchRow({ status, name, meta }) {
  return (
    <div className="file-row" style={{ gridTemplateColumns: '24px 1fr auto' }}>
      <div className="file-row__status">
        {status === 'ok'
          ? <span style={{ color: 'var(--ok)' }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-8" /></svg></span>
          : <span style={{ color: 'var(--err)' }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4l8 8M12 4l-8 8" /></svg></span>}
      </div>
      <div className="file-row__label">
        <div className="name mono">{name}</div>
        <div className="meta">{meta}</div>
      </div>
      <div>
        <span className={"badge " + (status === 'ok' ? 'badge--ok' : 'badge--err')}>
          {status === 'ok' ? 'Accepté' : 'Rejeté'}
        </span>
      </div>
    </div>
  );
}

function UploadInspecting() {
  const files = [
    { name: 'ECP_10XFR-RTE-01_20250829.zip', state: 'done', type: 'full dump', label: 'Snapshot PROD 29/08' },
    { name: 'ECP_10XDE-TEN-04_20250829.zip', state: 'done', type: 'full dump', label: 'TenneT Allemagne' },
    { name: 'ECP_10XBE-ELIA-02_20250829.zip', state: 'inspect', type: 'full dump', label: '' },
    { name: 'rte-prod.properties',           state: 'inspect', type: 'config',    label: '' },
    { name: 'ECP_10XES-REE-07_20250829.zip', state: 'queued', type: 'full dump', label: '' },
  ];
  return (
    <>
      <div className="dropzone dropzone--hover" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, justifyContent: 'center' }}>
          <div className="dropzone__icon" style={{ margin: 0, width: 40, height: 40, fontSize: 18 }}>⏳</div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ color: 'var(--ink-0)', fontWeight: 700 }}>Inspection en cours… <span className="mono" style={{ color: 'var(--cyan-2)' }}>2 / 5</span></div>
            <div style={{ color: 'var(--ink-3)', fontSize: 12.5 }}>Lecture des manifestes, calcul des empreintes, vérification EIC.</div>
          </div>
        </div>
      </div>
      <div className="divider" />
      <UploadBatchTable files={files} phase="inspect" />
      <UploadSubmitToolbar ready={2} total={5} disabled />
    </>
  );
}

function UploadDuplicate() {
  const files = [
    { name: 'ECP_10XFR-RTE-01_20250829.zip', state: 'ok',        type: 'full dump', label: 'Snapshot PROD 29/08' },
    { name: 'ECP_10XDE-TEN-04_20250829.zip', state: 'ok',        type: 'full dump', label: 'TenneT Allemagne' },
    { name: 'ECP_10XBE-ELIA-02_20250829.zip', state: 'duplicate', type: 'full dump', label: 'Elia · remplacement' },
    { name: 'rte-prod.properties',           state: 'ok',        type: 'config',    label: 'Config PROD' },
    { name: 'ECP_10XES-REE-07_20250829.zip', state: 'ok',        type: 'full dump', label: 'REE Espagne' },
  ];
  return (
    <>
      <div className="banner banner--warn" style={{ marginBottom: 14 }}>
        <div className="banner__ico">!</div>
        <div>
          <b style={{ color: '#f5d79a' }}>1 doublon détecté.</b> Un snapshot Elia du 29/08 existe déjà en base
          (importé il y a 2h). Cochez <i>Remplacer</i> pour l'écraser ou retirez le fichier.
        </div>
      </div>
      <DuplicateDiff />
      <div className="divider" />
      <UploadBatchTable files={files} phase="ready" />
      <UploadSubmitToolbar ready={5} total={5} />
    </>
  );
}

function DuplicateDiff() {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .6, textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 8 }}>
        Aperçu de la différence
      </div>
      <div className="dup-diff">
        <div className="dup-diff__col dup-diff__col--old">
          <div className="title" style={{ color: '#f4b4b4' }}>Existant · 2025-08-29 12:14</div>
          <div className="kv"><span>Nœuds</span><span className="mono">47</span></div>
          <div className="kv"><span>Liens</span><span className="mono">132</span></div>
          <div className="kv"><span>SHA256</span><span className="mono">…a94e2f</span></div>
        </div>
        <div className="dup-diff__arrow">→</div>
        <div className="dup-diff__col dup-diff__col--new">
          <div className="title" style={{ color: '#a7e0bc' }}>Entrant · 2025-08-29 14:32</div>
          <div className="kv"><span>Nœuds</span><span className="mono">48 <span style={{ color: 'var(--ok)' }}>+1</span></span></div>
          <div className="kv"><span>Liens</span><span className="mono">135 <span style={{ color: 'var(--ok)' }}>+3</span></span></div>
          <div className="kv"><span>SHA256</span><span className="mono">…7c1d80</span></div>
        </div>
      </div>
    </div>
  );
}

function UploadUploading() {
  const files = [
    { name: 'ECP_10XFR-RTE-01_20250829.zip', state: 'done',    type: 'full dump', label: 'Snapshot PROD 29/08', progress: 100 },
    { name: 'ECP_10XDE-TEN-04_20250829.zip', state: 'done',    type: 'full dump', label: 'TenneT Allemagne', progress: 100 },
    { name: 'ECP_10XBE-ELIA-02_20250829.zip', state: 'uploading', type: 'full dump', label: 'Elia (remplacement)', progress: 62 },
    { name: 'rte-prod.properties',           state: 'queued',  type: 'config',    label: 'Config PROD', progress: 0 },
    { name: 'ECP_10XES-REE-07_20250829.zip', state: 'queued',  type: 'full dump', label: 'REE Espagne', progress: 0 },
  ];
  return (
    <>
      <div className="card" style={{ padding: '14px 18px', marginBottom: 14, background: 'var(--dark-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-0)' }}>Import en cours · <span className="mono" style={{ color: 'var(--cyan-2)' }}>2 / 5</span> terminés</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>Lot PROD · débuté il y a 38 secondes</div>
          </div>
          <button className="btn btn--danger-outline btn--sm">Annuler</button>
        </div>
        <div className="progress">
          <div className="progress__fill" style={{ width: '48%' }} />
        </div>
      </div>
      <UploadBatchTable files={files} phase="upload" />
    </>
  );
}

function UploadComplete() {
  return (
    <>
      <div className="banner banner--ok" style={{ marginBottom: 16 }}>
        <div className="banner__ico">✓</div>
        <div>
          <b style={{ color: '#b8ecc9' }}>Import terminé en 1 min 12 s.</b> 4 snapshots créés, 1 remplacé. Les données sont immédiatement visibles sur la carte.
        </div>
      </div>

      <div className="summary-grid" style={{ marginBottom: 20 }}>
        <div className="summary-stat summary-stat--ok">
          <div className="summary-stat__num">4</div>
          <div className="summary-stat__label">Snapshots créés</div>
        </div>
        <div className="summary-stat summary-stat--warn">
          <div className="summary-stat__num">1</div>
          <div className="summary-stat__label">Remplacé (doublon)</div>
        </div>
        <div className="summary-stat">
          <div className="summary-stat__num">0</div>
          <div className="summary-stat__label">Échecs</div>
        </div>
      </div>

      <div className="card">
        <div className="panel-header">
          <h2>Détail du lot</h2>
          <span className="sub">29 août 2025 · 14:32 UTC</span>
        </div>
        <div>
          <CompleteRow label="Snapshot PROD 29/08" eic="10XFR-RTE-01" nodes="48" status="created" />
          <CompleteRow label="TenneT Allemagne"    eic="10XDE-TEN-04" nodes="91" status="created" />
          <CompleteRow label="Elia (remplacement)"  eic="10XBE-ELIA-02" nodes="34" status="replaced" />
          <CompleteRow label="Config PROD"          eic="—" nodes="—" status="created" />
          <CompleteRow label="REE Espagne"          eic="10XES-REE-07" nodes="58" status="created" />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 18 }}>
        <button className="btn btn--ghost">Vider le batch</button>
        <a className="btn btn--primary" href="#">Voir sur la carte → </a>
      </div>
    </>
  );
}

function CompleteRow({ label, eic, nodes, status }) {
  const badge = status === 'created'
    ? <span className="badge badge--ok">Créé</span>
    : <span className="badge badge--warn">Remplacé</span>;
  return (
    <div className="file-row" style={{ gridTemplateColumns: '1fr 200px 100px 110px' }}>
      <div className="file-row__label">
        <div className="name">{label}</div>
      </div>
      <div className="mono" style={{ color: 'var(--ink-2)', fontSize: 12 }}>{eic}</div>
      <div className="mono" style={{ color: 'var(--ink-2)' }}>{nodes} nœuds</div>
      <div>{badge}</div>
    </div>
  );
}

function UploadBatchTable({ files, phase }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="panel-header">
        <h2>Lot en préparation <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>· {files.length} fichiers</span></h2>
        <span className="sub">Éditez les étiquettes et types avant soumission</span>
      </div>
      <div>
        {files.map((f, i) => (
          <div className="file-row" key={i}>
            <div className="file-row__status">
              <StatusDot state={f.state} />
            </div>
            <div className="file-row__label">
              <div className="name mono" style={{ fontSize: 12, color: 'var(--ink-1)' }}>{f.name}</div>
              <div className="meta">
                {f.state === 'inspect' && <>Lecture du manifeste…</>}
                {f.state === 'queued'  && <>En attente</>}
                {f.state === 'done'    && <>Empreinte validée · prêt</>}
                {f.state === 'ok'      && <>Prêt à importer</>}
                {f.state === 'duplicate' && <span style={{ color: 'var(--warn)' }}>Doublon détecté — cochez <i>Remplacer</i></span>}
                {f.state === 'uploading' && <span style={{ color: 'var(--cyan-2)' }}>Transfert en cours…</span>}
              </div>
            </div>
            <div>
              <input className="inline-edit" defaultValue={f.label} placeholder="Étiquette…" />
            </div>
            <div>
              <select className="select" defaultValue={f.type} style={{ height: 28 }}>
                <option>full dump</option>
                <option>incremental</option>
                <option>config</option>
              </select>
            </div>
            <div>
              {f.state === 'duplicate'
                ? <label className="check"><input type="checkbox" defaultChecked /><span className="box" />Remplacer</label>
                : f.state === 'uploading'
                  ? <div className="progress" style={{ width: 90 }}><div className="progress__fill" style={{ width: `${f.progress}%` }} /></div>
                  : f.state === 'done'
                    ? <span className="badge badge--ok">Prêt</span>
                    : <span style={{ color: 'var(--ink-3)', fontSize: 11.5 }}>—</span>}
            </div>
            <button className="icon-btn" title="Retirer"><svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 4h10M6.5 4V2.5h3V4M5 4l1 9h4l1-9" /></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusDot({ state }) {
  if (state === 'done' || state === 'ok')
    return <span style={{ color: 'var(--ok)' }}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l4 4 6-8" /></svg></span>;
  if (state === 'duplicate')
    return <span style={{ color: 'var(--warn)' }}>!</span>;
  if (state === 'uploading' || state === 'inspect')
    return <span className="dot-pulse" />;
  if (state === 'queued')
    return <span style={{ color: 'var(--ink-4)', fontSize: 14 }}>·</span>;
  return null;
}

function UploadSubmitToolbar({ ready, total, disabled }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
      <button className="btn btn--ghost">Vider le batch</button>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn--outline">Valider sans importer</button>
        <button className={"btn btn--primary"} disabled={disabled} style={disabled ? { opacity: .5, cursor: 'not-allowed' } : {}}>
          Importer tout ({ready} prêt{ready > 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

// Pulsing dot style injected once
if (!document.getElementById('dot-pulse-css')) {
  const s = document.createElement('style');
  s.id = 'dot-pulse-css';
  s.textContent = `
    .dot-pulse { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--cyan-2); box-shadow: 0 0 0 0 rgba(0,189,237,.7); animation: dot-pulse 1.4s ease-out infinite; }
    @keyframes dot-pulse { 70% { box-shadow: 0 0 0 8px rgba(0,189,237,0); } 100% { box-shadow: 0 0 0 0 rgba(0,189,237,0); } }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { UploadPage });
