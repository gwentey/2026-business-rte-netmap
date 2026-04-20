# Spec Technique — api/admin

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/admin                       |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `admin` regroupe deux services indépendants exposés par un unique contrôleur : la zone danger (purges) et la gestion de l'annuaire ENTSO-E uploadable.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `admin.controller.ts` | Routes : DELETE purge-imports/purge-overrides/purge-all, POST entsoe/upload, GET entsoe/status |
| `danger.service.ts` | Purges des tables Import, ComponentOverride, EntsoeEntry |
| `entsoe.service.ts` | Upload et statut de l'annuaire ENTSO-E en base |
| `admin.module.ts` | Module NestJS |

---

## Interfaces

### Routes HTTP

| Méthode | Chemin | Description | Réponse |
|---------|--------|-------------|---------|
| DELETE | /api/admin/purge-imports | Purge tous les imports (tous envs) + ZIPs sur disque | `PurgeResult` |
| DELETE | /api/admin/purge-overrides | Purge tous les ComponentOverride | `PurgeResult` |
| DELETE | /api/admin/purge-all | Purge imports + overrides + EntsoeEntry | `ResetAllResult` |
| POST | /api/entsoe/upload | Upload CSV ENTSO-E officiel (max 5 MB) | `{ count: number; refreshedAt: string }` |
| GET | /api/entsoe/status | Statut de l'annuaire ENTSO-E en base | `EntsoeStatus` |

### Types de réponse (`@carto-ecp/shared`)

```typescript
PurgeResult = { deletedCount: number }

ResetAllResult = { imports: number; overrides: number; entsoe: number }

EntsoeStatus = { count: number; refreshedAt: string | null }
```

### Body POST /api/entsoe/upload

Multipart/form-data, champ `file`. CSV ENTSO-E au format officiel :
- Délimiteur `;`, BOM UTF-8
- Colonnes utilisées : `EicCode`, `EicLongName`, `EicDisplayName`, `MarketParticipantIsoCountryCode`, `EicTypeFunctionList`

Max 5 MB.

### Table BDD `EntsoeEntry`

| Colonne | Type | Description |
|---------|------|-------------|
| eic | string (PK) | Code EIC |
| displayName | string? | Nom long ou display name ENTSO-E |
| organization | string? | EicDisplayName (utilisé comme organisation) |
| country | string? | MarketParticipantIsoCountryCode |
| function | string? | EicTypeFunctionList |
| refreshedAt | DateTime | Date du batch d'upload |

---

## DangerService — logique des purges

### `purgeImports()`

1. Récupère tous les `Import` avec leur `zipPath`
2. Pour chaque ZIP existant sur disque : `unlinkSync` (best effort)
3. `prisma.import.deleteMany()` (cascade supprime les tables liées : ImportedComponent, ImportedPath, ImportedMessagingStat, ImportedAppProperty)
4. Retourne `{ deletedCount }`

### `purgeOverrides()`

`prisma.componentOverride.deleteMany()`. Retourne `{ deletedCount }`.

### `purgeAll()`

Appelle `purgeImports()` + `purgeOverrides()` + `prisma.entsoeEntry.deleteMany()`. Retourne le count de chacun.

---

## EntsoeService — logique upload

### `upload(buffer)`

1. Parse le CSV ENTSO-E (délimiteur `;`, BOM, trim)
2. `prisma.entsoeEntry.deleteMany()` — remplace entièrement l'annuaire (pas de merge)
3. `prisma.entsoeEntry.createMany()` avec les nouvelles entrées
4. Retourne `{ count, refreshedAt }`

La table `EntsoeEntry` est donc toujours cohérente avec le dernier CSV uploadé (pas de doublons possibles).

### `status()`

Retourne `{ count: number; refreshedAt: string | null }`.

---

## Dépendances

- `PrismaService` — toutes les opérations de purge et upload
- `csv-parse/sync` — parsing du CSV ENTSO-E (EntsoeService)
- `@carto-ecp/shared` — types `PurgeResult`, `ResetAllResult`, `EntsoeStatus`
- `multer` (via `FileInterceptor`) — upload du fichier CSV

---

## Invariants

1. Les purges sont irréversibles. Aucune confirmation n'est requise au niveau API (la confirmation typing-to-confirm est entièrement côté frontend).
2. `purgeImports` supprime aussi les ZIPs sur disque (best effort — pas d'erreur si unlinkSync échoue).
3. L'upload ENTSO-E est un remplacement complet (deleteMany + createMany) : aucune entrée de l'ancien CSV n'est conservée.
4. `EntsoeEntry` constitue le niveau 2 de la cascade dans GraphService, après les ComponentOverride (niveau 1) et avant le registry overlay RTE (niveau 3).
5. La table `EntsoeEntry` peut être vide (aucun upload effectué) — dans ce cas le niveau 2 de la cascade ne contribue pas.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `admin.controller.spec.ts` | Routes purge, routes entsoe, validation upload |
| `danger.service.spec.ts` | purgeImports (best effort unlink), purgeOverrides, purgeAll |
| `entsoe.service.spec.ts` | upload CSV (parse, delete+create), status |

Ref. croisées : [api/graph](../graph/spec-technique.md) — consomme `EntsoeEntry` comme niveau 2 de la cascade. [web/admin](../../web/admin/spec-technique.md) — interface utilisateur zone danger + onglet ENTSO-E.
