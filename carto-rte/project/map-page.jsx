/* map-page.jsx — Carto ECP MapPage
 * Leaflet map of Europe with mocked ECP topology (nodes + links by process),
 * timeline slider, detail panel, overlays (HomeCD, BA filter), footer legend.
 */

const MAP_VIEW = { center: [47.5, 4.5], zoom: 5 };

// ── Mock topology ────────────────────────────────────────────────
// Coordinates are real European city locations; shapes are made up.
const MAP_NODES = [
  // RTE home CD — Paris hub
  { id: 'paris-hub',  name: 'PAR-HUB-01',      type: 'cd-hub',  city: 'Paris',   lat: 48.8566, lng: 2.3522,  ba: 'P1', org: '10X1001A1001A' },
  { id: 'lyon',       name: 'LYO-CD-02',      type: 'cd',      city: 'Lyon',    lat: 45.7640, lng: 4.8357,  ba: 'P1', org: '10X1001A1001A' },
  { id: 'marseille',  name: 'MRS-CD-03',      type: 'cd',      city: 'Marseille', lat: 43.2965, lng: 5.3698, ba: 'P1', org: '10X1001A1001A' },
  { id: 'toulouse',   name: 'TLS-ECP-11',     type: 'ecp',     city: 'Toulouse', lat: 43.6047, lng: 1.4442, ba: 'P2', org: '10X1001A1001A' },
  { id: 'bordeaux',   name: 'BRD-ECP-14',     type: 'ecp',     city: 'Bordeaux', lat: 44.8378, lng: -0.5792, ba: 'P2', org: '10X1001A1001A' },
  { id: 'nantes',     name: 'NTE-ECP-19',     type: 'ecp',     city: 'Nantes',   lat: 47.2184, lng: -1.5536, ba: 'P3', org: '10X1001A1001A' },
  { id: 'rennes',     name: 'REN-ECP-22',     type: 'ecp',     city: 'Rennes',   lat: 48.1173, lng: -1.6778, ba: 'P3', org: '10X1001A1001A' },
  { id: 'lille',      name: 'LIL-CD-07',      type: 'cd',      city: 'Lille',    lat: 50.6292, lng: 3.0573,  ba: 'P1', org: '10X1001A1001A' },
  { id: 'strasbourg', name: 'STR-ECP-31',     type: 'ecp',     city: 'Strasbourg', lat: 48.5734, lng: 7.7521, ba: 'P2', org: '10X1001A1001A' },
  { id: 'nice',       name: 'NCE-ECP-35',     type: 'ecp',     city: 'Nice',     lat: 43.7102, lng: 7.2620,  ba: 'P3', org: '10X1001A1001A' },

  // Neighbours
  { id: 'london',     name: 'LDN-XB-01',      type: 'xb',      city: 'London',    lat: 51.5074, lng: -0.1278, ba: 'P2', org: '10X1001A1001B' },
  { id: 'brussels',   name: 'BRU-XB-02',      type: 'xb',      city: 'Brussels',  lat: 50.8503, lng: 4.3517,  ba: 'P1', org: '10X1001A1001C' },
  { id: 'amsterdam',  name: 'AMS-XB-03',      type: 'xb',      city: 'Amsterdam', lat: 52.3676, lng: 4.9041,  ba: 'P2', org: '10X1001A1001D' },
  { id: 'frankfurt',  name: 'FRA-XB-04',      type: 'xb',      city: 'Frankfurt', lat: 50.1109, lng: 8.6821,  ba: 'P1', org: '10X1001A1001E' },
  { id: 'munich',     name: 'MUC-XB-05',      type: 'xb',      city: 'Munich',    lat: 48.1351, lng: 11.5820, ba: 'P2', org: '10X1001A1001E' },
  { id: 'madrid',     name: 'MAD-XB-06',      type: 'xb',      city: 'Madrid',    lat: 40.4168, lng: -3.7038, ba: 'P1', org: '10X1001A1001F' },
  { id: 'barcelona',  name: 'BCN-XB-07',      type: 'xb',      city: 'Barcelona', lat: 41.3851, lng: 2.1734,  ba: 'P2', org: '10X1001A1001F' },
  { id: 'turin',      name: 'TRN-XB-08',      type: 'xb',      city: 'Turin',     lat: 45.0703, lng: 7.6869,  ba: 'P3', org: '10X1001A1001G' },
  { id: 'geneva',     name: 'GEN-XB-09',      type: 'xb',      city: 'Geneva',    lat: 46.2044, lng: 6.1432,  ba: 'P2', org: '10X1001A1001H' },
  { id: 'zurich',     name: 'ZRH-XB-10',      type: 'xb',      city: 'Zurich',    lat: 47.3769, lng: 8.5417,  ba: 'P3', org: '10X1001A1001H' },
];

