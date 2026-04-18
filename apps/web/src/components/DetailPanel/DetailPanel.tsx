import { useAppStore } from '../../store/app-store.js';
import { NodeDetails } from './NodeDetails.js';
import { EdgeDetails } from './EdgeDetails.js';

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
    <aside className="h-full w-[400px] overflow-y-auto border-l bg-white p-4">
      <button
        type="button"
        onClick={() => (node ? clearNode(null) : clearEdge(null))}
        className="mb-3 text-sm text-gray-500 hover:text-gray-900"
      >
        × Fermer
      </button>
      {node ? <NodeDetails node={node} /> : null}
      {edge ? <EdgeDetails edge={edge} /> : null}
    </aside>
  );
}
