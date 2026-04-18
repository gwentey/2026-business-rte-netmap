# Spec Technique — api/ingestion

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/ingestion       |
| Version       | 0.1.1               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 1 remédiation |

---

## Architecture du module

Le module `ingestion` est un pipeline stateless de 5 services NestJS chaînés, orchestré par `IngestionService`. Chaque service a une responsabilité unique et ne partage pas d'état entre les appels.

```
IngestionService.ingest(IngestionInput)
  │
  ├─ 1. ZipExtractorService.extract(buffer)         → ExtractedZip
  │       └─ Map<filename, Buffer> (whitelist appliquée, sensibles exclus)
  │
  ├─ 2. CsvReaderService.readApplicationProperties() → AppPropertyRow[]
  │   CsvReaderService.readComponentDirectory()      → ComponentDirectoryRow[]
  │       └─ Extraction du blob XML (colonne directoryContent[0])
  │
  ├─ 3. XmlMadesParserService.parse(xmlBlob)         → MadesTree
  │       └─ { cdCode, brokers[], endpoints[], componentDirectories[] }
  │          Chaque MadesComponent contient paths[], urls[], certificates[]
  │
  ├─ 4. CsvReaderService.readMessagePaths()          → MessagePathRow[]  (optionnel)
  │   CsvReaderService.readMessagingStatistics()     → MessagingStatisticRow[] (optionnel)
  │
  ├─ 5. NetworkModelBuilderService.build(BuilderInput) → NetworkSnapshot
  │       ├─ Détection componentType (ENDPOINT vs COMPONENT_DIRECTORY)
  │       ├─ Enrichissement registry (resolveComponent par EIC)
  │       ├─ Classification messageType (classifyMessageType)
  │       ├─ Calcul direction IN/OUT (basé sur rteEicSet)
  │       └─ Calcul isExpired (validTo vs Date.now())
  │
  └─ 6. SnapshotPersisterService.persist(snapshot, zipBuffer, label)
          ├─ Écriture zip sur disque (storage/snapshots/{uuid}.zip)
          └─ Transaction Prisma : Snapshot + Components + ComponentUrls
                                  + MessagePaths + MessagingStatistics
                                  + AppProperties (filtrées)
```

### Dépendances injectées

`NetworkModelBuilderService` dépend de `RegistryService` (module `registry`, exporté via `RegistryModule`). `SnapshotPersisterService` dépend de `PrismaService`. Les trois autres services (`ZipExtractorService`, `CsvReaderService`, `XmlMadesParserService`) n'ont aucune dépendance injectée — ce sont des services purs.

