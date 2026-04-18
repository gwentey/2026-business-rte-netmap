# Spec Technique — web/detail-panel

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/detail-panel    |
| Version       | 0.2.0               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 2 remédiation |

---

## Architecture du module

Le module est composé de trois composants React purs, organisés en arbre parent/enfants :

```
DetailPanel (conteneur, logique de sélection)
├── NodeDetails  (rendu fiche nœud)
└── EdgeDetails  (rendu fiche arête)
```

`DetailPanel` est le seul composant connecté au store Zustand. Il lit `graph`, `selectedNodeEic`, `selectedEdgeId`, et les actions `selectNode`/`selectEdge`. Il résout l'entité sélectionnée depuis le graphe en mémoire (`graph.nodes.find` / `graph.edges.find`) et délègue le rendu à `NodeDetails` ou `EdgeDetails` via props typées.

`NodeDetails` et `EdgeDetails` sont des composants de présentation purs : ils reçoivent une prop unique (`node: GraphNode` ou `edge: GraphEdge`) et ne lisent pas le store.

Le bouton `× Fermer` est rendu directement dans `DetailPanel`. Son handler appelle `selectNode(null)` si un nœud est actif, sinon `selectEdge(null)`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/src/components/DetailPanel/DetailPanel.tsx` | Conteneur — logique de sélection, affichage conditionnel, bouton Fermer | ~31 |
| `apps/web/src/components/DetailPanel/NodeDetails.tsx` | Présentation — fiche nœud (EIC, org, pays, networks, process, timestamps, URLs, badge position) | ~61 |
| `apps/web/src/components/DetailPanel/EdgeDetails.tsx` | Présentation — fiche arête (direction, transport, broker, activité, validité, messageTypes badges) | ~62 |
| `apps/web/src/store/app-store.ts` | Store Zustand global — `selectedNodeEic`, `selectedEdgeId`, `selectNode`, `selectEdge`, `graph` | ~64 |
| `apps/web/src/lib/format.ts` | Utilitaire — `formatDateTime` via `Intl.DateTimeFormat('fr-FR')` | ~12 |
| `packages/shared/src/graph.ts` | DTOs TypeScript — `GraphNode`, `GraphEdge`, `GraphResponse`, `EdgeDirection`, `NodeKind` | ~59 |

---

## Schéma BDD (si applicable)

Le DetailPanel ne fait aucun appel réseau direct. Il consomme les données du graphe déjà chargé en mémoire via le store Zustand. Les types de données affichés correspondent aux entités suivantes en base (pour référence) :

| Type affiché | Entités Prisma sources |
|---|---|
| `GraphNode` | `Component` + `ComponentUrl` |
| `GraphEdge` | `MessagePath` + `MessagingStatistic` (agrégés par `GraphService`) |

---

## API / Endpoints (si applicable)

Aucun appel API direct depuis ce module. Le graphe est chargé par `setActiveSnapshot` dans le store (`GET /api/snapshots/:id/graph`) et stocké en mémoire. Le DetailPanel consomme uniquement le store.

---

## Patterns identifiés

- **Container / Presentational pattern** — `DetailPanel` est le container (connecté au store), `NodeDetails` et `EdgeDetails` sont les composants de présentation (props only, aucune dépendance externe).
- **Conditional render with early return** — Le composant retourne `null` dès que les préconditions ne sont pas remplies (`!graph`, `!selectedNodeEic && !selectedEdgeId`), évitant tout rendu inutile.
- **Selector per state slice (Zustand)** — Chaque valeur du store est lue via un sélecteur dédié (`useAppStore((s) => s.graph)`) pour minimiser les re-renders.
- **Mutual exclusion via store** — L'invariant "une seule sélection à la fois" est appliqué dans le store (`selectNode` nullifie `selectedEdgeId` et vice versa), pas dans le composant.
- **Definition list (`<dl>/<dt>/<dd>`) pour les fiches** — Structure sémantique HTML5 pour les paires label/valeur, avec grille 3 colonnes Tailwind (1 col label, 2 col valeur).
- **`Intl.DateTimeFormat` instancié une fois en module scope** — L'objet `FR_DT` est créé une seule fois au chargement de `format.ts`, évitant une instanciation par appel de `formatDateTime`.

---

## Interface des composants

### `DetailPanel`

```tsx
// Aucune prop — lit tout depuis useAppStore
export function DetailPanel(): JSX.Element | null
```

Comportement de rendu :
- `graph === null` → `null`
- `!selectedNodeEic && !selectedEdgeId` → `null`
- `selectedNodeEic` non null → `<aside>` avec `<NodeDetails node={...} />`
- `selectedEdgeId` non null → `<aside>` avec `<EdgeDetails edge={...} />`

Layout : `<aside className="h-full w-[400px] overflow-y-auto border-l bg-white p-4">`

### `NodeDetails`

```tsx
export function NodeDetails({ node }: { node: GraphNode }): JSX.Element
```

Champs rendus dans l'ordre :
1. `node.displayName` — titre `<h2>`
2. `node.eic` — monospace
3. `node.kind` — type de composant
4. `node.organization`
5. `node.country` — `'—'` si null
6. `node.networks.join(', ')` — `'—'` si tableau vide
7. `node.process` — `'—'` si null
8. `node.creationTs` — `formatDateTime`
9. `node.modificationTs` — `formatDateTime`
10. `node.urls` — section conditionnelle si `urls.length > 0`, liste `network — url` (texte non cliquable)
11. `node.isDefaultPosition` — encadré avertissement jaune si `true`

### `EdgeDetails`

```tsx
export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element
```

Champs rendus dans l'ordre :
1. `edge.process` — titre `<h2>` `"Flux {process}"`
2. `edge.direction` — `'IN'` ou `'OUT'`
3. `edge.fromEic` — monospace
4. `edge.toEic` — monospace
5. `edge.transportPatterns.join(', ')`
6. `edge.intermediateBrokerEic` — ligne conditionnelle si non null, monospace
7. `edge.activity.connectionStatus` — `'—'` si null
8. `edge.activity.lastMessageUp` — `formatDateTime`
9. `edge.activity.isRecent` — `'Oui'` / `'Non'`
10. Validité : `formatDateTime(edge.validFrom) → formatDateTime(edge.validTo)`
11. `edge.messageTypes` — badges `<span>` fond gris monospace, avec compteur dans le titre

---

## Formatage des dates

`formatDateTime` (module `apps/web/src/lib/format.ts`) :

```ts
const FR_DT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});

export function formatDateTime(input: string | null | undefined): string {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return FR_DT.format(date);
}
```

Résultat typique : `"17/04/2026 10:30"`. Les cas null, undefined et chaîne invalide retournent tous `'—'`.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/src/components/DetailPanel/NodeDetails.test.tsx` | **[P2-5]** Rendu `country` null → `'—'`, rendu `process` null → `'—'`, rendu `networks` vide → `'—'`, badge "Position par défaut" si `isDefaultPosition = true`, formatage `creationTs` en locale fr-FR | Ajouté Phase 2 |
| `apps/web/src/components/DetailPanel/EdgeDetails.test.tsx` | **[P2-5]** Rendu `connectionStatus` null → `'—'`, rendu `intermediateBrokerEic` null (ligne absente), badges `messageTypes`, `isRecent = true` → `'Oui'`, rendu `validTo` null → `'—'` | Ajouté Phase 2 |
| Smoke Playwright (MapPage) | Couverture indirecte possible via navigation carte | Partiel (non vérifié) |
