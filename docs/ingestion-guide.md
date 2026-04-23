# Guide d'ingestion ECP — documentation fonctionnelle

Ce document décrit **ce qu'il faut fournir** pour importer un composant ECP dans la carte, **comment récupérer les fichiers** depuis ECP, et **ce qui se passe en interne** à chaque étape. Il complète les specs techniques (`docs/specs/api/ingestion/`, `docs/specs/api/imports/`) avec une vue pratique opérateur.

---

## 1. Résumé — deux fichiers par composant

Pour chaque composant ECP que vous voulez voir sur la carte, il faut **deux fichiers** :

| Fichier | Format | Source ECP | Obligatoire ? |
|---|---|---|---|
| `<EIC>_<timestamp>Z.zip` | Archive ZIP (~200 kB – 1 MB) | Export → Configuration management → **Export configuration package** | **Oui** — c'est le dump complet du composant |
| `<EIC>-configuration.properties` | Fichier texte Java Properties | Settings → Runtime Configuration → **Export Configuration** | Fortement recommandé — sinon warning `CONFIGURATION_PROPERTIES_MISSING` et projectName/envName/NAT incomplets |

Exemple pour le CD central INTERNET-CD (EIC `17V000002014106G`) :

```
PRFRI-CD1/
  17V000002014106G_2026-04-22T08_16_46Z.zip        <- dump zip
  17V000002014106G-configuration.properties         <- runtime config
```

Les 7 dumps PRFRI de référence sont dans `tests/fixtures/EXPORT/PRFRI-*/` avec cette structure.

---

## 2. Comment récupérer les fichiers depuis l'admin ECP

### 2.1 Le `.zip` (dump complet)

1. Connexion admin sur l'UI ECP (`https://<hôte>:8443/ECP_MODULE/`)
2. Menu **Monitoring** → **Configuration management**
3. Cliquer **Export configuration package**
4. Le navigateur télécharge `<EIC>_<timestamp>Z.zip` (~200 kB à 1 MB)

### 2.2 Le `.properties` (configuration runtime)

1. Même admin UI
2. Menu **Settings** → **Runtime Configuration**
3. Cliquer **Export Configuration**
4. Le navigateur télécharge `<EIC>-configuration.properties` (~5–10 kB)

> **Référence** : `docs/officiel/ECP Administration Guide v4.16.0.pdf` §4.1.2.2 "Export current configuration" et §4.4 "How to set Project and Environment name".

### 2.3 Organiser les fichiers

Pour un environnement entier (ex. PRFRI = 1 CD + 6 endpoints), créer un dossier par composant :

```
EXPORT/
├── PRFRI-CD1/              <- CD central
│   ├── 17V000002014106G_2026-04-22T08_16_46Z.zip
│   └── 17V000002014106G-configuration.properties
├── PRFRI-EP1/
│   ├── 17V0000009927458_2026-04-21T14_33_57Z.zip
│   └── 17V0000009927458-configuration.properties
├── PRFRI-EP2/
├── PRFRI-CWERPN/
├── PRFRI-PCN-EP1/
├── PRFRI-PCN-EP2/
└── PRFRI-PCN-EP3/
```

Les 7 dossiers peuvent être uploadés en une seule fois via le drag-and-drop sur `/upload` — chaque `.properties` est apparié automatiquement à son zip via l'EIC.

---

## 3. Anatomie du `.zip` (dump ECP)

### 3.1 Contenu typique

Un zip d'**endpoint** contient 8 fichiers CSV. Un zip de **CD** contient 10 fichiers CSV. Ce tableau liste ceux lus par le pipeline (whitelist dans `USABLE_CSV_FILES`) et ceux strictement exclus :

