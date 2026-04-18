# Spec Technique — api/snapshots

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/snapshots       |
| Version       | 0.2.0               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 2 remédiation |

---

## Architecture du module

Le module `SnapshotsModule` est un module NestJS standard composé de deux classes et d'un module annexe importé :

- `SnapshotsController` — reçoit les requêtes HTTP, applique les validations d'entrée (MIME, magic bytes, Zod), et délègue vers `IngestionService` (POST) ou `SnapshotsService` (GET).
- `SnapshotsService` — couche de lecture Prisma : mappe les lignes SQLite en DTOs `SnapshotSummary` / `SnapshotDetail`, avec parsing défensif des warnings JSON.
- `IngestionModule` est importé pour rendre `IngestionService` injectable dans le controller.

`SnapshotsModule` exporte `SnapshotsService` (consommé par `GraphModule` pour les accès au snapshot dans l'endpoint graph).

```
HTTP Request
    │
    ▼
SnapshotsController
    ├── [POST /api/snapshots]
    │       ├── FileInterceptor (Multer memoryStorage, MIME allowlist, 50 MB limit)
    │       ├── magic bytes check (PK\x03\x04)
    │       ├── Zod validation (createSnapshotSchema)
    │       └── IngestionService.ingest() → SnapshotsService.detail()
    │
    ├── [GET /api/snapshots]
    │       └── SnapshotsService.list(envName?)
    │
    └── [GET /api/snapshots/:id]
            └── SnapshotsService.detail(id)
                        │
                        └── PrismaService.snapshot.findUnique (with _count)
```

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/src/snapshots/snapshots.controller.ts` | Controller NestJS — 3 endpoints REST, validation multipart | ~84 |
| `apps/api/src/snapshots/snapshots.service.ts` | Service lecture Prisma — list + detail + safeParseWarnings | ~63 |
| `apps/api/src/snapshots/snapshots.module.ts` | Déclaration du module NestJS | ~12 |
| `apps/api/src/snapshots/dto/create-snapshot.dto.ts` | Schéma Zod pour label + envName | ~8 |
| `packages/shared/src/snapshot.ts` | Types partagés : `SnapshotSummary`, `SnapshotDetail`, `Warning`, `ComponentType` | ~28 |
| `apps/api/src/common/errors/ingestion-errors.ts` | Exceptions typées utilisées : `InvalidUploadException`, `SnapshotNotFoundException` | ~64 |

---

## Schéma BDD

Table principale utilisée : `Snapshot`

| Colonne               | Type SQL   | Description                                      |
|-----------------------|------------|--------------------------------------------------|
| `id`                  | TEXT (PK)  | UUID généré à la persistance                     |
| `label`               | TEXT       | Label saisi par l'utilisateur                    |
| `envName`             | TEXT       | Nom d'environnement (ex. OPF, PROD)              |
| `componentType`       | TEXT       | `ENDPOINT` ou `COMPONENT_DIRECTORY`              |
| `sourceComponentCode` | TEXT       | Code EIC du composant source                     |
| `cdCode`              | TEXT?      | Code EIC du CD associé (null si type = CD)       |
| `organization`        | TEXT?      | Organisation résolue par le registry             |
| `uploadedAt`          | DATETIME   | Horodatage de l'upload                           |
| `zipPath`             | TEXT       | Chemin relatif vers le zip archivé               |
| `warningsJson`        | TEXT       | Tableau JSON de `Warning[]` — peut être corrompu |

Relations utilisées via `_count` dans `detail()` :

| Relation          | Table cible        | Alias exposé        |
|-------------------|--------------------|---------------------|
| `components`      | `Component`        | `componentsCount`   |
| `messagePaths`    | `MessagePath`      | `pathsCount`        |
| `messagingStats`  | `MessagingStatistic` | `statsCount`      |

---

## API / Endpoints

| Méthode | Route                  | Description                                                    | Auth    | Code succès |
|---------|------------------------|----------------------------------------------------------------|---------|-------------|
| POST    | `/api/snapshots`       | Upload multipart (zip + label + envName) — déclenche ingestion | Aucune  | 201         |
| GET     | `/api/snapshots`       | Liste des snapshots, filtre optionnel `?envName=`              | Aucune  | 200         |
| GET     | `/api/snapshots/:id`   | Détail d'un snapshot avec counts et warnings parsés            | Aucune  | 200         |

### POST /api/snapshots — détail technique

- **Content-Type** : `multipart/form-data`
- **Champs form** :
  - `zip` (file) — le fichier zip, max 50 MB
  - `label` (text) — 1–200 caractères après trim
  - `envName` (text) — 1–50 caractères après trim
- **Storage Multer** : `memoryStorage()` — le buffer est gardé en RAM, jamais écrit sur disque par Multer (c'est `SnapshotPersisterService` qui archive le zip dans `storage/snapshots/`)
- **MIME allowlist** : `application/zip | application/x-zip-compressed | application/octet-stream`
- **Magic bytes** : `[0x50, 0x4B, 0x03, 0x04]` — vérification sur `file.buffer.subarray(0, 4)`
- **Réponse** : `SnapshotDetail` complet (même shape que `GET /api/snapshots/:id`)

### GET /api/snapshots — détail technique

- **Query param** : `envName` (string, optionnel) — filtre exact sur le champ `envName`
- **Tri** : `uploadedAt DESC`
- **Réponse** : `SnapshotSummary[]`

### GET /api/snapshots/:id — détail technique

- **Path param** : `id` (string UUID)
- **Requête Prisma** : `findUnique` avec `include: { _count: { select: { components, messagePaths, messagingStats } } }`
- **Réponse** : `SnapshotDetail` avec `stats` et `warnings[]`
- **Erreur 404** : `SnapshotNotFoundException` si `findUnique` retourne `null`

---

## Gestion des erreurs

| Exception                   | Code HTTP | Code métier           | Déclencheur                                      |
|-----------------------------|-----------|-----------------------|--------------------------------------------------|
| `InvalidUploadException`    | 400       | `INVALID_UPLOAD`      | MIME non autorisé, magic bytes invalides, Zod KO, fichier absent |
| `SnapshotNotFoundException` | 404       | `SNAPSHOT_NOT_FOUND`  | `findUnique` retourne `null`                     |
| `PayloadTooLargeException`  | 413       | `PAYLOAD_TOO_LARGE`   | Fichier > 50 MB (levée par Multer limits)        |

Toutes ces exceptions étendent `IngestionError` → `HttpException` NestJS. Le body de réponse contient `{ code, message, context, timestamp }`.

---

## `safeParseWarnings` — comportement défensif

```typescript
private safeParseWarnings(json: string): Warning[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as Warning[]) : [];
  } catch {
    return [];
  }
}
```

- `JSON.parse` peut lever si `warningsJson` est corrompu → capturé, retourne `[]`
- Si le JSON est valide mais n'est pas un tableau → retourne `[]`
- Utilisé dans `list()` (pour `warningCount`) et dans `detail()` (pour `warningCount` + `warnings[]`)

---

## Patterns identifiés

- **Controller mince / Service lecture** : toute la logique métier de création est déléguée à `IngestionService`. `SnapshotsService` ne fait que des lectures Prisma sans logique métier.
- **Validation en couches** : trois niveaux successifs avant d'appeler `IngestionService` — MIME (Multer fileFilter), magic bytes (controller), champs texte (Zod).
- **Défense en profondeur sur la désérialisation JSON** : `warningsJson` en base peut être n'importe quelle chaîne — `safeParseWarnings` garantit un tableau sans jamais lever d'exception.
- **DTO Zod sans class-validator** : le projet n'utilise pas `class-validator` / `class-transformer`. La validation se fait via un schéma Zod instancié directement dans le DTO et appelé manuellement avec `safeParse`.
- **`memoryStorage` Multer** : choix délibéré pour garder le buffer zip en mémoire jusqu'à la fin de l'ingestion, plutôt que de l'écrire dans un répertoire temp. L'archivage définitif est fait par `SnapshotPersisterService`.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/test/full-ingestion-endpoint.spec.ts` | `POST /api/snapshots` avec fixture Endpoint réel — vérifie HTTP 201, `componentType`, `sourceComponentCode`, `cdCode`, `stats.componentsCount` | Existant |
| `apps/api/test/full-ingestion-cd.spec.ts` | `POST /api/snapshots` avec fixture CD réel — pipeline complète | Existant |
| `apps/api/src/snapshots/snapshots.controller.spec.ts` | **[P2-1]** Rejet MIME invalide (415), magic bytes erronés (400), label vide (400), fichier absent (400), upload nominal (201) — tests unitaires avec NestJS `supertest` et Prisma mocké | Ajouté Phase 2 |
| `apps/api/src/snapshots/snapshots.service.spec.ts` | **[P2-1]** `list()` retourne tableau vide, `list()` avec filtre `envName`, `detail()` cas nominal avec counts, `detail()` retourne 404 sur snapshot inexistant, `safeParseWarnings` sur JSON corrompu | Ajouté Phase 2 |
