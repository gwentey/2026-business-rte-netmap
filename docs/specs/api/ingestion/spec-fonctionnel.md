# Spec Fonctionnelle — api/ingestion

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/ingestion                   |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-001](../../../adr/RETRO-001-pipeline-stateless-5-services.md) | Pipeline d'ingestion en services stateless chaînés | Documenté (rétro) |
| [RETRO-002](../../../adr/RETRO-002-parsing-tolerant-warnings-vs-erreurs-bloquantes.md) | Parsing tolérant : warnings non bloquants vs erreurs bloquantes | Documenté (rétro) |
| [RETRO-003](../../../adr/RETRO-003-exclusion-fichiers-sensibles-whitelist.md) | Sécurité : exclusion des fichiers et clés sensibles par whitelist | Documenté (rétro) |
| [ADR-030](../../../adr/ADR-030-dump-type-detector-heuristique.md) | DumpTypeDetector heuristique | Actif |
| [ADR-031](../../../adr/ADR-031-dump-type-detector-v2-signatures-csv.md) | DumpTypeDetector v2 signatures CSV | Actif |
| [ADR-032](../../../adr/ADR-032-parser-cd-via-csv-path-reader.md) | Parser CD via CsvPathReader | Actif |
| [ADR-033](../../../adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md) | Batch upload best-effort par fichier | Actif |
| [ADR-035](../../../adr/ADR-035-dumptype-immutable-post-ingest.md) | dumpType immuable post-ingestion | Actif |

---

## Contexte et objectif

Le module `ingestion` est le chemin critique de l'application. Il reçoit un fichier ZIP de backup ECP et produit en sortie un import persisté en base contenant les données brutes (composants, chemins, stats). En v2.0, les trois types de dumps ECP sont supportés : Endpoint, Component Directory et Broker. L'enrichissement géographique n'est plus effectué à l'ingestion — il se fait à la lecture dans `GraphService` (compute-on-read).

---

## Règles métier

1. **Détection automatique du type de dump.** Le type (ENDPOINT, COMPONENT_DIRECTORY, BROKER) est détecté automatiquement depuis les fichiers présents dans le ZIP. L'utilisateur peut forcer le type via le paramètre `dumpType`.

2. **Import BROKER accepté sans extraction.** Un dump Broker est accepté avec un warning. Il ne produit pas de composants ni de chemins (la base SQL du broker n'est pas exposée dans le dump).

3. **Fichiers sensibles jamais lus ni stockés.** `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` sont exclus de l'extraction mémoire. Le ZIP repackagé sur disque n'en contient pas.

4. **Clés de configuration sensibles filtrées.** Les propriétés d'application contenant `password`, `secret`, `keystore.password`, `privateKey` ou `credentials` sont supprimées avant persistance.

5. **Parsing tolérant.** Les CSV optionnels malformés produisent un warning structuré mais n'annulent pas l'import.

6. **Namespace MADES obligatoire pour le XML.** Le blob XML dans `component_directory.csv` doit contenir le namespace `http://mades.entsoe.eu/componentDirectory`. Un namespace absent est une erreur bloquante (HTTP 400).

7. **Déduplication CSV vs XML pour les dumps ENDPOINT.** Les composants présents à la fois dans le CSV `component_directory.csv` (identification basique) et dans les blobs XML MADES (données riches) sont mergés par EIC, avec la version XML en priorité.

8. **Transaction atomique.** Toutes les insertions en base se font dans une seule transaction Prisma. En cas d'échec, le ZIP déjà écrit sur disque est supprimé.

9. **effectiveDate extraite du nom de fichier.** Le format standard ECP `{EIC}_{TIMESTAMP}Z.zip` permet d'extraire la date du dump. Si le nom ne correspond pas, `effectiveDate = now`.

10. **Deux formats de date coexistants.** CSV : ISO avec nanosecondes sans Z. XML : ISO avec Z et millisecondes. Les deux sont normalisés à la milliseconde.

11. **Normalisation des valeurs nulles CSV.** La chaîne `NULL_VALUE_PLACEHOLDER` dans les CSV est normalisée en `null`.

12. **Paths ENDPOINT lus aussi depuis `message_path.csv` local.** Pour un dump ENDPOINT, les paths sont extraits à la fois du XML MADES (déduit du CD) et du CSV `message_path.csv` local. Ces deux sources sont dédupliquées via la clé 5-champs `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)` avec XML prioritaire — le CSV ne fait qu'ajouter les paths absents du XML. Les rows `messagePathType === 'ACKNOWLEDGEMENT'`, `status === 'INVALID'` ou `applied === false` sont ignorées à l'ingestion. Les `allowedSenders` multi-EIC (séparés par `;`) sont explosés en N paths (1 par sender). Wildcards (`*` en sender ou receiver) exclus à l'ingestion.

---

## Cas d'usage

### CU-001 — Import d'un dump Endpoint

**Flux** : ZIP soumis -> détection ENDPOINT (messaging_statistics.csv présent) -> extraction CSV (application_property + component_directory + messaging_statistics + message_path + message_upload_route) + parsing XML blobs MADES -> construction BuiltImport (merge XML/CSV des paths, XML prioritaire) -> persistance -> `ImportDetail` retourné.

### CU-002 — Import d'un dump Component Directory

**Flux** : ZIP soumis -> détection COMPONENT_DIRECTORY (synchronized_directories.csv présent) -> extraction CSV (component_directory + message_path) -> construction via CsvPathReader -> persistance -> `ImportDetail` retourné.

### CU-003 — Import d'un dump Broker

**Flux** : ZIP soumis -> détection BROKER (broker.xml présent) -> import persisté sans composants/chemins + warning `BROKER_DUMP_METADATA_ONLY` -> `ImportDetail` retourné.

### CU-004 — Rejet d'un ZIP invalide

**Flux alternatif** : ZIP corrompu -> `INVALID_UPLOAD` 400. MIME invalide -> `INVALID_MIME` 400. Magic bytes invalides -> `INVALID_MAGIC` 400. Taille > 50 MB -> 413.

### CU-005 — Import tolérant avec warnings

Si des erreurs non bloquantes surviennent (CSV optionnel malformé, XML blob invalide dans une ligne), l'import continue et les warnings sont inclus dans la réponse et persistés dans `warningsJson`.

---

## Dépendances

- **api/registry** — résolution géographique (via ImportBuilderService)
- **api/graph** — consomme les données persistées par ce module
- **packages/shared** — types `Warning`, `ImportDetail`, `InspectResult`
- **packages/registry** — données de référence (CSV ENTSO-E + overlay JSON RTE)
