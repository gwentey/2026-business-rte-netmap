# Spec Technique — api/envs

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/envs                        |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Module minimal exposant un endpoint GET pour lister les environnements existants. Un environnement est un `envName` distinct présent dans la table `Import`.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `envs.controller.ts` | Route GET /api/envs |
| `envs.service.ts` | `listEnvs()` : `SELECT DISTINCT envName FROM Import ORDER BY envName` |
| `envs.module.ts` | Module NestJS |

---

## Interfaces

### Route

```
GET /api/envs
```

Réponse 200 : `string[]` — liste des noms d'environnements distincts, triée alphabétiquement.

La liste est vide si aucun import n'existe.

---

## Dépendances

- `PrismaService` — `prisma.import.findMany({ select: { envName: true }, distinct: ['envName'] })`

---

## Invariants

1. Un environnement existe si et seulement si au moins un import lui appartient. La suppression du dernier import d'un environnement supprime implicitement cet environnement de la liste.
2. Aucun endpoint de création d'environnement — les envs sont créés implicitement par le premier import.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `envs.controller.spec.ts` | Liste vide, liste avec plusieurs envs distincts |

Ref. croisées : [web/env-selector](../../web/env-selector/spec-technique.md) — consomme cet endpoint. [api/imports](../imports/spec-technique.md) — crée implicitement les envs.
