import type { ProcessColorMap } from '@carto-ecp/shared';
import { PROCESS_COLORS } from '../../lib/process-colors.js';
import { NODE_KIND_COLOR, NODE_KIND_LABEL } from './node-icon.js';

interface Props {
  nodeCount: number;
  edgeCount: number;
  processColors?: ProcessColorMap;
  fullWidth?: boolean;
}

const KIND_ORDER: Array<keyof typeof NODE_KIND_LABEL> = [
  'RTE_CD',
  'RTE_ENDPOINT',
  'EXTERNAL_CD',
  'EXTERNAL_ENDPOINT',
  'BROKER',
];

/**
 * MapLegend — bandeau footer absolute (ADR-040). Liste les couleurs process
 * actives + la classification des nœuds + le compteur global.
 */
export function MapLegend({
  nodeCount,
  edgeCount,
  processColors = PROCESS_COLORS,
  fullWidth = false,
}: Props): JSX.Element {
  return (
    <footer className={fullWidth ? 'map-legend map-legend--full' : 'map-legend'}>
      <div className="map-legend__group">
        <span className="map-legend__title">Processus</span>
        {Object.entries(processColors).map(([process, color]) => (
          <span key={process} className="map-legend__item">
            <span className="swatch swatch--line" style={{ background: color }} />
            <span className="mono" style={{ fontSize: 11 }}>
              {process}
            </span>
          </span>
        ))}
      </div>
      <div className="map-legend__group">
        <span className="map-legend__title">Nœuds</span>
        {KIND_ORDER.map((kind) => (
          <span key={kind} className="map-legend__item">
            <span className="swatch" style={{ background: NODE_KIND_COLOR[kind] }} />
            {NODE_KIND_LABEL[kind]}
          </span>
        ))}
      </div>
      <div className="map-legend__count mono">
        <span>
          <b>{nodeCount}</b> nœuds
        </span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>
          <b>{edgeCount}</b> liens
        </span>
      </div>
    </footer>
  );
}
