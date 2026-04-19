# Spec Fonctionnelle — api/registry [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | registry            |
| App        | api                 |
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
| [RETRO-012](../../../adr/RETRO-012-registry-singleton-global-in-memory-boot-time.md) | Registry EIC chargé en mémoire au boot comme singleton Global NestJS | Documenté (rétro) |
| [RETRO-013](../../../adr/RETRO-013-registry-path-resolution-process-cwd.md) | Résolution du chemin des fichiers registry via process.cwd() | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

> **Référence croisée** : [RETRO-004](../../../adr/RETRO-004-classification-message-type-a-l-ingestion.md) — Classification messageType résolue à l'ingestion (tagué `ingestion`, mais concerne directement `classifyMessageType` du RegistryService).

---

## Contexte et objectif

Le module `registry` fournit une couche de référence statique pour enrichir les données ECP lors de l'ingestion. L'ECP (Energy Communication Platform) produit des backups contenant des codes EIC (Energy Identification Codes) qui identifient les participants du marché de l'énergie européen. Ces codes seuls sont insuffisants pour afficher les composants sur une carte — il faut résoudre des coordonnées géographiques, des noms d'affichage, et classifier les types de messages en processus métier.

Le `RegistryService` charge au démarrage deux sources de données complémentaires :
- Le registre officiel ENTSO-E (~14 929 codes EIC, format CSV) — référence de l'ensemble des participants du marché de l'énergie européen.
- L'overlay RTE (JSON) — données propriétaires RTE : endpoints RTE précis, géocodage par organisation partenaire, classification des types de messages ECP en processus métier, palette de couleurs.

Ces données alimentent exclusivement le pipeline d'ingestion (`NetworkModelBuilder`). Elles ne sont pas ré-exposées via l'API REST publique.

## Règles métier (déduites du code)

### Géocodage — cascade à 4 niveaux (`resolveComponent`)

1. **Niveau 1 — Overlay RTE endpoint** : si l'EIC correspond à un des 6 endpoints RTE définis dans l'overlay, les coordonnées et le nom d'affichage sont issus directement de l'overlay. Pays forcé à `FR`. Flag `isDefaultPosition = false`.

2. **Niveau 2 — Overlay RTE Component Directory** : si l'EIC est celui du CD RTE (un seul), même traitement. Pays forcé à `FR`. Flag `isDefaultPosition = false`.

3. **Niveau 3 — ENTSO-E + géocodage par organisation** : si l'EIC est connu dans le registre ENTSO-E, on cherche dans l'overlay si l'organisation partenaire (fournie par le backup) a un géocode explicite. Si oui, les coordonnées de l'organisation sont utilisées ; le `displayName` vient de l'ENTSO-E. Flag `isDefaultPosition = false`.

4. **Niveau 4a — ENTSO-E + géocodage par pays** : si l'EIC est connu en ENTSO-E mais que l'organisation n'a pas de géocode, on utilise le pays renseigné dans l'ENTSO-E pour trouver les coordonnées du pays dans l'overlay. Flag `isDefaultPosition = false`.

5. **Niveau 4b — Défaut Bruxelles** : si aucun des niveaux précédents ne s'applique (EIC totalement inconnu), les coordonnées de Bruxelles (`DEFAULT` dans `countryGeocode`) sont utilisées. Le `displayName` est résolu en cascade : `entsoe.displayName ?? organization ?? eic`. Flag `isDefaultPosition = true`.

**Règle d'invariant** : l'entrée `DEFAULT` dans `countryGeocode` de l'overlay est obligatoire. Son absence provoque une exception explicite au runtime.

### Classification des types de messages (`classifyMessageType`)

1. **Wildcard / vide** : si le `messageType` est vide ou égal à `*`, retourner `UNKNOWN` immédiatement (les wildcards sont des catch-all dans le protocole ECP, sans signification métier).

2. **Correspondance exacte** : chercher le `messageType` dans la map `exact` de l'overlay. Si trouvé, retourner le `ProcessKey` associé.

3. **Correspondance regex** : tester les patterns (dans l'ordre de l'overlay) contre le `messageType`. Le premier pattern correspondant détermine le `ProcessKey`.

4. **Fallback** : si aucune règle ne correspond, retourner `UNKNOWN`.

Les regexes sont compilées une seule fois au chargement de l'overlay (dans `onModuleInit`) pour éviter la recompilation à chaque classification.

### Données de référence connues (au 2026-04-18)

- **6 types de processus métier ECP** (hors UNKNOWN et MIXTE) : `TP`, `UK-CC-IN`, `CORE`, `MARI`, `PICASSO`, `VP`.
- **1 endpoint RTE exposé** : `17V000000498771C` (ECP-INTERNET-2, Paris — La Défense).
- **1 CD RTE** : `17V000002014106G` (CD RTE, Paris — La Défense).
- **14 applications métier RTE** classifiées P1/P2/P3 (ex : OCAPPI P1, PLANET P2, ECO2MIX P3).
- **12 organisations partenaires TSO** géocodées : RTE, SwissGrid, Terna, REE, Elia, TenneT, Amprion, TransnetBW, EirGrid, ENTSO-E, Statnett, Energinet.
- **10 pays** couverts par le géocodage pays + le fallback DEFAULT (Bruxelles).

