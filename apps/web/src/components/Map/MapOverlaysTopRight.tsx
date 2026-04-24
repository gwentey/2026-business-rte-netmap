import type { GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store.js';

interface Props {
  graph: GraphResponse | null;
}

const SvgIcon = ({ d, size = 14 }: { d: string; size?: number }): JSX.Element => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d={d} />
  </svg>
);

const ICONS = {
  locate: 'M8 1v2 M8 13v2 M1 8h2 M13 8h2 M8 4a4 4 0 100 8 4 4 0 000-8z M8 7.5a.5.5 0 100 1 .5.5 0 000-1z',
  download: 'M8 2v8 M4 8l4 4 4-4 M3 13.5h10',
  info: 'M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z M8 7v4.5 M8 4.5v.01',
};

/**
 * Bandeau d'overlays en haut à droite de la carte (ADR-040).
 * Trois cartes : toggle hiérarchie CD, filtre BA, raccourcis (centrer/export/info).
 */
export function MapOverlaysTopRight(_: Props): JSX.Element {
  const showHomeCdOverlay = useAppStore((s) => s.showHomeCdOverlay);
  const toggleHomeCdOverlay = useAppStore((s) => s.toggleHomeCdOverlay);

  return (
    <div className="map-overlays-tr">
      <div className="map-overlay">
        <label className="check">
          <input
            type="checkbox"
            checked={showHomeCdOverlay}
            onChange={toggleHomeCdOverlay}
            aria-label="Afficher la hiérarchie CD"
          />
          <span className="box" />
          Hiérarchie CD
        </label>
      </div>

      <div className="map-overlay map-overlay--compact">
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="icon-btn" title="Recentrer">
            <SvgIcon d={ICONS.locate} />
          </button>
          <button type="button" className="icon-btn" title="Exporter PNG">
            <SvgIcon d={ICONS.download} />
          </button>
          <button type="button" className="icon-btn" title="Informations">
            <SvgIcon d={ICONS.info} />
          </button>
        </div>
      </div>
    </div>
  );
}
