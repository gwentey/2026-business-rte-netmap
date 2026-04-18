import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';
import { SnapshotSelector } from '../components/SnapshotSelector/SnapshotSelector.js';
import { useAppStore } from '../store/app-store.js';
import { PROCESS_COLORS } from '../lib/process-colors.js';

export function MapPage(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);
  const activeId = useAppStore((s) => s.activeSnapshotId);
  const snapshots = useAppStore((s) => s.snapshots);
  const active = snapshots.find((s) => s.id === activeId) ?? null;

  useEffect(() => {
    if (activeId && !graph) {
      void useAppStore.getState().setActiveSnapshot(activeId);
    }
  }, [activeId, graph]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-rte">Carto ECP</span>
          <SnapshotSelector />
          {active ? (
            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
              env {active.envName} — {active.componentType}
            </span>
          ) : null}
        </div>
        <Link to="/upload" className="text-sm text-gray-600 hover:text-gray-900">
          + Charger un snapshot
        </Link>
      </header>

      {error ? <div className="bg-red-100 px-4 py-2 text-sm text-red-700">{error}</div> : null}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">{loading ? <SkeletonMap /> : <NetworkMap />}</div>
        <DetailPanel />
      </div>

      <footer className="flex items-center gap-4 border-t bg-white px-4 py-2 text-xs text-gray-600">
        {Object.entries(PROCESS_COLORS).map(([process, color]) => (
          <span key={process} className="flex items-center gap-1">
            <span
              className="inline-block h-3 w-3 rounded"
              style={{ backgroundColor: color }}
            />
            {process}
          </span>
        ))}
        {graph ? (
          <span className="ml-auto">
            {graph.nodes.length} nœuds / {graph.edges.length} liens
          </span>
        ) : null}
      </footer>
    </div>
  );
}

function SkeletonMap(): JSX.Element {
  return <div className="flex h-full items-center justify-center text-gray-400">Chargement…</div>;
}
