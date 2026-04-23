import type { ReactNode } from 'react';
import { useAppStore } from '../../store/app-store.js';
import { NodeDetails } from './NodeDetails.js';
import { EdgeDetails } from './EdgeDetails.js';

const CloseIcon = (): JSX.Element => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export function DetailPanel(): JSX.Element | null {
  const graph = useAppStore((s) => s.graph);
  const selectedNodeEic = useAppStore((s) => s.selectedNodeEic);
  const selectedEdgeId = useAppStore((s) => s.selectedEdgeId);
  const clearNode = useAppStore((s) => s.selectNode);
  const clearEdge = useAppStore((s) => s.selectEdge);

  if (!graph) return null;
  if (!selectedNodeEic && !selectedEdgeId) return null;

  const node = selectedNodeEic
    ? graph.nodes.find((n) => n.eic === selectedNodeEic)
    : undefined;
  const edge = selectedEdgeId
    ? graph.edges.find((e) => e.id === selectedEdgeId)
    : undefined;

  let kicker = '';
  let title: ReactNode = '';
  let body: ReactNode = null;

  if (node !== undefined) {
    kicker = node.kind.replace('_', ' ');
    title = node.displayName;
    body = <NodeDetails node={node} />;
  } else if (edge !== undefined) {
    kicker = edge.kind === 'PEERING' ? 'Peering' : `Flux ${edge.process ?? ''}`.trim();
    title = `${edge.fromEic} → ${edge.toEic}`;
    body = <EdgeDetails edge={edge} />;
  }

  return (
    <aside className="detail-panel" aria-label="Détails de l'élément sélectionné">
      <div className="detail-panel__head">
        <div style={{ minWidth: 0 }}>
          <div className="detail-panel__kicker">{kicker}</div>
          <div
            className="detail-panel__title mono"
            style={{ wordBreak: 'break-all' }}
          >
            {title}
          </div>
        </div>
        <button
          type="button"
          className="icon-btn"
          aria-label="Fermer le panneau de détails"
          onClick={() => (node !== undefined ? clearNode(null) : clearEdge(null))}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="detail-panel__body scroll">{body}</div>
    </aside>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className="detail-section">
      <h3 className="detail-section__title">{title}</h3>
      <div className="detail-section__body">{children}</div>
    </section>
  );
}

export function Kv({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="detail-kv">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}
