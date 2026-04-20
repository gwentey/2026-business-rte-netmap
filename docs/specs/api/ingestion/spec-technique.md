# Spec Technique — api/ingestion

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/ingestion                   |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `ingestion` gère l'ensemble du pipeline d'import de dumps ECP. En v2.0, il expose directement les routes HTTP (le contrôleur est dans ce module), orchestre la détection de type, route vers le bon parser selon le `dumpType`, construit le modèle brut et persiste les données. Il n'y a plus de table Snapshot globale : chaque import persiste ses données brutes dans `Import`, `ImportedComponent`, `ImportedPath`, `ImportedMessagingStat` et `ImportedAppProperty`.

### Services et responsabilités

| Service | Fichier | Rôle |
|---------|---------|------|
| `ImportsController` | `imports.controller.ts` | Routes HTTP : POST, POST inspect, GET, DELETE, PATCH |
| `ImportsService` | `imports.service.ts` | Orchestrateur : détection type, routing parsers, construction BuiltImport, délégation à RawPersister |
| `DumpTypeDetector` (fonction) | `dump-type-detector.ts` | Détection heuristique type de dump par fichiers CSV présents dans le ZIP |
| `ZipExtractorService` | `zip-extractor.service.ts` | Extraction ZIP en mémoire, whitelist, exclusion sensibles |
| `CsvReaderService` | `csv-reader.service.ts` | Parsing CSV : application_property, component_directory, message_path, messaging_statistics |
| `CsvPathReaderService` | `csv-path-reader.service.ts` | Parsing chemins de messages dans un dump CD (explode senders x receivers) |
| `XmlMadesParserService` | `xml-mades-parser.service.ts` | Parsing blob XML MADES (namespace ENTSO-E) : composants, brokers, chemins |
| `ImportBuilderService` | `import-builder.service.ts` | Construction `BuiltImport` : `buildFromLocalCsv`, `buildFromXml`, `buildFromCdCsv`, `buildAppProperties`, `buildMessagingStats` |
| `RawPersisterService` | `raw-persister.service.ts` | Repackage ZIP (sans sensibles), écriture disque, transaction Prisma atomique |
| `FilenameParser` (fonction) | `filename-parser.ts` | Extraction `sourceComponentEic` + `sourceDumpTimestamp` depuis le nom de fichier |

### Routing par dumpType

```
ZIP reçu
  -> ZipExtractorService.listEntries()
  -> detectDumpType(entries, overrideOptional)
       ENDPOINT          -> extract() -> CSV (component_directory + app_property + messaging_stats optionnel)
                           + XML blobs MADES dans chaque ligne component_directory.csv
       COMPONENT_DIRECTORY -> extract() -> CSV (component_directory + message_path + app_property)
       BROKER            -> metadata-only (aucune extraction, warning BROKER_DUMP_METADATA_ONLY)
  -> ImportBuilderService (3 méthodes selon type)
  -> RawPersisterService.persist(builtImport, zipBuffer)
```

### Détection du type de dump (`detectDumpType`)

Heuristique par fichiers exclusifs présents dans le ZIP (ADR-031) :

| Fichier présent | Type | Confiance |
|----------------|------|-----------|
| `synchronized_directories.csv` | COMPONENT_DIRECTORY | HIGH |
| `component_statistics.csv` | COMPONENT_DIRECTORY | HIGH |
| `pending_edit_directories.csv` ou `pending_removal_directories.csv` | COMPONENT_DIRECTORY | HIGH |
| `messaging_statistics.csv` | ENDPOINT | HIGH |
| `message_upload_route.csv` | ENDPOINT | HIGH |
| `broker.xml` ou `bootstrap.xml` | BROKER | HIGH |
| `component_directory.csv` seul | COMPONENT_DIRECTORY | FALLBACK |
| Aucune signature reconnue | COMPONENT_DIRECTORY | FALLBACK |
| Override explicite via body `dumpType` | Valeur fournie | HIGH |

---

## Interfaces

### Routes HTTP (préfixe `/api`)

| Méthode | Chemin | Description | Réponse |
|---------|--------|-------------|---------|
| POST | /api/imports | Import un ZIP (1 fichier) | `ImportDetail` |
| POST | /api/imports/inspect | Inspecte N ZIPs sans persister | `InspectResult[]` |
| GET | /api/imports | Liste les imports (`?env=` optionnel) | `ImportDetail[]` |
| DELETE | /api/imports/:id | Supprime un import + ZIP sur disque | 204 |
| PATCH | /api/imports/:id | Modifie label ou effectiveDate | `ImportDetail` |

### Body POST /api/imports (multipart/form-data)

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| file | File (ZIP, max 50 MB) | Oui | Le dump ECP |
| envName | string (1-64) | Oui | Nom de l'environnement |
| label | string (1-256) | Oui | Label libre |
| dumpType | 'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER' | Non | Override de détection |
| replaceImportId | UUID | Non | Remplacer un import existant (même env obligatoire) |

Validations supplémentaires : MIME `application/zip` ou `application/x-zip-compressed`, magic bytes `50 4B 03 04`.

