# Carto ECP Network Map — Design slice #1

|  |  |
| :---- | :---- |
| **Version** | 1.0 |
| **Date** | 2026-04-18 |
| **Auteur brainstorming** | Anthony Rodrigues (AR46850T) — DPCM/IMGH, assisté par Claude |
| **Document source** | `carto-ecp-document-fonctionnel-v1.2.md` (17 avril 2026) |
| **Cible** | Spec d'entrée pour le skill `superpowers:writing-plans` |
| **Statut** | À valider par le Tech Lead ECP |

---

## 1. Contexte et objectif du slice

Ce document formalise le **premier slice vertical** de l'application ECP Network Map,
issue du document fonctionnel v1.2. L'objectif du slice #1 est de livrer **la chaîne
complète** upload d'un zip Endpoint → parsing → persistance → affichage carte, sur
un seul Endpoint réel (`ECP-INTERNET-2`, EIC `17V000000498771C`, env `OPF`), **sans
authentification**, en **dev local uniquement**. Les features annexes (recherche,
filtres, toggles couches, export CSV, historique complet, admin registry, auth,
déploiement VM RTE) sont reportées à des slices ultérieurs.

La décision de démarrer par un vertical slice (option C du brainstorming) a été
prise pour valider au plus tôt la faisabilité technique du parser (format MADES +
8 CSV ECP) contre un backup réel avant d'investir sur la partie auth/admin/historique.

## 2. Hypothèses validées

Les décisions suivantes ont été actées lors du brainstorming et **ne sont pas à re-discuter**
dans le plan d'implémentation :

- **Approche** : vertical slice upload → parser → carte, sans auth.
- **Données de test** : backup réel `17V000000498771C_2026-04-17T21_27_17Z/` présent
  dans `tests/fixtures/`. Le parser sera développé et testé contre ce backup, pas
  contre des fixtures synthétiques.
- **Registry de référence** : `X_eicCodes.csv` ENTSO-E officiel (~14 929 codes,
  présent dans `tests/fixtures/`), complété par un overlay RTE-custom JSON qui sera
  préchargé avec les ~10 orgas clés (RTE, SwissGrid, Terna, REE, Elia, TenneT,
  Amprion, TransnetBW, EirGrid, ENTSO-E, Statnett, Energinet).
- **Structure** : monorepo pnpm workspaces (apps/api + apps/web + packages/shared
  + packages/registry).
- **Stack** :
  - Backend : NestJS 10, Prisma 5, SQLite, `fast-xml-parser`, `adm-zip`,
    `csv-parse/sync`, Zod, nestjs-pino, Helmet, @nestjs/throttler.
  - Frontend : React 18, Vite, TypeScript, shadcn/ui, Tailwind CSS, Radix, React
    Router v6, Zustand (+ persist), React-Leaflet, leaflet-curve.
  - Package manager : pnpm. Node 20 LTS.
- **Langue UI** : français partout. Format date `dd/MM/yyyy HH:mm` (`fr-FR`).
- **Environnement `envName`** : accepté en texte libre à l'upload (pas de whitelist).
  Le backup de test utilise `OPF` (à côté des `PROD` et `PFRFI` mentionnés en §5
  du document fonctionnel).

## 3. Périmètre slice #1

### 3.1 Dans le slice (IN)

| Ref fonctionnel | Description |
| :---- | :---- |
| F1 simplifié | Upload d'un seul zip Endpoint (pas le paquet complet 7 zips), avec label + envName libre |
| Parsing complet | `application_property.csv`, `component_directory.csv` (avec XML MADES embarqué), `messaging_statistics.csv`, `message_path.csv` |
| Persistance | SQLite via Prisma, archivage du zip tel quel dans `storage/snapshots/{uuid}.zip` |
| F2 | Carte Leaflet (fond OSM) avec nœuds positionnés (RTE au centre, externes géolocalisés) et liens colorés par process |
| F3 minimal | Panneau latéral affichant les infos d'un nœud ou d'un edge au clic |
| Registry | Lookup in-memory bootstrap (CSV ENTSO-E + overlay JSON), classification `messageType → process` selon §9.1 |
| Snapshot picker | Sélecteur permettant de basculer entre snapshots uploadés |

### 3.2 Hors slice (OUT — reporté)

- F4 recherche, F5 filtres, F6 toggles couches
- F7 export CSV, F8 historique complet (renommage, suppression, activation)
- F9 analyse d'impact BA, F10 vue par process en 1 clic
- Upload multi-zips (CD + 6 Endpoints + config `.properties`)
- Admin page (rechargement registry à chaud, liste des messageTypes UNKNOWN,
  re-classification)
