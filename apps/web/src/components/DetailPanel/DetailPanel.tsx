import { useAppStore } from '../../store/app-store.js';
import { NodeDetails } from './NodeDetails.js';
import { EdgeDetails } from './EdgeDetails.js';
import styles from './DetailPanel.module.scss';

export function DetailPanel(): JSX.Element | null {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const clearNode = useAppStore((s) => s.selectNode);
  const clearEdge = useAppStore((s) => s.selectEdge);

  if (!graph) return null;
  if (!selectedNodeEic && !selectedEdgeId) return null;

  const node = selectedNodeEic ? graph.nodes.find((n) => n.eic === selectedNodeEic) : undefined;
  const edge = selectedEdgeId ? graph.edges.find((e) => e.id === selectedEdgeId) : undefined;

  return (
    <aside className={styles.panel}>
      <button
        type="button"
        onClick={() => (node ? clearNode(null) : clearEdge(null))}
        className={styles.closeButton}
      >
        × Fermer
      </button>
      {node ? <NodeDetails node={node} /> : null}
      {edge ? <EdgeDetails edge={edge} /> : null}
    </aside>
  );
}
