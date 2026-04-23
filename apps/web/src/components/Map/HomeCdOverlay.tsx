import { Polyline } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';

type Props = {
  nodes: Map<string, GraphNode>;
  /** Toggle global : affiche les liens endpoint → home CD pour TOUS les noeuds. */
  visible: boolean;
  /**
   * EIC actuellement sélectionné dans le store (Slice 3a+). Quand non-null,
   * trace systématiquement la ligne vers le home CD **même si `visible=false`**,
   * avec un style marqué (rouge RTE, plus épais). Permet de matérialiser
   * l'enregistrement CD ↔ Endpoint dès que l'utilisateur clique sur un noeud.
   */
  selectedNodeEic?: string | null;
};

type Line = {
  from: GraphNode;
  to: GraphNode;
  /** 'global' = overlay toggle, 'focus' = lie au noeud sélectionné */
  style: 'global' | 'focus';
};

/**
 * Overlay visuel endpoint → home Component Directory.
 *
 * Deux modes cumulatifs :
 *  - Mode global (`visible=true`) : trace une fine ligne pointillée grise pour
 *    chaque endpoint vers son CD. Volontairement discret pour ne pas
 *    concurrencer les edges BUSINESS / PEERING.
 *  - Mode focus (`selectedNodeEic` non null) : trace une ligne plus marquée
 *    (rouge RTE) uniquement pour le noeud sélectionné — endpoint → son CD,
 *    ou CD → tous ses endpoints si c'est un CD qui est sélectionné.
 *    Activé automatiquement à la sélection, indépendamment du toggle global.
 */
export function HomeCdOverlay({
  nodes,
  visible,
  selectedNodeEic,
}: Props): JSX.Element | null {
  const lines: Line[] = [];

  // Mode global : toutes les lignes endpoint → CD
  if (visible) {
    for (const node of nodes.values()) {
      if (node.homeCdCode == null) continue;
      const cd = nodes.get(node.homeCdCode);
      if (cd == null) continue;
      if (cd.eic === node.eic) continue;
      lines.push({ from: node, to: cd, style: 'global' });
    }
  }

  // Mode focus : lignes liées au noeud sélectionné, même si toggle OFF
  if (selectedNodeEic != null) {
    const selected = nodes.get(selectedNodeEic);
    if (selected != null) {
      // Cas 1 : endpoint sélectionné → ligne vers son home CD
      if (selected.homeCdCode != null) {
        const cd = nodes.get(selected.homeCdCode);
        if (cd != null && cd.eic !== selected.eic) {
          addFocusLine(lines, selected, cd);
        }
      }
      // Cas 2 : CD sélectionné → lignes vers tous ses endpoints
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
                  color: '#C8102E', // rouge RTE
                  weight: 2.5,
                  opacity: 0.85,
                  dashArray: '6 4',
                  interactive: false,
                }
              : {
                  color: '#94a3b8',
                  weight: 1,
                  opacity: 0.55,
                  dashArray: '2 4',
                  interactive: false,
                }
          }
        />
      ))}
    </>
  );
}

/**
 * Ajoute une ligne focus en remplaçant la version globale du même couple si
 * elle existe, pour éviter un double trait au même endroit.
 */
function addFocusLine(lines: Line[], from: GraphNode, to: GraphNode): void {
  const globalIdx = lines.findIndex(
    (l) => l.style === 'global' && l.from.eic === from.eic && l.to.eic === to.eic,
  );
  if (globalIdx >= 0) lines.splice(globalIdx, 1);
  lines.push({ from, to, style: 'focus' });
}
