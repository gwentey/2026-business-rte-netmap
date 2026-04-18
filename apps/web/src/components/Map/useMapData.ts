import { useMemo } from 'react';
import type { GraphNode, GraphResponse } from '@carto-ecp/shared';

export function useMapData(graph: GraphResponse | null): {
  nodes: GraphNode[];
  edges: GraphResponse['edges'];
  bounds: GraphResponse['bounds'] | null;
} {
  return useMemo(() => {
    if (!graph) return { nodes: [], edges: [], bounds: null };
    const { rteClusterLat, rteClusterLng, rteClusterOffsetDeg, rteClusterProximityDeg } =
      graph.mapConfig;
    const parisGroup = graph.nodes.filter(
      (n) =>
        Math.abs(n.lat - rteClusterLat) < rteClusterProximityDeg &&
        Math.abs(n.lng - rteClusterLng) < rteClusterProximityDeg,
    );
    const offsetMap = new Map<string, { lat: number; lng: number }>();
    if (parisGroup.length > 1) {
      parisGroup.forEach((node, idx) => {
        const angle = (2 * Math.PI * idx) / parisGroup.length;
        offsetMap.set(node.eic, {
          lat: rteClusterLat + rteClusterOffsetDeg * Math.cos(angle),
          lng: rteClusterLng + rteClusterOffsetDeg * Math.sin(angle),
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
