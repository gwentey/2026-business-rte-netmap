# Spec Technique — api/registry

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/registry                    |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `registry` charge au démarrage les données de référence statiques depuis `packages/registry/` et les expose via des méthodes synchrones consommées par les autres modules (graph, ingestion). Il n'expose aucune route HTTP publique.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `registry.service.ts` | Service NestJS (OnModuleInit) : charge CSV ENTSO-E + overlay RTE JSON au boot |
| `registry.module.ts` | Module Global NestJS (ADR-012) |
| `types.ts` | Types TypeScript des structures de données registry |

---

## Méthodes publiques

| Méthode | Signature | Description |
|---------|-----------|-------------|
| `resolveEic` | `(eic) -> RegistryInput \| null` | Retourne les données registry pour un EIC (niveau 3 de la cascade v2) |
| `classifyMessageType` | `(messageType) -> ProcessKey` | Classe un messageType en processus métier |
| `getRteEicSet` | `() -> Set<string>` | Ensemble des EICs RTE autoritatifs (endpoints + CD) |
| `getMapConfig` | `() -> MapConfig` | Configuration de la carte (cluster RTE, coords défaut) |
| `getOverlay` | `() -> RteOverlay` | Accès complet à l'overlay RTE |
| `processColor` | `(process) -> string` | Code hex de couleur d'un process |
| `lookupEntsoe` | `(eic) -> EntsoeEntry \| null` | Lookup direct dans l'index ENTSO-E statique |
| `entsoeSize` | `() -> number` | Nombre d'entrées dans l'index ENTSO-E statique |

---

## Sources de données

### `eic-entsoe.csv` (~14 929 entrées)

CSV officiel ENTSO-E, délimiteur `;`, BOM UTF-8. Colonnes utilisées :

| Colonne CSV | Champ interne |
|-------------|---------------|
| EicCode | eic (clé d'index) |
| EicDisplayName | displayName |
| EicLongName | longName |
| MarketParticipantIsoCountryCode | country |
| MarketParticipantVatCode | vatCode |
| EicTypeFunctionList | functionList |

### `eic-rte-overlay.json`

JSON versionné. Structure principale (`RteOverlay`) :

| Champ | Type | Description |
|-------|------|-------------|
| version | string | Version sémantique du fichier |
| rteEndpoints | RteEndpointOverlay[] | Endpoints RTE (eic, code, displayName, process, lat, lng, city) |
| rteComponentDirectory | object | CD RTE (eic, displayName, lat, lng) |
| rteBusinessApplications | { code, criticality }[] | Applications métier RTE (non exposé via API) |
| organizationGeocode | Record<org, {lat, lng, country}> | Géocode par organisation partenaire |
| countryGeocode | Record<country, {lat, lng, label?}> | Géocode par pays + DEFAULT (Brussels) |
| messageTypeClassification | { exact, patterns } | Classification messageType -> ProcessKey |
| processColors | Record<ProcessKey, string> | Couleurs hex des processus |
| mapConfig | MapConfig | Config carte (cluster RTE, coords défaut) |

`rteEicSet` est calculé au boot : `Set(rteEndpoints[*].eic ∪ {rteComponentDirectory.eic})`.

---

## Résolution du chemin des fichiers

Ordre de priorité (ADR-013) :

1. `REGISTRY_PATH` (variable d'environnement)
2. `process.cwd() + '/../../packages/registry'` (défaut — fonctionne si l'API est démarrée depuis `apps/api/`)

---

## Classification messageType (`classifyMessageType`)

| Étape | Condition | Résultat |
|-------|-----------|---------|
| 1 | messageType vide ou `*` | `UNKNOWN` |
| 2 | Correspondance exacte dans `overlay.messageTypeClassification.exact` | ProcessKey associée |
| 3 | Premier pattern regex correspondant dans `overlay.messageTypeClassification.patterns` | ProcessKey du pattern |
| 4 | Aucune correspondance | `UNKNOWN` |

Les regexes sont compilées une seule fois au boot (dans `onModuleInit`). L'ordre des patterns dans l'overlay est significatif.

---

## `resolveEic` (v2 — niveau 3 de la cascade)

Retourne les données registry pour enrichir la cascade `applyCascade` (niveau 3 = registry overlay RTE) :

1. Si l'EIC est dans `rteEndpoints` : retourne displayName, org=RTE, country=FR, lat, lng, type=ENDPOINT, process
2. Si l'EIC est `rteComponentDirectory.eic` : retourne displayName, org=RTE, country=FR, lat, lng, type=COMPONENT_DIRECTORY, process=null
3. Si l'EIC est dans l'index ENTSO-E statique : retourne displayName, country (sans coords — la cascade ajoute les coords depuis organizationGeocode ou countryGeocode)
4. Sinon : `null`

Note : en v2, la géocodage par organisation/pays est désormais dans `applyCascade` (graph module), pas dans `resolveEic`.

---

## `MapConfig`

```typescript
MapConfig = {
  rteClusterLat: number;    // Centre du cluster RTE (Paris La Défense ~)
  rteClusterLng: number;
  rteClusterOffsetDeg: number;    // Offset radial pour disperser les nœuds superposés (ADR-015)
  rteClusterProximityDeg: number; // Seuil de proximité pour activer l'offset
  defaultLat: number;   // Coordonnées Brussels (fallback niveau 5)
  defaultLng: number;
}
```

---

## Dépendances

- `packages/registry/eic-entsoe.csv` — données ENTSO-E statiques
- `packages/registry/eic-rte-overlay.json` — overlay RTE propriétaire
- `csv-parse/sync` — parsing CSV
- `node:fs/promises` — lecture des fichiers
- `@carto-ecp/shared` — type `ProcessKey`, `MapConfig`

---

## Invariants

1. La clé `DEFAULT` dans `countryGeocode` de l'overlay est obligatoire. Son absence cause une exception au runtime.
2. Le RegistryService est un module NestJS Global (ADR-012) : il est instantié une seule fois et partagé par tous les modules consommateurs.
3. Si le chargement des fichiers échoue dans `onModuleInit`, l'application ne démarre pas.
4. L'index ENTSO-E statique et l'overlay sont immuables à chaud. Tout changement nécessite un redémarrage.
5. `rteEicSet` est construit une seule fois au boot et partagé par référence.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `registry.service.spec.ts` | resolveEic (4 niveaux), classifyMessageType (exact, regex, UNKNOWN, wildcard), getRteEicSet, getMapConfig |

Ref. croisées : [api/graph](../graph/spec-technique.md) — consommateur principal (niveau 3 de la cascade via `resolveEic`, rteEicSet, classifyMessageType, mapConfig). [api/ingestion](../ingestion/spec-technique.md) — consomme `classifyMessageType` (pas de résolution géo à l'ingestion en v2, calcul à la lecture).
