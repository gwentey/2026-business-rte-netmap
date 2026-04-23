import { Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';
import { useAppStore } from '../../store/app-store.js';

const SAMPLES = 20;

/**
 * Épaisseur d'edge dérivée du volume de messages (échelle log).
 */
export function weightFromVolume(totalVolume: number): number {
  if (totalVolume <= 0) return 1;
  const w = 1 + Math.log10(totalVolume + 1);
  return Math.min(6, Math.max(1, w));
}

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
  const processColors = useAppStore((s) => s.graph?.mapConfig.processColors);
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

  const isPeering = edge.kind === 'PEERING';
  const volumeWeight = weightFromVolume(edge.activity.totalVolume);
  const baseWeight = isPeering ? 1.5 : volumeWeight;
  // Peering = teal foncé pour bien se distinguer des flux process colorés.
  const color = isPeering ? '#0f4a5e' : colorFor(edge.process, processColors);
  const dashArray = isPeering
    ? '2 4'
    : edge.activity.isRecent
      ? undefined
      : '6 6';

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color,
        weight: selected ? baseWeight + 2 : baseWeight,
        opacity: isPeering ? 0.7 : 0.85,
        dashArray,
      }}
      eventHandlers={{ click: () => onSelect(edge.id) }}
    />
  );
}
