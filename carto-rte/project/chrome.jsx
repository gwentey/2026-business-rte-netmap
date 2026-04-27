/* chrome.jsx — AppHeader & SubHeader shared chrome */

function AppHeader({ active = 'map', env = 'PROD' }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-logo">Rte</div>
        <div>
          <div className="brand-title">Carto ECP · RTE</div>
          <div className="brand-tagline">Topologie réseau — vue opérationnelle</div>
        </div>
      </div>

      <nav className="app-nav">
        <a href="#/" className={active === 'map' ? 'active' : ''}>Carte</a>
        <a href="#/upload" className={active === 'upload' ? 'active' : ''}>Import</a>
        <a href="#/admin" className={active === 'admin' ? 'active' : ''}>Administration</a>
      </nav>

      <div className="env-selector" title="Environnement actif">
        <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .5, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Env</span>
        <span className="env-chip">{env}</span>
        <span className="env-caret">▾</span>
      </div>

      <div className="hdr-user">
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>v3.14.2</span>
        <span className="avatar">MC</span>
      </div>
    </header>
  );
}

function SubHeader({ breadcrumb = [], right }) {
  return (
    <div className="sub-header">
      <div className="breadcrumb">
        {breadcrumb.map((b, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span style={{ color: i === breadcrumb.length - 1 ? 'var(--ink-1)' : 'var(--ink-3)' }}>{b}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="sh-right">{right}</div>
    </div>
  );
}

Object.assign(window, { AppHeader, SubHeader });
