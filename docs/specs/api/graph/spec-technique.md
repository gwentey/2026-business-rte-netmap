# Spec Technique — api/graph

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/graph                       |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `graph` expose une route GET qui calcule à la volée le graphe réseau pour un environnement et une date de référence. Il n'y a plus de table de graphe pré-calculée (suppression des anciennes tables globales Snapshot/Component/MessagePath de v1). Le calcul se fait en plusieurs étapes : chargement des imports filtrés, merge des composants, cascade 5 niveaux, merge des chemins, construction des edges.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `graph.controller.ts` | Route GET /api/graph?env=&refDate= |
| `graph.service.ts` | Orchestrateur du calcul compute-on-read |
| `apply-cascade.ts` | Fonction `applyCascade` : cascade 5 niveaux par champ |
| `merge-components.ts` | Fonction `mergeComponentsLatestWins` : dédupliquer composants par EIC |
| `merge-paths.ts` | Fonction `mergePathsLatestWins` : dédupliquer chemins par clé 5-champs |

---

## Interfaces

### Route

```
GET /api/graph?env={envName}&refDate={ISO8601}
```

| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| env | string | Oui | Nom de l'environnement |
| refDate | ISO 8601 | Non | Date de coupure. Défaut : maintenant |

Réponse 200 : `GraphResponse` (`@carto-ecp/shared`).

### Types de réponse (`@carto-ecp/shared`)

```typescript
GraphResponse = {
  bounds: GraphBounds;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mapConfig: MapConfig;
}

GraphNode = {
  id: string; eic: string; kind: NodeKind;
  displayName: string; organization: string; country: string | null;
  lat: number; lng: number; isDefaultPosition: boolean;
  networks: string[]; process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string; modificationTs: string;
}

GraphEdge = {
  id: string; fromEic: string; toEic: string;
  direction: 'IN' | 'OUT'; process: ProcessKey;
  messageTypes: string[]; transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: { connectionStatus: string | null; lastMessageUp: string | null;
               lastMessageDown: string | null; isRecent: boolean; };
  validFrom: string; validTo: string | null;
}

NodeKind = 'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT'

MapConfig = {
  rteClusterLat: number; rteClusterLng: number;
  rteClusterOffsetDeg: number; rteClusterProximityDeg: number;
  defaultLat: number; defaultLng: number;
}
```

---

## Algorithme compute-on-read (`GraphService.getGraph`)

### Étape 1 — Chargement des imports filtrés

```
SELECT * FROM Import
WHERE envName = :env AND effectiveDate <= :refDate
ORDER BY effectiveDate ASC
```

Inclut les `importedComponents` (avec urls), `importedPaths` et `importedStats`.

### Étape 2 — Merge des composants par EIC (latest-wins)

`mergeComponentsLatestWins(rows)` : pour chaque EIC, conserve uniquement le composant dont l'import a la `effectiveDate` la plus récente. Retourne `Map<eic, MergedComponent>`.

### Étape 3 — Cascade 5 niveaux par champ (`applyCascade`)

Pour chaque EIC, construit un `GlobalComponent` en appliquant la priorité champ par champ (ADR-024) :

| Niveau | Source | Champs |
|--------|--------|--------|
| 1 | `ComponentOverride` (BDD) | displayName, type, organization, country, lat, lng, tagsCsv, notes |
| 2 | `EntsoeEntry` (BDD, uploadée via /api/entsoe/upload) | displayName, organization, country |
| 3 | Registry overlay RTE (JSON, boot) | displayName, organization, country, lat, lng, type, process |
| 4 | `MergedComponent` (import latest-wins) | tous les champs restants |
| 5 | Défaut Brussels (`mapConfig.defaultLat/defaultLng`) | lat, lng si aucun niveau n'a fourni de coords |

`isDefaultPosition = true` si lat/lng proviennent du niveau 5.

### Étape 4 — Merge des chemins par clé 5-champs (latest-wins)

Clé : `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)`.

`mergePathsLatestWins(rows)` : conserve le chemin de l'import avec la `effectiveDate` la plus récente.