### Body POST /api/imports/inspect (multipart/form-data)

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| files | File[] (ZIP, max 20 x 50 MB) | Oui | Dumps à inspecter |
| envName | string | Non | Pour détecter les doublons dans cet env |

### Body PATCH /api/imports/:id (JSON strict)

Au moins un champ parmi : `label` (string 1-256), `effectiveDate` (ISO 8601 datetime).

### Types internes (`ingestion/types.ts`)

| Type | Rôle |
|------|------|
| `DumpType` | `'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER'` |
| `BuiltImport` | Objet complet avant persistance (components, paths, messagingStats, appProperties, warnings) |
| `BuiltImportedComponent` | Composant brut avant cascade géographique (lat/lng peuvent être null) |
| `BuiltImportedPath` | Chemin de message brut (receiverEic, senderEic, messageType, transportPattern...) |
| `BuiltImportedMessagingStat` | Statistique de connexion (sourceEndpointCode, remoteComponentCode, lastMessageUp...) |
| `MadesTree` | Arbre MADES décodé (cdCode, brokers, endpoints, componentDirectories) |
| `MadesComponent` | Composant MADES avec paths, urls, certificates |

Constantes de whitelist :

| Constante | Contenu |
|-----------|---------|
| `REQUIRED_CSV_FILES` | `application_property.csv`, `component_directory.csv` |
| `USABLE_CSV_FILES` | Les 2 requis + `message_path.csv`, `messaging_statistics.csv` |
| `IGNORED_CSV_FILES` | `component_statistics.csv`, `synchronized_directories.csv`, `pending_edit_directories.csv`, `pending_removal_directories.csv` |
| `SENSITIVE_CSV_FILES` | `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` |

---

## Dépendances

- `PrismaService` — accès SQLite (via RawPersisterService)
- `RegistryService` — résolution géographique (via ImportBuilderService)
- `adm-zip` — extraction et repackage du ZIP
- `csv-parse/sync` — parsing CSV (délimiteur `;`)
- `fast-xml-parser` — parsing XML MADES
- `node:crypto` — SHA256 du ZIP brut pour déduplication
- `@carto-ecp/shared` — types `ImportDetail`, `ImportSummary`, `InspectResult`, `Warning`

---

## Invariants

1. Les fichiers `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` ne sont jamais chargés en mémoire ni persistés. Le ZIP repackagé sur disque en exclut également le contenu.
2. Les clés AppProperty correspondant à `/password|secret|keystore\.password|privateKey|credentials/i` sont filtrées avant `createMany`.
3. La transaction Prisma est atomique : en cas d'échec, le ZIP déjà écrit sur disque est supprimé (best effort, avec log si `unlinkSync` échoue).
4. Un import BROKER est accepté sans extraire composants/paths (tables `importedComponents` et `importedPaths` restent vides pour cet import, warning `BROKER_DUMP_METADATA_ONLY` produit).
5. `effectiveDate` = `sourceDumpTimestamp` (extrait du nom de fichier si pattern `{EIC}_{TIMESTAMP}Z`) ou `new Date()` si le nom ne correspond pas au pattern.
6. Déduplication dans inspect : priorité `(sourceComponentEic, sourceDumpTimestamp)` dans l'env puis fallback `fileHash`.
7. `replaceImportId` doit appartenir au même `envName` sinon erreur `REPLACE_IMPORT_MISMATCH`.
8. Déduplication CSV vs XML pour les composants ENDPOINT : XML prend la priorité par EIC (données plus riches).
9. Pour un dump ENDPOINT, les composants XML vus dans les blobs MADES de chaque ligne `component_directory.csv` sont mergés ; les blobs non-XML sont ignorés silencieusement.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `imports.controller.spec.ts` | Validation body/MIME/magic bytes, routing, réponses HTTP |
| `imports.service.spec.ts` | Orchestration, doublons, replace, BROKER metadata-only |
| `dump-type-detector.spec.ts` | Toutes les heuristiques (HIGH + FALLBACK, override) |
| `csv-path-reader.service.spec.ts` | Parsing chemins CD depuis CSV |
| `import-builder.service.spec.ts` | buildFromLocalCsv, buildFromXml, buildFromCdCsv, buildAppProperties |
| `raw-persister.service.spec.ts` | Transaction atomique, repackage ZIP, nettoyage compensatoire |
| `zip-extractor.service.spec.ts` | Whitelist, exclusion sensibles, listEntries |
| `xml-mades-parser.service.spec.ts` | Parsing namespace MADES, brokers/endpoints/CDs/paths |
| `filename-parser.spec.ts` | Extraction EIC + timestamp depuis noms de fichiers |
| `csv-reader.service.spec.ts` | Parsing CSV tolérant, NULL_VALUE_PLACEHOLDER, formats dates |

Ref. croisées : [api/imports](../imports/spec-technique.md) est le module consommateur des routes exposées ici (ils partagent le même dossier src/ingestion). [api/graph](../graph/spec-technique.md) consomme les données persistées.
