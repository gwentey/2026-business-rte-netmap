import { Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

const SAMPLES = 20;

type Props = {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function sampleBezier(
  from: LatLngTuple,
  mid: LatLngTuple,
  to: LatLngTuple,
  count: number,
): LatLngTuple[] {
  const points: LatLngTuple[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const mt = 1 - t;
    const lat = mt * mt * from[0] + 2 * mt * t * mid[0] + t * t * to[0];
    const lng = mt * mt * from[1] + 2 * mt * t * mid[1] + t * t * to[1];
    points.push([lat, lng]);
  }
  return points;
}

export function EdgePath({ edge, nodes, selected, onSelect }: Props): JSX.Element | null {
  const from = nodes.get(edge.fromEic);
  const to = nodes.get(edge.toEic);
  if (!from || !to) return null;

  const mid: LatLngTuple = [
    (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15,
    (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15,
  ];
  const positions = sampleBezier(
    [from.lat, from.lng],
    mid,
    [to.lat, to.lng],
    SAMPLES,
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: colorFor(edge.process),
        weight: selected ? 4 : 2,
        opacity: 0.85,
        dashArray: edge.activity.isRecent ? undefined : '6 6',
      }}
      eventHandlers={{ click: () => onSelect(edge.id) }}
    />
  );
}
