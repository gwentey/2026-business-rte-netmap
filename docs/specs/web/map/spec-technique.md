# Spec Technique — web/map

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/map             |
| Version       | 0.1.1               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 1 remédiation |

---

## Architecture du module

Le module `web/map` est composé de cinq unités distinctes organisées selon une hiérarchie claire :

```
MapPage (pages/MapPage.tsx)
├── Header : SnapshotSelector + badge env/componentType + lien upload
├── NetworkMap (components/Map/NetworkMap.tsx)
│   ├── useMapData (components/Map/useMapData.ts)   ← hook de transformation
│   ├── EdgePath[] (components/Map/EdgePath.tsx)    ← arêtes Bézier
│   └── NodeMarker[] (components/Map/NodeMarker.tsx) ← marqueurs CircleMarker
├── DetailPanel (composant externe — feature web/detail-panel)
└── Footer : légende PROCESS_COLORS + compteurs nodes/edges
```

**Flux de données** :

1. `useAppStore` fournit le `GraphResponse` brut (nodes, edges, bounds) chargé depuis `GET /api/snapshots/:id/graph`.
2. `useMapData` transforme ce graphe : détection du groupe de coordonnées Paris, application des offsets radiaux sur les nœuds superposés.
3. `NetworkMap` reçoit les nodes/edges transformés et rend un `MapContainer` Leaflet avec `TileLayer` OSM.
4. Pour chaque edge, `EdgePath` crée une couche Leaflet native via `L.curve` (impérative via `useEffect`/`useRef`).
5. Pour chaque node, `NodeMarker` rend un `<CircleMarker>` react-leaflet déclaratif.
6. Les sélections (click nœud / click arête) transitent par le store Zustand, qui met à jour `selectedNodeEic` / `selectedEdgeId` et provoque le rendu du `DetailPanel`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/src/pages/MapPage.tsx` | Page racine : layout flex h-screen, header, footer légende, orchestration loading/error | ~70 |
| `apps/web/src/components/Map/NetworkMap.tsx` | Conteneur Leaflet, itération nodes/edges, gestion bounds/center | ~53 |
| `apps/web/src/components/Map/NodeMarker.tsx` | Marqueur CircleMarker stylé par kind, tooltip, handler click | ~52 |
| `apps/web/src/components/Map/EdgePath.tsx` | Arête Bézier quadratique via L.curve, dashArray si inactif, handler click | ~54 |
| `apps/web/src/components/Map/useMapData.ts` | Hook de détection/offset radial du groupe Paris-La-Défense | ~35 |
| `apps/web/src/lib/process-colors.ts` | Palette `PROCESS_COLORS` (8 entrées) + helper `colorFor()` | ~18 |
| `packages/shared/src/graph.ts` | Types `GraphNode`, `GraphEdge`, `GraphResponse`, `GraphBounds`, `NodeKind` | ~59 |
| `packages/shared/src/registry.ts` | Types `ProcessKey`, `PROCESS_KEYS`, `ProcessColorMap` | ~15 |

---

## Schéma BDD (si applicable)

Ce module est purement frontend. Il consomme les données via l'API REST ; il ne lit pas directement la base SQLite. Les tables pertinentes côté backend sont `Component`, `MessagePath` et `MessagingStatistic` (agrégées par `GraphService.buildGraph` avant exposition).

---

## API / Endpoints (si applicable)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/snapshots/:id/graph` | Retourne `GraphResponse` (nodes, edges, bounds) pour le snapshot actif | Aucune (slice #1) |
| GET | `/api/snapshots` | Liste des snapshots disponibles (pour `SnapshotSelector`) | Aucune (slice #1) |

---

## Patterns identifiés

- **Approche hybride déclarative/impérative Leaflet** : `NodeMarker` utilise les composants déclaratifs react-leaflet (`CircleMarker`), tandis que `EdgePath` adopte une approche impérative pure (`useEffect` + `useRef` + `curve.addTo(map)` / `map.removeLayer`) car `leaflet-curve` n'a pas de wrapper react-leaflet.

- **Hook de transformation (useMapData)** : séparation nette entre la logique de transformation spatiale (offset radial) et le composant de rendu (`NetworkMap`). Le hook retourne des données dérivées mémoïsées via `useMemo`.

- **Map EIC pour lookup O(1)** : dans `NetworkMap`, les nœuds sont indexés dans une `Map<string, GraphNode>` (par EIC) via `useMemo` pour permettre un accès rapide depuis `EdgePath` lors du calcul des coordonnées d'extrémité.

- **Type casting unsafe pour lib sans types** : `leaflet-curve` est importé sans types. L'accès à `L.curve` se fait via `(L as unknown as { curve: ... })`. Un stub `declare module 'leaflet-curve'` est présent dans `apps/web/src/env.d.ts`.

- **Stabilisation des callbacks Zustand** : les actions `selectNode` et `selectEdge` extraites du store sont wrappées dans des `useCallback` dans `NetworkMap` pour éviter des re-renders inutiles sur `NodeMarker` et `EdgePath`.

- **Réactivité store Zustand** : `MapPage` souscrit sélectivement aux slices du store (`graph`, `loading`, `error`, `activeSnapshotId`, `snapshots`) pour minimiser les re-renders.

---

## Constantes notables

| Constante | Valeur | Fichier | Rôle |
|-----------|--------|---------|------|
| `PARIS_LAT` | `48.8918` | `useMapData.ts` | Latitude de référence du groupe RTE (La Défense) |
| `PARIS_LNG` | `2.2378` | `useMapData.ts` | Longitude de référence du groupe RTE (La Défense) |
| `OFFSET_DEG` | `0.6` | `useMapData.ts` | Rayon du cercle de dispersion radiale en degrés (~66 km) |
| Seuil de proximité | `0.01°` | `useMapData.ts` | Distance maximale pour appartenir au groupe Paris |
| Zoom initial | `4` | `NetworkMap.tsx` | Zoom Leaflet à l'ouverture (vue Europe) |
| Centre fallback | `[50, 5]` | `NetworkMap.tsx` | Centre carte si pas de bounds (Europe centrale) |
| Bezier offset | `0.15` | `EdgePath.tsx` | Facteur de déflexion du point de contrôle quadratique |
| dashArray inactif | `"6 6"` | `EdgePath.tsx` | Tirets Leaflet pour arêtes non récentes |
| Rayon sélection | `+3 px` | `NodeMarker.tsx` | Augmentation du rayon d'un nœud sélectionné |
| Épaisseur sélection | `4 px` | `EdgePath.tsx` | Épaisseur d'une arête sélectionnée |

---

## Styles visuels des nœuds (STYLE_BY_KIND)

| Kind | Rayon | Fill | Stroke | Weight |
|------|-------|------|--------|--------|
| `RTE_ENDPOINT` | 10 px | `#e30613` | `#ffffff` | 2 |
| `RTE_CD` | 12 px | `#b91c1c` | `#ffffff` | 2 |
| `BROKER` | 6 px | `#111827` | `#ffffff` | 1 |
| `EXTERNAL_CD` | 9 px | `#1f2937` | couleur process | 1 |
| `EXTERNAL_ENDPOINT` | 7 px | `#6b7280` | couleur process | 1 |

Note : pour les kinds `EXTERNAL_*`, le stroke utilise `colorFor(node.process)` au lieu de `style.stroke`. Le fill reste fixe.

---

## Palette processColors (PROCESS_COLORS)

| Process | Hex | Usage |
|---------|-----|-------|
| `TP` | `#3b82f6` | Bleu |
| `UK-CC-IN` | `#f97316` | Orange |
| `CORE` | `#a855f7` | Violet |
| `MARI` | `#22c55e` | Vert |
| `PICASSO` | `#f59e0b` | Ambre |
| `VP` | `#ec4899` | Rose |
| `MIXTE` | `#4b5563` | Gris foncé |
| `UNKNOWN` | `#9ca3af` | Gris clair |

Cette palette est dupliquée dans `packages/registry/eic-rte-overlay.json` (backend). Depuis **Phase 1 (P1-3)**, un test Vitest automatique vérifie la synchronisation entre les deux sources.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| Aucun fichier `.spec.ts` ou `.spec.tsx` dans `apps/web/src/components/Map/` | — | Absent |
| `apps/web/src/pages/MapPage.tsx` | — | Absent |
| `apps/web/src/lib/process-colors.sync.test.ts` | Synchronisation palette : vérifie que les clés et valeurs hex de `PROCESS_COLORS` (TS) correspondent exactement à `processColors` du JSON overlay | Ajouté Phase 1 (P1-3) |
| Tests E2E Playwright (`tests/e2e/`) | Smoke tests — navigation vers la carte, présence de la carte après upload | Existant (indirect) |

Le module `web/map` ne dispose pas de tests unitaires sur les composants React. La couverture repose sur les smoke tests Playwright et le test de synchronisation palette ajouté en Phase 1.
