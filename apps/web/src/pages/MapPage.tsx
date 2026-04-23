import { useAppStore } from '../store/app-store.js';
import { SubHeader } from '../components/SubHeader/SubHeader.js';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';
import { TimelineSlider } from '../components/TimelineSlider/TimelineSlider.js';
import { MapOverlaysTopRight } from '../components/Map/MapOverlaysTopRight.js';
import { MapLegend } from '../components/Map/MapLegend.js';
import {
  MapEmptyState,
  MapErrorState,
  MapLoadingState,
} from '../components/Map/MapStates.js';
import { PROCESS_COLORS } from '../lib/process-colors.js';

const RefreshIcon = (): JSX.Element => (
  <span style={{ fontSize: 13, marginTop: -1 }}>⟲</span>
);

export function MapPage(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const refDate = useAppStore((s) => s.refDate);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);

  const subHeader = (
    <SubHeader
      breadcrumb={['Cartographie', activeEnv ?? '—', 'Snapshot actuel']}
      right={
        <>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              if (activeEnv !== null) {
                void loadGraph(activeEnv, refDate ?? undefined);
              }
            }}
            disabled={activeEnv === null}
          >
            <RefreshIcon />
            Rafraîchir
          </button>
          <a className="btn btn--primary btn--sm" href="/upload">
            + Charger un snapshot
          </a>
        </>
      }
    />
  );

  if (loading && !graph) {
    return (
      <>
        {subHeader}
        <div className="map-shell">
          <div className="map-canvas-wrap">
            <MapLoadingState />
          </div>
        </div>
      </>
    );
  }

  if (error !== null) {
    return (
      <>
        {subHeader}
        <div className="map-shell">
          <div className="map-canvas-wrap">
            <MapErrorState
              message={error}
              onRetry={() => {
                if (activeEnv !== null) {
                  void loadGraph(activeEnv, refDate ?? undefined);
                }
              }}
            />
          </div>
        </div>
      </>
    );
  }

  if (!activeEnv || !graph || graph.nodes.length === 0) {
    return (
      <>
        {subHeader}
        <div className="map-shell">
          <div className="map-canvas-wrap">
            <MapEmptyState envName={activeEnv} />
          </div>
        </div>
      </>
    );
  }

  const isDetailOpen = selectedNodeEic !== null || selectedEdgeId !== null;
  const processColors = graph.mapConfig.processColors ?? PROCESS_COLORS;

  return (
    <>
      {subHeader}
      <div className="map-shell">
        <TimelineSlider />
        <div className="map-canvas-wrap">
          <div className="map-canvas">
            <NetworkMap />
          </div>
          <MapOverlaysTopRight graph={graph} />
          <DetailPanel />
          <MapLegend
            nodeCount={graph.nodes.length}
            edgeCount={graph.edges.length}
            processColors={processColors}
            fullWidth={!isDetailOpen}
          />
        </div>
      </div>
    </>
  );
}