- Auth JWT + rôles (`exploitant`, `techlead`, `reader`)
- Dockerfile + déploiement VM RTE + Nginx + HTTPS
- Sauvegarde cron / rétention 30 jours
- Vue diff entre 2 snapshots

## 4. Architecture globale

```
┌─────────────────────────────────────────────────────────────────┐
│                    Navigateur (Chrome/Edge)                     │
│  React 18 + Vite + TypeScript + shadcn/ui + Tailwind            │
│  ├─ UploadPage           (drag & drop .zip)                     │
│  ├─ MapPage              (React-Leaflet + leaflet-curve)        │
│  ├─ DetailPanel          (clic nœud ou edge → fiche)            │
│  └─ SnapshotSelector     (picker du snapshot actif)             │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP JSON + multipart
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   NestJS 10 (apps/api)                          │
│  ├─ SnapshotsController                                         │
│  ├─ IngestionModule                                             │
│  │    ZipExtractor → CsvReader → XmlMadesParser                 │
│  │    → NetworkModelBuilder → SnapshotPersister                 │
│  ├─ RegistryModule       (lookup EIC in-memory)                 │
│  ├─ GraphModule          (build payload nodes/edges)            │
│  └─ PrismaService        (ORM SQLite)                           │
└──────────────────┬──────────────────────────────────────────────┘
                   ▼
   ┌──────────────────────┐    ┌──────────────────────┐
   │  SQLite (prisma.db)  │    │  storage/snapshots/  │
   │  snapshots, comp...  │    │  {uuid}.zip          │
   └──────────────────────┘    └──────────────────────┘
```

**Invariant fondamental** : le backend ne communique **jamais** avec un ECP réel.
Il lit un zip uploadé, parse, persiste, et sert un graphe au front. Conforme §4
du document fonctionnel ("application statique").

## 5. Structure du monorepo

```
2026-business-rte-netmap/
├── apps/
│   ├── api/                        # NestJS backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── prisma/
│   │   │   │   ├── prisma.service.ts
│   │   │   │   └── schema.prisma
│   │   │   ├── snapshots/
│   │   │   │   ├── snapshots.controller.ts
│   │   │   │   ├── snapshots.service.ts
│   │   │   │   └── dto/
│   │   │   ├── ingestion/
│   │   │   │   ├── zip-extractor.service.ts
│   │   │   │   ├── csv-reader.service.ts
│   │   │   │   ├── xml-mades-parser.service.ts
│   │   │   │   ├── network-model-builder.service.ts
│   │   │   │   ├── snapshot-persister.service.ts
│   │   │   │   └── types.ts
│   │   │   ├── registry/
│   │   │   │   ├── registry.service.ts
│   │   │   │   └── registry.module.ts
│   │   │   ├── graph/
│   │   │   │   ├── graph.service.ts
│   │   │   │   └── graph.controller.ts
│   │   │   └── common/
│   │   │       ├── null-value-normalizer.ts
│   │   │       ├── date-parser.ts
│   │   │       └── errors/
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                        # React frontend
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── UploadPage.tsx
│       │   │   └── MapPage.tsx
│       │   ├── components/
│       │   │   ├── Map/
│       │   │   │   ├── NetworkMap.tsx
│       │   │   │   ├── NodeMarker.tsx
│       │   │   │   ├── EdgePath.tsx
│       │   │   │   └── useMapData.ts
│       │   │   ├── DetailPanel/
│       │   │   ├── SnapshotSelector/
│       │   │   └── ui/
│       │   ├── lib/
│       │   │   ├── api.ts
│       │   │   └── process-colors.ts
│       │   └── styles/
│       ├── index.html
│       ├── vite.config.ts
│       ├── tailwind.config.ts
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   ├── shared/                     # types TS partagés api ↔ web
│   │   ├── src/
│   │   │   ├── graph.ts
│   │   │   ├── snapshot.ts
│   │   │   └── registry.ts
│   │   └── package.json
│   │
│   └── registry/                   # données de référence
│       ├── eic-entsoe.csv          # copie de X_eicCodes.csv
│       ├── eic-rte-overlay.json
│       └── README.md
│
├── storage/                        # gitignored
│   └── snapshots/{uuid}.zip
│
├── tests/
│   └── fixtures/
│       ├── 17V000000498771C_2026-04-17T21_27_17Z/
│       └── X_eicCodes.csv
│
├── docs/
│   ├── superpowers/specs/
│   │   └── 2026-04-18-carto-ecp-slice-1-design.md
│   └── carto-ecp-document-fonctionnel-v1.2.md
│
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
└── README.md
```

