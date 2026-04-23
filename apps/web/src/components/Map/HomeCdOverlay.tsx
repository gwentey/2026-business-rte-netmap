import { Polyline } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';

type Props = {
  nodes: Map<string, GraphNode>;
  visible: boolean;
};

/**
 * Overlay visuel endpoint → home Component Directory.
 * Affiche une fine ligne pointillée grise de chaque endpoint vers le CD auquel
 * il est rattaché (`homeCdCode`), si ce CD est aussi un nœud du graph courant.
 * Volontairement discret pour ne pas concurrencer les edges métier (BUSINESS)
 * et peering (PEERING) : couleur neutre slate-300, dashArray `2 4`, weight 1.
 */
export function HomeCdOverlay({ nodes, visible }: Props): JSX.Element | null {
  if (!visible) return null;

  const lines: Array<{ from: GraphNode; to: GraphNode }> = [];
  for (const node of nodes.values()) {
    if (node.homeCdCode == null) continue;
    const cd = nodes.get(node.homeCdCode);
    if (cd == null) continue;
    if (cd.eic === node.eic) continue; // auto-référence (un CD est son propre home)
    lines.push({ from: node, to: cd });
  }

  if (lines.length === 0) return null;

  return (
    <>
      {lines.map(({ from, to }) => (
        <Polyline
          key={`home:${from.eic}->${to.eic}`}
          positions={[
            [from.lat, from.lng],
            [to.lat, to.lng],
          ]}
          pathOptions={{
            color: '#94a3b8',
            weight: 1,
            opacity: 0.55,
            dashArray: '2 4',
            interactive: false,
          }}
        />
      ))}
    </>
  );
}