const MAP_LINKS = [
  // Internal (Paris hub spokes)
  { from: 'paris-hub', to: 'lyon',       proc: 'gofast'    },
  { from: 'paris-hub', to: 'marseille',  proc: 'gofast'    },
  { from: 'paris-hub', to: 'lille',      proc: 'sgt'       },
  { from: 'paris-hub', to: 'nantes',     proc: 'sgt'       },
  { from: 'paris-hub', to: 'rennes',     proc: 'sgt'       },
  { from: 'paris-hub', to: 'strasbourg', proc: 'fenix'     },
  { from: 'paris-hub', to: 'bordeaux',   proc: 'gofast'    },
  { from: 'lyon',      to: 'marseille',  proc: 'emergencia'},
  { from: 'lyon',      to: 'toulouse',   proc: 'paradox'   },
  { from: 'marseille', to: 'nice',       proc: 'emergencia'},
  { from: 'toulouse',  to: 'bordeaux',   proc: 'sgt'       },
  { from: 'nantes',    to: 'rennes',     proc: 'gofast'    },

  // Cross-border
  { from: 'lille',      to: 'brussels',   proc: 'emergencia' },
  { from: 'paris-hub',  to: 'london',     proc: 'emergencia' },
  { from: 'brussels',   to: 'amsterdam',  proc: 'fenix'     },
  { from: 'strasbourg', to: 'frankfurt',  proc: 'emergencia' },
  { from: 'frankfurt',  to: 'munich',     proc: 'paradox'   },
  { from: 'strasbourg', to: 'munich',     proc: 'gofast'    },
  { from: 'lyon',       to: 'geneva',     proc: 'emergencia' },
  { from: 'geneva',     to: 'zurich',     proc: 'paradox'   },
  { from: 'lyon',       to: 'turin',      proc: 'fenix'     },
  { from: 'marseille',  to: 'barcelona',  proc: 'emergencia' },
  { from: 'barcelona',  to: 'madrid',     proc: 'sgt'       },
  { from: 'bordeaux',   to: 'madrid',     proc: 'gofast'    },
  { from: 'turin',      to: 'munich',     proc: 'sgt'       },
];

const PROC_META = {
  gofast:      { label: 'GOFAST',     color: '#00bded' },
  emergencia:  { label: 'EMERGENCIA', color: '#e74c4c' },
  sgt:         { label: 'SGT',        color: '#2fb573' },
  paradox:     { label: 'PARADOX',    color: '#c38cf5' },
  fenix:       { label: 'FENIX',      color: '#e6a23c' },
};

const NODE_META = {
  'cd-hub': { label: 'Home CD', fill: '#00bded', stroke: '#ffffff', ring: true },
  'cd':     { label: 'Control Dispatch', fill: '#00bded', stroke: '#0a1114' },
  'ecp':    { label: 'ECP', fill: '#2fb573', stroke: '#0a1114' },
  'xb':     { label: 'Cross-border', fill: '#c38cf5', stroke: '#0a1114' },
};