## Cas d'usage (déduits)

### CU-001 — Géocoder un composant ECP à l'ingestion

**Acteur** : `NetworkModelBuilder` (service interne)

**Flux** :
1. NetworkModelBuilder reçoit un composant ECP avec son `eic` et son `organization`.
2. Il appelle `RegistryService.resolveComponent(eic, organization)`.
3. Le service parcourt la cascade des 4 niveaux et retourne un `ResolvedLocation` avec `displayName`, `country`, `lat`, `lng`, `isDefaultPosition`.
4. NetworkModelBuilder stocke ces coordonnées dans la table `Component`.

**Résultat** : chaque composant ECP a des coordonnées géographiques permettant son affichage sur la carte Leaflet.

### CU-002 — Classifier un type de message en processus métier

**Acteur** : `NetworkModelBuilder` (service interne)

**Flux** :
1. NetworkModelBuilder reçoit un `MessagePath` avec son `messageType` (ex : `RSMD`, `VP-CUSTOM-123`, `*`).
2. Il appelle `RegistryService.classifyMessageType(messageType)`.
3. Le service applique la cascade exact → regex → UNKNOWN.
4. Le `ProcessKey` résultant est stocké dans la table `MessagePath.process`.

**Résultat** : chaque chemin de message est associé à un processus métier connu, permettant le coloriage des edges sur la carte.

### CU-003 — Déterminer les endpoints RTE autoritatifs

**Acteur** : `NetworkModelBuilder` (service interne)

**Flux** :
1. NetworkModelBuilder appelle `RegistryService.getOverlay()` pour récupérer l'overlay complet.
2. Il extrait `overlay.rteEndpoints` (EICs des endpoints RTE) et `overlay.rteComponentDirectory.eic` pour constituer l'ensemble RTE autoritatif.
3. Cet ensemble sert à calculer la direction `IN`/`OUT` de chaque `MessagePath` relativement à RTE (pas via un heuristique sur le préfixe `17V`).

### CU-004 — Résoudre la couleur d'un processus

**Acteur** : `NetworkModelBuilder`, `GraphService` (indirectement via DTO)

**Flux** :
1. Appel à `RegistryService.processColor(processKey)`.
2. Retourne le code hexadécimal de couleur défini dans l'overlay (ex : `VP` → `#ec4899`).

**Note** : cette palette est dupliquée côté frontend dans `apps/web/src/lib/process-colors.ts`. Les deux doivent rester synchronisées manuellement si l'overlay est modifié.

## Dépendances

- **`packages/registry/eic-entsoe.csv`** : registre officiel ENTSO-E des codes EIC. Format CSV, délimiteur `;`, BOM UTF-8. Colonnes utilisées : `EicCode`, `EicDisplayName`, `EicLongName`, `MarketParticipantIsoCountryCode`, `MarketParticipantVatCode`, `EicTypeFunctionList`.
- **`packages/registry/eic-rte-overlay.json`** : overlay RTE propriétaire. JSON structuré, versionné par date.
- **`csv-parse/sync`** : bibliothèque de parsing CSV synchrone (package npm).
- **`@carto-ecp/shared`** : type `ProcessKey` partagé avec le frontend.
- **`NetworkModelBuilder`** (consommateur principal) : appelle `resolveComponent`, `classifyMessageType`, `getOverlay`.

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Pourquoi un seul endpoint RTE** dans le JSON alors que le nom de champ est `rteEndpoints` (pluriel) ? L'overlay actuel ne contient qu'une entrée (`17V000000498771C`). Il est possible que d'autres endpoints RTE existent en production et n'ont pas été inclus dans ce fichier de configuration de slice #1 — à valider.
- **`rteBusinessApplications`** : la liste des 14 applications est chargée dans l'overlay mais aucun accès à `overlay.rteBusinessApplications` n'est visible dans le code de `RegistryService` ni dans les consommateurs identifiés. Cette donnée est-elle réservée à un usage futur (dashboard applicatif) ou peut-elle être exposée dès maintenant ?
- **Ordre des patterns regex** : la spécification ne précise pas si l'ordre des patterns dans l'overlay est intentionnel (priorité). Le code les parcourt dans l'ordre du tableau — à documenter comme règle explicite ou à confirmer que l'ordre est significatif.
- **Synchronisation `processColors`** : la duplication entre `eic-rte-overlay.json` et `apps/web/src/lib/process-colors.ts` est manuelle. Il n'existe pas de mécanisme de validation. À terme, une source unique (overlay exposé via endpoint ou package shared) éviterait la dérive.
- **Gestion des erreurs de chargement** : si `eic-entsoe.csv` ou `eic-rte-overlay.json` est absent ou corrompu au démarrage, l'exception remonte sans handler dédié. Le comportement exact de NestJS (`onModuleInit` qui lance une exception) — crash applicatif ou dégradation — n'est pas explicitement testé.
