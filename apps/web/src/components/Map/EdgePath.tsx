import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-curve';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

type Props = {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  selected: boolean;
  onSelect: (id: string) => void;
};

export function EdgePath({ edge, nodes, selected, onSelect }: Props): null {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);

  useEffect(() => {
    const from = nodes.get(edge.fromEic);
    const to = nodes.get(edge.toEic);
    if (!from || !to) return;
    const mid: [number, number] = [
      (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15,
      (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15,
    ];
    const curve = (L as unknown as { curve: (path: unknown[], options: L.PathOptions) => L.Path }).curve(
      [
        'M',
        [from.lat, from.lng],
        'Q',
        mid,
        [to.lat, to.lng],
      ],
      {
        color: colorFor(edge.process),
        weight: selected ? 4 : 2,
        opacity: 0.85,
        dashArray: edge.activity.isRecent ? undefined : '6 6',
      },
    );
    curve.on('click', () => onSelect(edge.id));
    curve.addTo(map);
    layerRef.current = curve;
    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [edge, nodes, selected, onSelect, map]);

  return null;
}
