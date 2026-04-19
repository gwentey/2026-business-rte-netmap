# Stack technique du projet

> Fichier généré automatiquement par le subagent `stack-detector` lors de l'initialisation.
> Dernière détection : 2026-04-17

## Apps (monorepo)

| App | Root | Stack |
|---|---|---|
| `api` | `apps/api` | NestJS 10 + Prisma 5 + SQLite |
| `web` | `apps/web` | React 18 + Vite 5 + Tailwind CSS 3 |
| `shared` | `packages/shared` | TypeScript library (no build step) |
| `registry` | `packages/registry` | Data-only (CSV + JSON, no code) |

---

## Monorepo

- **Outil :** pnpm workspaces (`pnpm-workspace.yaml`)
- **Gestionnaire de paquets :** pnpm >= 9.0.0
- **Node requis :** >= 20.11.0
- **Type racine :** `"type": "module"` (surchargé en `commonjs` dans `apps/api`)
- **Contrainte build :** `onlyBuiltDependencies` allowlist dans `pnpm-workspace.yaml` — ne pas supprimer (`@nestjs/core`, `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma`)

---

## Frontend — `apps/web`

- **Framework :** React 18.3
- **Build tool :** Vite 5.4
- **Langage :** TypeScript 5.5
- **UI :** Tailwind CSS 3.4 + composants Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-slot`) + `lucide-react`
- **Utilitaires CSS :** `class-variance-authority`, `clsx`, `tailwind-merge`
- **State management :** Zustand 4.5
- **Routing :** React Router DOM 6.26
- **Cartographie :** Leaflet 1.9 + react-leaflet 4.2 + leaflet-curve 1.0 (pas de types — stub dans `apps/web/src/env.d.ts`)
- **Upload fichier :** react-dropzone 14.2
- **Structure :** `src/` standard Vite + React
- **Dev server :** http://localhost:5173

### Conventions frontend

- `leaflet-curve` n'a pas de types TS — utiliser le cast `L as unknown as { curve: ... }` dans les composants
- `tsconfig.base.json` active `noUncheckedIndexedAccess: true` — tout accès tableau retourne `T | undefined`; utiliser `array[i]!` dans les tests, des guards dans le source
- Les couleurs de process sont dupliquées entre `packages/registry/eic-rte-overlay.json` et `apps/web/src/lib/process-colors.ts` — les garder synchronisées

### Commandes frontend

```bash
pnpm dev:web                    # démarre Vite sur le port 5173
pnpm --filter @carto-ecp/web build
pnpm --filter @carto-ecp/web test          # Vitest (unit)
pnpm --filter @carto-ecp/web test:e2e      # Playwright smoke tests
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web exec playwright test --grep upload
```

---

## Backend — `apps/api`

- **Framework :** NestJS 10.4
- **Langage :** TypeScript 5.5 — **compilé en CommonJS** (`"type": "commonjs"` dans `apps/api/package.json`, contrairement à la racine ESM)
- **ORM :** Prisma 5.20
- **Base de données :** SQLite — fichier `apps/api/prisma/dev.db` (gitignore)
- **Auth :** Aucune (hors scope slice #1)
- **HTTP :** `@nestjs/platform-express` (Express sous NestJS)
- **Rate limiting :** `@nestjs/throttler`
- **Sécurité headers :** `helmet`
- **Logging :** `nestjs-pino` + `pino-pretty`
- **Upload fichiers :** `multer`
- **Parsing ZIP :** `adm-zip`
- **Parsing CSV :** `csv-parse`
- **Parsing XML :** `fast-xml-parser`
- **Validation :** `zod`
- **UUIDs :** `uuid`
- **Dev server :** http://localhost:3000

### Structure backend

```
apps/api/src/
  ingestion/          # Pipeline ZIP → CSV → XML → model → Prisma
    ZipExtractor
    CsvReader
    XmlMadesParser
    NetworkModelBuilder
    SnapshotPersister
  common/
    date-parser.ts
    null-value-normalizer.ts
  graph/
    GraphService         # Agrégation MessagePath → edges