`IngestionModule` exporte uniquement `IngestionService` pour les consumers externes (typiquement `SnapshotsController`).

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/src/ingestion/ingestion.service.ts` | Orchestrateur du pipeline — chaîne les 5 services | ~60 |
| `apps/api/src/ingestion/ingestion.module.ts` | Module NestJS — déclare et exporte les providers | ~21 |
| `apps/api/src/ingestion/zip-extractor.service.ts` | Extraction et validation du zip (whitelist, sensibles, taille) | ~64 |
| `apps/api/src/ingestion/csv-reader.service.ts` | Parsing des 4 CSV typés (appProperties, componentDirectory, messagePaths, stats) | ~115 |
| `apps/api/src/ingestion/xml-mades-parser.service.ts` | Parsing du blob XML MADES (fast-xml-parser) | ~130 |
| `apps/api/src/ingestion/network-model-builder.service.ts` | Business logic : détection type, enrichissement, classification, direction | ~163 |
| `apps/api/src/ingestion/snapshot-persister.service.ts` | Écriture zip + transaction Prisma + filtrage AppProperty sensibles | ~136 |
| `apps/api/src/ingestion/types.ts` | Contrats TypeScript internes au pipeline | ~180 |
| `apps/api/src/common/date-parser.ts` | Parser de dates ECP (nanosecondes CSV + millisecondes XML) | ~17 |
| `apps/api/src/common/null-value-normalizer.ts` | Normalisation `NULL_VALUE_PLACEHOLDER` → `null` | ~8 |
| `apps/api/src/common/errors/ingestion-errors.ts` | Hiérarchie d'exceptions typées (5 classes héritant de `IngestionError`) | ~65 |
| `apps/api/src/ingestion/zip-extractor.service.spec.ts` | Tests unitaires ZipExtractor (6 cas) | ~72 |
| `apps/api/src/ingestion/csv-reader.service.spec.ts` | Tests unitaires CsvReader | ~variable |
| `apps/api/src/ingestion/xml-mades-parser.service.spec.ts` | Tests unitaires XmlMadesParser | ~variable |
| `apps/api/src/ingestion/network-model-builder.service.spec.ts` | Tests unitaires NetworkModelBuilder (6 cas) | ~193 |
| `apps/api/test/full-ingestion-endpoint.spec.ts` | Test d'intégration end-to-end backup Endpoint réel | ~69 |
| `apps/api/test/full-ingestion-cd.spec.ts` | Test d'intégration end-to-end backup CD réel | ~55 |
| `apps/api/test/fixtures-loader.ts` | Construction dynamique des zips de fixture à partir des dossiers réels | ~variable |

---

## Schéma BDD (tables écrites par ce module)

| Table | Créations par ingestion | Clé primaire |
|-------|------------------------|--------------|
| `Snapshot` | 1 ligne par ingestion | `id` (UUID v4) |
| `Component` | N lignes (brokers + endpoints + CDs du MADES) | `id` (auto) + FK `snapshotId` |
| `ComponentUrl` | M lignes (URLs AMQPS/HTTPS par composant) | `id` (auto) + FK `componentId` |
| `MessagePath` | P lignes (XML_CD_PATHS + LOCAL_CSV_PATHS) | `id` (auto) + FK `snapshotId` |
| `MessagingStatistic` | Q lignes (depuis `messaging_statistics.csv`) | `id` (auto) + FK `snapshotId` |
| `AppProperty` | R lignes (depuis `application_property.csv`, clés sensibles filtrées) | `id` (auto) + FK `snapshotId` |

Champs notables sur `Snapshot` : `warningsJson` (JSON sérialisé), `componentType` (enum `ENDPOINT` | `COMPONENT_DIRECTORY`), `cdCode` (nullable), `zipPath` (chemin absolu sur disque).

---

## API / Endpoints (point d'entrée du pipeline)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/snapshots` | Upload multipart : champ `zip` (fichier), `label` (string), `envName` (string). Déclenche `IngestionService.ingest()`. | Aucune |

Réponse 201 : `IngestionResult` = `{ snapshotId, componentType, sourceComponentCode, cdCode, warnings[], stats }`.

---

## Patterns identifiés

- **Pipeline pattern stateless** : chaque service reçoit une entrée pure et retourne une sortie pure. Pas d'état partagé entre les étapes. L'orchestrateur (`IngestionService`) est le seul à détenir la séquence.
- **Fail-fast sur erreurs bloquantes, tolérance sur erreurs non bloquantes** : la hiérarchie `IngestionError` (sous-classes typées par code) est levée immédiatement pour les erreurs structurelles. Les anomalies métier (EIC inconnu, messageType non classé) produisent des warnings accumulés dans un tableau. Depuis **Phase 1 (P1-4)**, le cas `component_directory.csv` vide lève une `InvalidUploadException` (HTTP 400 / `INVALID_UPLOAD`) au lieu d'une `Error` native (qui produisait un HTTP 500 opaque).
- **Whitelist de fichiers** : constantes exportées depuis `types.ts` (`REQUIRED_CSV_FILES`, `USABLE_CSV_FILES`, `IGNORED_CSV_FILES`, `SENSITIVE_CSV_FILES`) — la liste est la source de vérité unique utilisée par `ZipExtractorService`.
- **Typed row parsing** : `CsvReaderService` expose des méthodes spécialisées par CSV retournant des types structurés (`AppPropertyRow`, `MessagePathRow`, etc.), avec des helpers privés `str()`, `bool()`, `num()`, `date()` qui normalisent les valeurs nulles et invalides.
- **Enum validation à la lecture** : les valeurs textuelles à domaine fini (`messagePathType`, `transportPattern`) sont validées lors du parsing CSV et nullifiées si hors domaine, plutôt qu'en post-traitement.
- **Transaction compensatoire** : si la transaction Prisma échoue après écriture du zip, le zip est supprimé via `unlink()` avec log d'avertissement en cas d'échec du nettoyage.
- **isArray forcé sur fast-xml-parser** : les éléments XML pouvant être singletons ou tableaux (`broker`, `endpoint`, `componentDirectory`, `network`, `url`, `certificate`, `path`) sont systématiquement forcés en tableau via le callback `isArray`.

