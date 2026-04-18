# RETRO-014 — leaflet-curve : approche impérative par useEffect/useRef sans wrapper react-leaflet

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-04-17          |
| Source     | Rétro-ingénierie    |
| Features   | map                 |

## Contexte

`leaflet-curve` est une extension Leaflet qui permet de tracer des courbes de Bézier (quadratiques ou cubiques) sur une carte. Elle n'a pas de wrapper react-leaflet officiel ni de types TypeScript. La bibliothèque expose une fonction `L.curve(path, options)` qui retourne une `L.Path` Leaflet standard.

Pour tracer les arêtes courbées entre les nœuds ECP, il fallait soit trouver un wrapper react-leaflet, soit gérer l'intégration directement.

## Décision identifiée

`EdgePath.tsx` adopte une approche **entièrement impérative** : le composant retourne `null` (pas de JSX) et gère le cycle de vie de la couche Leaflet via `useEffect` + `useRef`. A chaque changement de props pertinentes (`edge`, `nodes`, `selected`, `onSelect`), l'effet supprime l'ancienne couche (`map.removeLayer`) et crée une nouvelle instance `L.curve` qu'il ajoute à la carte (`curve.addTo(map)`). Le `useMap()` hook react-leaflet donne accès à l'instance Leaflet sous-jacente.

Le cast TypeScript `(L as unknown as { curve: (path, options) => L.Path })` contourne l'absence de types. Un stub `declare module 'leaflet-curve'` dans `env.d.ts` empêche les erreurs de compilation sur l'import.

`NodeMarker.tsx`, en revanche, utilise l'approche déclarative react-leaflet standard (`<CircleMarker>`) car react-leaflet supporte nativement les `CircleMarker`.

## Conséquences observées

### Positives
- Fonctionne sans nécessiter de fork ou de wrapper custom de la librairie.
- La logique de nettoyage est explicite et fiable : le `return () => map.removeLayer(...)` dans le `useEffect` garantit qu'aucune couche orpheline ne reste sur la carte lors des re-renders ou du démontage.
- Compatible avec la contrainte d'isolation réseau RTE (pas de nouvelle dépendance npm à approuver).

### Négatives / Dette
- Le cast `as unknown as { curve: ... }` est fragile : si l'API de `leaflet-curve` change, l'erreur sera silencieuse à la compilation et visible seulement au runtime.
- La recréation complète de la couche à chaque changement de props (y compris `selected`) provoque un flash visuel potentiel et sollicite davantage le GC que des mutations in-place.
- L'absence de types officiels impose de maintenir manuellement la signature du stub de cast.
- L'approche hybride (impératif pour `EdgePath`, déclaratif pour `NodeMarker`) complique la compréhension pour un développeur qui ne connaît pas les deux patterns.

## Recommandation

Garder pour slice #1 — la solution fonctionne et la dette est acceptable à ce stade. Reconsidérer si `leaflet-curve` publie des types officiels ou si un wrapper react-leaflet devient disponible. Alternative future : remplacer `leaflet-curve` par une solution basée sur `<SVGOverlay>` react-leaflet avec des `<path>` SVG natifs, ce qui offrirait un contrôle total et l'élimination de la dépendance sans types.

---

## Evolution 2026-04-19 — Remplacement par `<Polyline>` sampled bezier (Phase 4, PR #5)

La recommandation ci-dessus a été appliquée en Phase 4. `leaflet-curve` a été **supprimé** de `apps/web/package.json`. `EdgePath.tsx` a été réécrit de manière entièrement déclarative :

- Le helper `sampleBezier(p0, p1, p2, n)` génère N+1 points `[lat, lng]` le long de la courbe de Bézier quadratique (pure TS, sans DOM ni Leaflet).
- `EdgePath` rend désormais `<Polyline positions={sampleBezier(...)} pathOptions={...} eventHandlers={...} />` — aucun `useEffect`, aucun `useRef`, aucun cast `as unknown`.
- Le stub `declare module 'leaflet-curve'` dans `apps/web/src/env.d.ts` a été supprimé.
- 2 tests Vitest (`EdgePath.test.tsx`) vérifient le count N+1 points et le midpoint de la courbe.

Dette m10 résolue. L'approche hybride impérative/déclarative identifiée par cet ADR n'existe plus : `EdgePath` et `NodeMarker` sont désormais tous deux déclaratifs.
