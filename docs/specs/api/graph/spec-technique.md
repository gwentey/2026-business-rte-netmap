# Spec Technique — api/graph

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/graph           |
| Version       | 0.2.0               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 2 remédiation |

## Architecture du module

Le module `graph` est un module NestJS autonome composé de trois éléments :

- **`GraphController`** : contrôleur REST mince. Reçoit `GET /snapshots/:id/graph`,
  délègue immédiatement à `GraphService.getGraph()` et retourne le résultat sérialisé.
  Aucune transformation, aucune validation de requête (le snapshot ID est passé tel
  quel au service).

- **`GraphService`** : service métier principal. Contient deux méthodes publiques :
  - `getGraph(snapshotId)` : méthode async qui charge les données depuis Prisma puis
    appelle `buildGraph`. C'est le point d'entrée pour les requêtes HTTP.
  - `buildGraph(snapshot, components, paths, stats)` : méthode synchrone pure qui
    exécute toute la logique d'agrégation. Exposée `public` pour être testable
    unitairement sans DI Prisma.

  Méthodes privées :
  - `toNode(component)` : mappe un `Component` Prisma en `GraphNode` DTO.
  - `kindOf(component)` : détermine le `NodeKind` depuis `component.type` et
    `component.organization`.
  - `computeBounds(nodes)` : calcule les bornes géographiques avec padding.

