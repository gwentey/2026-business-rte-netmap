import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';
import { PROCESS_COLORS } from '../lib/process-colors.js';

export function MapPage(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadEnvs = useAppStore((s) => s.loadEnvs);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    void loadEnvs();
  }, [loadEnvs]);

  if (loading && !graph) {
    return <div className="p-8 text-gray-500">Chargement…</div>;
  }

  if (error) {
    return (
      <div className="p-8 text-red-700" role="alert">
        Erreur : {error}
      </div>
    );
  }

  if (!activeEnv || !graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
        <p className="text-center text-gray-700">
          {activeEnv ? (
            <>
              Aucun composant connu pour l'environnement <strong>{activeEnv}</strong>.
            </>
          ) : (
            <>Aucun import dans la base.</>
          )}
        </p>
        <Link
          to={activeEnv ? `/upload?env=${encodeURIComponent(activeEnv)}` : '/upload'}
          className="rounded bg-rte px-4 py-2 text-white hover:bg-red-700"
        >
          Importer un dump
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-rte">Carto ECP</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium">
            env {activeEnv}
          </span>
        </div>
        <Link to="/upload" className="text-sm text-gray-600 hover:text-gray-900">
          + Charger un snapshot
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1">
          <NetworkMap />
        </div>
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
        <span className="ml-auto">
          {graph.nodes.length} nœuds / {graph.edges.length} liens
        </span>
      </footer>
    </div>
  );
}
