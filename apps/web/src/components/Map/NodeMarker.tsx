import { Marker, Tooltip } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { buildNodeDivIcon, healthStatusFromLastSync } from './node-icon.js';

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
        <div className="text-xs">
          <strong>{node.displayName}</strong>
          <br />
          {node.eic} {node.country ? `— ${node.country}` : ''}
          {node.isDefaultPosition ? (
            <>
              <br />
              <em>⚠ Position par défaut (centre Europe) — coordonnées non renseignées</em>
            </>
          ) : null}
        </div>
      </Tooltip>
    </Marker>
  );
}
