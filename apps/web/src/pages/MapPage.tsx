import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';
import { TimelineSlider } from '../components/TimelineSlider/TimelineSlider.js';
import { PROCESS_COLORS } from '../lib/process-colors.js';
import styles from './MapPage.module.scss';

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
    return <div className={styles.loading}>Chargement…</div>;
  }

  if (error) {
    return (
      <div className={styles.error} role="alert">
        Erreur : {error}
      </div>
    );
  }

  if (!activeEnv || !graph || graph.nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>
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
          className={styles.emptyButton}
        >
          Importer un dump
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.brand}>Carto ECP</span>
          <span className={styles.envBadge}>env {activeEnv}</span>
        </div>
        <Link to="/upload" className={styles.snapshotLink}>
          + Charger un snapshot
        </Link>
      </header>

      <TimelineSlider />

      <div className={styles.body}>
        <div className={styles.mapContainer}>
          <NetworkMap />
        </div>
        <DetailPanel />
      </div>

      <footer className={styles.footer}>
        {Object.entries(graph.mapConfig.processColors ?? PROCESS_COLORS).map(([process, color]) => (
          <span key={process} className={styles.legendItem}>
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: color }}
            />
            {process}
          </span>
        ))}
        <span className={styles.counter}>
          {graph.nodes.length} nœuds / {graph.edges.length} liens
        </span>
      </footer>
    </div>
  );
}
