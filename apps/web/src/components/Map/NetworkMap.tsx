import { useCallback, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAppStore } from '../../store/app-store.js';
import { useMapData } from './useMapData.js';
import { NodeMarker } from './NodeMarker.js';
import { EdgePath } from './EdgePath.js';
import { HomeCdOverlay } from './HomeCdOverlay.js';

const TILE_URL =
  (import.meta.env.VITE_TILE_URL as string | undefined) ??
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function NetworkMap(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const selectNodeStore = useAppStore((s) => s.selectNode);
  const selectEdgeStore = useAppStore((s) => s.selectEdge);
  const showHomeCdOverlay = useAppStore((s) => s.showHomeCdOverlay);
  const selectedBaCodes = useAppStore((s) => s.selectedBaCodes);

  const selectNode = useCallback(
    (eic: string | null) => selectNodeStore(eic),
    [selectNodeStore],
  );
  const selectEdge = useCallback(
    (id: string | null) => selectEdgeStore(id),
    [selectEdgeStore],
  );

  const { nodes, edges, bounds } = useMapData(graph, selectedBaCodes);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.eic, n])), [nodes]);

  const center: [number, number] = bounds
    ? [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2]
    : [50, 5];

  return (
    <MapContainer
      center={center}
      zoom={4}
      bounds={
        bounds
          ? [
              [bounds.south, bounds.west],
              [bounds.north, bounds.east],
            ]
          : undefined
      }
      zoomControl
      attributionControl={false}
      style={{ height: '100%', width: '100%', background: 'var(--dark-0)' }}
    >
      <TileLayer
        attribution={TILE_ATTRIBUTION}
        url={TILE_URL}
        subdomains="abcd"
        maxZoom={19}
      />
      <HomeCdOverlay
        nodes={nodesById}
        visible={showHomeCdOverlay}
        selectedNodeEic={selectedNodeEic}
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
