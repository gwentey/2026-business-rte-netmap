import type { GraphEdge, GraphNode } from '@carto-ecp/shared';

/**
 * Filtre les nodes et edges selon les BAs sélectionnées (Slice 3c).
 *
 * Règles :
 *  - Si `selectedBaCodes` est vide, aucun filtre : on retourne tout.
 *  - Sinon, on garde :
 *    (a) les nodes RTE qui portent **au moins une** BA sélectionnée ;
 *    (b) les nodes externes (ou RTE sans BA comme les brokers) qui sont
 *        connectés à un node actif via une edge BUSINESS.
 *  - Les edges dont les deux extrémités sont visibles sont conservées.
 *
 * Retourne `{ nodes, edges }` filtrés, en conservant l'ordre initial.
 */
export function filterGraphByBa(
  nodes: ReadonlyArray<GraphNode>,
  edges: ReadonlyArray<GraphEdge>,
  selectedBaCodes: ReadonlyArray<string>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  if (selectedBaCodes.length === 0) {
    return { nodes: [...nodes], edges: [...edges] };
  }
  const baSet = new Set(selectedBaCodes);

  // Noeuds « ancres » : RTE avec ≥1 BA sélectionnée
  const anchors = new Set<string>();
  for (const n of nodes) {
    if (n.businessApplications.some((ba) => baSet.has(ba.code))) {
      anchors.add(n.eic);
    }
  }

  // Contacts : noeuds connectés à une ancre via une edge BUSINESS
  const contacts = new Set<string>();
  for (const e of edges) {
    if (e.kind !== 'BUSINESS') continue;
    if (anchors.has(e.fromEic)) contacts.add(e.toEic);
    if (anchors.has(e.toEic)) contacts.add(e.fromEic);
  }

  const visibleEics = new Set<string>([...anchors, ...contacts]);
  const filteredNodes = nodes.filter((n) => visibleEics.has(n.eic));
  const filteredEdges = edges.filter(
    (e) => visibleEics.has(e.fromEic) && visibleEics.has(e.toEic),
  );
  return { nodes: filteredNodes, edges: filteredEdges };
}
