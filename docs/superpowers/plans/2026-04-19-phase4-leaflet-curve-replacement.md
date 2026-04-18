# Phase 4 — Remplacement `leaflet-curve` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Remplacer la dépendance `leaflet-curve` + son stub TypeScript par un composant react-leaflet natif (`<Polyline>` avec échantillonnage de Bézier quadratique).

**Architecture:** Composant fonctionnel déclaratif remplace l'usage impératif de `L.curve()`. Helper pur `sampleBezier()` testé unitairement. Dépendance `leaflet-curve` retirée, stub `env.d.ts` supprimé.

**Tech Stack:** React 18, react-leaflet 4.2, Leaflet 1.9, Vitest 2.1, TypeScript 5.5.

**Spec :** `docs/superpowers/specs/2026-04-19-phase4-leaflet-curve-replacement-design.md`

---

## Task 0 : Branche

- [ ] Vérifier qu'on est sur `feat/phase4-leaflet-curve-replacement` (déjà créée).

## Task 1 : Remplacer `EdgePath.tsx` par la version Polyline

**Files :** Modify : `apps/web/src/components/Map/EdgePath.tsx`

- [ ] **Step 1 : Écrire le nouveau contenu complet**

Remplacer TOUT le contenu de `apps/web/src/components/Map/EdgePath.tsx` par :

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

export function sampleBezier(
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

- [ ] **Step 2 : Typecheck**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
```

Expected : exit 0. Si `Polyline` est utilisé depuis `react-leaflet` et l'import OK, typecheck passe.

## Task 2 : Supprimer le stub `env.d.ts` et la dépendance

**Files :**
- Modify : `apps/web/src/env.d.ts`
- Modify : `apps/web/package.json`, `pnpm-lock.yaml`

- [ ] **Step 1 : Retirer le stub leaflet-curve**

Dans `apps/web/src/env.d.ts`, supprimer la ligne :
```ts
declare module 'leaflet-curve';
```

- [ ] **Step 2 : Retirer la dépendance npm**

Run :
```bash
pnpm --filter @carto-ecp/web remove leaflet-curve
```

Expected : `apps/web/package.json` ne contient plus `leaflet-curve`, lockfile mis à jour.

- [ ] **Step 3 : Vérifier typecheck**

Run :
```bash
pnpm --filter @carto-ecp/web typecheck
```

Expected : exit 0 — aucune référence orpheline à `leaflet-curve`.

## Task 3 : Ajouter les tests unitaires `sampleBezier`

**Files :** Create : `apps/web/src/components/Map/EdgePath.test.tsx`

- [ ] **Step 1 : Créer le test**

Contenu :
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
    // At t=0.5, mid-sampled point = 0.25*from + 0.5*mid + 0.25*to
    // lat = 0.25*0 + 0.5*0.5 + 0.25*1 = 0.5
    // lng = 0.25*0 + 0.5*1 + 0.25*0 = 0.5
    expect(pts[1]![0]).toBeCloseTo(0.5);
    expect(pts[1]![1]).toBeCloseTo(0.5);
  });
});
```

- [ ] **Step 2 : Run tests**

Run :
```bash
pnpm --filter @carto-ecp/web test -- EdgePath
```

Expected : **2 tests passent**.

## Task 4 : Vérif globale + commit + PR

- [ ] **Step 1 : Chaîne qualité racine**

Run :
```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
```

Expected : exit 0 pour tous. Total tests : 108 + 2 = 110.

- [ ] **Step 2 : Playwright smokes**

Run :
```bash
pnpm --filter @carto-ecp/web test:e2e
```

Expected : 3/3 passent.

- [ ] **Step 3 : Commit refactor**

Run :
```bash
git add apps/web/src/components/Map/EdgePath.tsx apps/web/src/components/Map/EdgePath.test.tsx apps/web/src/env.d.ts apps/web/package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
refactor(web/map): remplacer leaflet-curve par <Polyline> échantillonnée (P3-8)

- EdgePath devient un composant React déclaratif utilisant <Polyline> de
  react-leaflet au lieu de L.curve() imperatif
- Helper pur sampleBezier() produit 20 points le long de la Bézier
  quadratique (from, mid, to), testé unitairement
- Dépendance leaflet-curve supprimée de apps/web/package.json
- Stub "declare module 'leaflet-curve'" supprimé de env.d.ts
- 2 nouveaux tests unitaires (count+1 points, midpoint formula)
- Comportement visuel inchangé : courbes colorées + dashArray + click handler

Refs: plan-remediation P3-8, dette m10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4 : Push**

Run :
```bash
git push -u origin feat/phase4-leaflet-curve-replacement
```

- [ ] **Step 5 : Ouvrir PR**

Run :
```bash
gh pr create --base feature/slice-1 --head feat/phase4-leaflet-curve-replacement --title "Phase 4 : remplacement leaflet-curve par Polyline (P3-8)" --body "$(cat <<'EOF'
## Summary

Remplace la dépendance \`leaflet-curve@1.0.0\` + son stub TypeScript par un composant react-leaflet natif utilisant \`<Polyline>\` avec échantillonnage de Bézier quadratique (20 points).

- Dette m10 résolue (leaflet-curve sans types TS, cast \`as unknown as\` fragile)
- Helper pur \`sampleBezier\` testé unitairement
- Comportement visuel et interactif identique

Spec : \`docs/superpowers/specs/2026-04-19-phase4-leaflet-curve-replacement-design.md\`
Plan : \`docs/superpowers/plans/2026-04-19-phase4-leaflet-curve-replacement.md\`

## Test plan

- [x] typecheck / lint / test (110/110) / Playwright (3/3)
- [x] \`leaflet-curve\` retiré de package.json + lockfile
- [x] stub env.d.ts retiré

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected : URL de PR imprimée.