| Fichier CSV | Présent dans | Statut | Contenu résumé |
|---|---|---|---|
| `application_property.csv` | EP + CD | **Lu** | `ecp.*` de l'état courant (projectName, envName, componentCode, contacts, URLs home CD, internal.status, networks, appTheme, timezone…) |
| `component_directory.csv` | EP + CD | **Lu** | Annuaire des composants connus — **XML MADES** dans la colonne `directoryContent` (EP) ou métadonnée brute (CD) |
| `message_path.csv` | EP + CD | **Lu** | Routes métier (receiver, sender, messageType, transportPattern, intermediateBrokerCode, validFrom/To) |
| `messaging_statistics.csv` | EP seul | **Lu** | Stats p2p par pair distant (`sumMessagesUp/Down`, `lastMessageUp/Down`, `connectionStatus`) |
| `message_upload_route.csv` | EP seul | **Lu** | Cibles d'upload prioritaires (`targetComponentCode`, `createdDate`) |
| `component_statistics.csv` | CD seul | **Lu** | Santé vue CD (`lastSynchronizedTime`, cumul `sentMessages`/`receivedMessages`) |
| `synchronized_directories.csv` | CD seul | **Lu** | CDs partenaires en peering (`directoryCode`, `directorySyncMode` ONE_WAY/TWO_WAY, `directoryUrls`, `synchronizationStatus`) |
| `message_type.csv` | EP + CD | Ignoré (hors scope) | Redondant avec `message_path.csv` |
| `pending_edit_directories.csv` | CD | Ignoré | État transient |
| `pending_removal_directories.csv` | CD | Ignoré | État transient |
| `local_key_store.csv` | EP + CD | **Bloqué (sensible)** | **Clés privées X.509** — jamais lu ni persisté |
| `registration_store.csv` | EP | **Bloqué (sensible)** | Demandes d'enregistrement avec CSR — jamais lu |
| `registration_requests.csv` | CD | **Bloqué (sensible)** | Demandes d'enregistrement côté CD — jamais lu |

### 3.2 Règles de sécurité appliquées au zip

1. **Les 3 fichiers sensibles** (`local_key_store`, `registration_store`, `registration_requests`) sont filtrés **avant** toute extraction mémoire (`ZipExtractor`). Même si présents dans le zip source, ils ne sont jamais chargés.
2. Le zip **repackagé** sauvegardé dans `storage/imports/<importId>.zip` est une copie **sans** les 3 CSV sensibles.
3. Les clés `application_property.csv` matchant `password|secret|keystoreP?ass(word)?|privateKey|credentials` sont écartées avant persistence (regex `SENSITIVE_KEY_REGEX`).
4. Côté fixtures, `tests/fixtures/EXPORT/**/*.zip` est `gitignore` — on ne commit jamais un zip brut (ses secrets y sont empaquettés et impossible à filtrer par ligne).

---

## 4. Anatomie du `.properties` (configuration runtime)

### 4.1 Format

Format standard **Java `.properties`** :

```properties
# Commentaire
! Aussi un commentaire
ecp.projectName = INTERNET-EP1
ecp.envName = PFRFI
ecp.directory.client.synchronization.homeComponentDirectoryPrimaryUrl = https://10.144.0.148:8443/ECP_MODULE/
ecp.natEnabled =
```

Règles :
- `key = value` (espaces autour du `=` tolérés)
- Les **commentaires** `#` et `!` sont ignorés
- **CRLF** et **LF** sont tolérés, ainsi qu'un **BOM UTF-8** en entête
- Les **valeurs vides** (`ecp.natEnabled =`) sont préservées
- Les clés sensibles sont automatiquement filtrées (même regex que le CSV)

### 4.2 Clés typiquement présentes

Un `.properties` exporté depuis l'admin ECP contient entre ~10 (endpoint minimal) et ~40 clés (CD complet avec synchronisation et sécurité). Les principales :

| Clé | Valeur exemple | Utilité pour la carte |
|---|---|---|
| `ecp.projectName` | `INTERNET-EP1` | Nom humain affiché sur le marker |
| `ecp.envName` | `PFRFI` / `ACCEPTANCE` / `PROD` | Filtre environnement |
| `ecp.componentCode` | `17V0000009927458` | EIC (déjà dans le nom de fichier) |
| `ecp.appTheme` | `WHITE` / `BLUE` / `DEFAULT` | Thème UI ECP |
| `ecp.internal.status` | `ACTIVE` | Statut du composant |
| `ecp.networks` | `internet,acer` | Réseau d'appartenance |
| `ecp.natEnabled` | `true` / (vide) | Composant derrière NAT |
| `ecp.urls` | `https://<IP>:8443/ECP_MODULE` | URL publique (CDs seulement) |
| `ecp.directory.client.synchronization.homeComponentDirectoryPrimaryUrl` | `https://10.144.0.148:8443/...` | URL du CD home (endpoints seulement) |
| `ecp.company.organization` | `RTE` | Organisation propriétaire |
| `ecp.company.contactEmail` | `rte-dsit-mco-ecp@rte-france.com` | Contact support |
| `ecp.endpoint.antivirus.*` | — | Config antivirus (ClamAV / Symantec) |
| `ecp.endpoint.archive.*` | — | Config archivage |
| `ecp.security.keyStore.keyAlias` | `ecp_module_sign` | Alias de certificat (clé non-sensible) |

