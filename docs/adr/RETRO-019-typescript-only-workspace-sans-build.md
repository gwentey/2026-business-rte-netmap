# RETRO-019 — Package TypeScript-only sans build step (main → ./src/index.ts)

| Champ      | Valeur                    |
|------------|---------------------------|
| Numéro     | RETRO-019                 |
| Statut     | Documenté (rétro)         |
| Date       | 2026-04-17                |
| Source     | Rétro-ingénierie          |
| Features   | types                     |
| App        | shared                    |

## Contexte

Dans un monorepo pnpm workspaces, les packages internes partagés (ici `@carto-ecp/shared`) peuvent être consommés de deux façons :

1. **Avec build** : le package compile ses sources TypeScript en JavaScript (`dist/`), et `main` pointe vers `./dist/index.js`. Les consommateurs importent du JS compilé.
2. **Sans build** : `main`, `types` et `exports["."]` pointent directement vers `./src/index.ts`. Les consommateurs importent du TypeScript source et le transpilent eux-mêmes.

Le projet a choisi la seconde approche pour `packages/shared`.

## Décision identifiée

`packages/shared/package.json` expose :

```json
{
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

Aucun script `build` n'est défini. La seule commande disponible est `typecheck` (`tsc --noEmit`).

Cette configuration fonctionne parce que :
- `apps/web` (Vite 5) résout les imports workspace en TypeScript source nativement via son plugin TypeScript.
- `apps/api` utilise `@swc/core` via `unplugin-swc` pour Vitest et ts-node (ou NestJS dev server via `ts-node`) qui transpilent les imports `.ts` directement.

## Conséquences observées

### Positives

- **Zéro friction de développement** : modifier un type dans `shared/` est immédiatement reflété dans les deux apps sans `tsc --watch` ni étape intermédiaire.
- **Pas de désynchronisation dist/** : il n'existe aucun artefact compilé qui pourrait être en retard sur les sources.
- **Typage bout-en-bout garanti** : `pnpm typecheck` valide en une passe les consommateurs ET les sources partagées.
- **Simplicité de configuration** : pas de `tsconfig.build.json` séparé, pas de `declarations: true`, pas de `outDir` à configurer dans le package.

### Négatives / Dette

- **Incompatible avec une publication npm** : si `@carto-ecp/shared` devait être publié sur npm ou consommé hors du monorepo, `main: ./src/index.ts` serait invalide — les consommateurs n'ont pas nécessairement TypeScript dans leur pipeline.
- **Dépendant de la capacité des outils à résoudre `.ts`** : tout outil qui ne supporte pas les imports TypeScript source (ex. Jest sans transform, un runner Node.js sans ts-node) ne pourrait pas consommer ce package. En production, si `apps/api` est compilée en CommonJS (`nest build`), les imports de `@carto-ecp/shared` sont résolus au moment de la compilation NestJS — le JS produit ne contient plus de référence au `.ts` source. Ce point est sûr pour le déploiement actuel mais doit être gardé en tête.
- **`tsc --noEmit` dans le package shared ne vérifie pas les consumers** : le typecheck global (`pnpm typecheck`) à la racine est nécessaire pour détecter les incompatibilités entre les types partagés et leur usage dans `api` ou `web`.
- **Extensions `.js` dans les imports internes** : conformément à la convention ESM TypeScript, `graph.ts` importe `registry.ts` via `import type { ProcessKey } from './registry.js'` (extension `.js` bien que le fichier source soit `.ts`). C'est contre-intuitif mais requis par le standard. Un développeur non averti pourrait s'attendre à `.ts`.

## Recommandation

**Garder** pour la durée du slice #1 et des slices de développement local. Ce pattern est une convention établie dans l'écosystème pnpm workspaces/Vite/NestJS pour les monorepos internes.

Si le projet évolue vers :
- Un déploiement Docker multi-stage avec build séparé des packages
- La publication de `@carto-ecp/shared` en dehors du monorepo
- L'ajout d'un runner qui ne supporte pas TypeScript source

...alors il faudra ajouter une étape de build (`tsc -p tsconfig.build.json`) et pointer `main` vers `./dist/index.js`. L'opération est mécanique et sans impact sur le code source des types.
