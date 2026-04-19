# RETRO-013 — Résolution du chemin des fichiers registry via process.cwd()

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-013                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | registry                       |
| App        | api                            |

## Contexte

Le `RegistryService` doit lire deux fichiers situés dans `packages/registry/`, un package du monorepo distinct de `apps/api/`. En développement local, le chemin relatif depuis la racine du monorepo est `../../packages/registry` si l'API est démarrée depuis `apps/api/`. La question est comment résoudre ce chemin de manière fiable sans hardcoder un chemin absolu machine.

## Décision identifiée

Le chemin est résolu via une constante calculée au niveau module (à l'import du fichier, pas dans une méthode) :

```typescript
const REGISTRY_PACKAGE_ROOT = resolve(process.cwd(), '../../packages/registry');
```

Cette approche exploite le fait que `pnpm dev:api`, `pnpm build` (via `nest build`), et `pnpm test` (Vitest avec `--filter @carto-ecp/api`) s'exécutent tous avec `process.cwd()` égal à `apps/api/`. Le chemin résolu est donc déterministe dans tous les contextes de développement locaux.

Ce choix est documenté dans CLAUDE.md §Known friction points #3.

## Conséquences observées

### Positives
- Zéro configuration requise en développement local — fonctionne out-of-the-box avec les commandes pnpm standards.
- Simple à comprendre et à déboguer (un seul chemin, calculé une fois).
- Compatible avec `nest start --watch` (rechargement TypeScript ne réexécute pas le niveau module).

### Négatives / Dette
- **Fragile en contexte Docker** : si le WORKDIR du conteneur est `/app` (racine du monorepo), le chemin `../../packages/registry` pointerait en dehors du répertoire de travail et échouerait. Si le WORKDIR est `/app/apps/api`, cela fonctionnerait.
- La constante est calculée à l'import du module JavaScript — avant que NestJS initialise son contexte DI. Cela rend difficile l'injection d'une valeur via `ConfigService` ou variable d'environnement (il faudrait déplacer le `resolve()` dans `onModuleInit`).
- Les tests qui changent de répertoire de travail entre les suites pourraient produire des chemins incorrects (non observé en pratique grâce à `fileParallelism: false`).

## Recommandation

Reconsidérer lors de la mise en place du Dockerfile. Les deux solutions envisageables :
1. **Variable d'environnement `REGISTRY_PATH`** : déplacer le `resolve()` dans `onModuleInit`, lire `process.env.REGISTRY_PATH` avec fallback sur le chemin relatif actuel.
2. **Bundler les fichiers dans le build** : copier `packages/registry/` dans `dist/` à la compilation via `nest-cli.json` `assets`, puis résoudre via `__dirname`.

L'option 1 est la moins invasive et la plus flexible pour les environnements variables (dev, CI, Docker, VM RTE).
