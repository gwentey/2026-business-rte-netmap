# Spec Fonctionnelle — web/map [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/map             |
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
| [RETRO-014](../../../adr/RETRO-014-leaflet-curve-sans-wrapper-react-approche-imperative.md) | leaflet-curve : approche impérative par useEffect/useRef sans wrapper react-leaflet | Documenté (rétro) |
| [RETRO-015](../../../adr/RETRO-015-offset-radial-paris-la-defense-dispersion-noeuds-superposes.md) | Offset radial Paris-La-Défense : dispersion visuelle des nœuds RTE superposés | Documenté (rétro) |
| [RETRO-016](../../../adr/RETRO-016-duplication-process-colors-json-ts-synchronisation-manuelle.md) | Duplication de la palette processColors entre overlay JSON et process-colors.ts | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

La feature `web/map` est la page principale de l'application Carto ECP. Elle offre une visualisation cartographique interactive du réseau ECP (Energy Communication Platform) à partir des données d'un snapshot uploadé. L'utilisateur voit sur un fond OpenStreetMap l'ensemble des composants ECP (endpoints, component directories, brokers) positionnés géographiquement, reliés par des arêtes colorées représentant les flux de messages métier par process.

L'objectif est de permettre aux exploitants MCO de RTE de comprendre rapidement la topologie du réseau ECP actif et d'identifier les liens inactifs ou les processus métier impliqués.

---

## Règles métier (déduites du code)

1. **Chargement automatique du graphe** : à l'ouverture de la page, si un snapshot actif est défini en store mais que le graphe n'est pas encore chargé, le graphe est rechargé automatiquement via `setActiveSnapshot`.

2. **Affichage conditionnel** : tant que le graphe est en cours de chargement (`loading === true`), un squelette de chargement (`SkeletonMap`) remplace la carte. En cas d'erreur, une bannière rouge s'affiche au-dessus de la carte.

