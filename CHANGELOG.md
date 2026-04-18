# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### Added

- **P1-1 — ESLint 9 flat config** : configs `eslint.config.mjs` créées pour `apps/api` et `apps/web` (suppression du legacy `.eslintrc.cjs`). Ruleset `recommended` + 5 règles type-aware (`consistent-type-imports`, `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-unused-vars`). Overrides permissifs pour les fichiers `spec/test`. 12 devDependencies ESLint ajoutées.
- **P1-3 — Garde-fou anti-désynchro palette** : `apps/web/src/lib/process-colors.sync.test.ts` — 2 tests Vitest qui lisent `packages/registry/eic-rte-overlay.json` et comparent les clés + valeurs hex avec `PROCESS_COLORS` du TS.

### Changed

- **P1-2 — REGISTRY_PATH env var** : `RegistryService` déplace la résolution du chemin dans `onModuleInit()`. Lit `process.env.REGISTRY_PATH` avec fallback sur `../../packages/registry`. Suppression de la constante module-level `REGISTRY_PACKAGE_ROOT`. Log `Registry root: <path>` au boot.

### Fixed

- **P1-1 — Violations JSX/TS** : 10 violations `react/jsx-no-leaked-render` corrigées (pattern `{x && <C/>}` → `{x ? <C/> : null}`) dans 6 fichiers TSX. 2 violations `no-misused-promises` corrigées dans `UploadPage.tsx` (async `onClick` wrappé avec `void`).
- **P1-4 — HTTP 500 → HTTP 400 sur CSV vide** : `IngestionService` lève désormais `InvalidUploadException` (HTTP 400, code `INVALID_UPLOAD`) au lieu d'une `Error` native quand `component_directory.csv` est vide ou absent de l'archive.

### Removed

### BDD
