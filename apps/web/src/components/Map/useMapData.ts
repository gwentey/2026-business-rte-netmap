import { useMemo } from 'react';
import type { GraphNode, GraphResponse } from '@carto-ecp/shared';

const PARIS_LAT = 48.8918;
const PARIS_LNG = 2.2378;
const OFFSET_DEG = 0.6;

export function useMapData(graph: GraphResponse | null): {
  nodes: GraphNode[];
  edges: GraphResponse['edges'];
  bounds: GraphResponse['bounds'] | null;
} {
  return useMemo(() => {
    if (!graph) return { nodes: [], edges: [], bounds: null };
    const parisGroup = graph.nodes.filter(
      (n) => Math.abs(n.lat - PARIS_LAT) < 0.01 && Math.abs(n.lng - PARIS_LNG) < 0.01,
    );
    const offsetMap = new Map<string, { lat: number; lng: number }>();
    if (parisGroup.length > 1) {
      parisGroup.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / parisGroup.length;
        offsetMap.set(node.eic, {
          lat: PARIS_LAT + OFFSET_DEG * Math.cos(angle),
          lng: PARIS_LNG + OFFSET_DEG * Math.sin(angle),
        });
      });
    }
    const nodes = graph.nodes.map((n) => {
      const off = offsetMap.get(n.eic);
      return off ? { ...n, lat: off.lat, lng: off.lng } : n;
    });
    return { nodes, edges: graph.edges, bounds: graph.bounds };
  }, [graph]);
}
