# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Internal RTE application to visualize the ECP (Energy Communication Platform) network on a map of Europe. Upload a zipped ECP backup (Endpoint or Component Directory) → parse → persist to SQLite → render on a Leaflet map with edges colored by business process.

Current state: **slice #1** delivered on branch `feature/slice-1`, dev-local only, no auth. The functional document is `carto-ecp-document-fonctionnel-v1.2.md`; the implementation design is `docs/superpowers/specs/2026-04-18-carto-ecp-slice-1-design.md`.

## Monorepo layout

pnpm workspaces — 4 packages:

```
apps/api/              # NestJS 10 + Prisma 5 + SQLite backend
apps/web/              # React 18 + Vite + Leaflet frontend
packages/shared/       # TS DTOs shared between api and web
packages/registry/     # Reference data (ENTSO-E EIC CSV + RTE overlay JSON)
```

`packages/shared` is consumed as `@carto-ecp/shared` workspace:* and uses `main: ./src/index.ts` (no build step). `packages/registry` is data-only: no code, loaded by `RegistryService` at boot.

## Common commands

All commands run from repo root.

```bash
pnpm install                          # install all workspace deps
pnpm dev                              # api (port 3000) + web (port 5173) parallel
pnpm dev:api                          # api only
pnpm dev:web                          # web only
pnpm test                             # all vitest suites (unit + integration)
pnpm test:e2e                         # Playwright smoke tests (boots dev servers)
pnpm typecheck                        # tsc --noEmit across all workspaces
pnpm build                            # build api + web
pnpm lint                             # ⚠️ ESLint binary not yet wired — fails today
```

### Single-test patterns

```bash
pnpm --filter @carto-ecp/api test -- registry.service       # one spec file
pnpm --filter @carto-ecp/api test -- full-ingestion         # integration only
pnpm --filter @carto-ecp/api test:watch                     # watch mode
pnpm --filter @carto-ecp/web exec playwright test --grep upload
```

### Prisma

```bash
pnpm --filter @carto-ecp/api prisma:migrate                 # dev migration
pnpm --filter @carto-ecp/api prisma:generate                # regenerate client
pnpm --filter @carto-ecp/api prisma:studio                  # DB browser
```

The SQLite file lives at `apps/api/prisma/dev.db` (gitignored). The `apps/api/.env` with `DATABASE_URL="file:./dev.db"` is local only.

## Ingestion pipeline (core of the backend)

`apps/api/src/ingestion/` is the hot path. Five stateless services chained in order:

```
ZipExtractor → CsvReader → XmlMadesParser → NetworkModelBuilder → SnapshotPersister
```

