# Spec Fonctionnelle — snapshot-selector [DRAFT — à valider par le dev]

| Champ      | Valeur                  |
|------------|-------------------------|
| Module     | web/snapshot-selector   |
| Version    | 0.1.0                   |
| Date       | 2026-04-17              |
| Auteur     | retro-documenter        |
| Statut     | DRAFT                   |
| Source     | Rétro-ingénierie        |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-017](../../../adr/RETRO-017-zustand-persist-au-lieu-de-react-context-redux.md) | Zustand + persist au lieu de React Context ou Redux | Documenté (rétro) |
| [RETRO-018](../../../adr/RETRO-018-partialize-persist-activeSnapshotId-uniquement.md) | Persist partiel : seul activeSnapshotId sérialisé dans localStorage | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `snapshot-selector` permet à l'utilisateur de choisir le snapshot actif parmi l'ensemble des snapshots uploadés dans l'application. Il est positionné dans le header de la `MapPage`, visible en permanence lors de la consultation de la carte.

L'identifiant du snapshot actif est persisté dans le localStorage afin que l'utilisateur retrouve automatiquement son dernier contexte lors d'une nouvelle ouverture de l'application.

## Règles métier (déduites du code)

1. Au montage du composant, la liste complète des snapshots disponibles est chargée depuis l'API (`GET /api/snapshots`).
2. Si aucun snapshot n'est disponible, le composant affiche un lien de redirection vers la page d'upload plutôt qu'un sélecteur vide.
3. Si aucun snapshot actif n'est défini (`activeSnapshotId === null`) et que la liste retournée contient au moins un élément, le premier snapshot de la liste est automatiquement activé.
4. Un snapshot persisté dans le localStorage dont l'identifiant reste valide est restauré sans re-sélection automatique au chargement — le graphe correspondant est rechargé depuis l'API.
5. La sélection d'un snapshot via le `<select>` déclenche immédiatement le chargement du graphe associé (`GET /api/snapshots/:id/graph`) et réinitialise la sélection courante (nœud et edge remis à null).
6. Chaque option du sélecteur affiche : le libellé du snapshot, l'environnement (`envName`), et la date/heure d'upload formatée en français (format `fr-FR`).
7. L'`activeSnapshotId` est le seul champ persisté dans le localStorage (clé `carto-ecp-store`) — les données de graphe, la liste des snapshots et la sélection courante ne sont pas persistées.

## Cas d'usage (déduits)

### CU-001 — Ouverture de la carte, aucun snapshot existant

L'utilisateur ouvre `MapPage` alors qu'aucun snapshot n'a encore été uploadé. Le composant `SnapshotSelector` affiche un lien texte « Aucun snapshot — charger » pointant vers `/upload`. L'utilisateur clique et est redirigé vers la page d'upload.

### CU-002 — Ouverture de la carte, première session (aucun état persisté)

L'utilisateur ouvre `MapPage` pour la première fois. `activeSnapshotId` est `null` (aucun état dans le localStorage). `loadSnapshots` retourne une liste non vide. Le premier snapshot de la liste est automatiquement activé : le graphe correspondant est chargé et la carte s'affiche.

### CU-003 — Retour sur la carte après une session précédente

L'utilisateur revient sur `MapPage`. Le localStorage contient un `activeSnapshotId` valide. `loadSnapshots` charge la liste. Comme `activeSnapshotId` n'est pas `null`, l'auto-bascule vers `list[0]` n'est pas déclenchée. `setActiveSnapshot` est appelé avec l'id persisté, chargeant le graphe du snapshot mémorisé.

### CU-004 — Changement de snapshot en cours de session

L'utilisateur, sur la `MapPage`, sélectionne un autre snapshot dans le `<select>`. `setActiveSnapshot` est appelé avec le nouvel id : la sélection courante (nœud/edge) est réinitialisée, le graphe est rechargé depuis l'API, et l'`activeSnapshotId` est mis à jour dans le store et persisté dans le localStorage.

## Dépendances

- **Store Zustand** (`useAppStore`) — actions `loadSnapshots`, `setActiveSnapshot` ; champs `snapshots`, `activeSnapshotId`.
- **API client** (`apps/web/src/lib/api.ts`) — `api.listSnapshots()`, `api.getGraph(id)`.
- **Types partagés** (`@carto-ecp/shared`) — `SnapshotSummary`.
- **Utilitaire de formatage** (`apps/web/src/lib/format.ts`) — `formatDateTime` (locale `fr-FR`).
- **React Router** — `<Link to="/upload">` pour la redirection quand la liste est vide.
- **Middleware Zustand persist** — `localStorage`, clé `carto-ecp-store`.

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le comportement attendu lorsqu'un `activeSnapshotId` persisté ne correspond plus à aucun snapshot de la liste (snapshot supprimé entre deux sessions) n'est pas géré explicitement — l'appel `getGraph` échouera silencieusement (affichage de l'erreur dans le store, mais pas de fallback automatique vers `list[0]`). Est-ce le comportement voulu ?
- L'ordre de tri de la liste retournée par `GET /api/snapshots` n'est pas spécifié ici — le premier élément de `list` est activé par défaut, ce qui implique que l'ordre de l'API détermine le snapshot initial. Valider que ce comportement est intentionnel.
- Le libellé « Aucun snapshot — charger » et l'apparence du lien (classe `text-rte underline`) restent à valider avec le design.
