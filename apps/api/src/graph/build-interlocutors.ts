import type { GraphEdge, GraphNodeInterlocutor } from '@carto-ecp/shared';

type Accum = {
  messageTypes: Set<string>;
  hasAsSender: boolean;
  hasAsReceiver: boolean;
};

const directionRank: Record<GraphNodeInterlocutor['direction'], number> = {
  BIDI: 0,
  OUT: 1,
  IN: 2,
};

/**
 * Calcule les interlocuteurs de chaque noeud a partir des edges BUSINESS
 * agregees. Les edges PEERING (CD-CD) sont exclues — elles relevent du
 * peering administratif, pas d'un flux metier.
 *
 * Vu depuis un noeud X :
 *  - X est fromEic d'une edge -> X emet vers l'autre (OUT)
 *  - X est toEic d'une edge -> X recoit de l'autre (IN)
 *  - les deux -> BIDI
 *
 * Tri des interlocuteurs par (1) direction BIDI > OUT > IN, (2) nombre de
 * messageTypes decroissant, (3) EIC croissant.
 */
export function buildInterlocutorsByEic(
  edges: ReadonlyArray<GraphEdge>,
): Map<string, GraphNodeInterlocutor[]> {
  const byNode = new Map<string, Map<string, Accum>>();

  const ensure = (nodeEic: string, otherEic: string): Accum => {
    let inner = byNode.get(nodeEic);
    if (!inner) {
      inner = new Map();
      byNode.set(nodeEic, inner);
    }
    let a = inner.get(otherEic);
    if (!a) {
      a = { messageTypes: new Set(), hasAsSender: false, hasAsReceiver: false };
      inner.set(otherEic, a);
    }
    return a;
  };

  for (const e of edges) {
    if (e.kind !== 'BUSINESS') continue;
    if (e.fromEic === e.toEic) continue; // self-edge protection

    const fromAccum = ensure(e.fromEic, e.toEic);
    fromAccum.hasAsSender = true;
    for (const mt of e.messageTypes) fromAccum.messageTypes.add(mt);

    const toAccum = ensure(e.toEic, e.fromEic);
    toAccum.hasAsReceiver = true;
    for (const mt of e.messageTypes) toAccum.messageTypes.add(mt);
  }

  const out = new Map<string, GraphNodeInterlocutor[]>();
  for (const [nodeEic, innerMap] of byNode) {
    const list: GraphNodeInterlocutor[] = [];
    for (const [otherEic, a] of innerMap) {
      const direction: GraphNodeInterlocutor['direction'] =
        a.hasAsSender && a.hasAsReceiver
          ? 'BIDI'
          : a.hasAsSender
            ? 'OUT'
            : 'IN';
      list.push({
        eic: otherEic,
        messageTypes: Array.from(a.messageTypes).sort(),
        direction,
      });
    }
    list.sort((x, y) => {
      const dx = directionRank[x.direction] - directionRank[y.direction];
      if (dx !== 0) return dx;
      const mx = y.messageTypes.length - x.messageTypes.length;
      if (mx !== 0) return mx;
      return x.eic < y.eic ? -1 : x.eic > y.eic ? 1 : 0;
    });
    out.set(nodeEic, list);
  }
  return out;
}