- **`GraphModule`** : module NestJS déclarant le controller et le service, exportant
  `GraphService` (potentiellement consommé par d'autres modules futurs). Il importe
  implicitement `PrismaService` et `RegistryService` via le `AppModule` global —
  ces dépendances ne sont pas explicitement listées dans les imports du module.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/src/graph/graph.service.ts` | Logique d'agrégation — `buildGraph`, `toNode`, `kindOf`, `computeBounds` | ~173 |
| `apps/api/src/graph/graph.controller.ts` | Endpoint REST `GET :id/graph` | ~12 |
| `apps/api/src/graph/graph.module.ts` | Déclaration NestJS du module | ~10 |
| `apps/api/src/graph/graph.service.spec.ts` | Tests unitaires `buildGraph` | ~139 |
| `packages/shared/src/graph.ts` | Types DTO partagés : `GraphNode`, `GraphEdge`, `GraphBounds`, `GraphResponse`, `NodeKind`, `EdgeDirection` | ~59 |

## Schéma BDD

Tables lues en lecture seule par ce module :

| Table | Colonnes utilisées | Rôle |
|-------|-------------------|------|
| `Snapshot` | `id`, `uploadedAt` | Référence du snapshot, point temporel pour `isRecent` |
| `Component` | `eic`, `type`, `organization`, `displayName`, `country`, `lat`, `lng`, `isDefaultPosition`, `networksCsv`, `process`, `creationTs`, `modificationTs` | Données des nœuds |
| `ComponentUrl` | `network`, `url` | URLs AMQPS/HTTPS incluses dans chaque nœud |
| `MessagePath` | `direction`, `senderEicOrWildcard`, `receiverEic`, `process`, `messageType`, `transportPattern`, `intermediateBrokerEic`, `validFrom`, `validTo` | Source des edges avant agrégation |
| `MessagingStatistic` | `sourceEndpointCode`, `remoteComponentCode`, `connectionStatus`, `lastMessageUp`, `lastMessageDown` | Données d'activité des edges |

Aucune écriture en base dans ce module.

## API / Endpoints

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/snapshots/:id/graph` | Retourne `GraphResponse` pour le snapshot `id` | Aucune (hors scope slice #1) |

**Réponses :**
- `200 OK` — `GraphResponse` JSON
- `404 Not Found` — `SnapshotNotFoundException` si le snapshot n'existe pas

**Payload de réponse (`GraphResponse`) :**
```ts
{
  bounds: { north: number; south: number; east: number; west: number };
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

**Détail `GraphNode` :**
```ts
{
  id: string;           // = eic
  eic: string;
  kind: 'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT';
  displayName: string;
  organization: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  networks: string[];
  process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string;   // ISO 8601
  modificationTs: string;
}
```

**Détail `GraphEdge` :**
```ts
{
  id: string;           // SHA-1 hex tronqué 16 chars de "fromEic|toEic|process"
  fromEic: string;
  toEic: string;
  direction: 'IN' | 'OUT';
  process: ProcessKey;  // VP | CORE | MARI | PICASSO | TP | UK-CC-IN | MIXTE | UNKNOWN
  messageTypes: string[];
  transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: {
    connectionStatus: string | null;
    lastMessageUp: string | null;   // ISO 8601
    lastMessageDown: string | null;
    isRecent: boolean;
  };
  validFrom: string;    // ISO 8601, fallback new Date(0)
  validTo: string | null;
}
```

## Algorithme `buildGraph` — détail

```
1. Mapper components → GraphNode[] via toNode()
2. Construire statsMap : Map<"source::remote", MessagingStatistic>
3. Pour chaque MessagePath p :
   a. Calculer fromEic / toEic selon direction (IN : sender→receiver, OUT : receiver→sender)
   b. Si fromEic === '*' ou toEic === '*' → skip
   c. Clé = "fromEic::toEic"
   d. Si groupe existant : ajouter process, messageType, transportPattern au Set
   e. Sinon : créer un nouveau groupe
4. Pour chaque groupe → créer GraphEdge :
   a. process = 'MIXTE' si |processes| >= 2, sinon unique process
   b. id = sha1("fromEic|toEic|process").slice(0,16)
   c. Chercher stat = statsMap("fromEic::toEic") ?? statsMap("toEic::fromEic")
   d. isRecent = stat.lastMessageUp != null
                 && uploadedAt - lastMessageUp < 86400000ms
                 && uploadedAt - lastMessageUp >= 0
5. Retourner { bounds: computeBounds(nodes), nodes, edges }
```

**`kindOf(component)` :**
```
if type === 'BROKER'              → 'BROKER'
if type === 'COMPONENT_DIRECTORY'
  if org === 'RTE' && eic.startsWith('17V') → 'RTE_CD'
  else                            → 'EXTERNAL_CD'
else (ENDPOINT)
  if org === 'RTE' && eic.startsWith('17V') → 'RTE_ENDPOINT'
  else                            → 'EXTERNAL_ENDPOINT'
```

**`computeBounds(nodes)` :**
```
if nodes.length === 0 → { north: 60, south: 40, east: 20, west: -10 }
else :
  Parcourir tous les nœuds pour trouver min/max lat et lng
  Retourner { north: max_lat+2, south: min_lat-2, east: max_lng+2, west: min_lng-2 }
```

## Patterns identifiés

- **Thin Controller** : `GraphController` ne fait aucun traitement, délègue tout au service.
- **Pure function testable** : `buildGraph` est une méthode synchrone sans side-effects,
  testable unitairement en instanciant le service avec des mocks Prisma vides.
- **Map-based aggregation** : l'agrégation des paths utilise une `Map<string, Group>`
  avec la clé string `"fromEic::toEic"`, évitant toute double boucle.
- **Set pour déduplication** : les `processes`, `messageTypes` et `transports` sont
  accumulés dans des `Set<>` pendant l'agrégation, puis convertis en tableaux.
- **Recherche bidirectionnelle des stats** : la lookup `statsMap` tente les deux
  orientations `(A,B)` puis `(B,A)` pour absorber les asymétries de nommage entre
  `sourceEndpointCode` et `remoteComponentCode`.
- **Identifiant déterministe** : le hash SHA-1 sur `fromEic|toEic|process` rend
  l'id stable entre deux appels successifs du même snapshot (utile pour le state
  `selectedEdgeId` côté frontend Zustand).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/src/graph/graph.service.spec.ts` | Agrégation 2 paths → 1 edge | Existant |
| | Skip des paths wildcard (`*`) | Existant |
| | Détection MIXTE (2 processes → MIXTE) | Existant |
| | `isRecent = true` si `lastMessageUp < 24h` du snapshot | Existant |
| | `computeBounds` avec padding 2° | Existant |
| `apps/api/test/full-graph-endpoint.spec.ts` | **[P2-3]** Test d'intégration contre les fixtures réelles (Endpoint + CD) : HTTP 200, présence `nodes` et `edges`, cohérence `bounds` (lat/lng finis), HTTP 404 sur snapshot inexistant | Ajouté Phase 2 |
| Tests E2E Playwright | Affichage carte (smoke test) — couverture indirecte | Existant (partiel) |