### Étape 5 — Construction des edges

Pour chaque chemin merged :
- Sauter les wildcards (`receiverEic === '*'` ou `senderEic === '*'`)
- `direction` : `IN` si `receiverEic` dans `rteEicSet`, sinon `OUT`
- `fromEic` = senderEic si direction IN, sinon receiverEic
- `toEic` = receiverEic si direction IN, sinon senderEic
- Agrégation par clé `{fromEic}::{toEic}`
- `process = 'MIXTE'` si >= 2 processus distincts sur la paire

### Étape 6 — Statistiques et isRecent

Stats de messagerie : latest-wins par `(sourceEndpointCode, remoteComponentCode)`.

`isRecent = lastMessageUp != null`
  `&& (refTime - lastMessageUp.getTime()) < isRecentThreshold`
  `&& (refTime - lastMessageUp.getTime()) >= 0`

`refTime` = `effectiveDate` du dernier import chargé.
`isRecentThreshold` = env var `ISRECENT_THRESHOLD_MS` (défaut : 86 400 000 ms = 24h).

### Étape 7 — ID d'edge déterministe

`SHA1("{fromEic}|{toEic}|{process}").slice(0, 16)`.

### Étape 8 — Bounds

`min/max(lat/lng)` des nodes + padding de 2 degrés. Défaut si aucun nœud : `{ north: 60, south: 40, east: 20, west: -10 }`.

---

## NodeKind

| Kind | Condition |
|------|-----------|
| `RTE_ENDPOINT` | `type = 'ENDPOINT'` et EIC dans rteEicSet |
| `RTE_CD` | `type = 'COMPONENT_DIRECTORY'` et EIC dans rteEicSet |
| `BROKER` | `type = 'BROKER'` |
| `EXTERNAL_CD` | `type = 'COMPONENT_DIRECTORY'` et EIC hors rteEicSet |
| `EXTERNAL_ENDPOINT` | `type = 'ENDPOINT'` et EIC hors rteEicSet |

---

## Dépendances

- `PrismaService` — lecture Import, ImportedComponent, ImportedPath, ImportedMessagingStat, ComponentOverride, EntsoeEntry
- `RegistryService` — `resolveEic(eic)`, `classifyMessageType(messageType)`, `getRteEicSet()`, `getMapConfig()`
- `@carto-ecp/shared` — types `GraphResponse`, `GraphNode`, `GraphEdge`, `NodeKind`, `ProcessKey`, `MapConfig`

---

## Invariants

1. L'ensemble des nœuds est exclusivement déterminé par les composants importés dans l'envName. Les ComponentOverride et EntsoeEntry enrichissent mais ne créent pas de nœuds.
2. `rteEicSet` = `overlay.rteEndpoints[*].eic` ∪ `{overlay.rteComponentDirectory.eic}`. Immuable à chaud.
3. Les edges n'incluent pas les chemins wildcard.
4. `isRecent` est calculé relativement à `effectiveDate` du dernier import (reproductibilité historique, ADR-010).
5. `ISRECENT_THRESHOLD_MS` est configurable par variable d'environnement.
6. La classification `messageType -> ProcessKey` est effectuée à la lecture (via `RegistryService.classifyMessageType`) et non à l'ingestion en v2.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `graph.controller.spec.ts` | Validation param env requis, parsing refDate |
| `graph.service.compute.spec.ts` | Algorithme compute-on-read : merge, cascade, edges, isRecent, MIXTE |
| `apply-cascade.spec.ts` | Cascade 5 niveaux par champ, priorités, isDefaultPosition |
| `merge-components.spec.ts` | Latest-wins par EIC sur plusieurs imports |
| `merge-paths.spec.ts` | Latest-wins par clé 5-champs |

Ref. croisées : [api/imports](../imports/spec-technique.md) — données brutes. [api/registry](../registry/spec-technique.md) — niveau 3 cascade. [api/overrides](../overrides/spec-technique.md) — niveau 1 cascade. [api/admin](../admin/spec-technique.md) — niveau 2 cascade (EntsoeEntry).
