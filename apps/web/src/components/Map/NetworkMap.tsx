import { useCallback, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import { useAppStore } from '../../store/app-store.js';
import { useMapData } from './useMapData.js';
import { NodeMarker } from './NodeMarker.js';
import { EdgePath } from './EdgePath.js';
import { HomeCdOverlay } from './HomeCdOverlay.js';
import { BaFilter } from './BaFilter.js';
import styles from './NetworkMap.module.scss';

export function NetworkMap(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const selectNodeStore = useAppStore((s) => s.selectNode);
  const selectEdgeStore = useAppStore((s) => s.selectEdge);
  const showHomeCdOverlay = useAppStore((s) => s.showHomeCdOverlay);
  const toggleHomeCdOverlay = useAppStore((s) => s.toggleHomeCdOverlay);
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

  const toggleClass = showHomeCdOverlay
    ? `${styles.toggle} ${styles.toggleActive}`
    : styles.toggle;

  return (
    <div className={styles.container}>
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
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
      <button
        type="button"
        onClick={toggleHomeCdOverlay}
        aria-pressed={showHomeCdOverlay}
        className={toggleClass}
        title="Afficher les liens endpoint → home CD"
      >
        {showHomeCdOverlay ? '✓ Hiérarchie CD' : 'Hiérarchie CD'}
      </button>
      <BaFilter graph={graph} />
    </div>
  );
}
