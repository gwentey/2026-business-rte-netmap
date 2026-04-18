# Spec Fonctionnelle — api/graph [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/graph           |
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
| [RETRO-009](../../../adr/RETRO-009-aggregation-edges-par-paire-eic-avec-detection-mixte.md) | Agrégation des MessagePath en edges par paire (fromEic, toEic) avec détection MIXTE | Documenté (rétro) |
| [RETRO-010](../../../adr/RETRO-010-isrecent-relatif-au-snapshot-reproductibilite-historique.md) | isRecent calculé relativement à uploadedAt du snapshot pour reproductibilité historique | Documenté (rétro) |
| [RETRO-011](../../../adr/RETRO-011-identifiant-edge-sha1-deterministe.md) | Identifiant d'edge SHA-1 déterministe sur (fromEic, toEic, process) | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `api/graph` est la couche de lecture du réseau ECP. Il agrège les données
brutes persistées lors de l'ingestion (`MessagePath`, `MessagingStatistic`, `Component`)
en un graphe nodes/edges consommable directement par le frontend Leaflet.

L'objectif est de fournir, pour un snapshot donné, une représentation unifiée du
réseau ECP : les composants (nœuds positionnés géographiquement) et les chemins de
messages actifs entre eux (arêtes colorées par processus métier). Ce graphe est
volontairement dénormalisé pour éviter tout traitement côté frontend.

## Règles métier (déduites du code)

1. **Agrégation par paire (fromEic, toEic)** — Plusieurs `MessagePath` en base
   concernant la même paire de composants sont fusionnés en un seul edge. Les
   `messageTypes` et `transportPatterns` distincts sont agrégés en tableaux.

2. **Direction IN/OUT** — Sur chaque `MessagePath`, la direction est stockée
   relativement au composant source du backup. L'edge prend la direction du premier
   path de son groupe (les paths d'un groupe partagent la même paire, la direction
   est cohérente).

3. **Skip des wildcards** — Tout path dont `senderEicOrWildcard === '*'` ou dont
   l'EIC calculé pour `fromEic` ou `toEic` serait `'*'` est ignoré et ne génère
   pas d'edge. Ces paths représentent des règles d'acceptation globales sans
   partenaire identifiable.

4. **Détection MIXTE** — Si au moins 2 valeurs de `process` distinctes coexistent
   dans un groupe (même paire), l'edge reçoit `process = 'MIXTE'`. Si tous les
   paths du groupe partagent le même process, cet unique process est utilisé.

5. **isRecent relatif au snapshot** — Le flag `isRecent` d'un edge est calculé
   relativement à `snapshot.uploadedAt`, pas à l'heure courante. L'algorithme est :
   `isRecent = lastMessageUp != null && (uploadedAt - lastMessageUp) < 24h && (uploadedAt - lastMessageUp) >= 0`.
   Cela garantit la reproductibilité historique : afficher un snapshot d'il y a
   6 mois donne les mêmes indicateurs d'activité qu'au moment du snapshot.

6. **Identifiant d'edge stable** — Chaque edge reçoit un identifiant SHA-1 tronqué
   à 16 caractères hex, calculé sur la chaîne `fromEic|toEic|process`. L'identifiant
   est stable et reproductible pour un même snapshot.

7. **Activité via MessagingStatistic** — Les données d'activité (`connectionStatus`,
   `lastMessageUp`, `lastMessageDown`) sont recherchées dans la table
   `MessagingStatistic` par la clé `(sourceEndpointCode, remoteComponentCode)`.
   La recherche est bidirectionnelle : si `(A, B)` n'existe pas, le service cherche
   `(B, A)`.

8. **Bounds avec padding 2°** — Les bornes géographiques de la vue carte sont
   calculées à partir des coordonnées de tous les nœuds, avec un padding de 2 degrés
   dans chaque direction (nord/sud/est/ouest). En l'absence de nœuds, les bornes
   par défaut sont `{ north: 60, south: 40, east: 20, west: -10 }` (Europe occidentale).

9. **Classement NodeKind** — Chaque nœud reçoit un type (`kind`) calculé à la volée
   à partir de son `type` Prisma et de son appartenance à l'organisation RTE :
   - `BROKER` : si `component.type === 'BROKER'`
   - `RTE_CD` : si `type === 'COMPONENT_DIRECTORY'` et organisation RTE (EIC préfixé `17V`)
   - `EXTERNAL_CD` : si `type === 'COMPONENT_DIRECTORY'` et non RTE
   - `RTE_ENDPOINT` : si `type` est autre et organisation RTE
   - `EXTERNAL_ENDPOINT` : tous les autres cas

