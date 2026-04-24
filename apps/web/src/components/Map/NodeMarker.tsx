import { Marker, Tooltip } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { buildNodeDivIcon, healthStatusFromLastSync, NODE_KIND_LABEL } from './node-icon.js';

type Props = {
  node: GraphNode;
  selected: boolean;
  onSelect: (eic: string) => void;
};

export function NodeMarker({ node, selected, onSelect }: Props): JSX.Element {
  const health = healthStatusFromLastSync(node.lastSync);
  const icon = buildNodeDivIcon(node.kind, node.isDefaultPosition, selected, health);
  return (
    <Marker
      position={[node.lat, node.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(node.eic) }}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
        <div>
          <strong>{node.displayName}</strong>
          <br />
          {node.eic}
          {node.country !== null && node.country !== undefined ? ` — ${node.country}` : ''}
          <br />
          <span style={{ opacity: 0.7 }}>{NODE_KIND_LABEL[node.kind]}</span>
          {node.isDefaultPosition ? (
            <>
              <br />
              <em>⚠ Position par défaut (centre Europe)</em>
            </>
          ) : null}
        </div>
      </Tooltip>
    </Marker>
  );
}
