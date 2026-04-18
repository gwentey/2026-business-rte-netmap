import { useCallback, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAppStore } from '../../store/app-store.js';
import { useMapData } from './useMapData.js';
import { NodeMarker } from './NodeMarker.js';
import { EdgePath } from './EdgePath.js';

export function NetworkMap(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const selectNodeStore = useAppStore((s) => s.selectNode);
  const selectEdgeStore = useAppStore((s) => s.selectEdge);
  const selectNode = useCallback((eic: string | null) => selectNodeStore(eic), [selectNodeStore]);
  const selectEdge = useCallback((id: string | null) => selectEdgeStore(id), [selectEdgeStore]);
  const { nodes, edges, bounds } = useMapData(graph);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.eic, n])), [nodes]);

  const center: [number, number] = bounds
    ? [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2]
    : [50, 5];

  return (
    <MapContainer
      center={center}
      zoom={4}
      bounds={bounds ? [[bounds.south, bounds.west], [bounds.north, bounds.east]] : undefined}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {edges.map((edge) => (
        <EdgePath
          key={edge.id}
          edge={edge}
          nodes={nodesById}
          selected={selectedEdgeId === edge.id}
          onSelect={selectEdge}
        />
      ))}
      {nodes.map((node) => (
        <NodeMarker
          key={node.eic}
          node={node}
          selected={selectedNodeEic === node.eic}
          onSelect={selectNode}
        />
      ))}
    </MapContainer>
  );
}
