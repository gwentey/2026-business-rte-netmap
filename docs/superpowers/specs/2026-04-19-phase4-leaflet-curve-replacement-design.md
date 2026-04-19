# Phase 4 — Remplacement `leaflet-curve` par `<Polyline>` — Design

| Champ              | Valeur                                                     |
|--------------------|------------------------------------------------------------|
| Date               | 2026-04-19                                                 |
| Portée             | P3-8 unique — remplacer `leaflet-curve` + stub types par une solution native react-leaflet |
| Branche cible      | `feat/phase4-leaflet-curve-replacement` depuis `feature/slice-1` |
| Livraison          | 1 PR, 3 commits (spec + plan + refactor)                   |
| Prérequis          | Phase 1 + Phase 2 + Phase 3 mergées                        |

---

## 1. Objectif

Éliminer la dépendance `leaflet-curve@1.0.0` et son stub TypeScript (`declare module 'leaflet-curve';` dans `env.d.ts`), remplacés par un composant React-Leaflet natif utilisant `<Polyline>` avec des points échantillonnés le long d'une courbe de Bézier quadratique.

## 2. Décision

**Approche retenue : `<Polyline>` avec échantillonnage de Bézier quadratique**

- Calculer 20 points le long de la courbe de Bézier quadratique (from, mid, to) — même formule que l'actuel `L.curve(['M', from, 'Q', mid, to])`
- Passer la liste des 20 points à `<Polyline positions={samples} ...>` de `react-leaflet`
- Résultat visuel identique à l'œil nu au niveau de zoom typique de l'application

**Alternatives écartées** :
- `<SVGOverlay>` + path SVG : contrainte de bounds fixe, incompatible avec un rendu qui doit se redraw au pan/zoom
- Subclass `L.Path` personnalisée : utiliserait Leaflet internals, fragile
- `<Polygon>` : pas un polygon fermé, pas sémantique

## 3. Implémentation

### Fichier principal : `apps/web/src/components/Map/EdgePath.tsx`

Avant — composant null utilisant `useEffect` + `L.curve` imperatif :

```tsx
export function EdgePath({ edge, nodes, selected, onSelect }: Props): null {
  const map = useMap();
  const layerRef = useRef<L.Layer | null>(null);
  useEffect(() => {
    // ... L.curve([M, from, Q, mid, to]) ...
  });
  return null;
}
```

Après — composant déclaratif utilisant `<Polyline>` de react-leaflet :

```tsx
import { Polyline } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { GraphEdge, GraphNode } from '@carto-ecp/shared';
import { colorFor } from '../../lib/process-colors.js';

const SAMPLES = 20;

type Props = {
  edge: GraphEdge;
  nodes: Map<string, GraphNode>;
  selected: boolean;
  onSelect: (id: string) => void;
};

function sampleBezier(
  from: LatLngTuple,
  mid: LatLngTuple,
  to: LatLngTuple,
  count: number,
): LatLngTuple[] {
  const points: LatLngTuple[] = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const mt = 1 - t;
    const lat = mt * mt * from[0] + 2 * mt * t * mid[0] + t * t * to[0];
    const lng = mt * mt * from[1] + 2 * mt * t * mid[1] + t * t * to[1];
    points.push([lat, lng]);
  }
  return points;
}

export function EdgePath({ edge, nodes, selected, onSelect }: Props): JSX.Element | null {
  const from = nodes.get(edge.fromEic);
  const to = nodes.get(edge.toEic);
  if (!from || !to) return null;

  const mid: LatLngTuple = [
    (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15,
    (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15,
  ];
  const positions = sampleBezier(
    [from.lat, from.lng],
    mid,
    [to.lat, to.lng],
    SAMPLES,
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: colorFor(edge.process),
        weight: selected ? 4 : 2,
        opacity: 0.85,
        dashArray: edge.activity.isRecent ? undefined : '6 6',
      }}
      eventHandlers={{ click: () => onSelect(edge.id) }}
    />
  );
}
```

### Fichier : `apps/web/src/env.d.ts`

Avant :
```ts
declare module 'leaflet-curve';
```

Après : ligne supprimée.

### Fichier : `apps/web/package.json`

Retirer la dépendance `leaflet-curve`.

Run :
```bash
pnpm --filter @carto-ecp/web remove leaflet-curve
```

## 4. Tests

**E2E existants (Playwright)** :
- `upload-to-map.spec.ts` vérifie que la map se rend après upload
- `select-node.spec.ts` n'implique pas d'edges
- `snapshot-switch.spec.ts` vérifie rendu sur 2 snapshots

Ces smokes ne testent PAS la visualisation des edges (fixtures actuelles ont 0 edge via wildcards). Le refactor passe sans modifier ces tests.

**Test unitaire nouveau** : `apps/web/src/components/Map/EdgePath.test.tsx`

Testing-library + happy-dom ne rendent PAS correctement react-leaflet (qui s'attend à un DOM avec `<MapContainer>` contexte). **Pas de test unitaire de rendu** — à la place, un test unitaire de la fonction pure `sampleBezier` :

```tsx
import { describe, it, expect } from 'vitest';
import { sampleBezier } from './EdgePath';

describe('sampleBezier (EdgePath helper)', () => {
  it('returns count+1 points from start to end inclusive', () => {
    const pts = sampleBezier([0, 0], [0.5, 1], [1, 0], 10);
    expect(pts).toHaveLength(11);
    expect(pts[0]).toEqual([0, 0]);
    expect(pts[10]).toEqual([1, 0]);
  });

  it('midpoint at t=0.5 follows the quadratic bezier formula', () => {
    const pts = sampleBezier([0, 0], [0.5, 1], [1, 0], 2);
    expect(pts[1]![0]).toBeCloseTo(0.5);
    expect(pts[1]![1]).toBeCloseTo(0.5);
  });
});
```

Cela nécessite d'exporter `sampleBezier` depuis `EdgePath.tsx`.

## 5. Critères de succès

1. `pnpm install --frozen-lockfile` exit 0 (lockfile cohérent après remove)
2. `pnpm lint` exit 0
3. `pnpm typecheck` exit 0 (le stub `declare module 'leaflet-curve'` supprimé ne manque nulle part)
4. `pnpm test` exit 0 : +2 nouveaux tests (sampleBezier) → total 110
5. `pnpm test:e2e` : 3/3 Playwright smokes inchangés
6. Vérification manuelle : boot `pnpm dev`, ouvrir la carte avec un snapshot qui aurait des edges (si fixture disponible) — les edges s'affichent en courbes colorées

## 6. Hors scope

- Pas d'ADR dédié : ce refactor documente un choix d'implémentation (Polyline échantillonnée vs lib externe), pas une décision architecturale majeure
- Pas d'optimisation de perf : 20 samples × N edges reste négligeable aux volumes slice #1
- Pas de personnalisation du nombre de samples : 20 codé en dur, suffisant pour les courbes à ce niveau de zoom

## 7. ADR post-implémentation

Pas d'ADR. Le remplacement est une amélioration d'implémentation dans le cadre de la résolution de dette m10. L'ADR RETRO-014 (leaflet-curve sans wrapper React) peut être mis à jour en post-sync pour refléter l'évolution.
