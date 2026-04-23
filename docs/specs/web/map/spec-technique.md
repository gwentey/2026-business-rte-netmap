# Spec Technique — web/map

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/map                         |
| Version| 2.0.1                           |
| Date   | 2026-04-23                      |
| Source | v2.0.1 — refonte overlays styling 5c |

---

## Architecture

Le module `map` compose la vue cartographique principale. Il reçoit les données du store Zustand (`graph`, `selectedNodeEic`, `selectedEdgeId`) et les rendu via react-leaflet. Les nœuds utilisent des `DivIcon` Lucide personnalisés selon le `NodeKind`. Les edges sont des `Polyline` react-leaflet calculées par approximation de Bézier quadratique. L'offset radial pour le cluster Paris La Défense est appliqué côté client via `useMapData`.

### Composants et fichiers

| Fichier | Rôle |
|---------|------|
| `NetworkMap.tsx` | Composant racine : `MapContainer` + `TileLayer` + rendu nodes/edges |
| `NodeMarker.tsx` | `Marker` react-leaflet avec `DivIcon` généré par `buildNodeDivIcon` |
| `node-icon.tsx` | `buildNodeDivIcon(kind, isDefaultPosition, selected)` : génère un `L.divIcon` avec icône Lucide SVG inline |
| `EdgePath.tsx` | `Polyline` react-leaflet avec points Bézier calculés |
| `useMapData.ts` | Hook de transformation : applique l'offset radial cluster RTE, extrait nodes/edges/bounds depuis `GraphResponse` |

---

## Interfaces

### `NetworkMap`

Props : aucune (lit tout depuis le store Zustand).

Sources de données :
- `useAppStore(s => s.graph)` — `GraphResponse | null`
- `useAppStore(s => s.selectedNodeEic)` — EIC sélectionné
- `useAppStore(s => s.selectedEdgeId)` — ID d'edge sélectionné
- Callbacks : `selectNode`, `selectEdge`

### `NodeMarker`

```typescript
Props = { node: GraphNode; selected: boolean; onSelect: (eic: string) => void }
```

Génère l'icône via `buildNodeDivIcon(node.kind, node.isDefaultPosition, selected)`.

Tooltip : `displayName`, EIC, pays, avertissement si `isDefaultPosition`.

### `buildNodeDivIcon(kind, isDefaultPosition, selected)`

Retourne `L.divIcon` avec HTML inline.

| Kind | Icône Lucide | Couleur fond |
|------|-------------|-------------|
| `RTE_ENDPOINT` | `Zap` | `#e30613` (rouge RTE) |
| `RTE_CD` | `Network` | `#b91c1c` |
| `BROKER` | `Router` | `#111827` |
| `EXTERNAL_CD` | `Network` | `#1f2937` |
| `EXTERNAL_ENDPOINT` | `Zap` | `#6b7280` |

Badge orange `⚠` (10px) en bas à droite si `isDefaultPosition = true`.

Halo bleu (`box-shadow`) si `selected = true`.

Taille icône : 24x24 px, cercle blanc centré sur le marker (iconAnchor [12,12]).

### `EdgePath`

```typescript
Props = { edge: GraphEdge; nodes: Map<string, GraphNode>; selected: boolean; onSelect: (id: string) => void }
```

Rendu nul si l'un des nœuds extrémités est absent de la map.

**Algorithme Bézier quadratique** (SAMPLES = 20 points) :

Point de contrôle (`mid`) calculé comme :
```
mid.lat = (from.lat + to.lat) / 2 + (to.lng - from.lng) * 0.15
mid.lng = (from.lng + to.lng) / 2 - (to.lat - from.lat) * 0.15
```

Couleur : `colorFor(edge.process)` (depuis `process-colors.ts`).

Style : `weight=4` si sélectionné, sinon `2`. `dashArray='6 6'` si `edge.activity.isRecent === false` (edge inactif). `opacity=0.85`.

### `useMapData(graph)`

Applique l'offset radial pour les nœuds proches du cluster RTE (Paris La Défense) :