**Règles** :
- `packages/shared` contient les DTOs partagés (aucune duplication api/web).
- `packages/registry` contient des **données**, pas de code.
- `storage/` est gitignored. Contient les zips archivés pour re-parsing éventuel
  (mitigation §16 risque #4 du document fonctionnel).
- Scripts top-level : `pnpm dev`, `pnpm dev:api`, `pnpm dev:web`, `pnpm test`,
  `pnpm build`, `pnpm lint`, `pnpm typecheck`.

## 6. Pipeline de parsing (backend — IngestionModule)

### 6.1 Contrat d'étape

Chaque étape est un service NestJS **pur** (pas d'I/O hors des deux bornes),
stateless, testable sur fixture isolée.

```
ZipExtractor → CsvReader → XmlMadesParser → NetworkModelBuilder → SnapshotPersister
        ↓           ↓              ↓                   ↓
   raw files   typed rows    typed MADES tree   NetworkSnapshot DTO
```

### 6.2 ZipExtractor

- **Entrée** : `Buffer` du zip uploadé.
- **Sortie** : `{ files: Map<string, Buffer> }` (clé = nom du fichier).
- **Lib** : `adm-zip`.
- **Validation early-fail** : présence obligatoire de `application_property.csv`
  + `component_directory.csv`. Sinon `UploadValidationException` (code
  `MISSING_REQUIRED_CSV`).
- **Refus DoS** : toute entrée > 50 MB dans le zip bloque l'import.
- **Whitelist** des noms de fichiers chargés en mémoire : 6 CSV sur les 8 du
  §8bis.2. Les 2 fichiers sensibles (`local_key_store.csv`,
  `registration_store.csv`) sont **explicitement exclus de l'extraction mémoire**,
  même s'ils restent présents dans le zip archivé sur disque (pour un
  éventuel re-parsing futur). Tout autre fichier du zip est ignoré silencieusement.

### 6.3 CsvReader

- **Entrée** : `Buffer` + nom logique (ex. `application_property`).
- **Sortie** : `Row[]` typés par fichier (ex. `AppPropertyRow[]`, `MessagePathRow[]`).
- **Lib** : `csv-parse/sync` (delimiter `;`, `columns: true`, `trim: true`).
- **Post-processing** :
  - `NULL_VALUE_PLACEHOLDER` → `null` (fonction `normalizeNull`).
  - Wildcards `*` préservés.
  - Booléens `true`/`false` → boolean natif.
  - Dates ISO nano (`2025-03-12T15:34:48.560980651`) : regex + troncature nanos
    au ms → `Date` JS valide (util `date-parser.ts`).
- **Validation Zod stricte par fichier**. Ligne invalide → warning (ligne ignorée),
  **jamais throw** (philosophie tolérante, §8 du doc fonctionnel).

### 6.4 XmlMadesParser

- **Entrée** : string du `directoryContent` (unique ligne data de
  `component_directory.csv`).
- **Sortie** : `MadesComponentDirectory` typé :
  ```
  {
    cdCode: string, contentId: number, ttl: number,
    brokers: MadesBroker[],
    endpoints: MadesEndpoint[],
    componentDirectories: MadesComponentDirectoryRef[]
  }
  ```
- **Lib** : `fast-xml-parser` (`ignoreAttributes: false`, `attributeNamePrefix: '@_'`).
- **Namespace** : vérification stricte de `http://mades.entsoe.eu/componentDirectory`.
  Sinon `UnknownMadesNamespaceException` bloquante.
- **Dates** : format ISO Z ms parsées par `date-parser.ts`.
- **Paths** : chaque `<path>` mappé vers
  `{ senderComponent: string|null, messageType: string, path: { type: 'DIRECT'|'INDIRECT', brokerCode: string|null }, validFrom, validTo }`.
  Le texte `"INDIRECT:{broker}"` est splitté sur `:`. Un `<path>DIRECT</path>`
  donne `brokerCode = null`.
- **Valeurs vides** : `<senderComponent/>` ou absence = `null` (équivaut à
  wildcard `*` dans la logique métier).

### 6.5 NetworkModelBuilder

- **Entrée** : `{ appProperties, madesTree, messagingStats, localMessagePaths }`.
- **Sortie** : `NetworkSnapshot`  :
  ```
  {
    meta: { envName, sourceEndpointCode, cdCode, organization, networks[] },
    components: ComponentRecord[],
    messagePaths: MessagePathRecord[],
    messagingStats: MessagingStatRecord[],
    warnings: Warning[]
  }
  ```
- **Enrichissement registry** : pour chaque composant, `RegistryService.resolve(eic,
  organization)` renvoie `displayName, country, lat, lng, isDefaultPosition`.
  Algorithme en §7.
- **Classification** : chaque `MessagePath` se voit assigner un `process` via
  `RegistryService.classifyMessageType(messageType)` (cascade exact → patterns
  → `UNKNOWN`). Résolu **à l'ingestion**, stocké en DB. Jamais recalculé à
  l'affichage (§9.1 règle 2 du doc fonctionnel).
- **Direction IN/OUT** : heuristique — si `receiver` est dans les composants RTE
  (EIC préfixé `17V` **et** organization `RTE`) ⇒ `IN`, sinon `OUT`.
- **Source tag** : `'XML_CD_PATHS'` pour les paths issus du MADES, `'LOCAL_CSV_PATHS'`
  pour ceux issus de `message_path.csv`.
- **Dédoublonnage** : **non fait ici**. Les paths bruts sont conservés. L'agrégation
  visuelle par couple (endpoint, partenaire) se fait dans `GraphService` au
  moment de servir `/graph` (§8 ci-dessous).

### 6.6 SnapshotPersister

- **Entrée** : `NetworkSnapshot` + `zipBuffer` + `uploadMeta`.
- **Sortie** : `{ snapshotId, warnings }`.
- **Séquence** :
  1. Génère `snapshotId` (uuid v4).
  2. Sauvegarde zip dans `storage/snapshots/{snapshotId}.zip`.
  3. Transaction Prisma : `Snapshot` → `Component` + `ComponentUrl` → `MessagePath`
     → `MessagingStatistic` → `AppProperty`.
  4. Si transaction échoue → supprime le zip archivé (pas de leak).

### 6.7 Philosophie tolérante — tableau récap

| Gravité | Déclencheur | Comportement |
| :---- | :---- | :---- |
| Bloquant 400 | Zip illisible / corrompu | Pas de Snapshot créé |
| Bloquant 400 | `application_property.csv` ou `component_directory.csv` absent | Idem |
| Bloquant 400 | `component_directory.csv` vide ou sans ligne de data | Idem |
| Bloquant 400 | XML non parsable ou namespace différent de `http://mades.entsoe.eu/componentDirectory` | Idem |
| Bloquant 413 | Zip > 50 MB | Idem |
| Warning 201 | CSV annexe manquant (`messaging_statistics`, etc.) | Snapshot créé, feature partielle |
| Warning | Ligne CSV invalide | Ligne ignorée, compteur warning |
| Warning | EIC absent du registry | Position par défaut Bruxelles + badge visuel |
| Warning | `messageType` non classé | Process = `UNKNOWN`, liste exposée via warnings |
| Warning | `validTo` < date snapshot | Path stocké mais tagué `expired=true` |

## 7. Registry EIC

### 7.1 Architecture

```
RegistryService (singleton NestJS, chargé au boot)
├── eicIndex: Map<eic, EntsoeEntry>     # depuis eic-entsoe.csv
├── rteOverlay: RteOverlay              # depuis eic-rte-overlay.json
└── classifier: MessageTypeClassifier   # règles §9.1
```

### 7.2 Format `eic-rte-overlay.json`

Fichier JSON versionné en git, rechargé au boot uniquement (rechargement à chaud
reporté à un slice ultérieur).

```json
{
  "version": "2026-04-18",
  "rteEndpoints": [
    {
      "eic": "17V000000498771C",
      "code": "ECP-INTERNET-2",
      "displayName": "INTERNET-2",
      "process": "UK-CC-IN",
      "lat": 48.8918,
      "lng": 2.2378,
      "city": "Paris - La Défense"
    }
  ],
  "rteComponentDirectory": {
    "eic": "17V000002014106G",
    "displayName": "CD RTE",
    "lat": 48.8918,
    "lng": 2.2378
  },
  "rteBusinessApplications": [
    { "code": "OCAPPI", "criticality": "P1" }
  ],
  "organizationGeocode": {
    "RTE":         { "lat": 48.8918, "lng": 2.2378,  "country": "FR" },
    "SwissGrid":   { "lat": 47.5596, "lng": 7.9086,  "country": "CH" },
    "Terna":       { "lat": 41.9028, "lng": 12.4964, "country": "IT" },
    "REE":         { "lat": 40.4168, "lng": -3.7038, "country": "ES" },
    "Elia":        { "lat": 50.8503, "lng": 4.3517,  "country": "BE" },
    "TenneT":      { "lat": 52.3702, "lng": 4.8952,  "country": "NL" },
    "Amprion":     { "lat": 51.5136, "lng": 7.4653,  "country": "DE" },
    "TransnetBW":  { "lat": 48.7758, "lng": 9.1829,  "country": "DE" },
    "EirGrid":     { "lat": 53.3498, "lng": -6.2603, "country": "IE" },
    "ENTSO-E":     { "lat": 50.8503, "lng": 4.3517,  "country": "BE" },
    "Statnett":    { "lat": 59.9139, "lng": 10.7522, "country": "NO" },
    "Energinet":   { "lat": 55.6761, "lng": 12.5683, "country": "DK" }
  },
  "countryGeocode": {
    "FR":       { "lat": 46.6, "lng": 2.4 },
    "DE":       { "lat": 51.2, "lng": 10.4 },
    "BE":       { "lat": 50.5, "lng": 4.5 },
    "IT":       { "lat": 41.9, "lng": 12.5 },
    "DEFAULT":  { "lat": 50.8503, "lng": 4.3517, "label": "Bruxelles (défaut)" }
  },
  "messageTypeClassification": {
    "exact": {
      "RSMD": "VP", "CAPVP": "VP",
      "IDCCOR": "CORE", "CGM": "CORE",
      "MARI-ENERGY-ACT": "MARI",
      "PICASSO-OFFER": "PICASSO"
    },
    "patterns": [
      { "match": "^VP-.*",    "process": "VP" },
      { "match": "^CORE-.*",  "process": "CORE" },
      { "match": "^TP-.*",    "process": "TP" },
      { "match": "^UK-CC-.*", "process": "UK-CC-IN" }
    ]
  },
  "processColors": {
    "TP":       "#3b82f6",
    "UK-CC-IN": "#f97316",
    "CORE":     "#a855f7",
    "MARI":     "#22c55e",
    "PICASSO":  "#f59e0b",
    "VP":       "#ec4899",
    "MIXTE":    "#4b5563",
    "UNKNOWN":  "#9ca3af"
  }
}
```

### 7.3 Algorithme `resolveComponent(eic, organization)`

```
1. Match rteEndpoints[].eic           → lat/lng/displayName précis
2. Match rteComponentDirectory.eic    → lat/lng/displayName précis
3. Lookup eicIndex[eic] (ENTSO-E)     → EntsoeEntry (nom, pays)
   3.a organizationGeocode[org] existe → lat/lng orga
   3.b countryGeocode[isoCountry] existe → lat/lng pays
   3.c countryGeocode.DEFAULT + warning + isDefaultPosition=true
4. Aucun match eicIndex               → DEFAULT + warning critique
```

### 7.4 Classifier `classifyMessageType`

```ts
classify(messageType: string): ProcessKey {
  if (exact[messageType]) return exact[messageType];
  for (const { match, process } of patterns) {
    if (new RegExp(match).test(messageType)) return process;
  }
  return 'UNKNOWN';
}
```

Les regex sont compilées une fois au boot.

## 8. API REST

### 8.1 Endpoints

```
POST   /api/snapshots
  Content-Type: multipart/form-data
  Fields: zip (File, required), label (string, required), envName (string, required)
  201 → { id, label, envName, sourceEndpointCode, cdCode, uploadedAt, warnings[] }
  400 → INVALID_UPLOAD, MISSING_REQUIRED_CSV, UNKNOWN_MADES_NAMESPACE
  413 → PAYLOAD_TOO_LARGE

GET    /api/snapshots
  Query: ?envName=OPF (optionnel)
  200 → SnapshotSummary[]

GET    /api/snapshots/:id
  200 → SnapshotDetail
  404 → SNAPSHOT_NOT_FOUND

GET    /api/snapshots/:id/graph
  200 → GraphResponse
  404 → SNAPSHOT_NOT_FOUND
```

La suppression (`DELETE`) est reportée à un slice ultérieur.

### 8.2 Payload `/graph`

```ts
type NodeKind = 'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT';

type Node = {
  id: string; eic: string; kind: NodeKind;
  displayName: string; organization: string;
  country: string | null;
  lat: number; lng: number; isDefaultPosition: boolean;
  networks: string[];
  process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string; modificationTs: string;
};

type Edge = {
  id: string;
  fromEic: string; toEic: string;
  direction: 'IN' | 'OUT';
  process: ProcessKey;        // VP | CORE | MARI | PICASSO | TP | UK-CC-IN | MIXTE | UNKNOWN
  messageTypes: string[];
  transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: {
    connectionStatus: string | null;
    lastMessageUp: string | null;
    lastMessageDown: string | null;
    isRecent: boolean;
  };
  validFrom: string;
  validTo: string | null;
};

type GraphResponse = {
  bounds: { north: number; south: number; east: number; west: number };
  nodes: Node[];
  edges: Edge[];
};
```

### 8.3 Règles d'agrégation (§5bis du doc fonctionnel)

Dans `GraphService` :

1. Group `MessagePath` par clé `(fromEic, toEic)`.
2. Si ≥ 2 processes distincts dans le groupe → `process = 'MIXTE'`.
3. Sinon `process` = celui du groupe.
4. Fusion des paths `ACKNOWLEDGEMENT` + `BUSINESS` entre même couple (1 seul edge).
5. `isRecent = true` si `lastMessageUp < 24h` **par rapport à la date du snapshot**
   (reproductible historiquement, pas relative à `Date.now()`).

## 9. Modèle de données Prisma

```
Snapshot (id, label, envName, sourceEndpointCode, cdCode, organization,
          uploadedAt, zipPath, warningsJson)

Component (id, snapshotId, eic, type, organization, personName, email, phone,
           homeCdCode, networksCsv, creationTs, modificationTs,
           displayName, country, lat, lng, isDefaultPosition,
           process, sourceType)

ComponentUrl (id, componentId, network, url)

MessagePath (id, snapshotId, receiverEic, senderEicOrWildcard, messageType,
             transportPattern, intermediateBrokerEic, validFrom, validTo,
             process, direction, source, isExpired)

MessagingStatistic (id, snapshotId, sourceEndpointCode, remoteComponentCode,
                    connectionStatus, lastMessageUp, lastMessageDown,
                    sumMessagesUp, sumMessagesDown, deleted)

AppProperty (id, snapshotId, key, value)   # clés sensibles blacklistées
```

**Omis du slice #1** : `Certificate`, `LocalKeyStore`, `RegistrationStore`.

## 10. Frontend

### 10.1 Routes

```
/          → redirect vers /map si ≥ 1 snapshot, sinon /upload
/upload    → UploadPage
/map       → MapPage
```

Router : `react-router-dom v6`. État global : `zustand` + `persist` (pour
`activeSnapshotId`).

### 10.2 State (zustand)

```ts
type AppState = {
  activeSnapshotId: string | null;
  snapshots: SnapshotSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  visibleProcesses: Set<ProcessKey>;
  loading: boolean;
  error: string | null;
  loadSnapshots(): Promise<void>;
  setActiveSnapshot(id: string): Promise<void>;
  selectNode(eic: string | null): void;
  selectEdge(id: string | null): void;
};
```

### 10.3 UploadPage

- `react-dropzone`, accepte `.zip` uniquement, 50 MB max côté client.
- Champs : label (requis), envName (texte libre, placeholder "OPF/PROD/PFRFI").
- Après upload : affichage des warnings (accordion) + bouton "Voir sur la carte".

### 10.4 MapPage — layout

```
┌─────────────────────────────────────────────────────────────────┐
│ Header: logo RTE | snapshot actif | SnapshotSelector | env tag  │
├──────────────────────────────────────────────┬──────────────────┤
│                                              │                  │
│                                              │  DetailPanel     │
│              NetworkMap                      │  (si sélection)  │
│         OSM tiles + curves                   │                  │
│                                              │                  │
├──────────────────────────────────────────────┴──────────────────┤
│ Footer: légende couleurs processes + stats (N nodes / N edges)  │
└─────────────────────────────────────────────────────────────────┘
```

Desktop only au slice #1 (cible : postes exploitants MCO).
Panneau détail : 400 px, collapse → 0.

### 10.5 Rendu des nœuds et edges

- `NodeMarker` via `<CircleMarker>`. Style par `kind` :
  - `RTE_ENDPOINT` : cercle rouge rempli, liseré env, label permanent.
  - `RTE_CD` : losange rouge, label permanent.
  - `BROKER` : carré noir.
  - `EXTERNAL_*` : cercle coloré par process majoritaire, label au hover.
- `EdgePath` via `<Polyline>` courbée (`leaflet-curve`) :
  - Couleur = `processColors[edge.process]`.
  - `dashArray: "6 6"` si `activity.isRecent === false`.
  - Épaisseur 2 px.
- **Regroupement Paris-La-Défense** : les 6 Endpoints RTE + CD sur la même
  lat/lng → offset radial (-50 à +50 px) calculé dans `useMapData`.
- **Position par défaut** (Bruxelles) : icône `MapPin` de `lucide-react` (pas
  d'emoji) + tooltip "position par défaut".

### 10.6 Interactions

- Clic nœud → `selectNode(eic)` → panneau détail.
- Clic edge → `selectEdge(id)` → panneau détail.
- Clic fond de carte → reset sélection.
- Hover nœud externe → tooltip (nom + EIC + pays).
- Hover edge → tooltip (process + liste messageTypes + activité).

### 10.7 DetailPanel

- **Nœud sélectionné** : displayName, EIC, organisation, pays, networks, URLs
  (texte, pas de lien cliquable), timestamps, process associé, liens IN/OUT.
- **Edge sélectionné** : sens, process, messageTypes, transport pattern(s),
  broker intermédiaire, dernière activité, validité.

### 10.8 i18n & accessibilité

- Textes français, dates `dd/MM/yyyy HH:mm` (`Intl.DateTimeFormat('fr-FR')`).
- Contraste WCAG AA vérifié pour toutes les combinaisons couleur process ×
  fond. Ajustement des couleurs si besoin.
- Navigation clavier : best-effort au slice #1, noté dans backlog si incomplet.

## 11. Sécurité slice #1

- **Pas d'auth** (acté). README.md documente explicitement : "ne pas exposer
  publiquement ce MVP".
- **Helmet** activé sur NestJS.
- **CORS** : whitelist `http://localhost:5173` en dev, `same-origin` en prod.
- **Rate limit** : `@nestjs/throttler` 60 req/min par IP.
- **Upload** : `multer` en `memoryStorage`, limite 50 MB, `fileFilter` MIME +
  magic bytes `PK\x03\x04`.
- **Zip whitelist** : seuls les 8 noms de fichiers CSV reconnus sont extraits.
- **Clés sensibles blacklistées** dans `application_property.csv` (regex sur clés) :
  `*.password*`, `*.secret*`, `*.keystore.password*`, `*.privateKey*`,
  `*.credentials.*`. Extensible via constante.
- **Fichiers jamais parsés / exposés** : `local_key_store.csv`,
  `registration_store.csv`.
- **Storage isolation** : `storage/snapshots/{uuid}.zip`, uuid v4, aucun path
  traversal possible.
- **Logs** (Pino JSON) : jamais le contenu des blobs XML ni les valeurs des
  `AppProperty`.

## 12. Stratégie de tests

### 12.1 Pyramide

| Niveau | Outil | Cible |
| :---- | :---- | :---- |
| Unit | Vitest (api + web) | Parsers purs, classifier, registry, builders |
| Intégration | Vitest + Prisma SQLite file temp | Pipeline ingestion end-to-end |
| E2E API | Vitest + Supertest | POST /snapshots avec vrai zip → GET /graph |
| E2E Front | Playwright | 3 smoke tests |

### 12.2 Tests critiques

**`csv-reader.service.spec.ts`** :
- Parse `NULL_VALUE_PLACEHOLDER` → `null`.
- Parse dates ISO nano → `Date` précision ms.
- Parse dates ISO Z → `Date`.
- Wildcard `*` préservé.
- Booléens → boolean.
- Ligne malformée → warning, ligne ignorée (pas throw).

**`xml-mades-parser.service.spec.ts`** :
- Namespace correct → OK.
- Namespace inconnu → `UnknownMadesNamespaceException`.
- Path `INDIRECT:broker` → split correct.
- Path `DIRECT` → `brokerCode = null`.
- `validTo` absent → `null`.
- Arbre vide (0 composant) → valide.

**`network-model-builder.service.spec.ts`** :
- EIC dans overlay RTE → lat/lng précis.
- EIC dans ENTSO-E avec orga géocodée → lat/lng orga.
- EIC dans ENTSO-E sans orga géocodée → lat/lng pays.
- EIC inconnu partout → Bruxelles + `isDefaultPosition=true`.
- Classification messageType : exact, pattern, UNKNOWN.
- Direction IN/OUT : receiver RTE vs non-RTE.

**`graph.service.spec.ts`** :
- Agrégation 1 process → 1 edge.
- Agrégation ≥ 2 processes → `MIXTE`.
- Fusion ACK + BUSINESS → 1 edge.
- `isRecent` relatif à date snapshot.

**`registry.service.spec.ts`** :
- Chargement du CSV ENTSO-E réel → compteur attendu.
- Lookup inexistant → fallback correct.

### 12.3 Test intégration phare

`full-ingestion.spec.ts` :

```
Arrange:
  - Zip reconstruit à la volée depuis les 8 CSV de tests/fixtures/17V.../.
  - Registry bootstrap avec overlay complet.
  - Prisma SQLite file temp.

Act:
  POST /api/snapshots avec le zip reconstruit.

Assert:
  - 201
  - sourceEndpointCode === 'ECP-INTERNET-2'
  - cdCode === '17V000002014106G'
  - Component/MessagePath counts > 0
  - Aucune table Certificate/KeyStore/Registration persistée
  - GET /api/snapshots/:id/graph retourne nodes + edges
  - Chaque node a lat/lng valide
  - Chaque edge.process est un ProcessKey valide
```

### 12.4 Fixtures synthétiques

- `mades-3-processes-mixed.xml` → test MIXTE.
- `mades-unknown-namespace.xml` → test bloquant.
- `zip-missing-required.zip` → test bloquant.
- `zip-with-malicious-files.zip` (contient `../etc/passwd`) → test whitelist.
- `zip-with-password-in-properties.zip` → test blacklist clés.

### 12.5 E2E Playwright (3 smoke tests)

1. Upload → Map : drag zip → warnings → bouton "Voir sur la carte" → carte
   rendue avec ≥ 1 nœud rouge (RTE).
2. Clic sur un nœud → panneau détail visible avec EIC + URL + timestamps.
3. Upload 2 snapshots → bascule via selector → graphe change.

### 12.6 CI

GitHub Actions (ou Gitea RTE selon disponibilité) :
`pnpm install` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`
→ `pnpm test:e2e` (step séparé avec artefact screenshots en cas de fail).

### 12.7 Couverture visée

- `apps/api/src/ingestion/*` et `apps/api/src/registry/*` : ≥ 90 %.
- Autres services backend : ≥ 70 %.
- Frontend : pas de coverage strict, les 3 smoke tests suffisent.

## 13. Points laissés ouverts (hors slice #1)

Ces points sont identifiés mais **non traités** par le slice #1 :

- Nomenclature Endpoints `PCN-1` vs `PCN-EP-1` (§13.2 doc fonctionnel). À
  trancher quand un backup PCN sera disponible.
- Vrais EIC codes des 6 Endpoints RTE : seul `ECP-INTERNET-2` est connu
  (`17V000000498771C`). Les 5 autres restent à récupérer.
- Format du backup CD (§8bis.6) : reste à valider dès récupération d'un
  backup CD RTE.
- Acronyme "DBAG" et matrice PICASSO.
- Liste définitive des clés `.properties` à blacklister (équipe sécurité).
- Rechargement à chaud du registry (admin page).
- Historique renommage / suppression / activation.
- Auth + rôles.
- Dockerfile + déploiement VM + Nginx.
- Export CSV, filtres, recherche.

## 14. Critères de fin de slice #1

Le slice #1 est considéré terminé lorsque :

- `pnpm dev` lance api + web en local, interface accessible sur `localhost:5173`.
- `pnpm test` passe à vert (unit + intégration) avec couverture ingestion/registry ≥ 90 %.
- `pnpm test:e2e` passe les 3 smoke tests Playwright.
- Le backup `17V000000498771C_2026-04-17T21_27_17Z` uploadé via l'UI produit
  un snapshot visible sur la carte, avec au moins les nœuds RTE et les
  partenaires externes géolocalisés, et les edges colorés par process.
- Les fichiers sensibles (`local_key_store.csv`, `registration_store.csv`) ne
  sont jamais persistés.
- Le README du repo explique comment lancer le dev et charger un backup.

## 15. Prochaine étape

Ce document est l'entrée de la phase de planification d'implémentation. Il sera
passé au skill `superpowers:writing-plans` pour produire un plan d'exécution
détaillé (découpage en étapes implémentables, ordre de mise en place, points de
vérification intermédiaires).

---

*Fin du document de design — slice #1 — 2026-04-18*
