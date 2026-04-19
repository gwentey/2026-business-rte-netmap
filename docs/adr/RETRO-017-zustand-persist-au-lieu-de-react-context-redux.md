# RETRO-017 — Zustand + persist au lieu de React Context ou Redux

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-04-17          |
| Source     | Rétro-ingénierie    |
| Features   | snapshot-selector, upload, map |

## Contexte

L'application frontend nécessite un état global partagé entre plusieurs pages et composants : le snapshot actif, la liste des snapshots, le graphe chargé, la sélection courante (nœud ou edge). Plusieurs approches étaient envisageables : React Context natif, Redux Toolkit, Zustand, Jotai, ou un état local levé au niveau du routeur.

La contrainte principale est la persistance du `activeSnapshotId` entre les sessions navigateur, afin que l'utilisateur retrouve automatiquement le dernier snapshot sélectionné lors d'une nouvelle ouverture de l'application.

## Décision identifiée

Le store global est implémenté avec **Zustand 4.5** via `create<AppState>()`, enveloppé dans le middleware `persist` de `zustand/middleware`. Seul `activeSnapshotId` est sérialisé dans `localStorage` via l'option `partialize: (s) => ({ activeSnapshotId: s.activeSnapshotId })`. La clé de stockage est `carto-ecp-store`.

Les données non persistées (liste des snapshots, graphe, sélection courante, états loading/error) sont réinitialisées à chaque session via `loadSnapshots()` déclenché au montage du composant `SnapshotSelector`.

## Conséquences observées

### Positives
- API minimaliste : les composants sélectionnent uniquement les slices d'état dont ils ont besoin (`useAppStore((s) => s.snapshots)`), évitant les re-renders superflus.
- Le middleware `persist` gère nativement la sérialisation/désérialisation JSON et la réhydratation au boot sans boilerplate.
- `partialize` permet de ne persister que l'identifiant (scalaire) et non les objets graphe/snapshots (potentiellement lourds), éliminant le risque de saturation du localStorage.
- Pas de Provider wrapper nécessaire, ni de boilerplate type/reducer/selector séparé comme Redux.
- Couplage minimal : `useAppStore` est un hook React standard importable directement depuis n'importe quel composant.

### Négatives / Dette
- Le store mélange état de navigation (`activeSnapshotId`), état de données (`snapshots`, `graph`) et état UI (`selectedNodeEic`, `selectedEdgeId`, `loading`, `error`) dans une seule slice — pas de séparation fonctionnelle.
- L'absence de DevTools Zustand configurées (non vérifiable dans ce code) rend le debug moins ergonomique que Redux DevTools.
- La donnée `graph` (potentiellement plusieurs centaines de nœuds et edges) est en mémoire dans le store mais pas dans un cache requête (pas de React Query / SWR) — pas d'invalidation automatique.
- Si `activeSnapshotId` persisté pointe vers un snapshot supprimé, l'appel `getGraph` échouera au montage ; l'auto-bascule vers `list[0]` n'est déclenchée que si `activeSnapshotId` est `null`, pas si le snapshot est absent de la liste.

## Recommandation

Garder pour slice #1 — le choix est approprié à la taille de l'application (état modeste, 1 utilisateur à la fois). Reconsidérer l'introduction de React Query pour la couche fetching (graphe, liste snapshots) dans un slice ultérieur, ce qui découplerait le cache réseau de l'état UI et offrirait invalidation automatique et gestion des erreurs plus fine.
