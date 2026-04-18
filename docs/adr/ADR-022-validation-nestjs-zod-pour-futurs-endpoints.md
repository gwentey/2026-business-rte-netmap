# ADR-022 — Validation : adopter nestjs-zod pour les futurs endpoints NestJS

| Champ    | Valeur                                              |
|----------|-----------------------------------------------------|
| Date     | 2026-04-18                                          |
| Statut   | Acceptée                                            |
| Portée   | Tout nouvel endpoint NestJS ajouté au-delà du slice #1 |
| Source   | `docs/retro/plan-remediation.md` P3-5, dette m11    |

## Contexte

Le slice #1 a livré un seul endpoint de mutation (`POST /api/snapshots`) et
deux endpoints de lecture (`GET /api/snapshots`, `GET /api/snapshots/:id`,
`GET /api/snapshots/:id/graph`).

La validation actuelle :
- `POST /snapshots` : le body `label + envName` est parsé par
  `createSnapshotSchema.safeParse(body)` (Zod manuel) dans le body du
  controller, après le FileInterceptor et les checks MIME / magic bytes
- Les paramètres `:id` et `?envName` ne passent par **aucun** pipe NestJS :
  ils sont acceptés en string brute

Cette stratégie est hybride : Zod pour le body (cohérent avec le reste du
projet qui utilise Zod dans `packages/shared`), mais pas de validation pour
les params/query. Si d'autres endpoints sont ajoutés (filtres, export,
admin registry, diff view, etc.), deux directions sont possibles :
- `class-validator` (convention NestJS par défaut), avec `ValidationPipe`
  global activé dans `main.ts`
- `nestjs-zod` (adaptateur qui expose des DTO Zod via decorators + pipe)

## Décision

**Adopter `nestjs-zod` pour tout nouvel endpoint ajouté après le slice #1.**

- Les endpoints existants de `SnapshotsController` ne sont **pas** refactorés
  (risque disproportionné par rapport au bénéfice, les tests existants
  valident le comportement actuel)
- Tout nouvel endpoint utilisera `@nestjs/zod`, avec :
  - DTOs typés via `createZodDto(schema)` de `nestjs-zod`
  - Pipes de validation automatiques (body, query, params) via `ZodValidationPipe`
  - Schémas Zod réutilisables dans `packages/shared` ou spécifiques au module

## Conséquences

- **Positives** : cohérence Zod de bout en bout (shared types, API
  validation, tests), typage automatique, validation des params/query par
  défaut, moins de boilerplate que `class-validator` (pas de décorateurs
  manuels par champ)
- **Négatives** : dépendance supplémentaire (`nestjs-zod`), hétérogénéité
  temporaire avec `SnapshotsController` qui garde son approche manuelle
- **Mitigation** : documenter le pattern `nestjs-zod` dans un README du
  premier module qui l'adopte, pour guider les contributeurs

## Alternatives écartées

- **class-validator (canonique NestJS)** : impose des décorateurs par champ,
  typage moins fluide avec TypeScript strict, friction avec SWC + Prisma
  types, duplique les schémas déjà exprimés en Zod dans `@carto-ecp/shared`
- **Migration rétroactive des endpoints existants** : risque de régression
  pour 0 gain fonctionnel, le slice #1 est stable, les tests couvrent les 3
  cas de rejet upload
- **Ne rien faire / laisser chaque module choisir** : divergence prévisible,
  dette technique reportée, review plus difficile

## Implémentation future

Lorsque le premier nouvel endpoint sera ajouté :
1. `pnpm --filter @carto-ecp/api add nestjs-zod zod` (zod déjà présent)
2. Activer `ZodValidationPipe` globalement dans `main.ts` via
   `app.useGlobalPipes(new ZodValidationPipe())`
3. Créer un DTO avec `createZodDto(filterSchema)` importé d'un schéma Zod
4. Utiliser `@Query() filter: FilterDto` dans le controller

Pas de ticket spécifique ouvert : ce chantier démarrera avec la première
feature de slice #2 nécessitant validation étendue.
