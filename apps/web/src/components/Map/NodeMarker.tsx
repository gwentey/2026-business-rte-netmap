import { CircleMarker, Tooltip } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

type Props = {
  node: GraphNode;
  selected: boolean;
  onSelect: (eic: string) => void;
};

const STYLE_BY_KIND: Record<
  GraphNode['kind'],
  { radius: number; fill: string; stroke: string; weight: number }
> = {
  RTE_ENDPOINT: { radius: 10, fill: '#e30613', stroke: '#ffffff', weight: 2 },
  RTE_CD: { radius: 12, fill: '#b91c1c', stroke: '#ffffff', weight: 2 },
  BROKER: { radius: 6, fill: '#111827', stroke: '#ffffff', weight: 1 },
  EXTERNAL_CD: { radius: 9, fill: '#1f2937', stroke: '#ffffff', weight: 1 },
  EXTERNAL_ENDPOINT: { radius: 7, fill: '#6b7280', stroke: '#ffffff', weight: 1 },
};

export function NodeMarker({ node, selected, onSelect }: Props): JSX.Element {
  const style = STYLE_BY_KIND[node.kind];
  const processColor = colorFor(node.process);
  return (
    <CircleMarker
      center={[node.lat, node.lng]}
      radius={selected ? style.radius + 3 : style.radius}
      pathOptions={{
        color: node.kind.startsWith('EXTERNAL') ? processColor : style.stroke,
        weight: style.weight,
        fillColor: style.fill,
        fillOpacity: 0.9,
      }}
      eventHandlers={{ click: () => onSelect(node.eic) }}
    >
      <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
        <div className="text-xs">
          <strong>{node.displayName}</strong>
          <br />
          {node.eic} {node.country ? `— ${node.country}` : ''}
          {node.isDefaultPosition && (
            <>
              <br />
              <em>Position par défaut</em>
            </>
          )}
        </div>
      </Tooltip>
    </CircleMarker>
  );
}