La liste complète des clés existantes est référencée par l'admin guide ECP v4.16.0 §4 et §5.

---

## 5. Appariement zip ↔ properties

### 5.1 Règle d'appariement

Le frontend apparie chaque `.properties` à son zip via **l'EIC extrait du nom de fichier**.

Pattern validé : `<EIC>-configuration.properties`

- Exemple : `17V000002014106G-configuration.properties` → EIC `17V000002014106G`
- Regex côté store : `/^(\S+?)-configuration\.properties$/i` (permissive : tout préfixe sans espace)

### 5.2 Workflow d'upload

1. L'utilisateur drag-and-drop **N zips + M `.properties`** dans le dropzone `/upload` (peu importe l'ordre).
2. Les **zips** sont inspectés côté backend (`POST /api/imports/inspect`) pour détecter le type (ENDPOINT / CD / BROKER) et l'EIC source.
3. Les **`.properties`** sont indexés en mémoire côté frontend dans `propertiesFiles: Record<EIC, File>` — pas d'appel API à ce stade.
4. Quand l'utilisateur clique **Importer tout**, pour chaque zip actionable :
   - `api.createImport(zip, envName, label, dumpType, replaceImportId, propertiesFile?)`
   - Le frontend associe le `propertiesFile` correspondant via `propertiesFiles[sourceEic.toUpperCase()]`
   - Le backend reçoit les 2 fichiers dans un `multipart/form-data` à `POST /api/imports`
5. Si un zip a son `.properties` associé : **`hasConfigurationProperties: true`** sur l'Import.
6. Si un zip n'a PAS son `.properties` : ajout du warning `CONFIGURATION_PROPERTIES_MISSING` sur l'Import (non bloquant), badge ✗ rouge dans `/admin > Imports`.

### 5.3 Feedback visuel

La page `/upload` affiche après chaque drop :

- Une carte **"Dernier drop — N fichier(s) reçu(s)"** qui liste chaque fichier :
  - `✓ zip · <nom>` (vert) — zip valide
  - `✓ properties · <nom>` (violet) — properties accepté
  - `✗ properties (nom invalide) · <nom>` (rouge) — pattern EIC non reconnu
  - `✗ extension · <nom>` (rouge) — extension autre que `.zip` / `.properties`
- Une chip violette **"N fichier(s) .properties en attente d'association : <EIC1>, <EIC2>…"** qui liste les `.properties` indexés et encore non soumis.
- Un **sélecteur natif** `<input type="file">` en fallback si le dropzone rejette un MIME.

---

## 6. Pipeline d'ingestion backend

```
POST /api/imports (multipart: file + configurationProperties?)
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│ 1. ImportsController                                            │
│    - FileFieldsInterceptor [file, configurationProperties]      │
│    - Validations : MIME zip, magic bytes, extension .properties │
│    - Taille max : zip 50 MB, properties 128 kB                  │
└──────────┬──────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────┐
│ 2. ImportsService.createImport                                  │
│    - PropertiesParserService.parse(buffer) → Record<k,v>        │
│    - ZipExtractorService.extract(buffer) → Map<name, Buffer>    │
│      (filtre les 3 CSV sensibles)                               │
│    - detectDumpType(entries) → ENDPOINT / CD / BROKER           │
└──────────┬──────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────┐
│ 3. Branche ENDPOINT                  Branche CD                 │
│    CsvReader:                        CsvReader:                 │
│      - application_property           - application_property    │
│      - component_directory            - component_directory     │
│      - messaging_statistics           - synchronized_directories│
│      - message_upload_route           - component_statistics    │
│    XmlMadesParser: blobs XML         CsvPathReader: message_path│
│    ImportBuilder:                    ImportBuilder:             │
│      - buildFromCsv + buildFromXml    - buildFromCdCsv          │
│      - dedup CSV↔XML (XML gagne)      - buildDirectorySyncs     │
│      - injecte projectName sur EIC    - buildComponentStats     │
│        source                         - injecte projectName     │
│      - buildMessagingStats            - buildUploadRoutes (non) │
└──────────┬──────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────┐
│ 4. Fusion CSV ↔ .properties externe                             │
│    appsMap = CSV-pairs ; external écrase les clés homonymes     │
│    (l'état courant du composant au moment de l'Export)          │
└──────────┬──────────────────────────────────────────────────────┘
           ▼
┌────────────────────────────────────────────────────────────────┐
│ 5. RawPersisterService.persist (transaction Prisma)             │
│    - Import (hasConfigurationProperties, sourceComponentEic…)   │
│    - ImportedComponent[] + ImportedComponentUrl[]               │
│    - ImportedPath[]                                              │
│    - ImportedMessagingStat[]                                     │
│    - ImportedAppProperty[] (filtrées sensibles)                 │
│    - ImportedDirectorySync[] (CDs partenaires, CD seul)         │
│    - ImportedComponentStat[] (santé, CD seul)                   │
│    - ImportedUploadRoute[] (cibles upload, EP seul)             │
│    - Zip repackagé sans CSV sensibles → storage/imports/<id>.zip│
└──────────┬──────────────────────────────────────────────────────┘
           ▼
           ImportDetail retourné au frontend (warnings, stats, hasConfigurationProperties)
```

