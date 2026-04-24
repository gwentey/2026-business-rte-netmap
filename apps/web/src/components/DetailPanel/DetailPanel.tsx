import type { ReactNode } from 'react';
import { useAppStore } from '../../store/app-store.js';
import { NodeDetails } from './NodeDetails.js';
import { EdgeDetails } from './EdgeDetails.js';
import { NODE_KIND_LABEL } from '../Map/node-icon.js';

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
    kicker = NODE_KIND_LABEL[node.kind] ?? node.kind;
    title = node.displayName;
    body = <NodeDetails node={node} />;
  } else if (edge !== undefined) {
    kicker = edge.kind === 'PEERING' ? 'Peering CD ↔ CD' : 'Lien de processus';
    title = `${edge.fromEic} → ${edge.toEic}`;
    body = <EdgeDetails edge={edge} />;
  }

  const setActiveTab = useAppStore.getState; // helper

  return (
    <aside className="detail-panel" aria-label="Détails de l'élément sélectionné">
      <div className="detail-panel__head">
        <div style={{ minWidth: 0 }}>
          <div className="detail-panel__kicker">{kicker}</div>
          <h2
            className="detail-panel__title mono"
            style={{ wordBreak: 'break-all', margin: 0 }}
          >
            {title}
          </h2>
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

      <div className="detail-panel__foot">
        <a
          className="btn btn--outline btn--sm"
          href={
            node !== undefined
              ? `/admin?tab=components&eic=${encodeURIComponent(node.eic)}`
              : `/admin?tab=imports`
          }
        >
          {node !== undefined ? 'Voir dans Composants' : 'Voir dans Imports'}
        </a>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={() => {
            void setActiveTab; // hook reserved for history modal — backend endpoint à venir
          }}
        >
          Ouvrir l'historique
        </button>
      </div>
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
