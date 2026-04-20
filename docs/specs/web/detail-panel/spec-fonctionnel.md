# Spec Fonctionnelle — detail-panel [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/detail-panel    |
| Version    | 2.0.0               |
| Date       | 2026-04-20          |
| Source     | v2.0 post-implémentation |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

Aucun ADR RETRO créé pour cette feature (pas de décision technique isolée identifiée — les choix structurants sont couverts par les ADRs du projet global).

---

## Contexte et objectif

Le DetailPanel est le panneau de détail latéral de la carte ECP. Il se rend visible dès qu'un nœud ou une arête est sélectionné sur la carte, et disparaît quand aucune sélection n'est active. Son rôle est de donner à l'opérateur RTE une lecture complète des métadonnées d'un composant (nœud) ou d'un chemin de message (arête) sans quitter la vue cartographique.

---

## Règles métier (déduites du code)

1. **Affichage conditionnel** — Le panneau ne s'affiche que si un nœud (`selectedNodeEic`) ou une arête (`selectedEdgeId`) est sélectionné dans le store global. Si les deux sont absents, le composant retourne `null` (collapse complet, aucun espace occupé dans le layout).

2. **Exclusivité de sélection** — Le store garantit qu'une seule entité peut être sélectionnée à la fois. Sélectionner un nœud efface l'arête sélectionnée, et inversement (`selectNode` remet `selectedEdgeId` à `null`, `selectEdge` remet `selectedNodeEic` à `null`).

3. **Bouton Fermer** — Un bouton `× Fermer` réinitialise la sélection active en appelant `selectNode(null)` (si un nœud est affiché) ou `selectEdge(null)` (si une arête est affichée). La sélection de l'autre type reste à `null` car le store garantit l'exclusivité.

4. **Largeur fixe** — Le panneau a une largeur fixe de 400 px. Il s'insère dans le layout comme une colonne latérale à hauteur complète, avec défilement vertical interne si le contenu dépasse la fenêtre.

5. **Graphe requis** — Si le graphe n'est pas encore chargé (`graph === null`), le composant retourne `null` même si une sélection est présente en store (cas transitoire au chargement).

6. **Formatage des dates en français** — Toutes les dates (timestamps de création/modification, `lastMessageUp`, `validFrom`/`validTo`) sont formatées via `Intl.DateTimeFormat('fr-FR')` avec style court date et heure, fuseau `Europe/Paris`. Une date `null`, `undefined` ou invalide affiche le tiret cadratin `—`.

7. **URLs non cliquables** — Les URLs des nœuds sont affichées en texte (`<span>`) et non en lien hypertexte (`<a>`). Elles sont listées avec leur réseau associé (`network — url`).

8. **Badge position par défaut** — Si `node.isDefaultPosition === true`, un encadré d'avertissement signale que le nœud n'est pas géolocalisé dans le registry et utilise la position de repli (Bruxelles par défaut).

9. **Badges messageTypes** — Les types de messages d'une arête sont affichés sous forme de badges individuels (fond gris clair, police monospace). Leur nombre est indiqué dans le titre de section.

10. **Broker optionnel** — La ligne "Broker" dans la fiche arête n'est affichée que si `edge.intermediateBrokerEic` est non null.

---

## Cas d'usage (déduits)

### CU-001 — Ouverture de la fiche nœud

L'opérateur clique sur un marqueur nœud de la carte. Le store reçoit `selectNode(eic)`. Le DetailPanel devient visible avec la fiche `NodeDetails` du composant correspondant. Les données affichées sont : nom (`displayName`), EIC (monospace), type (`kind`), organisation, pays, réseaux, processus, timestamps création/modification formatés en français, URLs par réseau (texte), et le badge avertissement si la position est approximative.

### CU-002 — Ouverture de la fiche arête

L'opérateur clique sur une courbe arête de la carte. Le store reçoit `selectEdge(id)`. Le DetailPanel devient visible avec la fiche `EdgeDetails` de l'arête correspondante. Les données affichées sont : processus (titre), sens (`IN`/`OUT`), EIC source et destination (monospace), transport(s), broker intermédiaire si présent, statut de connexion, date du dernier message UP formatée, flag "actif récemment" (`Oui`/`Non`), plage de validité (`validFrom → validTo`), et la liste des types de messages en badges.

### CU-003 — Fermeture du panneau

L'opérateur clique sur `× Fermer`. Le store reçoit `selectNode(null)` ou `selectEdge(null)` selon l'entité affichée. Le panneau disparaît. La carte reprend toute la largeur de la zone de contenu.

### CU-004 — Changement de sélection sans fermeture

L'opérateur clique directement sur un autre nœud ou arête sans passer par `× Fermer`. Le store met à jour la sélection active (et vide l'autre type). Le DetailPanel met à jour son contenu sans animation.

---

## Dépendances

- **`useAppStore`** (Zustand, `apps/web/src/store/app-store.ts`) — source de vérité pour `graph`, `selectedNodeEic`, `selectedEdgeId`, `selectNode`, `selectEdge`.
- **`@carto-ecp/shared`** — types `GraphNode`, `GraphEdge`, `EdgeDirection`, `NodeKind`, `ProcessKey`.
- **`apps/web/src/lib/format.ts`** — fonction `formatDateTime` (formatage fr-FR via `Intl.DateTimeFormat`).
- **Tailwind CSS** — styles inline via classes utilitaires (pas de CSS module séparé).

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le champ `node.process` peut être `null` (arête `—` affiché). Il n'est pas clair si un nœud sans processus est un cas courant ou une anomalie de données à signaler visuellement.
- La liste `node.urls` est rendue sans limite de hauteur interne ; avec un grand nombre d'URLs, la lisibilité n'a pas été vérifiée par rétro-ingénierie (aucune limite de rendu n'est imposée dans le code).
- La section "liens IN/OUT" mentionnée dans le design §10.7 et dans la discovery #8 n'est pas implémentée dans le code actuel de `NodeDetails.tsx`. Il est possible que cette fonctionnalité soit prévue mais non encore réalisée.
- Le champ `edge.activity.lastMessageDown` est présent dans le type `GraphEdge` mais n'est pas affiché dans `EdgeDetails` (seul `lastMessageUp` l'est). Usage intentionnel ou oubli à valider.
- Le formatage de `validTo` lorsqu'il est `null` affiche `—` via `formatDateTime`, mais la plage est rendue `validFrom → —`, ce qui peut être déroutant pour l'opérateur.