- `ZipExtractor` enforces required files (`application_property.csv` + `component_directory.csv`), whitelists ~10 CSV names, and **explicitly excludes three sensitive files** (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`) from in-memory extraction. These sensitive files may remain inside the archived zip on disk but are never read into memory or persisted.
- `NetworkModelBuilder` does the business logic: detects `componentType` (ENDPOINT vs COMPONENT_DIRECTORY) from `ecp.componentCode`, enriches every component via `RegistryService.resolveComponent` (4-level cascade: overlay RTE → overlay CD → ENTSO-E + organization geocode → ENTSO-E + country geocode → Brussels default), classifies `messageType` via `RegistryService.classifyMessageType` (exact → regex → UNKNOWN), and computes IN/OUT direction relative to the authoritative RTE EIC set (sourced from `overlay.rteEndpoints` + `overlay.rteComponentDirectory.eic`, **not** a `17V` prefix heuristic).
- `SnapshotPersister` writes the zip to `storage/snapshots/{uuid}.zip` then runs a Prisma transaction. If the transaction fails the zip is unlinked (with a logged warning on cleanup error). It also **filters sensitive AppProperty keys** (`password|secret|keystore.password|privateKey|credentials`) before `createMany`.

`GraphService.buildGraph` aggregates `MessagePath` rows into edges by `(fromEic, toEic)` key, marks edges as `MIXTE` when ≥2 processes coexist on the same pair, skips wildcard endpoints, and computes `isRecent` as `lastMessageUp < 24h` **relative to the snapshot's uploadedAt** (not `Date.now()`, so the result is historically reproducible).

## Data shapes

Spec §8bis.4 defines the MADES XML namespace `http://mades.entsoe.eu/componentDirectory`. Two date formats coexist:
- CSV: ISO with nanoseconds, no Z (e.g. `2025-03-12T15:34:48.560980651`)
- XML: ISO with Z and milliseconds (e.g. `2025-03-18T15:00:00.000Z`)

Both are handled by `apps/api/src/common/date-parser.ts` via regex + truncation to ms. The string `NULL_VALUE_PLACEHOLDER` marks null cells in CSVs and is normalized via `apps/api/src/common/null-value-normalizer.ts`.

## Known friction points (learned the hard way)

1. **Root `package.json` has `"type": "module"` but `apps/api/package.json` overrides to `"type": "commonjs"`.** NestJS 10 with `@nestjs/cli` emits CommonJS; don't try to switch api to ESM.
2. **vitest + NestJS DI requires `unplugin-swc`** because esbuild doesn't emit decorator metadata. See `apps/api/vitest.config.ts` and `apps/api/src/vitest.setup.ts`.
3. **`RegistryService` resolves `packages/registry/` via `process.cwd()`**, assuming the api is started from `apps/api/`. Works for `nest start`, `nest build`, and vitest from that directory. Will need a different strategy (env var or bundled asset) when deploying to Docker with a different WORKDIR.
4. **Integration tests run with `fileParallelism: false`** (see `apps/api/vitest.config.ts`) because they share the dev SQLite file. Cleanup in `beforeAll` is scoped to the specific `sourceComponentCode` to avoid cross-file pollution.
5. **pnpm 10 build-script security**: `pnpm-workspace.yaml` has an `onlyBuiltDependencies` allowlist (nestjs/core, prisma engines, esbuild). Don't remove it — CI installs break without it.
6. **`apps/api/tsconfig.build.json` excludes `test/**`** so `nest start --watch` doesn't keep recompiling spec files. Add `tsConfigPath` in `nest-cli.json` points to it.
7. **`leaflet-curve` has no types** — there's a `declare module 'leaflet-curve';` stub in `apps/web/src/env.d.ts` and a `L as unknown as { curve: ... }` cast in `EdgePath.tsx`.
8. **`tsconfig.base.json` has `noUncheckedIndexedAccess: true`** — `array[index]` is always `T | undefined`. Use `array[i]!` in tests, proper guards in source.

## Test fixtures

Two real ECP backups live in `tests/fixtures/`:

- `17V000000498771C_2026-04-17T21_27_17Z/` — real Endpoint backup (ECP-INTERNET-2, env `OPF`)
- `17V000002014106G_2026-04-17T22_11_50Z/` — real CD backup (RTE CD)
- `X_eicCodes.csv` — ENTSO-E official EIC registry (~14929 codes)

The sensitive CSVs (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`) are **gitignored** — they contain private keys and internal inventory. Do not commit them even if the `ls` output looks incomplete.

Integration tests rebuild a fresh zip at runtime from these folders via `apps/api/test/fixtures-loader.ts`.

## Registry conventions

`packages/registry/eic-rte-overlay.json` is the single source of truth for:
- 6 RTE endpoints + 1 RTE CD EIC codes and coordinates
- 14 RTE business applications + criticality
- Organization-level geocode for ~12 partner TSOs
- Country-level fallback geocode
- `messageType → process` classification (exact map + regex patterns)
- `process → hex color` palette (also duplicated in `apps/web/src/lib/process-colors.ts` — keep them in sync if you change either)

Rechargement à chaud (hot reload) is **out of scope for slice #1** — any change requires a backend restart. A `re-classifier les snapshots existants` action will come in a later slice.

## Out of scope for slice #1 (don't add these unless asked)

Search, filters, layer toggles, CSV export, diff view, admin registry hot reload, auth/JWT, Dockerfile, VM Nginx deployment, alerting. These are explicitly deferred — see `docs/superpowers/specs/2026-04-18-carto-ecp-slice-1-design.md` §3.2.

## Running the app manually end-to-end

1. `pnpm install && pnpm --filter @carto-ecp/api prisma:migrate`
2. `pnpm dev`
3. Open http://localhost:5173, drag a zip from `tests/fixtures/17V.../` (skip the gitignored sensitive CSVs when building the test zip).
4. Enter label + envName (e.g. `OPF`), send, click "Voir sur la carte".
5. The map loads at http://localhost:5173/map with colored edges and clickable nodes.

## Commit & branch conventions

- Feature work happens on `feature/<slice-name>`. `main` stays releasable.
- Commit messages are **in French**, follow conventional commits (`feat(api):`, `fix(web):`, `test(api):`, `chore:`, `docs:`).
- Each commit ends with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` when Claude assisted.
- Never commit `tests/fixtures/**/local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`, `apps/api/.env`, `storage/`, `*.db*` — all gitignored.
