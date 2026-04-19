# Spec Fonctionnelle — api/ingestion [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/ingestion       |
| Version    | 0.1.0               |
| Date       | 2026-04-17          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-001](../../../adr/RETRO-001-pipeline-stateless-5-services.md) | Pipeline d'ingestion en 5 services stateless chaînés | Documenté (rétro) |
| [RETRO-002](../../../adr/RETRO-002-parsing-tolerant-warnings-vs-erreurs-bloquantes.md) | Parsing tolérant : warnings non bloquants vs erreurs bloquantes | Documenté (rétro) |
| [RETRO-003](../../../adr/RETRO-003-exclusion-fichiers-sensibles-whitelist.md) | Sécurité : exclusion des fichiers et clés sensibles par whitelist | Documenté (rétro) |
| [RETRO-004](../../../adr/RETRO-004-classification-message-type-a-l-ingestion.md) | Classification messageType résolue à l'ingestion pour reproductibilité historique | Documenté (rétro) |
| [RETRO-005](../../../adr/RETRO-005-direction-in-out-rte-eic-set-autoritatif.md) | Direction IN/OUT basée sur le set EIC RTE autoritatif (overlay), pas sur le préfixe 17V | Documenté (rétro) |
| [RETRO-006](../../../adr/RETRO-006-transaction-prisma-avec-nettoyage-zip-compensatoire.md) | Transaction Prisma atomique avec nettoyage zip compensatoire en cas d'échec | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `ingestion` est le chemin critique de l'application Carto ECP. Il reçoit un fichier zip de backup ECP (issu d'un Endpoint ou d'un Component Directory) et produit, en sortie, un snapshot persisté en base SQLite enrichi de coordonnées géographiques, de processus métier classifiés et de statistiques de messagerie. L'objectif est de transformer un export opaque d'infrastructure ECP en données exploitables par la carte Leaflet, sans jamais se connecter aux ECP réels (contrainte d'isolation réseau).

---

## Règles métier (déduites du code)

1. **Fichiers obligatoires** : tout zip soumis doit contenir `application_property.csv` et `component_directory.csv`. L'absence de l'un ou l'autre bloque l'ingestion avec une erreur `MISSING_REQUIRED_CSV` (HTTP 400).

2. **Fichiers sensibles jamais lus** : `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` sont explicitement exclus du chargement en mémoire, même s'ils sont présents dans le zip. Ils peuvent rester sur disque dans le zip archivé mais ne sont jamais parsés ni persistés.

3. **Limite de taille par entrée zip** : toute entrée individuelle décompressée dépassant 50 MB provoque une erreur `PAYLOAD_TOO_LARGE` (HTTP 413). La limite porte sur chaque fichier individuellement, pas sur le zip total.

4. **Whitelist de fichiers** : seuls les fichiers listés dans `USABLE_CSV_FILES` et `IGNORED_CSV_FILES` sont chargés en mémoire depuis le zip. Tout autre fichier est ignoré silencieusement.

5. **Parsing tolérant des CSV** : un CSV mal formé (erreur de parse) ne bloque pas l'ingestion — il produit un tableau vide et un warning loggé. Cette règle s'applique à `message_path.csv` et `messaging_statistics.csv` qui sont optionnels ; leur absence résulte simplement en listes vides.

6. **Namespace MADES obligatoire** : le blob XML dans `component_directory.csv` doit contenir le namespace `http://mades.entsoe.eu/componentDirectory`. Un namespace absent ou inconnu est la seule erreur bloquante au niveau XML (`UNKNOWN_MADES_NAMESPACE`, HTTP 400).

7. **Détection automatique du type de backup** : le `componentType` (`ENDPOINT` ou `COMPONENT_DIRECTORY`) est déterminé en comparant `ecp.componentCode` (depuis `application_property.csv`) à la liste des `componentDirectory.code` et au `cdCode` du XML MADES. Si le code source apparaît dans cette liste, c'est un backup CD ; sinon c'est un Endpoint.

8. **Clé `ecp.componentCode` obligatoire** : son absence dans `application_property.csv` bloque l'ingestion (`INVALID_UPLOAD`, HTTP 400). Toutes les autres clés de configuration sont optionnelles.

9. **Enrichissement géographique par cascade 4 niveaux** : chaque composant EIC est résolu via `RegistryService.resolveComponent` selon la cascade : overlay RTE > overlay CD > ENTSO-E + géocode organisation > ENTSO-E + géocode pays > position Bruxelles par défaut. Un composant résolu en position Bruxelles produit un warning `EIC_UNKNOWN_IN_REGISTRY`.

10. **Classification messageType à l'ingestion** : la classification `messageType → processus métier` est effectuée une fois lors du build du modèle réseau et stockée en base. Elle n'est jamais recalculée à l'affichage. Un messageType non classé génère un warning `MESSAGE_TYPE_UNCLASSIFIED` et reçoit le processus `UNKNOWN`. La cascade est : correspondance exacte > regex > `UNKNOWN`.

11. **Sens IN/OUT basé sur le registry RTE autoritatif** : la direction d'un chemin de message est `IN` si le `receiverEic` appartient à l'ensemble `overlay.rteEndpoints[*].eic` ∪ `overlay.rteComponentDirectory.eic`, sinon `OUT`. La heuristique de préfixe `17V` n'est **pas** utilisée.

12. **Expiration des chemins de message** : un `MessagePath` est marqué `isExpired = true` si `validTo` est renseignée et inférieure à l'heure de construction du snapshot (`Date.now()` au moment du `build()`).

13. **Deux sources de chemins de message** : les chemins issus du XML MADES (`XML_CD_PATHS`) et ceux issus du CSV local `message_path.csv` (`LOCAL_CSV_PATHS`) sont concaténés. Les chemins XML portent uniquement sur les endpoints du MADES ; les chemins CSV locaux sont filtrés (receiver, messageType et transportPattern doivent être non nuls).

14. **Filtrage des AppProperty sensibles avant persistance** : les clés correspondant à la regex `/password|secret|keystore\.password|privateKey|credentials/i` sont exclues du `createMany` en base. Elles sont présentes dans le zip archivé mais absentes de la base.

15. **Transaction Prisma atomique** : toutes les créations en base (Snapshot, Components, ComponentUrls, MessagePaths, MessagingStatistics, AppProperties) se font dans une seule transaction. En cas d'échec, le zip déjà écrit sur disque est supprimé (avec log d'avertissement si la suppression échoue elle-même).