10. **Gestion de l'absence de statistics** — Si aucune `MessagingStatistic` n'est
    trouvée pour une paire, le bloc `activity` de l'edge contient des `null` pour
    tous les champs et `isRecent = false`. L'edge est tout de même exposé.

11. **validFrom par défaut** — Si le `MessagePath` n'a pas de `validFrom`, la date
    `new Date(0)` (1970-01-01T00:00:00.000Z) est utilisée comme fallback. `validTo`
    reste `null` si absent.

## Cas d'usage (déduits)

### CU-001 — Affichage du graphe réseau d'un snapshot

**Acteur :** Frontend Leaflet (MapPage).

**Déclencheur :** L'utilisateur sélectionne un snapshot dans le `SnapshotSelector`
ou navigue vers `/map` avec un snapshot actif en store Zustand.

**Flux principal :**
1. Le frontend appelle `GET /api/snapshots/:id/graph`.
2. Le backend vérifie l'existence du snapshot ; lève une `404` si absent.
3. Le backend charge en parallèle les `Component` (avec leurs URLs), les `MessagePath`
   et les `MessagingStatistic` du snapshot.
4. `buildGraph` est appelé : agrégation des paths en edges, calcul des bounds, mapping
   des composants en nœuds.
5. La réponse JSON `{ bounds, nodes, edges }` est retournée en `200`.
6. Le frontend positionne les nœuds sur la carte et trace les arêtes courbées colorées
   par process.

**Cas d'erreur :**
- `snapshotId` inconnu → HTTP 404 avec code `SNAPSHOT_NOT_FOUND`.

### CU-002 — Visualisation d'un snapshot sans statistiques (backup CD)

**Acteur :** Frontend Leaflet.

**Contexte :** Un backup Component Directory ne contient pas de `messaging_statistics.csv`.
Les `MessagingStatistic` associées sont absentes ou vides.

**Flux :**
1. Le graphe est construit normalement.
2. Tous les edges ont `activity.isRecent = false`, `connectionStatus = null`,
   `lastMessageUp = null`, `lastMessageDown = null`.
3. La visualisation affiche les edges sans indicateur d'activité.

### CU-003 — Edge MIXTE (paire multi-processus)

**Acteur :** Frontend Leaflet.

**Contexte :** Deux process distincts (ex. `VP` et `CORE`) ont des paths entre
le même couple de composants.

**Flux :**
1. `buildGraph` regroupe les paths sous la même clé `fromEic::toEic`.
2. La détection de 2 process distincts assigne `process = 'MIXTE'`.
3. L'edge est coloré avec la couleur MIXTE (gris `#4b5563`) côté frontend.

## Dépendances

- `PrismaService` — accès aux tables `Snapshot`, `Component`, `ComponentUrl`,
  `MessagePath`, `MessagingStatistic`.
- `RegistryService` — injecté dans `GraphModule` mais **non utilisé** dans
  `GraphService` au slice #1. La classification process est lue directement depuis
  la base (résolue à l'ingestion — voir RETRO-004). La dépendance est présente dans
  le module mais `RegistryService` n'est pas appelé dans `buildGraph` ni `getGraph`.
- `@carto-ecp/shared` — types `GraphNode`, `GraphEdge`, `GraphResponse`, `GraphBounds`,
  `NodeKind`, `ProcessKey`.
- `SnapshotNotFoundException` — erreur métier typée depuis `common/errors/ingestion-errors.ts`.

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Direction de l'edge en cas de groupe** : le code prend la direction du premier
  path créant le groupe. Si des paths IN et OUT coexistaient pour une même paire
  (ce qui semble théoriquement impossible mais non contraint par le schéma), la
  direction serait celle du premier path rencontré dans l'itération. A valider
  avec le métier : une paire (A, B) peut-elle être à la fois IN et OUT ?
- **`RegistryService` injecté mais inutilisé** : le module déclare `RegistryService`
  dans ses providers mais `GraphService` ne l'utilise pas. Ce provider est-il
  préparatoire pour un futur slice (re-classification à la volée) ou un artefact
  à nettoyer ?
- **Critère `kindOf` basé sur `eic.startsWith('17V')` + `organization === 'RTE'`** :
  le code vérifie le préfixe `17V` pour la classification des nœuds RTE, alors que
  la direction IN/OUT (ingestion) utilise le set autoritatif de l'overlay. Cette
  asymétrie est-elle intentionnelle ? Le préfixe `17V` peut-il appartenir à un
  opérateur non-RTE ?
- **Sens de `fromEic`/`toEic`** : la logique de calcul (`direction === 'IN'` swaps
  `senderEicOrWildcard` et `receiverEic`) mériterait validation pour s'assurer que
  `fromEic` désigne toujours l'émetteur et `toEic` le récepteur du point de vue réseau.
