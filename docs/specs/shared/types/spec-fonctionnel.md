# Spec Fonctionnelle — shared/types [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | shared/types        |
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
| [RETRO-019](../../../adr/RETRO-019-typescript-only-workspace-sans-build.md) | Package TypeScript-only sans build step (main → ./src/index.ts) | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le package `@carto-ecp/shared` constitue la couche de contrat entre le backend NestJS (`apps/api`) et le frontend React (`apps/web`). Il exporte exclusivement des types TypeScript — aucune logique d'exécution, aucune dépendance de production. Son rôle est de garantir que les deux extrémités du canal HTTP parlent le même langage : même forme de données pour le graphe réseau, les snapshots et les clés de processus métier.

La décision de ne pas compiler ce package (pas de `tsc --build`, `main` pointant directement vers `./src/index.ts`) est délibérée pour cette phase de développement local : les deux applications consommatrices utilisent Vite (web) et ts-node/SWC (api) pour résoudre les imports TypeScript à la volée.

## Règles métier (déduites du code)

1. **Un nœud du graphe est toujours géocodé** : `lat` et `lng` sont des `number` non nullables dans `GraphNode`. La position par défaut (Bruxelles, visible dans `NetworkModelBuilder`) est encodée via le flag `isDefaultPosition: boolean`, non en rendant les coordonnées nulles.

2. **Le `process` d'un nœud est nullable** (`process: ProcessKey | null`), alors que le `process` d'un edge est obligatoire (`process: ProcessKey`). Un composant peut exister dans le réseau sans process identifié ; un chemin de message est toujours classifié (au pire `UNKNOWN`).

3. **`MIXTE` est un process valide de premier ordre** : il apparaît dans `PROCESS_KEYS` au même titre que `TP`, `CORE`, etc. Il n'est pas une valeur d'erreur — il signifie que plusieurs processus coexistent sur la même paire `(fromEic, toEic)`.

4. **`UNKNOWN` est la valeur sentinelle de classification échouée** : il est le dernier élément de `PROCESS_KEYS` et représente un `messageType` non reconnu par aucune règle exacte ni regex du registry.

5. **Un edge peut avoir plusieurs `messageTypes` et plusieurs `transportPatterns`** (tableaux non vides) : un edge représente l'agrégation de tous les `MessagePath` entre une paire d'EIC, pas un chemin individuel.

6. **`intermediateBrokerEic` est nullable** : un transport `DIRECT` n'implique pas de broker ; seul un transport `INDIRECT` en référence un.

7. **L'activité d'un edge est auto-portée** : le sous-objet `activity` encapsule `connectionStatus`, `lastMessageUp`, `lastMessageDown` (strings ISO 8601 ou null) et `isRecent` (boolean précalculé). La date de référence pour `isRecent` est celle du snapshot, pas `Date.now()` — ce qui garantit la reproductibilité historique (voir RETRO-010).

8. **`SnapshotDetail` étend `SnapshotSummary`** par intersection de types (`SnapshotSummary & { ... }`). La liste enrichit le résumé avec les compteurs de composants/chemins/stats et la liste complète des warnings.

9. **Les `warnings` sont structurés** : chaque `Warning` porte un `code` string, un `message` string, et un `context` optionnel de type `Record<string, unknown>` — assez générique pour couvrir tous les cas d'erreur non bloquante de l'ingestion.

10. **`ProcessColorMap` est un `Record` total** : le type garantit qu'une couleur est définie pour chaque clé de `PROCESS_KEYS`, y compris `MIXTE` et `UNKNOWN`. Toute modification de `PROCESS_KEYS` casse le type si `ProcessColorMap` n'est pas mis à jour en conséquence.

11. **`GraphBounds` encode le bounding box géographique** du graphe (north/south/east/west en degrés décimaux). Utilisé par le frontend pour centrer la vue Leaflet sur les données présentes.

12. **`cdCode` est nullable dans `SnapshotSummary`** : il est absent pour un backup de type `ENDPOINT` (un Endpoint ne connaît pas nécessairement son Component Directory de rattachement).

## Cas d'usage (déduits)

### CU-001 — Réponse graphe api → web

L'API construit une `GraphResponse` dans `GraphService.buildGraph` et la sérialise en JSON via NestJS. Le frontend la désérialise et la consomme directement sans transformation : les types étant partagés, aucun adaptateur n'est nécessaire entre le résultat de `fetch` et les composants React (`NetworkMap`, `NodeMarker`, `EdgePath`, `DetailPanel`).

### CU-002 — Liste et détail de snapshots

`GET /api/snapshots` retourne `SnapshotSummary[]`. `GET /api/snapshots/:id` retourne `SnapshotDetail`. Le `SnapshotSelector` du frontend exploite `SnapshotSummary` pour peupler la liste déroulante ; `DetailPanel` et la page de résultat d'upload exploitent `SnapshotDetail` pour afficher warnings et statistiques.

### CU-003 — Coloration des edges et nœuds par process

Le frontend (`process-colors.ts` + `EdgePath.tsx` + `NodeMarker.tsx`) utilise `ProcessKey` comme clé dans une map de couleurs. `PROCESS_KEYS as const` permet de dériver `ProcessKey` par inférence TypeScript sans énumération, ce qui évite la duplication de valeurs entre le type et le runtime.

### CU-004 — Affichage conditionnel selon `NodeKind`

`NodeMarker.tsx` utilise `NodeKind` pour choisir la représentation visuelle : cercle vs losange, couleur rouge pour les nœuds RTE (`RTE_ENDPOINT`, `RTE_CD`), regroupement radial pour les nœuds à position par défaut.

## Dépendances

- Aucune dépendance de production (package TS-only).
- Consommé par `@carto-ecp/api` (NestJS) via workspace `*`.
- Consommé par `@carto-ecp/web` (Vite/React) via workspace `*`.
- TypeScript 5.5 en `devDependency` uniquement (pour `tsc --noEmit`).

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Exhaustivité de `PROCESS_KEYS`** : les 6 valeurs métier (`TP`, `UK-CC-IN`, `CORE`, `MARI`, `PICASSO`, `VP`) semblent couvrir les processus ECP actuels de RTE, mais il est impossible de confirmer par le code seul si d'autres processus existent dans le réseau réel.
- **Sémantique de `networks`** dans `GraphNode` : c'est un `string[]` — la nature exacte de ces chaînes (noms de réseaux AMQP, identifiants internes ?) n'est pas documentée dans les types.
- **Format de `connectionStatus`** dans `GraphEdge.activity` : `string | null` — les valeurs possibles (ex. `CONNECTED`, `DISCONNECTED`) ne sont pas contraintes par le type partagé.
- **Signification de `validFrom` / `validTo`** dans `GraphEdge` : chaînes ISO 8601 dont la signification exacte (validité de la configuration vs validité de la donnée) mériterait confirmation.
- **`cdCode` dans `SnapshotSummary`** : la relation exacte entre le `sourceComponentCode` (EIC de l'entité uploadante) et le `cdCode` (EIC du CD de rattachement) n'est pas formalisée dans les types.
