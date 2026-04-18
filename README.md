# Carto ECP Network Map — Slice #1

Application interne RTE pour visualiser le réseau ECP sur une carte d'Europe.
Première livraison : vertical slice upload → parser → carte, sans authentification, dev local.

## Prérequis

- Node 20 LTS
- pnpm ≥ 9

## Installation

```bash
pnpm install
pnpm --filter @carto-ecp/api prisma migrate dev
```

## Développement local

```bash
pnpm dev
```

- API : http://localhost:3000/api
- Web : http://localhost:5173

## Tests

```bash
pnpm test           # unit + intégration backend + frontend
pnpm test:e2e       # Playwright (démarre dev servers)
```

## Charger un backup

1. Ouvrir http://localhost:5173
2. Cliquer sur « Charger un snapshot »
3. Déposer un zip de backup ECP (Endpoint ou Component Directory)
4. Entrer un label + un environnement (ex. OPF)
5. Envoyer → cliquer « Voir sur la carte »

Deux backups réels sont dans `tests/fixtures/` pour tester.

## Attention — sécurité

Ce slice #1 n'a **pas d'authentification**. Ne jamais l'exposer sur Internet.
Les fichiers `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv`
(clés privées + inventaire interne) ne sont **jamais** parsés ni persistés.

## Architecture

Monorepo pnpm :
- `apps/api/` — NestJS 10 + Prisma 5 + SQLite
- `apps/web/` — React 18 + Vite + Leaflet
- `packages/shared/` — types TypeScript partagés
- `packages/registry/` — données de référence (CSV ENTSO-E + overlay RTE)

Pipeline d'ingestion : `ZipExtractor → CsvReader → XmlMadesParser →
NetworkModelBuilder → SnapshotPersister`.

Voir `docs/superpowers/specs/2026-04-18-carto-ecp-slice-1-design.md` pour le design complet
et `docs/superpowers/plans/2026-04-18-carto-ecp-slice-1-plan.md` pour le plan d'implémentation.
