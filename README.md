# Carto ECP Network Map

Monorepo pnpm — NestJS 10 + Prisma 5 + SQLite (api) · React 18 + Vite + Leaflet (web).

## Prérequis

- Node ≥ 20.11
- pnpm ≥ 9

## Setup

```bash
pnpm install
pnpm --filter @carto-ecp/api prisma:migrate
```

## Dev

```bash
pnpm dev              # api (3000) + web (5173)
pnpm dev:api
pnpm dev:web
```

## Build

```bash
pnpm build
```

## Tests

```bash
pnpm typecheck
pnpm test                                          # vitest (api + web)
pnpm test:e2e                                      # playwright
pnpm --filter @carto-ecp/api test -- <pattern>     # un seul spec
pnpm --filter @carto-ecp/api test:watch
```

## Prisma

```bash
pnpm --filter @carto-ecp/api prisma:migrate        # applique migrations + régénère client
pnpm --filter @carto-ecp/api prisma:generate       # régénère client
pnpm --filter @carto-ecp/api prisma:studio         # UI DB
```

## Format

```bash
pnpm format
```

## Import d'un dump

1. http://localhost:5173/upload
2. Drop `<EIC>_<timestamp>.zip` + son `<EIC>-configuration.properties` (dossier `tests/fixtures/EXPORT/PRFRI-*/`)
3. Saisir env (ex. `PRFRI`) → `Importer tout`
4. `Voir sur la carte →`

## Structure

- `apps/api/` — backend NestJS
- `apps/web/` — frontend Vite
- `packages/shared/` — types partagés
- `packages/registry/` — référentiels EIC (CSV ENTSO-E + overlay RTE)
- `tests/fixtures/EXPORT/` — 7 dumps PRFRI réels (zips gitignorés, `.properties` tracked)

## Sécurité

Pas d'authentification. Dev local uniquement.
Les zips `tests/fixtures/EXPORT/**/*.zip` sont gitignorés : ils contiennent `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` (clés privées + inventaire RTE) — le pipeline d'ingestion les filtre avant toute persistance.

## Docs

- `CLAUDE.md` — conventions, friction points
- `CHANGELOG.md` — historique des releases
- `docs/specs/` — specs fonctionnelles + techniques
- `docs/adr/` — décisions d'architecture
- `docs/officiel/` — doc ECP v4.16.0 (PDF)