// ── Leaflet setup ────────────────────────────────────────────────
function useLeafletMap(containerRef, readyRef) {
  const [map, setMap] = React.useState(null);
  React.useEffect(() => {
    if (!window.L || !containerRef.current || map) return;
    const L = window.L;
    const m = L.map(containerRef.current, {
      center: MAP_VIEW.center,
      zoom:   MAP_VIEW.zoom,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(m);
    // CartoDB Dark Matter — matches our dark UI
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(m);
    setMap(m);
    if (readyRef) readyRef.current = m;
  }, [containerRef, map]);
  return map;
}

// ── Map page ──────────────────────────────────────────────────────
function MapPage({ baFilter = 'ALL', showHierarchy = true, selectedId = 'paris-hub', showOverlays = true }) {
  const mapRef = React.useRef(null);
  const leafletMap = useLeafletMap(mapRef);
  const layersRef = React.useRef({ links: [], nodes: [], homeCd: null });
  const [selected, setSelected] = React.useState(selectedId);
  React.useEffect(() => setSelected(selectedId), [selectedId]);

  // Draw / redraw topology
  React.useEffect(() => {
    const L = window.L;
    const m = leafletMap;
    if (!L || !m) return;

    // Clear previous
    layersRef.current.links.forEach((x) => m.removeLayer(x));
    layersRef.current.nodes.forEach((x) => m.removeLayer(x));
    if (layersRef.current.homeCd) m.removeLayer(layersRef.current.homeCd);
    layersRef.current = { links: [], nodes: [], homeCd: null };

    const nodeById = Object.fromEntries(MAP_NODES.map((n) => [n.id, n]));
    const filt = (n) => baFilter === 'ALL' || n.ba === baFilter;

    // Home CD overlay (circle around Paris hub)
    if (showHierarchy) {
      const hub = nodeById['paris-hub'];
      const circle = L.circle([hub.lat, hub.lng], {
        radius: 320000,
        color: '#00bded',
        weight: 1.5,
        opacity: .6,
        fillColor: '#00bded',
        fillOpacity: .05,
        dashArray: '4 6',
        interactive: false,
      }).addTo(m);
      layersRef.current.homeCd = circle;
    }

    // Draw links
    MAP_LINKS.forEach((link) => {
      const a = nodeById[link.from], b = nodeById[link.to];
      if (!a || !b) return;
      if (!filt(a) || !filt(b)) return;
      const color = PROC_META[link.proc].color;
      const poly = L.polyline(
        [[a.lat, a.lng], [b.lat, b.lng]],
        {
          color,
          weight: 2.2,
          opacity: 0.85,
          lineCap: 'round',
        }
      );
      poly.bindTooltip(`${a.name} → ${b.name} · ${PROC_META[link.proc].label}`, { sticky: true, direction: 'top' });
      poly.on('click', () => setSelected(`${link.from}__${link.to}`));
      poly.addTo(m);
      layersRef.current.links.push(poly);
    });

    // Draw nodes
    MAP_NODES.forEach((n) => {
      if (!filt(n)) return;
      const meta = NODE_META[n.type];
      const isSel = selected === n.id;
      const isHub = n.type === 'cd-hub';
      const r = isHub ? 9 : (n.type === 'cd' ? 7 : 5.5);
      const dot = L.circleMarker([n.lat, n.lng], {
        radius: r,
        color: isSel ? '#ffffff' : meta.stroke,
        weight: isSel ? 2.5 : 1.2,
        fillColor: meta.fill,
        fillOpacity: 1,
      });
      dot.bindTooltip(`<b>${n.name}</b><br>${n.city} · ${n.ba}`, { direction: 'top' });
      dot.on('click', () => setSelected(n.id));
      dot.addTo(m);
      if (isHub) {
        // Outer ring
        const ring = L.circleMarker([n.lat, n.lng], {
          radius: r + 4,
          color: '#00bded',
          weight: 1.2,
          fillOpacity: 0,
          opacity: .7,
          dashArray: '2 3',
        }).addTo(m);
        layersRef.current.nodes.push(ring);
      }
      layersRef.current.nodes.push(dot);
    });
  }, [leafletMap, baFilter, showHierarchy, selected]);

  const selNode  = MAP_NODES.find((n) => n.id === selected);
  const selLink  = !selNode && selected && selected.includes('__') ? (() => {
    const [a, b] = selected.split('__');
    return MAP_LINKS.find((l) => l.from === a && l.to === b);
  })() : null;

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Timeline */}
      <TimelineSlider />

      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div ref={mapRef} style={{ position: 'absolute', inset: 0, background: '#0a1114' }} />

        {/* Overlays top-right */}
        {showOverlays && (
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 500 }}>
            <div className="map-overlay">
              <label className="check">
                <input type="checkbox" defaultChecked={showHierarchy} readOnly />
                <span className="box" />
                Hiérarchie CD
              </label>
            </div>
            <div className="map-overlay">
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: .5, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>
                Filtre BA
              </div>
              <select className="select" defaultValue={baFilter} style={{ width: 180, height: 28 }}>
                <option>Toutes les Business Apps</option>
                <option>P1 — Prod critique</option>
                <option>P2 — Prod standard</option>
                <option>P3 — Non-prod / Dev</option>
              </select>
            </div>
            <div className="map-overlay map-overlay--compact">
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="icon-btn" title="Centrer"><SvgIcon name="locate" /></button>
                <button className="icon-btn" title="Exporter PNG"><SvgIcon name="download" /></button>
                <button className="icon-btn" title="Infos"><SvgIcon name="info" /></button>
              </div>
            </div>
          </div>
        )}

        {/* DetailPanel */}
        {(selNode || selLink) && <DetailPanel node={selNode} link={selLink} onClose={() => setSelected(null)} />}

        {/* Footer legend */}
        <MapLegend nodeCount={MAP_NODES.length} linkCount={MAP_LINKS.length} />
      </div>
    </div>
  );
}