---

## Détail des types internes (`types.ts`)

### Contrats d'entrée/sortie du pipeline

| Type | Rôle |
|------|------|
| `IngestionInput` | Entrée de `IngestionService.ingest()` : `{ zipBuffer, label, envName }` |
| `ExtractedZip` | Sortie de `ZipExtractorService` : `{ files: Map<string, Buffer> }` |
| `MadesTree` | Sortie de `XmlMadesParserService` : arbre MADES décodé |
| `MadesComponent` | Un composant MADES (broker/endpoint/CD) avec ses paths, urls, certificates |
| `MadesPath` | Un chemin de message XML : senderComponent, messageType, transportPattern, brokerCode, validity |
| `NetworkSnapshot` | Sortie de `NetworkModelBuilderService` : modèle réseau enrichi complet |
| `ComponentRecord` | Un composant enrichi (EIC + géocode + displayName + process) |
| `MessagePathRecord` | Un chemin de message résolu (direction, process, isExpired, source) |
| `IngestionResult` | Sortie de `SnapshotPersisterService.persist()` : IDs + warnings |

### Constantes de whitelist

| Constante | Contenu |
|-----------|---------|
| `REQUIRED_CSV_FILES` | `application_property.csv`, `component_directory.csv` |
| `USABLE_CSV_FILES` | Les 2 requis + `message_path.csv`, `messaging_statistics.csv`, `message_type.csv`, `message_upload_route.csv` |
| `IGNORED_CSV_FILES` | `component_statistics.csv`, `synchronized_directories.csv`, `pending_edit_directories.csv`, `pending_removal_directories.csv` |
| `SENSITIVE_CSV_FILES` | `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` |

---

## Hiérarchie d'erreurs

```
HttpException
  └─ IngestionError (code: string, context?: Record<string, unknown>)
       ├─ InvalidUploadException       → HTTP 400, code INVALID_UPLOAD
       ├─ MissingRequiredCsvException  → HTTP 400, code MISSING_REQUIRED_CSV
       ├─ UnknownMadesNamespaceException → HTTP 400, code UNKNOWN_MADES_NAMESPACE
       ├─ PayloadTooLargeException     → HTTP 413, code PAYLOAD_TOO_LARGE
       └─ SnapshotNotFoundException    → HTTP 404, code SNAPSHOT_NOT_FOUND
```

Toutes les erreurs incluent un champ `timestamp` ISO dans le corps de réponse.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/src/ingestion/zip-extractor.service.spec.ts` | 6 cas unitaires : whitelist, exclusion sensibles, fichiers manquants, zip corrompu, taille max | Existant |
| `apps/api/src/ingestion/csv-reader.service.spec.ts` | Parsing des 4 types de CSV | Existant |
| `apps/api/src/ingestion/xml-mades-parser.service.spec.ts` | Parsing XML MADES (namespace, paths, isArray) | Existant |
| `apps/api/src/ingestion/network-model-builder.service.spec.ts` | 6 cas : détection type, enrichissement RTE, direction IN/OUT, classification, warnings, isExpired | Existant |
| `apps/api/test/full-ingestion-endpoint.spec.ts` | Test d'intégration end-to-end contre le backup réel ECP-INTERNET-2 (Endpoint) | Existant |
| `apps/api/test/full-ingestion-cd.spec.ts` | Test d'intégration end-to-end contre le backup réel RTE CD | Existant |
| `apps/api/src/ingestion/snapshot-persister.service.spec.ts` | — | Absent |

### Particularités des tests d'intégration

- Utilisent `fileParallelism: false` (vitest config) car ils partagent le fichier SQLite `dev.db`.
- Le cleanup en `beforeAll` et `afterAll` est scopé au `sourceComponentCode` du backup testé, évitant les interférences cross-test.
- `fixtures-loader.ts` reconstruit dynamiquement un zip à partir des dossiers de fixtures réels (`tests/fixtures/17V.../`), en excluant les fichiers sensibles gitignorés.
- Les tests d'intégration vérifient : componentType détecté, codes EIC corrects, présence d'au moins un node dans le graphe, coordonnées géographiques finies, absence de clés sensibles en base.
