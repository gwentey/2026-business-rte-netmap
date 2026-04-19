# Spec Technique — snapshot-selector

| Champ         | Valeur                  |
|---------------|-------------------------|
| Module        | web/snapshot-selector   |
| Version       | 0.2.0                   |
| Date          | 2026-04-18              |
| Source        | Rétro-ingénierie + Phase 2 remédiation |

## Architecture du module

Le module repose sur deux fichiers distincts à responsabilités séparées :

- **`SnapshotSelector.tsx`** — composant React de présentation. Il consomme le store Zustand via des sélecteurs fins, déclenche `loadSnapshots` au montage, et délègue toute la logique métier (chargement, persistance, mise à jour du graphe) aux actions du store.
- **`app-store.ts`** — store Zustand singleton. Centralise l'état global de l'application web (snapshot actif, liste des snapshots, graphe courant, sélection UI) et encapsule les appels API. Seul `activeSnapshotId` est persisté via le middleware `persist`.

Le composant n'a aucun état local (`useState`) — tout transite par le store.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/src/components/SnapshotSelector/SnapshotSelector.tsx` | Composant React du sélecteur de snapshot | ~37 |
| `apps/web/src/store/app-store.ts` | Store Zustand global — état + actions + persist | ~64 |
| `apps/web/src/lib/api.ts` | Client HTTP fetch — `listSnapshots`, `getGraph` | ~30 |
| `apps/web/src/lib/format.ts` | Utilitaire `formatDateTime` (locale `fr-FR`) | ~12 |
| `packages/shared/src/snapshot.ts` | Types `SnapshotSummary`, `SnapshotDetail` | ~28 |

## Schéma BDD (si applicable)

Non applicable — ce module est purement frontend. Il consomme les endpoints REST de l'API NestJS qui lisent la table `Snapshot` (SQLite via Prisma). Aucune écriture en base depuis ce module.

## API / Endpoints consommés

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| GET | `/api/snapshots` | Liste tous les snapshots (résumés) | Aucune |
| GET | `/api/snapshots/:id/graph` | Graphe nodes/edges d'un snapshot | Aucune |

## Détail des actions du store

### `loadSnapshots(): Promise<void>`

1. Passe `loading: true`, `error: null`.
2. Appelle `api.listSnapshots()`.
3. Met à jour `snapshots` avec le résultat et `loading: false`.
4. Calcule `persistedStillValid = activeSnapshotId !== null && list.some(s => s.id === activeSnapshotId)`.
   - Si `persistedStillValid` et `graph === null` : appelle `setActiveSnapshot(activeSnapshotId)` pour charger le graphe (cas boot avec id persisté valide mais graphe non chargé en mémoire).
   - Si `!persistedStillValid` et `list.length > 0` : appelle `setActiveSnapshot(list[0].id)` pour basculer sur le premier snapshot disponible. **[P2-7]**
5. En cas d'erreur : `loading: false`, `error: message`.

### `setActiveSnapshot(id: string): Promise<void>`

1. Passe `loading: true`, `error: null`, `selectedNodeEic: null`, `selectedEdgeId: null`.
2. Appelle `api.getGraph(id)`.
3. Met à jour `activeSnapshotId: id`, `graph`, `loading: false`.
4. En cas d'erreur : `loading: false`, `error: message`.

Note : `activeSnapshotId` est persisté automatiquement après chaque `set` par le middleware Zustand `persist`.

## Configuration persist (localStorage)

| Paramètre | Valeur |
|-----------|--------|
| Clé localStorage | `carto-ecp-store` |
| Champ persisté | `activeSnapshotId` uniquement |
| Middleware | `zustand/middleware` — `persist` |
| Option `partialize` | `(s) => ({ activeSnapshotId: s.activeSnapshotId })` |

## Comportement du composant SnapshotSelector

Le composant utilise quatre sélecteurs Zustand fins pour éviter les re-renders inutiles :

```
snapshots       ← s.snapshots
activeId        ← s.activeSnapshotId
load            ← s.loadSnapshots   (référence stable)
setActive       ← s.setActiveSnapshot
```

`useEffect(() => { void load(); }, [load])` — déclenché une seule fois au montage (la référence `load` est stable grâce à Zustand).

**Rendu conditionnel :**
- `snapshots.length === 0` → `<Link to="/upload">` avec texte « Aucun snapshot — charger ».
- `snapshots.length > 0` → `<select>` natif avec `value={activeId ?? ''}`, une `<option>` par snapshot formatée `{label} — {envName} — {formatDateTime(uploadedAt)}`.

**Interaction :** `onChange={(e) => void setActive(e.target.value)}` — appel asynchrone sans await dans le handler (pattern `void promise`).

## Patterns identifiés

- **Selector pattern Zustand** : chaque champ d'état est sélectionné individuellement (`useAppStore((s) => s.snapshots)`) plutôt que de destructurer l'intégralité du store — optimisation des re-renders.
- **Persist middleware avec partialize** : seule la donnée de navigation (`activeSnapshotId`) est persistée, pas les données de payload (graphe, liste).
- **Fire-and-forget avec `void`** : les appels asynchrones dans les handlers d'événements React utilisent `void promise` plutôt que `async/await` dans la fonction handler — cohérent avec les règles ESLint `@typescript-eslint/no-floating-promises`.
- **Conditional rendering par branche** : le composant retourne deux rendus mutuellement exclusifs selon que la liste est vide ou non (pas de rendu vide/loading géré ici — l'état `loading` du store n'est pas consommé par `SnapshotSelector`).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx` | **[P2-6]** Liste vide → lien "Aucun snapshot — charger" affiché, liste non vide → `<select>` avec `value` égal à `activeSnapshotId`, `onChange` déclenche `setActiveSnapshot` avec l'id sélectionné | Ajouté Phase 2 |
| `apps/web/src/store/app-store.test.ts` | **[P2-7]** `loadSnapshots` bascule sur `list[0]` si `activeSnapshotId` persisté absent de la liste ; charge le graphe au boot si `activeSnapshotId` valide et `graph === null` | Ajouté Phase 2 |