function TimelineSlider() {
  const [val, setVal] = React.useState(68); // percent
  const dates = React.useMemo(() => {
    const arr = [];
    const d = new Date('2025-06-01');
    for (let i = 0; i < 90; i++) {
      const nd = new Date(d);
      nd.setDate(d.getDate() + i);
      arr.push(nd);
    }
    return arr;
  }, []);
  const dateIndex = Math.floor((val / 100) * (dates.length - 1));
  const dateLabel = dates[dateIndex].toISOString().slice(0, 10);
  return (
    <div className="timeline">
      <div className="timeline__left">
        <span className="timeline__icon"><SvgIcon name="clock" /></span>
        <span className="timeline__label">Snapshot</span>
        <span className="mono timeline__date">{dateLabel}</span>
        <span className="mono timeline__time">14:32 UTC</span>
      </div>
      <div className="timeline__track-wrap">
        <div className="timeline__track">
          <div className="timeline__progress" style={{ width: `${val}%` }} />
          <div className="timeline__ticks">
            {Array.from({ length: 13 }).map((_, i) => <span key={i} style={{ left: `${(i / 12) * 100}%` }} />)}
          </div>
          <input
            type="range" min="0" max="100" value={val}
            onChange={(e) => setVal(+e.target.value)}
            className="timeline__range"
          />
          <div className="timeline__thumb" style={{ left: `${val}%` }} />
          <div className="timeline__thumb-label mono" style={{ left: `${val}%` }}>{dateLabel}</div>
        </div>
        <div className="timeline__scale mono">
          <span>01 JUIN</span><span>15 JUIN</span><span>01 JUIL</span><span>15 JUIL</span><span>01 AOÛT</span><span>15 AOÛT</span><span>29 AOÛT</span>
        </div>
      </div>
      <div className="timeline__right">
        <button className="btn btn--ghost btn--sm">
          <span style={{ fontSize: 13, lineHeight: 1, marginTop: -1 }}>⟲</span>
          Retour au présent
        </button>
      </div>
    </div>
  );
}