---

## 7. Transformation à la lecture (`GraphService`)

Lorsque le frontend demande `GET /api/graph?env=X`, le backend ne rejoue pas le pipeline : il recalcule le graphe à la volée depuis les tables brutes.

1. **Merge des composants** (`mergeComponentsLatestWins`) : pour chaque EIC, les imports sont fusionnés par ordre chronologique, les champs non-null écrasent les null, URLs latest-wins.
2. **Cascade `displayName`** (`applyCascade`) :
   1. `ComponentOverride` (saisie admin)
   2. `merged.projectName` (`ecp.projectName` du dump — slice 2j)
   3. ENTSOE
   4. Registry RTE
   5. `merged.displayName`
   6. EIC brut (fallback)
3. **Enrichissement runtime** depuis `ImportedAppProperty` : `status`, `appTheme` injectés par EIC source.
4. **Santé CD** depuis `ImportedComponentStat` : `lastSync`, `sentMessages`, `receivedMessages` par EIC observé.
5. **Routes upload** depuis `ImportedUploadRoute` : `uploadTargets` par EIC source.
6. **CDs partenaires** depuis `ImportedDirectorySync` : ajout des `directoryCode` à l'ensemble des nodes, création d'edges `PEERING`.
7. **Edges business** depuis `ImportedPath` : agrégation par `(fromEic, toEic)`, MIXTE si ≥2 process, bi-directionnel pour les volumes.

---

## 8. Les 15 sections de Config ECP (modal admin)

