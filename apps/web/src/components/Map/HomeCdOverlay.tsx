import { Polyline } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';

type Props = {
  nodes: Map<string, GraphNode>;
  visible: boolean;
  selectedNodeEic?: string | null;
};

type Line = {
  from: GraphNode;
  to: GraphNode;
  /** 'global' = overlay toggle, 'focus' = lié au noeud sélectionné */
  style: 'global' | 'focus';
};

/**
 * Overlay visuel endpoint → home Component Directory.
 *
 * Modes :
 *  - global : fine ligne pointillée muted pour chaque endpoint vers son CD.
 *  - focus  : ligne marquée (cyan brand) pour le noeud sélectionné uniquement.
 */
export function HomeCdOverlay({
  nodes,
  visible,
  selectedNodeEic,
}: Props): JSX.Element | null {
  const lines: Line[] = [];

  if (visible) {
    for (const node of nodes.values()) {
      if (node.homeCdCode == null) continue;
      const cd = nodes.get(node.homeCdCode);
      if (cd == null) continue;
      if (cd.eic === node.eic) continue;
      lines.push({ from: node, to: cd, style: 'global' });
    }
  }

  if (selectedNodeEic != null) {
    const selected = nodes.get(selectedNodeEic);
    if (selected != null) {
      if (selected.homeCdCode != null) {
        const cd = nodes.get(selected.homeCdCode);
        if (cd != null && cd.eic !== selected.eic) {
          addFocusLine(lines, selected, cd);
        }
      }
      for (const node of nodes.values()) {
        if (node.homeCdCode === selected.eic && node.eic !== selected.eic) {
          addFocusLine(lines, node, selected);
        }
      }
    }
  }

  if (lines.length === 0) return null;

  return (
    <>
      {lines.map(({ from, to, style }) => (
        <Polyline
          key={`home:${style}:${from.eic}->${to.eic}`}
          positions={[
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]}
          pathOptions={
            style === 'focus'
              ? {
                  color: '#00bded', // cyan brand RTE
                  weight: 2.5,
                  opacity: 0.9,
                  dashArray: '6 4',
                  interactive: false,
                }
              : {
                  color: '#6f8591', // ink-3
                  weight: 1,
                  opacity: 0.5,
                  dashArray: '2 4',
                  interactive: false,
                }
          }
        />
      ))}
    </>
  );
}

function addFocusLine(lines: Line[], from: GraphNode, to: GraphNode): void {
  const globalIdx = lines.findIndex(
    (l) => l.style === 'global' && l.from.eic === from.eic && l.to.eic === to.eic,
  );
  if (globalIdx >= 0) lines.splice(globalIdx, 1);
  lines.push({ from, to, style: 'focus' });
}