```

### Conventions backend

- NestJS 10 tourne en CommonJS — ne pas tenter de migrer en ESM
- Vitest nécessite `unplugin-swc` (esbuild ne supporte pas les décorateurs metadata) — voir `apps/api/vitest.config.ts`
- `RegistryService` résout `packages/registry/` via `process.cwd()` — l'API doit être démarrée depuis `apps/api/`
- Les tests d'intégration tournent avec `fileParallelism: false` (SQLite partagé)
- `apps/api/tsconfig.build.json` exclut `test/**` — `nest start --watch` ne recompile pas les specs
- Trois fichiers CSV sensibles ne sont jamais lus en mémoire ni persistés : `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`
- Les AppProperty keys sensibles (`password|secret|keystore.password|privateKey|credentials`) sont filtrées avant `createMany`

### Commandes backend

```bash
pnpm dev:api                                        # nest start --watch (port 3000)
pnpm --filter @carto-ecp/api build                  # nest build
pnpm --filter @carto-ecp/api test                   # vitest run
pnpm --filter @carto-ecp/api test:watch             # vitest watch
pnpm --filter @carto-ecp/api test -- registry.service    # un seul fichier spec
pnpm --filter @carto-ecp/api test -- full-ingestion      # tests d'intégration
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/api prisma:migrate         # prisma migrate dev
pnpm --filter @carto-ecp/api prisma:generate        # regénère le client Prisma
pnpm --filter @carto-ecp/api prisma:studio          # navigateur DB
```

---

## Packages partagés

### `packages/shared` (`@carto-ecp/shared`)

- TypeScript pur — pas de build step, consommé directement via `main: ./src/index.ts`
- DTOs partagés entre `api` et `web`
- Commande : `pnpm --filter @carto-ecp/shared typecheck`

### `packages/registry` (`@carto-ecp/registry`)

- Data-only : `eic-entsoe.csv` (~14 929 codes EIC ENTSO-E) + `eic-rte-overlay.json`
- Pas de code — chargé par `RegistryService` au boot de l'API
- Source de vérité pour : EICs RTE, coordonnées, applications métier, couleurs de process, classification `messageType`

---

## Outils transverses

- **Gestionnaire de paquets :** pnpm >= 9.0.0 (workspaces)
- **TypeScript :** 5.5 (config base `tsconfig.base.json`, `noUncheckedIndexedAccess: true`)
- **Tests unitaires :** Vitest 2.1 (api + web)
- **Tests E2E :** Playwright 1.48 (web uniquement)
- **Linter :** ESLint (binaire non câblé en root — `pnpm lint` echoue aujourd'hui ; fonctionne par filtre : `eslint src --ext .ts`)
- **Formatter :** Prettier 3.3 (`pnpm format`)
- **CI/CD :** Non identifié (dev-local uniquement pour slice #1)
- **Docker :** Non identifié (hors scope slice #1)
- **Monorepo :** pnpm workspaces (pas de Turborepo ni Nx)

---

## Commandes racine (resume)

```bash
pnpm install                    # installe toutes les deps workspace
pnpm dev                        # api (3000) + web (5173) en parallele
pnpm dev:api                    # api seule
pnpm dev:web                    # web seule
pnpm test                       # tous les suites Vitest
pnpm test:e2e                   # Playwright (boot les serveurs dev)
pnpm typecheck                  # tsc --noEmit sur tous les workspaces
pnpm build                      # build api + web
pnpm format                     # prettier sur tout le repo
```

## Demarrage manuel end-to-end

```bash
pnpm install && pnpm --filter @carto-ecp/api prisma:migrate
pnpm dev
# Ouvrir http://localhost:5173
# Glisser un zip depuis tests/fixtures/17V.../
# Saisir label + envName (ex: OPF), envoyer
# Cliquer "Voir sur la carte" → http://localhost:5173/map
```
