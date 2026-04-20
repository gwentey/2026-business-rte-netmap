# Spec Fonctionnelle — shared/types

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | shared/types                    |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-019](../../../adr/RETRO-019-typescript-only-workspace-sans-build.md) | TypeScript-only workspace sans build step | Documenté (rétro) |

---

## Contexte et objectif

Le package `@carto-ecp/shared` est le contrat de communication entre le backend NestJS et le frontend React. Il contient exclusivement des types TypeScript (aucune logique) et évite la duplication des DTOs dans les deux codebase.

En v2.0, le package a été étendu pour inclure tous les types liés aux nouvelles fonctionnalités : imports, overrides, admin, annuaire ENTSO-E.

---

## Règles métier

1. **Tout DTO échangé via HTTP doit être défini ici.** Ni le frontend ni le backend ne définissent leurs propres DTOs d'interface — ils importent depuis `@carto-ecp/shared`.

2. **Aucune logique dans ce package.** Uniquement des types et constantes. Les fonctions utilitaires vont dans `apps/` ou `packages/`.

3. **Les types supprimés en v2.0** (`SnapshotSummary`, `SnapshotDetail`, `SnapshotIngestionResult`) ne sont plus exportés.

---

## Dépendances

Consommé par :
- `apps/api` — backend NestJS (types de réponses contrôleurs + types internes)
- `apps/web` — frontend React (types dans les appels API + composants)
