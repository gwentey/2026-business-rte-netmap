# Spec Technique — shared/types

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | shared/types        |
| Version       | 0.1.0               |
| Date          | 2026-04-17          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le package `@carto-ecp/shared` est un package TypeScript pur sans étape de compilation. Il expose trois modules sources re-exportés via un barrel `index.ts` :

- `registry.ts` — clés de processus métier et types dérivés
- `snapshot.ts` — contrats de l'API snapshots (liste + détail)
- `graph.ts` — contrats de l'API graphe (nœuds, edges, bounds)

Il n'y a aucune dépendance de production, aucun fichier `.js` compilé, aucun `dist/`. Les deux applications consommatrices (`api` via ts-node/SWC, `web` via Vite) résolvent directement les fichiers `.ts` sources.

La seule référence croisée interne est `graph.ts → registry.ts` : `GraphNode.process` et `GraphEdge.process` utilisent `ProcessKey` importé de `registry.ts`.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `packages/shared/src/registry.ts` | Constante `PROCESS_KEYS as const`, type `ProcessKey` dérivé, type `ProcessColorMap` | ~15 |
| `packages/shared/src/snapshot.ts` | Types `ComponentType`, `Warning`, `SnapshotSummary`, `SnapshotDetail` | ~29 |
| `packages/shared/src/graph.ts` | Types `NodeKind`, `EdgeDirection`, `GraphNode`, `GraphEdge`, `GraphBounds`, `GraphResponse` | ~60 |
| `packages/shared/src/index.ts` | Barrel re-export (`export * from`) | ~3 |
| `packages/shared/package.json` | Config workspace : `main`/`types`/`exports` → `./src/index.ts`, pas de build | ~17 |

## Schéma BDD (si applicable)

Ce package ne touche pas la base de données. Il définit les types des réponses HTTP — les mappers entre entités Prisma et ces types vivent dans `apps/api`.

Correspondances indicatives entre les types partagés et le modèle Prisma :

| Type partagé | Table(s) Prisma source |
|---|---|
| `GraphNode` | `Component`, `ComponentUrl` |
| `GraphEdge` | `MessagePath`, `MessagingStatistic` |
| `GraphBounds` | Calculé à partir des coordonnées de `Component` |
| `GraphResponse` | Agrégation `Component` + `MessagePath` + `MessagingStatistic` |
| `SnapshotSummary` | `Snapshot` (champs scalaires + `_count` Prisma) |
| `SnapshotDetail` | `Snapshot` + `Warning[]` (décodage `warningsJson`) |

## API / Endpoints (si applicable)

Ce package ne définit pas de routes. Il définit les types de réponse des routes suivantes (documentées dans `apps/api`) :

| Méthode | Route | Type retourné |
|---------|-------|---------------|
| GET | `/api/snapshots` | `SnapshotSummary[]` |
| GET | `/api/snapshots/:id` | `SnapshotDetail` |
| GET | `/api/snapshots/:id/graph` | `GraphResponse` |

## Patterns identifiés

- **`as const` + type dérivé** : `PROCESS_KEYS` est déclaré `as const` pour obtenir un tuple de littéraux. `ProcessKey` est ensuite dérivé par `(typeof PROCESS_KEYS)[number]`, évitant toute duplication entre valeur runtime et type statique. Ce pattern permet aussi d'itérer sur `PROCESS_KEYS` à l'exécution (ex. pour construire `ProcessColorMap`).

- **Barrel export** : `index.ts` agrège les trois modules par `export *`. Les consommateurs importent depuis `@carto-ecp/shared` sans connaître la structure interne du package.

- **Import `type`** : `graph.ts` utilise `import type { ProcessKey }` pour importer depuis `registry.ts`. Ceci est obligatoire dans un contexte TS `"type": "module"` avec des extensions `.js` dans les imports (convention TypeScript ESM) — l'import `type` est effacé à la compilation et n'introduit pas de dépendance circulaire runtime.

- **Extension de type par intersection** : `SnapshotDetail` est défini comme `SnapshotSummary & { organization, stats, warnings }` plutôt que par héritage d'interface. Ce pattern est idiomatique en TypeScript pour étendre des types objet sans déclarer d'interface.

- **TypeScript-only workspace sans build** : `package.json` expose `main`, `types` et `exports["."]` pointant tous vers `./src/index.ts`. Ce pattern exploite le fait que Vite (web) et les outils NestJS basés SWC/ts-node (api) peuvent consommer du TypeScript source directement en mode développement. Voir RETRO-019.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| — | Aucun test dédié au package shared | Absent |

> Note : l'absence de tests est cohérente avec la nature du package — il ne contient que des déclarations de types, qui sont vérifiées statiquement par le `typecheck` global (`pnpm typecheck` via `tsc --noEmit`). Il n'y a aucun comportement d'exécution à tester.
