# RETRO-001 — Pipeline d'ingestion en 5 services stateless chaînés

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-001                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

Le cœur de l'application est la transformation d'un zip de backup ECP en données persistées exploitables par la carte. Cette transformation implique plusieurs étapes hétérogènes (extraction binaire, parsing CSV, parsing XML, enrichissement métier, persistance) qui nécessitent une organisation claire pour être testables et maintenables.

## Décision identifiée

Le pipeline est découpé en 5 services NestJS stateless à responsabilité unique : `ZipExtractorService`, `CsvReaderService`, `XmlMadesParserService`, `NetworkModelBuilderService`, `SnapshotPersisterService`. Un sixième service, `IngestionService`, orchestre la séquence et est le seul point d'entrée exporté par `IngestionModule`. Chaque service peut être instancié et testé de façon isolée, sans dépendances croisées entre eux (sauf `NetworkModelBuilderService` qui dépend de `RegistryService`).

## Conséquences observées

### Positives
- Testabilité maximale : les 4 services sans injection (ZipExtractor, CsvReader, XmlMadesParser) s'instancient directement dans les tests unitaires sans `Test.createTestingModule`.
- Responsabilités claires : chaque service correspond à une frontière technologique (binaire zip, texte CSV, texte XML, logique métier, IO).
- Évolutivité : une nouvelle étape de transformation peut être insérée dans le pipeline sans modifier les autres.

### Négatives / Dette
- L'orchestration dans `IngestionService.ingest()` est purement impérative (appels séquentiels synchrones). Une erreur dans une étape intermédiaire lève une exception qui remonte sans retry ni compensation automatique (sauf le nettoyage du zip dans `SnapshotPersisterService`).
- `message_type.csv` et `message_upload_route.csv` sont dans la whitelist mais n'ont aucun service lecteur associé — le découpage anticipe des features non encore implémentées.

## Recommandation

Garder. Le pattern est adapté à la complexité actuelle et au volume prévu (slice #1, dev-local, < 10 utilisateurs). Si le pipeline devient concurrent ou asynchrone dans un slice futur, envisager un pattern Command/Handler ou une queue de traitement.