16. **Archivage du zip original** : le zip soumis est écrit sur disque dans `storage/snapshots/{uuid}.zip` avant la transaction Prisma, permettant un re-parsing éventuel ultérieur.

17. **Normalisation des valeurs nulles CSV** : la chaîne littérale `NULL_VALUE_PLACEHOLDER` dans les CSV est normalisée en `null` natif avant tout traitement.

18. **Deux formats de date coexistants** : les CSV utilisent un format ISO avec nanosecondes et sans suffixe Z (ex. `2025-03-12T15:34:48.560980651`) ; le XML utilise ISO avec Z et millisecondes (ex. `2025-03-18T15:00:00.000Z`). Les deux sont gérés par un parser commun qui tronque la précision à la milliseconde.

---

## Cas d'usage (déduits)

### CU-001 — Ingestion d'un backup Endpoint

**Acteur** : système (déclenché via POST `/api/snapshots` par l'utilisateur web)

**Préconditions** : le zip contient `application_property.csv` avec `ecp.componentCode` référençant un Endpoint (absent de la liste `componentDirectory` du XML MADES), et `component_directory.csv` avec un blob XML MADES valide.

**Flux principal** :
1. `ZipExtractorService.extract()` valide le zip, charge les fichiers whitelistés, exclut les fichiers sensibles.
2. `CsvReaderService.readApplicationProperties()` parse `application_property.csv`.
3. `CsvReaderService.readComponentDirectory()` extrait le blob XML depuis la première ligne de `component_directory.csv`.
4. `XmlMadesParserService.parse()` décode l'arbre MADES (brokers, endpoints, componentDirectories, chemins).
5. `CsvReaderService.readMessagePaths()` et `readMessagingStatistics()` parsent les fichiers optionnels.
6. `NetworkModelBuilderService.build()` détecte `componentType=ENDPOINT`, enrichit les composants via le registry, classifie les messageTypes, calcule la direction IN/OUT, marque les expirations.
7. `SnapshotPersisterService.persist()` écrit le zip sur disque, exécute la transaction Prisma, retourne `IngestionResult`.

**Résultat** : snapshot créé avec `componentType=ENDPOINT`, warnings éventuels inclus dans la réponse.

### CU-002 — Ingestion d'un backup Component Directory

Même flux que CU-001. La différence est que `ecp.componentCode` correspond à un `componentDirectory.code` ou au `cdCode` du XML MADES, donc `componentType=COMPONENT_DIRECTORY`. Le `cdCode` du snapshot est le code source lui-même.

### CU-003 — Rejet d'un zip invalide ou incomplet

**Flux alternatif** : si le zip est corrompu → `INVALID_UPLOAD` (400). Si `application_property.csv` ou `component_directory.csv` manquent → `MISSING_REQUIRED_CSV` (400). Si le namespace XML MADES est absent ou inconnu → `UNKNOWN_MADES_NAMESPACE` (400). Si `ecp.componentCode` est absent → `INVALID_UPLOAD` (400). Si une entrée dépasse 50 MB → `PAYLOAD_TOO_LARGE` (413).

### CU-004 — Ingestion tolérante avec warnings

Si des composants EIC ne sont pas trouvés dans le registry, ou si des messageTypes ne sont pas classifiables, l'ingestion continue et retourne des warnings dans la réponse. Ces warnings sont également persistés dans `warningsJson` sur le Snapshot.

---

## Dépendances

- **RegistryService** (`api/registry`) — résolution géographique et classification des messageTypes. Chargé au boot, singleton en mémoire.
- **PrismaService** (`api/prisma`) — accès SQLite via ORM Prisma 5.
- **`adm-zip`** — extraction du zip en mémoire.
- **`csv-parse/sync`** — parsing synchrone des CSV avec séparateur `;`.
- **`fast-xml-parser`** — parsing du blob XML MADES.
- **`uuid`** — génération de l'identifiant unique du snapshot.
- **`packages/shared`** — types partagés `ComponentType`, `ProcessKey`, `Warning`.
- **`packages/registry`** — données de référence (CSV ENTSO-E + overlay JSON RTE).

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Signification métier de `message_upload_route.csv` et `message_type.csv`** : ces fichiers sont dans la whitelist `USABLE_CSV_FILES` mais aucun lecteur ni consommateur n'a été trouvé dans le code actuel. Ils sont chargés en mémoire mais jamais parsés. À valider : sont-ils réservés pour une feature future ?
- **Traitement des fichiers `IGNORED_CSV_FILES`** : `component_statistics.csv`, `synchronized_directories.csv`, `pending_edit_directories.csv`, `pending_removal_directories.csv` sont chargés en mémoire (dans `LOADABLE_FILES`) mais ne font l'objet d'aucun parsing. Est-ce intentionnel pour un futur use-case, ou uniquement pour éviter l'erreur "fichier non reconnu" ?
- **Comportement si `component_directory.csv` contient plusieurs lignes** : le code ne prend que `componentDirectoryRows[0]`. Si plusieurs lignes existent, les suivantes sont ignorées. Est-ce le comportement attendu dans les backups réels ?
- **Sémantique exacte de `ttl` et `contentId` dans le XML MADES** : ces champs sont parsés mais non persistés ni utilisés. À valider avec l'équipe ECP.
- **Reproductibilité historique de `isExpired`** : le flag `isExpired` est calculé relativement à `Date.now()` au moment du `build()`, non relativement à `uploadedAt`. Contrairement à `isRecent` (calculé dans `GraphService` relativement à `uploadedAt`), `isExpired` n'est donc pas historiquement reproductible. À valider si c'est intentionnel.