La modal `⚙ Config` dans `/admin > Composants` classe les `ecp.*` properties du composant en sections lisibles (ordre d'affichage) :

| # | Section | Slug | Regex |
|---|---|---|---|
| 1 | Contact | `contact` | `^ecp\.company\.` |
| 2 | Identification | `identification` | `^ecp\.projectName\|envName\|componentCode\|internal\.status\|timezone\|appTheme` |
| 3 | Synchronisation CD | `sync` | `^ecp\.directory\.client\.synchronization` |
| 4 | Antivirus | `antivirus` | `^ecp\.endpoint\.antivirus` |
| 5 | Archivage | `archive` | `^ecp\.endpoint\.archive(Handler)?` |
| 6 | Compression | `compression` | `^ecp\.endpoint\.(compression\|messageTypes(To\|Skip)Compress)` |
| 7 | AMQP & Direct | `amqp` | `^ecp\.endpoint\.(amqpApi\|routes\|directMessagingEnabled)` |
| 8 | Connectivité | `connectivity` | `^ecp\.endpoint\.connectivityCheck` |
| 9 | Message paths | `messagepath` | `^ecp\.endpoint\.messagePath` |
| 10 | Messages | `messages` | `^ecp\.endpoint\.(priorityConfiguration\|messageTtl)\|^ecp\.messagebox` |
| 11 | Sécurité | `security` | `^ecp\.security` |
| 12 | JMS / FSSF | `jms` | `^ecp\.endpoint\.(jmsHeaders\|fssf)` |
| 13 | Handlers custom | `handlers` | `^ecp\.endpoint\.(sendHandler\|receiveHandler)` |
| 14 | Broker | `broker` | `^ecp\.broker` |
| 15 | Réseau | `network` | `^ecp\.(networks\|urls\|natEnabled\|natTable)` |
| 16 | Admin | `admin` | `^ecp\.(metricsSyncThreshold\|directory\.ttl)` |
| 17 | Autres | `misc` | *fallback* |

Source : `apps/api/src/admin/component-config.service.ts` — `SECTION_RULES`.

---

## 9. Warnings non-bloquants

Les warnings produits pendant l'ingestion sont persistés dans `Import.warningsJson` et affichés dans `/admin > Imports` (compteur avec tooltip). L'import reste valide.

| Code | Signification | Comment corriger |
|---|---|---|
| `CONFIGURATION_PROPERTIES_MISSING` | Zip uploadé sans son `.properties` | Ré-ingérer en fournissant `<EIC>-configuration.properties` |
| `CONFIGURATION_PROPERTIES_PARSE_ERROR` | Le `.properties` est mal formé | Vérifier CRLF, encodage UTF-8, pas de caractères binaires |
| `XML_PARSE_ERROR` | Une ligne `component_directory.csv` contient un XML invalide | Souvent corrompu côté ECP — warning non bloquant, les autres lignes passent |
| `CSV_PARSE_ERROR` | Un CSV optionnel (messaging_statistics, sync, stats) n'est pas parseable | Non bloquant, les autres données passent |
| `CSV_ROW_MISSING_EIC` | Une ligne CSV n'a pas d'EIC identifiable | Ligne skippée |
| `CSV_PATH_NO_RECEIVER` | Un `message_path` sans receiver | Ligne skippée |
| `CSV_PATH_UNKNOWN_TRANSPORT` | `transportPattern` ≠ DIRECT / INDIRECT | Ligne skippée |
| `BROKER_DUMP_METADATA_ONLY` | Dump Broker accepté mais sans composants (base SQL non exposée) | Comportement attendu, informatif |

---

## 10. FAQ / Troubleshooting

### « Mon `.properties` n'est pas détecté »

- Vérifier que le nom matche `<EIC>-configuration.properties` — avec un tiret (`-`) et en minuscules pour l'extension.
- Éviter les espaces, suffixes cachés Windows (`.properties.txt`), BOM UTF-16.
- Si le dropzone refuse, utiliser le **sélecteur natif** (`<input type=file>`) juste sous le dropzone.
- Vérifier la carte "Dernier drop" qui liste précisément ce qui a été reçu.

### « projectName est vide sur la carte »

- Vérifie que `ecp.projectName` est bien présent (décommenté) dans le `.properties`.
- Sinon, vérifie dans `application_property.csv` interne au zip.
- La cascade tombe sur Registry / EIC brut si aucune des 2 sources n'a la clé.

### « Le CD affiché est `CD RTE` alors que mon `ecp.projectName` vaut `INTERNET-CD` »

- Vérifier que `ecp.projectName` est bien remonté dans la DB (requête `/api/admin/components/:eic/config`).
- Si oui, la cascade `Override > merged.projectName > ENTSOE > Registry` devrait mettre `INTERNET-CD`. Un override manuel dans `/admin > Composants` bloquerait ça — check la colonne "Surchargé".

### « Les CDs partenaires ne sont pas visibles »

- Les CDs partenaires viennent uniquement du `synchronized_directories.csv`, **présent uniquement dans les dumps CD**.
- Si vous n'importez que des endpoints, aucun CD partenaire n'apparaît.
- Les partenaires héritent d'un fallback coordinates "Bruxelles" sauf override admin.

### « Santé toujours "Inconnu" alors que mon endpoint est actif »

- `lastSync` vient du `component_statistics.csv` du **CD** — l'endpoint seul n'en produit pas.
- Il faut importer **aussi** le dump du CD qui voit cet endpoint pour alimenter la santé.

### « Le dump ENDPOINT rapporte mes volumes, le CD aussi — conflit ? »

- Le frontend somme **bi-directionnellement** les `messaging_statistics` (A→B + B→A).
- Les `component_statistics` du CD sont pour la santé globale (`lastSync`, cumul messages).
- Pas de conflit ; les 2 sources alimentent des champs différents du node.

---

## 11. Références

- **Pipeline technique détaillé** : `docs/specs/api/ingestion/spec-fonctionnel.md` + `spec-technique.md`
- **Upload HTTP** : `docs/specs/api/imports/`
- **Graph compute** : `docs/specs/api/graph/`
- **Doc officielle ECP** : `docs/officiel/ECP Administration Guide v4.16.0.pdf` (§4.1 Export, §4.4 projectName/envName, §7.9.1 Networks)
- **Fixtures de référence** : `tests/fixtures/EXPORT/PRFRI-*/` (7 dumps PRFRI, cf. CLAUDE.md §"Test fixtures")
- **CHANGELOG** : `CHANGELOG.md` — slices 2h→2p (avril 2026)
