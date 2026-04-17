# 🗺️ ECP Network Map — Document fonctionnel

|  |  |
| :---- | :---- |
| **Porteur** | Anthony Rodrigues (AR46850T) — DPCM/IMGH |
| **Équipe cible** | MCO ECP RTE |
| **Validation** | Tech Lead ECP |
| **Version** | 1.2 |
| **Date** | 17 avril 2026 |
| **Changelog v1.1** | Ajout §5bis (règles de liens), §8bis (format des backups ECP), §9.1 (classification message\_type). MAJ §13.2 (points clarifiés). |
| **Changelog v1.2** | Refonte §8bis sur la base d'un **vrai backup Endpoint** analysé. Découverte majeure : `component_directory.csv` contient **1 blob XML MADES**, pas une table plate. §5bis mis à jour en conséquence. Schéma XML complet documenté (§8bis.4). Modèle de données précisé (§8bis.5). |

---

## 1\. 🎯 En une phrase

Une application web interne RTE qui **visualise sur une carte d'Europe** qui communique avec qui dans le réseau ECP, pour que l'équipe MCO arrête d'ouvrir 14 IHM pour répondre à une question simple.

---

## 2\. 🤔 Pourquoi ce projet ?

Aujourd'hui, pour répondre à des questions basiques comme :

- *« Avec quels GRT RTE échange-t-il sur le process VP ? »*  
- *« Si l'application OCAPPI tombe, quels Endpoints ECP sont impactés ? »*  
- *« Quels flux transitent par CWERPN en ce moment ? »*

…un exploitant MCO doit ouvrir manuellement **7 IHM par environnement** (1 CD \+ 6 Endpoints), parcourir onglet par onglet, et corréler les codes EIC à la main. Avec 2 environnements (PROD \+ PFRFI), on monte à **14 IHM à ouvrir**.

Il faut environ **30 minutes** pour obtenir une réponse qui devrait prendre **30 secondes**. Et la réponse n'est jamais partagée (chacun refait l'exercice dans son coin).

**Avec cette app, la réponse prendra moins de 2 minutes**, et elle sera visuelle, partageable, et historisée.

---

## 3\. 👥 Pour qui ?

| Profil | Usage | Permissions |
| :---- | :---- | :---- |
| **Exploitant MCO** | Consulter la carto, uploader les snapshots réguliers, exporter en CSV | Upload \+ consultation \+ export |
| **Tech Lead ECP** | Tout \+ administration (utilisateurs, registry, purge) | Tout |
| **Lecteur audit** *(v2)* | Consultation seule pour audit ponctuel | Lecture seule |

---

## 4\. 🏗️ Principe de fonctionnement

L'app est **statique** : elle ne se connecte **jamais** aux ECP. C'est une contrainte d'isolation réseau RTE non négociable.

Le flux est simple :

1. L'exploitant **extrait manuellement** les fichiers de backup depuis les ECP (DB backup du CD \+ DB backup des 6 Endpoints \+ un zip des fichiers `ecp.properties`).  
2. Il **upload** les fichiers dans l'app avec un label et l'environnement cible (PROD ou PFRFI).  
3. L'app **parse** les fichiers et construit automatiquement le graphe du réseau.  
4. La **carte d'Europe s'affiche** avec tous les composants positionnés, les flux colorés par process métier, et les liens entre eux.  
5. L'exploitant **navigue, filtre, recherche, exporte** selon son besoin.

La cartographie est **une photo à l'instant T**. Pour la rafraîchir, on refait un snapshot — typiquement 1 fois par semaine ou après tout changement de configuration.

---

## 5\. 🗺️ Ce qu'on voit sur la carte

La carte représente **3 zones logiques** sur fond d'Europe :

**À gauche (zone applicative RTE)** : les 14 Business Applications RTE qui utilisent ECP (OCAPPI, PLANET, CIA, NOVA, TACITE, PROPHYL, SMARDATA, RDM, KIWI, SRA, ECO2MIX, TOTEM, BOB, TOP NIVEAU).

**Au centre (Paris \- La Défense)** : les composants RTE :

- Les **6 Endpoints ECP** indépendants avec leur spécialité métier  
- Le **Component Directory RTE** (annuaire central)  
- Chaque Endpoint a son **Internal Broker Artemis** embarqué