3. **Cinq types de nœuds visuellement distincts** : chaque nœud possède un style visuel différent selon son `kind` :
   - `RTE_ENDPOINT` : cercle rouge (#e30613), rayon 10 px, liseré blanc.
   - `RTE_CD` : cercle rouge foncé (#b91c1c), rayon 12 px, liseré blanc.
   - `BROKER` : cercle noir (#111827), rayon 6 px.
   - `EXTERNAL_CD` : cercle gris foncé (#1f2937), rayon 9 px.
   - `EXTERNAL_ENDPOINT` : cercle gris (#6b7280), rayon 7 px.

4. **Nœuds externes colorés par process** : pour les kinds `EXTERNAL_CD` et `EXTERNAL_ENDPOINT`, la couleur de la bordure (stroke) du marqueur correspond à la couleur du process métier associé au nœud. Les nœuds RTE conservent un liseré blanc fixe.

5. **Agrandissement à la sélection** : quand un nœud est sélectionné, son rayon augmente de 3 px par rapport au rayon nominal.

6. **Arêtes courbées quadratiques** : les liens entre nœuds sont tracés comme des courbes de Bézier quadratiques via `leaflet-curve`. Le point de contrôle est calculé comme le milieu géométrique des deux extrémités, décalé perpendiculairement selon `(to.lng - from.lng) * 0.15` et `-(to.lat - from.lat) * 0.15`.

7. **Arêtes inactives en tirets** : si `edge.activity.isRecent === false`, l'arête est tracée en tirets (`dashArray: "6 6"`). Les arêtes actives sont continues.

8. **Épaisseur d'arête à la sélection** : une arête sélectionnée est tracée en épaisseur 4 px au lieu de 2 px.

9. **Couleur des arêtes par process** : chaque arête est colorée selon son `process` métier via la palette `PROCESS_COLORS` (TP, UK-CC-IN, CORE, MARI, PICASSO, VP, MIXTE, UNKNOWN).

10. **Regroupement radial des composants RTE à Paris-La-Défense** : tous les composants situés dans un rayon de 0,01° autour de la position de référence RTE (lat 48.8918, lng 2.2378) sont détectés comme un groupe. Si le groupe contient plus d'un nœud, ils sont répartis en cercle autour du centre avec un offset radial de 0,6°, en distribuant les angles uniformément.

11. **Sélection par clic** : un clic sur un nœud déclenche `selectNode(eic)` ; un clic sur une arête déclenche `selectEdge(id)`. La sélection est stockée en store Zustand et ouvre le `DetailPanel`.

12. **Tooltip au survol des nœuds** : chaque nœud affiche un tooltip au survol avec : nom affiché (`displayName`), code EIC, pays (si disponible), et une mention "Position par défaut" si `isDefaultPosition === true`.

13. **Légende des processes en pied de page** : le footer affiche une pastille colorée pour chacun des 8 processes définis dans `PROCESS_COLORS`, avec le nom du process. Il affiche également le nombre total de nœuds et d'arêtes du graphe chargé.

14. **Centrage automatique de la carte** : les bounds du graphe (nord, sud, est, ouest) retournées par l'API sont utilisées pour cadrer la vue Leaflet à l'initialisation. En l'absence de données, la carte se centre sur [50, 5] (Europe centrale).

15. **Basculement de snapshot** : le `SnapshotSelector` dans le header permet de changer de snapshot actif. Le changement déclenche le rechargement du graphe via le store. Un badge affiche l'`envName` et le `componentType` du snapshot actif.

---

## Cas d'usage (déduits)

### CU-001 — Visualiser le réseau ECP d'un snapshot

**Acteur** : Exploitant MCO RTE.

**Précondition** : au moins un snapshot a été uploadé et un `activeSnapshotId` est défini en store.

**Flux principal** :
1. L'utilisateur navigue vers `/map`.
2. La page détecte que le graphe n'est pas chargé et déclenche `setActiveSnapshot`.
3. Pendant le chargement, un message "Chargement…" s'affiche.
4. Le graphe est affiché sur la carte Leaflet avec les nœuds et arêtes colorés.
5. L'utilisateur survole un nœud : un tooltip apparaît avec le nom, EIC, pays.
6. L'utilisateur lit la légende en bas de page pour identifier les processes.

### CU-002 — Identifier les liens inactifs

**Flux principal** :
1. L'utilisateur observe les arêtes en tirets sur la carte.
2. Une arête en tirets signifie que le dernier message remonte à plus de 24 h par rapport à la date du snapshot (`isRecent === false`).
3. L'utilisateur clique sur l'arête pour ouvrir le `DetailPanel` et voir les détails d'activité.

### CU-003 — Sélectionner un nœud ou une arête

**Flux principal** :
1. L'utilisateur clique sur un nœud ou une arête.
2. L'élément sélectionné est mis en évidence (rayon +3 px ou épaisseur 4 px).
3. Le `DetailPanel` s'ouvre à droite avec les informations détaillées.

### CU-004 — Basculer entre snapshots

**Flux principal** :
1. L'utilisateur sélectionne un autre snapshot via le `SnapshotSelector` dans le header.
2. Le badge `env / componentType` se met à jour.
3. Le graphe est rechargé pour le nouveau snapshot actif.

### CU-005 — Charger un nouveau snapshot

**Flux principal** :
1. L'utilisateur clique sur "+ Charger un snapshot" dans le header.
2. Il est redirigé vers la page `/upload`.

---

## Dépendances

- `@carto-ecp/shared` — types `GraphNode`, `GraphEdge`, `GraphResponse`, `ProcessKey`, `ProcessColorMap`.
- `react-leaflet` — `MapContainer`, `TileLayer`, `CircleMarker`, `Tooltip`.
- `leaflet-curve` — extension Leaflet pour tracer des courbes de Bézier quadratiques (pas de types TS natifs).
- `leaflet` — couche native pour `L.curve`.
- Zustand store (`useAppStore`) — état partagé : `graph`, `loading`, `error`, `activeSnapshotId`, `snapshots`, `selectedNodeEic`, `selectedEdgeId`.
- `DetailPanel` — panneau latéral de détail (feature `web/detail-panel`).
- `SnapshotSelector` — sélecteur de snapshot actif (feature `web/snapshot-selector`).
- `GET /api/snapshots/:id/graph` — endpoint API qui fournit les nodes, edges et bounds.
- OpenStreetMap tile server (`tile.openstreetmap.org`) — fond de carte (dépendance réseau externe).

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Clic sur le fond de carte** : la spec design §10.6 mentionne "clic fond de carte → reset sélection" mais aucun handler de ce type n'est présent dans le code actuel de `NetworkMap.tsx`. Il est possible que cette interaction n'ait pas été implémentée en slice #1, ou qu'elle soit gérée par le `DetailPanel` lui-même.
- **Hover edge avec tooltip** : la spec design §10.6 mentionne un tooltip au survol des arêtes (process + messageTypes + activité), mais `EdgePath.tsx` ne contient pas de tooltip — seul le `DetailPanel` au clic fournit ces informations.
- **Label permanent sur nœuds RTE** : la spec design §10.5 mentionne un label permanent pour `RTE_ENDPOINT` et `RTE_CD`, mais `NodeMarker.tsx` utilise un `Tooltip` (hover) identique pour tous les kinds.
- **Position par défaut (Bruxelles)** : la spec mentionne une icône `MapPin` de `lucide-react` pour les nœuds `isDefaultPosition`, mais le code utilise un simple texte "Position par défaut" dans le tooltip Leaflet standard via `CircleMarker`. Le style visuel distinctif n'est pas implémenté.
- **Semantique de PARIS_LAT/PARIS_LNG** : les coordonnées (48.8918, 2.2378) correspondent à La Défense / Puteaux (siège RTE), pas au centre de Paris. Le commentaire "Paris" dans le code est une simplification.
- **Palette processColors — source de vérité** : la palette est dupliquée entre `packages/registry/eic-rte-overlay.json` (backend) et `apps/web/src/lib/process-colors.ts` (frontend). La procédure de synchronisation manuelle en cas de changement n'est pas formalisée.
