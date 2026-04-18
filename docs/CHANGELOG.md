# CHANGELOG — Documents de référence projet

> Ce changelog trace **uniquement** les versions des documents de niveau 0 de `docs/` :
> - `00-note-cadrage.md`
> - `01-cahier-des-charges-macro.md`
>
> Les specs fonctionnelles par feature (`docs/specs/{module}/`) sont versionnées dans leur propre `VERSIONNING.md`.
> Le code applicatif est versionné dans `CHANGELOG.md` à la **racine du projet** (format Keep a Changelog).

---

## [Unreleased]

### Modifie

### Documentation

- `docs/specs/api/ingestion/spec-technique.md` v0.1.1 : ajout de la note sur `InvalidUploadException` (P1-4) dans les patterns, mise à jour date/version
- `docs/specs/api/registry/spec-technique.md` v0.1.1 : remplacement de la section "Résolution du chemin" pour refléter `REGISTRY_PATH` env var (P1-2), ajout section Tests avec les 2 nouveaux cas, mise à jour Notes de déploiement
- `docs/specs/web/map/spec-technique.md` v0.1.1 : mise à jour palette (synchronisation désormais automatisée via test P1-3), ajout `process-colors.sync.test.ts` dans le tableau Tests
- `docs/adr/ADR-020-eslint-flat-config-par-workspace.md` : nouvel ADR — ESLint 9 flat config par workspace (résultat de P1-1)
- `docs/retro/dette-technique.md` : items M1, M2, M3, M5, m6 marqués RESOLU (Phase 1, commit 4f8ae25)
- `docs/retro/plan-remediation.md` : P1-1, P1-2, P1-3, P1-4 marqués Livrés (commit 4f8ae25)