function DetailPanel({ node, link, onClose }) {
  const isLink = !!link;
  const nodeById = Object.fromEntries(MAP_NODES.map((n) => [n.id, n]));
  const a = link && nodeById[link.from];
  const b = link && nodeById[link.to];

  return (
    <aside className="detail-panel">
      <div className="detail-panel__head">
        <div>
          <div className="detail-panel__kicker">
            {isLink ? 'Lien de processus' : NODE_META[node.type]?.label}
          </div>
          <div className="detail-panel__title mono">
            {isLink ? `${a?.name} → ${b?.name}` : node.name}
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Fermer">
          <SvgIcon name="close" />
        </button>
      </div>

      <div className="detail-panel__body scroll">
        {isLink ? (
          <>
            <DetailSection title="Processus">
              <div className="detail-kv">
                <span>Type</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <span className="swatch" style={{ background: PROC_META[link.proc].color }} />
                  <span className="mono">{PROC_META[link.proc].label}</span>
                </span>
              </div>
              <div className="detail-kv"><span>Direction</span><span>Bidirectionnel</span></div>
              <div className="detail-kv"><span>MTU</span><span className="mono">1500</span></div>
              <div className="detail-kv"><span>Latence</span><span className="mono">12.4 ms</span></div>
            </DetailSection>
            <DetailSection title="Extrémités">
              <div className="detail-endpoint">
                <span className="badge badge--teal">A</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{a?.name}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{a?.city} · {NODE_META[a?.type]?.label}</div>
                </div>
              </div>
              <div className="detail-endpoint">
                <span className="badge badge--teal">B</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ color: 'var(--ink-0)', fontWeight: 600 }}>{b?.name}</div>
                  <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{b?.city} · {NODE_META[b?.type]?.label}</div>
                </div>
              </div>
            </DetailSection>
            <DetailSection title="Historique d'import">
              <div className="detail-log">
                <div><span className="mono">2025-08-29 14:32</span> — snapshot PROD.OPF</div>
                <div><span className="mono">2025-08-28 09:14</span> — surchargé (ADR-039)</div>
                <div><span className="mono">2025-08-20 11:00</span> — snapshot PROD.OPF</div>
              </div>
            </DetailSection>
          </>
        ) : (
          <>
            <DetailSection title="Identité">
              <div className="detail-kv"><span>Nom affiché</span><span className="mono">{node.name}</span></div>
              <div className="detail-kv"><span>Type</span><span>{NODE_META[node.type]?.label}</span></div>
              <div className="detail-kv"><span>Ville</span><span>{node.city}</span></div>
              <div className="detail-kv"><span>Business App</span><span className="badge badge--cyan">{node.ba}</span></div>
              <div className="detail-kv"><span>EIC Org</span><span className="mono">{node.org}</span></div>
            </DetailSection>
            <DetailSection title="Coordonnées">
              <div className="detail-kv"><span>Latitude</span><span className="mono">{node.lat.toFixed(4)}</span></div>
              <div className="detail-kv"><span>Longitude</span><span className="mono">{node.lng.toFixed(4)}</span></div>
            </DetailSection>
            <DetailSection title="Connexions">
              <div className="detail-connections">
                {MAP_LINKS.filter((l) => l.from === node.id || l.to === node.id).map((l, i) => {
                  const otherId = l.from === node.id ? l.to : l.from;
                  const other = MAP_NODES.find((n) => n.id === otherId);
                  return (
                    <div key={i} className="detail-conn-row">
                      <span className="swatch" style={{ background: PROC_META[l.proc].color }} />
                      <span className="mono" style={{ fontSize: 12.5 }}>{other?.name}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>{PROC_META[l.proc].label}</span>
                    </div>
                  );
                })}
              </div>
            </DetailSection>
          </>
        )}
      </div>
      <div className="detail-panel__foot">
        <button className="btn btn--outline btn--sm">Voir dans Composants</button>
        <button className="btn btn--primary btn--sm">Ouvrir l'historique</button>
      </div>
    </aside>
  );
}

function DetailSection({ title, children }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: .6, color: 'var(--ink-3)', textTransform: 'uppercase', margin: '0 0 10px 0' }}>{title}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </section>
  );
}

function MapLegend({ nodeCount, linkCount }) {
  return (
    <footer className="map-legend">
      <div className="map-legend__group">
        <span className="map-legend__title">Processus</span>
        {Object.entries(PROC_META).map(([k, m]) => (
          <span key={k} className="map-legend__item">
            <span className="swatch swatch--line" style={{ background: m.color }} />
            <span>{m.label}</span>
          </span>
        ))}
      </div>
      <div className="map-legend__group">
        <span className="map-legend__title">Nœuds</span>
        <span className="map-legend__item"><span className="swatch" style={{ background: '#00bded', boxShadow: '0 0 0 1.5px #00bded55' }} /> Home CD</span>
        <span className="map-legend__item"><span className="swatch" style={{ background: '#00bded' }} /> CD</span>
        <span className="map-legend__item"><span className="swatch" style={{ background: '#2fb573' }} /> ECP</span>
        <span className="map-legend__item"><span className="swatch" style={{ background: '#c38cf5' }} /> Cross-border</span>
      </div>
      <div className="map-legend__count mono">
        <span><b>{nodeCount}</b> nœuds</span>
        <span style={{ opacity: .4 }}>·</span>
        <span><b>{linkCount}</b> liens</span>
      </div>
    </footer>
  );
}

function SvgIcon({ name, size = 14 }) {
  const paths = {
    close:    'M4 4l8 8M12 4l-8 8',
    clock:    'M8 4v4l2.5 2.5 M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z',
    locate:   'M8 1v2 M8 13v2 M1 8h2 M13 8h2 M8 4a4 4 0 100 8 4 4 0 000-8z M8 7.5a.5.5 0 100 1 .5.5 0 000-1z',
    download: 'M8 2v8 M4 8l4 4 4-4 M3 13.5h10',
    info:     'M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M8 7v4.5 M8 4.5v.01',
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

Object.assign(window, { MapPage, MAP_NODES, MAP_LINKS, PROC_META, NODE_META });