1. Filtre les nœuds dont `|lat - rteClusterLat| < rteClusterProximityDeg` ET `|lng - rteClusterLng| < rteClusterProximityDeg`
2. Si plusieurs nœuds dans ce groupe : calcule un offset radial pour chacun (`angle = 2π*idx/count`, offset = `rteClusterOffsetDeg * cos/sin(angle)`)
3. Retourne les nœuds avec coordonnées offset appliquées (uniquement pour l'affichage, pas modifié dans le store)

Paramètres depuis `graph.mapConfig` : `rteClusterLat`, `rteClusterLng`, `rteClusterOffsetDeg`, `rteClusterProximityDeg`.

---

## Page MapPage

`apps/web/src/pages/MapPage.tsx` — orchestre la page carte :
- `EnvSelector` en haut pour changer d'environnement
- `TimelineSlider` si plusieurs dates distinctes
- `NetworkMap` pour la carte
- `DetailPanel` pour le panneau latéral (nœud ou edge sélectionné)

**Styling du shell MapPage (Slice 5b — v3.0-alpha.16)** : `MapPage.module.scss` a été refondu pour consommer exclusivement les tokens `--c-*`/`--r-*`/`--shadow-*`/`--motion-*`/`--layout-*`/`--t-*` de `apps/web/src/styles/brand.scss`. Les états loading/error/empty, le sous-header, le footer légende, `snapshotLabel` et `snapshotLink` ne comportent plus aucun hex codé en dur. Voir `docs/specs/web/charte-visuelle/spec-technique.md §11` pour le détail complet des tokens consommés.

**Styling des overlays Map (Slice 5c — v3.0-alpha.17)** : `NetworkMap.module.scss`, `BaFilter.module.scss` et `NodeMarker.module.scss` ont été tokenisés. Points clés :
- `NetworkMap.module.scss` : toggle "Hiérarchie CD" migre de `#1e293b` (slate dur) vers `var(--c-surface-deep)`.
- `BaFilter.module.scss` : popup dark avec `--c-surface-dark`, items `--c-text-inverse`, palette criticité P1=`--c-error` / P2=`--c-primary` (cyan — résolution de l'incohérence ambre antérieure) / P3=`--c-text-muted`.
- `NodeMarker.module.scss` : styling des tooltips Leaflet via `:global(.leaflet-tooltip)` (seul moyen d'atteindre les éléments montés hors du sous-arbre React par Leaflet). Fond `--c-surface-dark`, texte `--c-text-inverse`, bordure `--c-border-subtle`.

Voir `docs/specs/web/charte-visuelle/spec-technique.md §12` pour le détail complet.

---

## Dépendances

- `react-leaflet` (`MapContainer`, `TileLayer`, `Marker`, `Tooltip`, `Polyline`)
- `leaflet` (`L.divIcon`)
- `lucide-react` (`Zap`, `Network`, `Router`) — rendu en SVG statique via `renderToStaticMarkup`
- `react-dom/server` (`renderToStaticMarkup`) — génération HTML des icônes
- `@carto-ecp/shared` — types `GraphNode`, `GraphEdge`, `GraphResponse`, `NodeKind`
- `process-colors.ts` — mapping `ProcessKey -> hex color`
- Zustand store (`useAppStore`)

---

## Invariants

1. `leaflet-curve` n'est plus utilisé (supprimé en Phase 4, ADR-014 obsolété). Les edges sont maintenant des `react-leaflet Polyline` avec approximation Bézier.
2. `buildNodeDivIcon` utilise `renderToStaticMarkup` (rendu serveur synchrone) pour générer le SVG Lucide inline dans le HTML du DivIcon — pas de composant React monté dans le DOM Leaflet.
3. L'offset radial est calculé à chaque render de `useMapData` via `useMemo` (dépend de `graph`). Il ne modifie pas les coordonnées stockées dans le graphe.
4. La classe CSS `carto-node-marker` est assignée à tous les DivIcon pour permettre un ciblage CSS global si besoin.
5. Les attributs `data-kind`, `data-default`, `data-selected` sont présents dans le HTML du DivIcon pour les tests.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `node-icon.test.ts` | buildNodeDivIcon : HTML généré, badge isDefaultPosition, halo selected, KIND_CONFIG exhaustif |
| `EdgePath.test.tsx` | sampleBezier (points calculés), rendu null si nœud absent |

Ref. croisées : [web/timeline-slider](../timeline-slider/spec-technique.md), [web/env-selector](../env-selector/spec-technique.md), [web/detail-panel](../detail-panel/spec-technique.md), [api/graph](../../api/graph/spec-technique.md).
