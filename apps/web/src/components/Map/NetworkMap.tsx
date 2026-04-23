import { useCallback, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAppStore } from '../../store/app-store.js';
import { useMapData } from './useMapData.js';
import { NodeMarker } from './NodeMarker.js';
import { EdgePath } from './EdgePath.js';
import { HomeCdOverlay } from './HomeCdOverlay.js';

export function NetworkMap(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const selectNodeStore = useAppStore((s) => s.selectNode);
  const selectEdgeStore = useAppStore((s) => s.selectEdge);
  const showHomeCdOverlay = useAppStore((s) => s.showHomeCdOverlay);
  const toggleHomeCdOverlay = useAppStore((s) => s.toggleHomeCdOverlay);
  const selectNode = useCallback((eic: string | null) => selectNodeStore(eic), [selectNodeStore]);
  const selectEdge = useCallback((id: string | null) => selectEdgeStore(id), [selectEdgeStore]);
  const { nodes, edges, bounds } = useMapData(graph);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.eic, n])), [nodes]);

  const center: [number, number] = bounds
    ? [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2]
    : [50, 5];

  return (
    <div className="relative h-full w-full">
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
        <HomeCdOverlay nodes={nodesById} visible={showHomeCdOverlay} />
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
      <button
        type="button"
        onClick={toggleHomeCdOverlay}
        aria-pressed={showHomeCdOverlay}
        className={`absolute right-3 top-3 z-[1000] rounded border px-3 py-1.5 text-xs font-medium shadow-sm ${
          showHomeCdOverlay
            ? 'border-slate-500 bg-slate-800 text-white'
            : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
        }`}
        title="Afficher les liens endpoint → home CD"
      >
        {showHomeCdOverlay ? '✓ Hiérarchie CD' : 'Hiérarchie CD'}
      </button>
    </div>
  );
}