**À droite (reste de l'Europe)** : les partenaires externes positionnés géographiquement :

- Les **ECP Brokers centraux** (type ENTSO-E)  
- Les **Component Directories partenaires**  
- Les **Endpoints des autres GRT** et des plateformes (SwissGrid, Terna, REE, Elia, TenneT, Amprion, TransnetBW, EirGrid, JAO, DBAG, IFA1/2, ELECLINK, MARI, PICASSO, CORE CCT)

Entre tous ces nœuds, des **liens colorés par process métier** :

- 🔵 Bleu \= TP (SwissGrid/Terna)  
- 🟠 Orange \= UK-CC-IN (interconnecteurs UK)  
- 🟣 Violet \= CORE/SDAC/IDA/XBID  
- 🟢 Vert \= MARI/CMM  
- 🟡 Ambre \= PICASSO  
- 🌸 Rose \= VP (Voltage Programs)

Les environnements **PROD et PFRFI** sont distingués par un **liseré coloré** (rouge / bleu) autour des nœuds RTE. Règle stricte : jamais de mélange PROD/PFRFI dans une même vue.

---

## 5bis. 🔗 Règles de construction des liens

Chaque lien affiché sur la carte correspond à **une règle dérivée des données extraites** des backups ECP, enrichie par le registry EIC. Aucun lien n'est inventé : si la donnée source n'est pas présente, le lien n'est pas tracé.

**Note importante** : dans un backup Endpoint, la vue complète du réseau se trouve dans le **XML MADES** embarqué dans `component_directory.csv` (champ `directoryContent`), **pas** dans un CSV plat relationnel. Cf. §8bis pour le détail du format.

| Type de lien | Source dans les backups | Règle de tracé |
| :---- | :---- | :---- |
| **Endpoint ↔ CD (enregistrement)** | XML MADES : chaque composant a un `<componentDirectory>{CD_code}</componentDirectory>` \+ `application_property.csv` (clés `ecp.directory.client.synchronization.*`) | Lien actif si l'Endpoint référence le CD dans sa config **ET** s'il apparaît dans le XML comme enregistré sur ce CD |
| **CD ↔ CD (fédération)** | Backup CD uniquement (non disponible côté Endpoint — à valider) | À spécifier quand on aura un backup CD |
| **BA RTE ↔ Endpoint RTE** | **Registry EIC** (non extrait des backups — information métier maintenue MCO) | Lien si le registry déclare que la BA utilise l'Endpoint |
| **Endpoint ↔ Partenaire externe (GRT, plateforme)** | XML MADES : `<endpoint>/<paths>/<path>` de chaque endpoint listé | Lien actif si un path existe avec ce couple, validité couvrant la date du snapshot |
| **Endpoint ↔ Broker intermédiaire** | XML MADES : `<path>/<path>INDIRECT:{brokerCode}</path>` | Lien vers le broker référencé dans les paths de type INDIRECT |
| **Activité réelle sur un lien** | `messaging_statistics.csv` (`lastMessageUp`, `lastMessageDown`, `connectionStatus`, `sumMessages*`) | Tag visuel "actif récemment" si `lastMessageUp` \< 24h, sinon "déclaré mais inactif" |

**Règles de dédoublonnage** :

- Plusieurs paths entre le même couple (Endpoint, Partenaire) pour des `messageType` différents → **1 seul lien visuel agrégé**, avec la liste des messageTypes en tooltip  
- Le process métier du lien est **le process majoritaire** des messageTypes agrégés (cf. §9.1)  
- Si le process est hétérogène (≥ 2 process différents sur le même couple), le lien est tracé en **gris foncé** avec label "MIXTE"  
- Les paths de type `messagePathType=ACKNOWLEDGEMENT` peuvent être **fusionnés** avec les paths `BUSINESS` entre les mêmes composants (même lien, rôle technique différent)

**Portée d'un flux** : un path visible dans le XML MADES d'un Endpoint reflète la **vue du CD** (ce que le CD diffuse à cet Endpoint). Donc en théorie, un seul backup Endpoint suffit pour avoir la vue complète du réseau tel que le CD le voit. Cependant, pour détecter des paths locaux non encore synchronisés avec le CD, le parser regarde aussi `message_path.csv` (local). Le sens IN/OUT est **toujours relatif à l'Endpoint RTE concerné** (un path dont le `receiver` est un Endpoint RTE \= flux IN ; sinon \= flux OUT).

---

## 6\. 📋 Fonctionnalités attendues

### 6.1 Doivent absolument être livrées (Must have)

| \# | Fonctionnalité | Description |
| :---- | :---- | :---- |
| F1 | **Upload d'un snapshot** | L'exploitant sélectionne l'env, drag & drop les zips, label automatique, détection auto du contenu |
| F2 | **Vue carte principale** | Affichage des 3 zones (BA, Endpoints RTE, partenaires) avec regroupement intelligent à Paris |
| F3 | **Panneau détail** | Clic sur un nœud → fiche détaillée (nom, EIC, org, pays, version, BA utilisées, processes, message types échangés) |
| F4 | **Recherche unifiée** | Barre de recherche qui trouve par EIC, nom de BA, nom d'Endpoint, nom d'organisation |
| F5 | **Filtres multiples** | Par environnement, process métier, BA, Endpoint source, partenaire, direction (IN/OUT) — cumulables |
| F6 | **Toggle des couches** | Masquer/afficher chaque catégorie de nœuds ou de liens, persistance par utilisateur |
| F7 | **Export CSV** | Exporter les liens visibles ou les composants, compatible Excel français |
| F8 | **Historique** | Liste des snapshots passés, filtrable, renommage, activation, suppression (techlead) |

### 6.2 Nice to have (à livrer si temps)

| \# | Fonctionnalité | Description |
| :---- | :---- | :---- |
| F9 | **Analyse d'impact BA** | Sélectionner une BA → voir toutes les chaînes qu'elle impacte (BA → Endpoint → Partenaires) |
| F10 | **Vue par process** | Raccourci "voir tout VP" / "voir tout CORE" en 1 clic |

### 6.3 Explicitement hors scope du MVP

- ❌ Détection temps réel (c'est le rôle de Prometheus/Grafana)  
- ❌ Alerting (c'est le rôle d'Alertmanager)  
- ❌ Analyse de logs (c'est le rôle d'ELK)  
- ❌ Scraping direct des ECP (contrainte d'isolation réseau)  
- ❌ Comparaison diff entre 2 snapshots  
- ❌ Édition manuelle de données (la source de vérité reste les backups ECP)  
- ❌ SSO / authentification externe

---

## 7\. 🏢 Topologie RTE à représenter

L'app doit représenter fidèlement la **vraie topologie** du réseau ECP RTE :

| Endpoint RTE | Process métier | Partenaires externes | Applications RTE |
| :---- | :---- | :---- | :---- |
| **INTERNET-1** | TP / SwissGrid-Terna | SwissGrid, Terna, DBAG/ICS, EirGrid | OCAPPI, TACITE, PLANET, PROPHYL |
| **INTERNET-2** | UK / CC IN | IFA1/2, ELECLINK, JAO | OCAPPI, PLANET, PROPHYL, CIA, NOVA, SMARDATA, KIWI, RDM |
| **CWERPN** | CORE/SDAC/IDA/XBID (via MPLS) | CORE CCT, DBAG XBID, IDA | CIA, PLANET, SRA, OCAPPI, SMARDATA, ECO2MIX, NOVA, RDM, TACITE |
| **PCN-1** | MARI / CMM | Plateforme MARI, CMM TERRE | OCAPPI, TOTEM, BOB, NOVA |
| **PCN-2** | PICASSO | Plateforme PICASSO | TOP NIVEAU |
| **PCN-3** | VP (Voltage Programs) | SwissGrid, REE, Terna, IFA1/2, ELECLINK, Amprion, TransnetBW, Elia | OCAPPI, PROPHYL, CIA |

S'ajoutent : **le CD RTE** et **les 6 Internal Brokers Artemis** (un par Endpoint).

Le tout multiplié par **2 environnements** (PROD et PFRFI).

---

## 8\. 📥 Données en entrée

Pour créer un snapshot, l'exploitant fournit **environ 8 fichiers** :

1. **1 zip du CD RTE** (backup base de données) — contient la vue globale du réseau connu  
2. **6 zips d'Endpoints RTE** (un par Endpoint : INTERNET-1, INTERNET-2, PCN-EP-1, PCN-EP-2, PCN-EP-3, CWERPN) — contiennent les flux sortants de chaque Endpoint  
3. **1 zip de configuration** contenant les fichiers `ecp.properties` du CD et des 6 Endpoints

Les fichiers sont extraits via l'IHM ECP ou via un script d'extraction (à fournir à part aux exploitants).

**Règles importantes** :

- Un snapshot **partiel** est accepté (si un Endpoint manque, on warn mais on affiche ce qu'on a)  
- Les **mots de passe** présents dans les `.properties` sont automatiquement ignorés à l'upload  
- Les **EIC inconnus** (pas dans le registry) apparaissent à Bruxelles avec un badge "📍 position par défaut"

---

## 8bis. 📦 Format des fichiers de backup ECP

**Source primaire** : analyse d'un vrai backup Endpoint RTE (`ECP-INTERNET-2`, env OPF, avril 2026), croisée avec l'*ECP Administration Guide v4.16.0* et l'*ECP Functional Specification v4.16.0 §4.5.8.8 / §4.6.9.6*.

Chaque backup ECP est un **zip contenant un fichier CSV par table de base de données**. Nom du zip : `{COMPONENT-CODE}_{timestamp}.zip`.

### 8bis.1 Format CSV — contrat technique

| Caractéristique | Valeur |
| :---- | :---- |
| Séparateur | **`;`** (point-virgule) |
| Encodage | ASCII / UTF-8 compatible, **pas de BOM** |
| Quoting | Guillemets doubles `"..."` autour des strings uniquement (nombres/booléens non quotés) |
| Ligne d'en-tête | Oui, toujours 1ère ligne, noms en camelCase |
| Format des dates | ISO 8601 sans timezone, avec nanosecondes : `"2025-03-12T15:34:48.560980651"` |
| Marqueur NULL | Chaîne littérale **`NULL_VALUE_PLACEHOLDER`** (pas vide, pas "NULL") |
| Wildcards | `"*"` pour "tous" (utilisé dans `allowedSenders`, `messageType`) |
| Booléens | `true` / `false` non quotés |

⚠️ **Piège à éviter** : utiliser un parser CSV naïf qui traite `NULL_VALUE_PLACEHOLDER` comme une valeur string ordinaire. Le parser doit le convertir explicitement en `null`.

### 8bis.2 Fichiers présents dans un backup Endpoint (9 tables observées)

| Fichier | Colonnes réelles (camelCase) | Utilité carto |
| :---- | :---- | :---- |
| `application_property.csv` | `changedBy, createdDate, key, modifiedDate, value` | **Clé-valeur** pour la config Endpoint : `ecp.componentCode`, `ecp.projectName`, `ecp.envName`, `ecp.company.organization`, `ecp.networks`, URL du CD primaire, etc. |
| `component_directory.csv` | `directoryContent, id, signature, version` | ⚠️ **1 seule ligne de data** contenant un gros **blob XML MADES** (`directoryContent`) \= l'annuaire complet du réseau reçu du CD. **C'est LA source principale** pour la carto (cf. §8bis.4) |
| `local_key_store.csv` | `certificateData, certificateID, certificateType, componentCode, componentDirectory, jksFile, keyData, validSince, validUntil` | **Ignoré** par le parser (contient clés privées, sensible) |
| `message_path.csv` | `allowedSenders, applied, intermediateBrokerCode, intermediateComponent, messagePathType, messageType, receiver, remote, status, transportPattern, validFrom, validTo` | Paths locaux définis sur cet Endpoint. `messagePathType` ∈ {`ACKNOWLEDGEMENT`, `BUSINESS`}, `transportPattern` ∈ {`DIRECT`, `INDIRECT`}, `status` ∈ {`ACTIVE`, `INVALID`} |
| `message_type.csv` | `remote, ttl, type` | Souvent vide en pratique. Catalogue local des business types connus |
| `message_upload_route.csv` | `createdDate, targetComponentCode` | Souvent vide en pratique. Routes AMQP sortantes |
| `messaging_statistics.csv` | `connectionStatus, deleted, lastMessageDown, lastMessageUp, localEcpInstanceId, remoteComponentCode, sumMessagesDown, sumMessagesUp` | **Indicateur d'activité réelle** par composant distant. `connectionStatus` ∈ {`NOT_CONNECTED`, `NOT_APPLICABLE`, `CONNECTED`, …}. Permet de tagger "lien actif récemment utilisé" vs "lien déclaré mais inactif" |
| `registration_store.csv` | `authenticationPrivateKey, encryptionPrivateKey, jksFile, registrationDirectoryId, signingPrivateKey, status` | **Ignoré** par le parser (clés privées) |

### 8bis.3 Stratégie de parsing — **ordre de priorité inversé**

La source de vérité pour la cartographie du réseau n'est **pas** le CSV `message_path.csv` (qui ne contient que les paths locaux de l'Endpoint, \~3 lignes). **C'est le XML embarqué dans `component_directory.csv`**.

**Ordre de lecture recommandé pour le parser** :

1. **Lire `application_property.csv`** → construire l'identité de l'Endpoint courant (code, org, projet, env, network, URL du CD)  
2. **Extraire le XML du `directoryContent` de `component_directory.csv`** → source primaire du graphe  
3. **Parser le XML MADES** (cf. §8bis.4) → liste des brokers, endpoints, componentDirectories avec leurs paths, certificats, timestamps  
4. **Enrichir avec `messaging_statistics.csv`** → marquer les liens actifs/inactifs (dernier message, volumétrie, statut de connexion)  
5. **Ignorer** : `local_key_store.csv`, `registration_store.csv` (sensibles), `message_type.csv`, `message_upload_route.csv` (souvent vides)  
6. **Complément informatif** : `message_path.csv` pour détecter des paths locaux spécifiques à cet Endpoint (peut différer de ce que le CD voit)

### 8bis.4 Schéma XML du `directoryContent` (MADES Component Directory)

**Namespace** : `http://mades.entsoe.eu/componentDirectory`

**Structure** :

\<components\>

  \<componentList\>

    \<broker\>            (0..n)

    \<endpoint\>          (0..n)

    \<componentDirectory\> (0..n)

  \</componentList\>

  \<metadata\>

    \<componentDirectoryMetadata\>

      \<componentDirectory\>{CD\_code}\</componentDirectory\>

      \<ttl\>{milliseconds}\</ttl\>

      \<contentID\>{integer}\</contentID\>

    \</componentDirectoryMetadata\>

  \</metadata\>

\</components\>

**Schéma commun à `broker`, `endpoint`, `componentDirectory`** :

| Élément | Cardinalité | Exemple / Valeurs |
| :---- | :---- | :---- |
| `organization` | 1 | `RTE`, `RTE-ATOM` |
| `person` | 1 | `DSIT-DPCM-IMGH-ECP` |
| `email` | 1 | `rte-dsit-mco-ecp@rte-france.com` |
| `phone` | 1 | `0033100000000` |
| `code` | 1 | **EIC code** — ex : `17V000000498771C`, `17VRTE-BROKER-01`, `17V000002014106G` |
| `type` | 1 | `BROKER` / `ENDPOINT` / `COMPONENT_DIRECTORY` |
| `networks/network` | 1..n | `internet` |
| `urls/url` (attr `network`) | 0..n | `amqps://host:5671` (broker), `https://host:8443/ECP_MODULE/` (CD) |
| `certificates/certificate` | 1..n | sous-éléments : `certificateID`, `type` (`AUTHENTICATION`/`ENCRYPTION`/`SIGNING`), `certificate` (base64), `validFrom`, `validTo` |
| `creationTimestamp` | 1 | `2025-01-15T13:53:00.163Z` (ISO 8601 avec `Z`) |
| `modificationTimestamp` | 1 | idem |
| `componentDirectory` | 1 | EIC du CD qui enregistre ce composant |
| `madesImplementation` | 0..1 | souvent vide |
| `paths/path` | 0..n (endpoints) | voir ci-dessous |
| `restriction` | 0..1 (brokers) | règles de transport du broker |

**Schéma d'un `<path>`** (enfant de `<endpoint>`) :

| Élément | Exemple |
| :---- | :---- |
| `senderComponent` | vide \= `*` (tous) ; sinon EIC du sender autorisé |
| `messageType` | `*` (tous) ou business-type précis (ex : `test`, `RSMD`, …) |
| `path` | `INDIRECT:{brokerCode}` ou `DIRECT` |
| `validFrom` | ISO 8601 avec `Z` |
| `validTo` | ISO 8601 avec `Z` (peut être absent \= valable pour toujours) |

⚠️ **Deux formats de date coexistent** dans un backup :

- **CSV** : `2025-03-12T15:34:48.560980651` (sans Z, avec nanos)  
- **XML MADES** : `2025-03-18T15:00:00.000Z` (avec Z, millisecondes)

Le parser doit gérer les deux.

### 8bis.5 Modèle de données dérivé (cible du parser)

Snapshot (id, label, env, uploaded\_at, uploaded\_by, source\_endpoint\_code, cd\_code)

 ├── Component (eic, type, organization, person, email, phone,

 │              home\_cd\_code, networks\[\], creation\_ts, modification\_ts,

 │              source\_type: 'XML\_CD' | 'LOCAL\_CSV')

 ├── ComponentUrl (component\_eic, network, url)      ← 1 component → n urls

 ├── Certificate (component\_eic, cert\_id, cert\_type, valid\_from, valid\_to)

 ├── MessagePath (receiver\_eic, sender\_eic\_or\_wildcard, message\_type\_or\_wildcard,

 │                transport\_pattern: 'DIRECT'|'INDIRECT',

 │                intermediate\_broker\_eic,

 │                valid\_from, valid\_to,

 │                source: 'XML\_CD\_PATHS' | 'LOCAL\_CSV\_PATHS')

 ├── MessagingStatistic (source\_endpoint\_code, remote\_component\_code,

 │                       connection\_status, last\_message\_up, last\_message\_down,

 │                       sum\_messages\_up, sum\_messages\_down, deleted)

 └── AppProperty (key, value)   ← config brute si besoin d'introspection

### 8bis.6 Contenu d'un backup CD (à valider)

**Non observé directement** (le backup CD n'a pas encore été récupéré). D'après la doc ECP : 13 tables CSV, dont :

- `component_directory.csv` (côté CD : plus riche, contient potentiellement tous les CD connus)  
- `message_path.csv` \+ `message_path_receiver.csv` \+ `message_path_sender.csv` (relationnels)  
- `synchronized_directories.csv` (source des liens CD↔CD)  
- `registration_requests.csv` (historique complet des composants enregistrés)

**À valider dès récupération** : est-ce que le CD utilise le même pattern « 1 ligne XML » que l'Endpoint, ou est-ce qu'il stocke vraiment en tables plates relationnelles ? Cette question est ouverte et conditionne le parser CD.

### 8bis.7 Validation d'un upload

Pour qu'un snapshot soit accepté :

- Le zip doit être décompressable et contenir au moins `application_property.csv` \+ `component_directory.csv`  
- `component_directory.csv` doit contenir une ligne de data avec un `directoryContent` XML parsable (namespace `http://mades.entsoe.eu/componentDirectory`)  
- Si un CSV attendu manque → **warning** affiché, le snapshot est parsé avec les données disponibles  
- Si le zip est illisible, absent du XML, ou namespace XML inconnu → **erreur bloquante**

---

## 9\. 📊 Données de référence — le "registry EIC"

L'app s'appuie sur un **fichier de référence JSON** (maintenu par l'équipe MCO) qui fait la correspondance entre :

- **EIC code ↔ Organisation** (ex : `10X1001A1001A345 → Terna`)  
- **Organisation ↔ Pays et coordonnées GPS** (pour le positionnement sur la carte)  
- **Criticité des Business Applications RTE**  
- **Règles de classification message\_type → process métier**

Ce fichier est **rechargeable à chaud** via l'interface admin. Pas besoin de redéployer l'app pour ajouter un nouveau partenaire.

Une version initiale a déjà été créée (\~17 partenaires \+ 14 BA \+ 6 Endpoints RTE \+ 10 processes documentés).

### 9.1 Règles de classification `message_type → process métier`

Les `message_type` ECP (= MADES `business-type`) sont des chaînes libres matchant le regex `[A-Za-z0-9-]+`. **ECP ne fournit aucune classification native** : le rattachement à un process métier (VP, CORE, MARI, PICASSO, TP, UK-CC-IN) est une règle 100% RTE, portée par le registry EIC.

Le registry définit **3 mécanismes évalués en cascade** pour chaque message\_type rencontré :

**Niveau 1 — Mapping exact** (priorité absolue)

"messageTypeClassification": {

  "exact": {

    "RSMD": "VP",

    "CAPVP": "VP",

    "IDCCOR": "CORE",

    "CGM": "CORE",

    "MARI-ENERGY-ACT": "MARI",

    "PICASSO-OFFER": "PICASSO"

  }

}

**Niveau 2 — Patterns préfixe/regex** (fallback)

"patterns": \[

  { "match": "^VP-.\*",     "process": "VP" },

  { "match": "^CORE-.\*",   "process": "CORE" },

  { "match": "^TP-.\*",     "process": "TP" },

  { "match": "^UK-CC-.\*",  "process": "UK-CC-IN" }

\]

**Niveau 3 — Fallback `UNKNOWN`**

Tout message\_type non classé est bucketé `UNKNOWN` et affiché en gris neutre. La page admin (§11) liste ces types pour revue périodique par le Tech Lead, qui enrichit le registry au besoin.

**Règles d'évaluation** :

1. Pour chaque message\_type : essayer `exact` → sinon essayer `patterns` dans l'ordre → sinon `UNKNOWN`  
2. Le process résolu est **stocké en base au moment du parsing** (pas recalculé à chaque affichage), pour performance et reproductibilité historique  
3. Le rechargement à chaud du registry propose une action explicite **"Re-classifier les snapshots existants"** — jamais automatique, pour préserver la traçabilité

**Pourquoi ce design** :

- Le mapping `exact` couvre les cas les plus fréquents en restant lisible par l'équipe MCO (non-devs)  
- Les `patterns` absorbent les nouveaux types sans modification à chaque ajout  
- Le bucket `UNKNOWN` est la soupape qui empêche un snapshot de planter sur un type inconnu  
- Le stockage du process résolu permet de faire évoluer la classification sans perdre l'historique

---

## 10\. 🚀 Scénarios d'usage concrets

### Scénario A — Incident OCAPPI

Un incident impacte OCAPPI en PROD. L'exploitant veut savoir **quels flux ECP sont coupés**. → Il ouvre la carto, active le snapshot PROD, tape "OCAPPI" dans la recherche, clique sur "Analyse d'impact". Il voit immédiatement les 5 Endpoints concernés et tous les partenaires externes derrière. Temps : **\< 2 minutes**.

### Scénario B — Demande ENTSO-E sur le flux VP

Un collègue de l'équipe VP demande quels partenaires voient leur flux RSMD. L'exploitant active le snapshot PROD, filtre sur le process "VP", coche la direction "IN" et le type de fichier "RSMD". → La carte affiche les 3 partenaires concernés (Amprion, TransnetBW, Elia). Export CSV pour envoi par mail.

### Scénario C — Préparation d'une MEP en PFRFI

Avant une mise en prod, l'exploitant veut vérifier que PROD et PFRFI ont la même topologie. Il ouvre le snapshot PFRFI, regarde, puis bascule sur le snapshot PROD. *(Vue diff à venir en v2)*

### Scénario D — Onboarding nouveau membre MCO

Un nouveau collègue doit comprendre rapidement le réseau ECP RTE. L'exploitant lui partage l'app, il explore visuellement en 15 minutes ce qui prendrait des semaines à assimiler via les IHM ECP.

---

## 11\. 🎨 Interface utilisateur

**Stack visuelle**: carte Leaflet \+ fond OpenStreetMap \+ composants React modernes, interface en français.

**Navigation** :

- **Page login** : username \+ password  
- **Page carto** (page principale) : carte \+ panneau filtres à gauche \+ panneau détail à droite  
- **Page historique** : liste des snapshots passés avec filtres  
- **Page upload** : formulaire de création de snapshot  
- **Page admin** (techlead uniquement) : gestion users, rechargement registry, revue des message types non classés

**Accessibilité** : conforme WCAG 2.1 AA, navigable au clavier, compatible lecteur d'écran.

---

## 12\. 🏗️ Hébergement et déploiement

### 12.1 Infrastructure

L'app est hébergée sur **la même VM** que la stack de supervision ECP (VM `ECPSURECSA001VM` pour PFRFI, `ECPSUPRDSA001VM` pour PROD). Un Nginx commun route entre les applications :

- `eccosp-supervision-pfrfi.rte-france.com` → Grafana \+ Prometheus \+ Alertmanager  
- `eccosp-netmap-pfrfi.rte-france.com` → l'app de carto  
- Équivalents sans `-pfrfi` pour la PROD

Les 2 FQDN pointent vers la même IP de VM, Nginx fait le tri en interne selon le nom demandé.

### 12.2 Base de données

**SQLite embarquée** — choix pragmatique pour éviter une demande d'infra PostgreSQL (délai long chez RTE). Suffisant pour le volume MCO attendu (\<10 utilisateurs concurrents, \~100 snapshots historisés). Migration vers PostgreSQL possible plus tard si besoin, sans refonte du code.

### 12.3 Authentification

JWT local avec 3 rôles (`exploitant`, `techlead`, `reader`). Mots de passe bcrypt. Durée de session 8h (journée de travail). Pas de SSO au MVP.

### 12.4 Sauvegarde

- Base de données \+ fichiers uploadés sauvegardés **quotidiennement** (cron)  
- Rétention des backups : 30 jours  
- Historique des snapshots : **illimité** (purge manuelle par techlead)

---

## 13\. 🗓️ Ce qui reste à faire

### 13.1 Actions administratives (en parallèle, \~5 jours délai RTE)

- [ ] **Ticket DNS 1** : création FQDN `eccosp-supervision-pfrfi.rte-france.com` (pour la stack supervision)  
- [ ] **Ticket DNS 2** : création FQDN `eccosp-netmap-pfrfi.rte-france.com` (pour l'app de carto)  
- [ ] **Ticket PKI** : certificat SSL avec SAN couvrant les 2 FQDN  
- [ ] **Mise à jour Confluence** (inventaire FQDN) une fois les DNS créés

### 13.2 Actions préparatoires

- [ ] Validation du document fonctionnel v1.2 par le Tech Lead  
- [ ] Validation de la stack technique (déjà documentée : NestJS \+ Prisma \+ SQLite \+ React \+ Leaflet)  
- [x] ~~Extraction d'un snapshot réel Endpoint pour valider le parser~~ → **fait (avril 2026\)**, analyse intégrée en §8bis. Backup `ECP-INTERNET-2` récupéré et analysé.  
- [ ] **Récupérer un backup du CD RTE** pour valider §8bis.6 (est-ce aussi du XML embarqué ou des tables plates ?)  
- [ ] Récupération des **vrais EIC codes** des 6 Endpoints RTE (INTERNET-1, INTERNET-2, CWERPN, PCN-\*) pour compléter le registry  
- [ ] Clarification de l'acronyme "DBAG" et de la matrice des messages PICASSO  
- [ ] Trancher la nomenclature Endpoints : **PCN-1 / PCN-2 / PCN-3** ou **PCN-EP-1 / PCN-EP-2 / PCN-EP-3** (incohérence entre §7 et §8 à lever avant codage)  
- [ ] Définir la liste des clés `.properties` à blacklister à l'upload (au minimum `*.password`, `*.secret`, `*.keystore.password` — à compléter avec l'équipe sécurité)  
- [x] ~~Format des fichiers de backup ECP~~ → clarifié en §8bis (zip de CSV avec XML embarqué, formats précis)  
- [x] ~~Schéma des données extraites~~ → clarifié en §8bis.5 (modèle dérivé)  
- [x] ~~Règle de construction des liens sur la carte~~ → clarifiée en §5bis  
- [x] ~~Règle de classification `message_type → process`~~ → clarifiée en §9.1

### 13.3 Développement

- [ ] Le développement est **entièrement délégué à Claude Code** via une documentation technique complète déjà rédigée (10 fichiers couvrant architecture, data model, parsing, API, frontend, déploiement, sécurité, conventions, exploitation, roadmap)  
- [ ] Livraison attendue en un MVP complet

### 13.4 Mise en production

- [ ] Installation Docker \+ Nginx sur la VM  
- [ ] Déploiement de la stack supervision (Prometheus \+ Grafana \+ Alertmanager)  
- [ ] Déploiement de l'app de carto  
- [ ] Création des utilisateurs MCO  
- [ ] Formation des exploitants MCO (démo 30 min \+ documentation d'usage)  
- [ ] Premier snapshot réel en conditions d'exploitation

---

## 14\. 🎯 Critères de succès

Le MVP sera considéré **réussi** si dans les 3 mois suivant la mise en prod :

- L'équipe MCO crée **au moins 1 snapshot PROD par semaine** sans difficulté  
- Le temps moyen pour répondre à une question de topologie passe de **30 minutes à moins de 2 minutes**  
- **Au moins 1 analyse d'impact** (scénario type "incident OCAPPI") est utilisée en condition réelle  
- **Aucun incident critique** (perte de données, app down) sur la période  
- Le registry EIC est **mis à jour au moins 1 fois** (preuve que l'autonomie de maintenance fonctionne)

---

## 15\. 📚 Livrables déjà prêts

Tous ces documents existent déjà et sont disponibles pour les parties concernées :

| Livrable | Usage |
| :---- | :---- |
| **Spec fonctionnelle détaillée** (v0.3) | Cadrage exhaustif des User Stories et règles métier |
| **Matrice métier Endpoint × Process × BA** | Référence MCO complète des 6 Endpoints avec tous les message types |
| **Registry EIC initial** (JSON) | Base de référence pour le positionnement des GRT sur la carte |
| **Schéma de base de données** (Prisma) | Structure des données (pour Claude Code) |
| **Documentation technique** (10 docs) | Brief complet pour Claude Code |
| **Runbook d'installation VM** | Procédure de déploiement sur VM RTE |

---

## 16\. ⚠️ Risques et points d'attention

| Risque | Impact | Mitigation |
| :---- | :---- | :---- |
| Délais administratifs RTE (DNS, PKI) | Retard démarrage | Demandes soumises en parallèle dès maintenant |
| Dérive de scope (ajout de features hors MVP) | Projet qui ne sort jamais | Roadmap claire, toute évolution passe par validation Tech Lead |
| Registry EIC incomplet au démarrage | Nœuds mal positionnés | Processus de rechargement à chaud \+ badge visuel "position par défaut" |
| Bug dans le parsing d'un backup ECP atypique | Snapshot incomplet | Archivage des fichiers bruts pour re-parsing ultérieur \+ tests unitaires robustes côté Claude Code |
| Départ du porteur du projet | Projet orphelin | Documentation complète (ce document \+ les 10 docs techniques) pour reprise par un tiers |

---

## 17\. 🎬 En résumé

**Ce qu'on fait** : une carto visuelle du réseau ECP RTE, pour MCO, avec upload manuel de snapshots.

**Ce qu'on ne fait pas** : scraping live, alerting, logs, comparaison de snapshots, édition manuelle.

**Pourquoi c'est pertinent** : gain de temps factor 15 sur les questions de topologie \+ support à l'onboarding \+ mémoire partagée de l'équipe.

**Prochain jalon** : validation de ce document par le Tech Lead, puis lancement du développement par Claude Code en parallèle des actions administratives.

---

*Fin du document fonctionnel v1.2 — 2026-04-17*  
