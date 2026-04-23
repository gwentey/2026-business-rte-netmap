# Spec Technique — web/env-selector

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/env-selector                |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Composant simple `<select>` qui permet de changer d'environnement. Il remplace l'ancien `SnapshotSelector` de v1. L'état est entièrement dans le store Zustand.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `components/EnvSelector/EnvSelector.tsx` | Composant `<select>` contrôlé |
| `store/app-store.ts` | État `envs: string[]`, `activeEnv: string | null`, action `setActiveEnv(env)` |

---

## Interfaces

### `EnvSelector`

Props : aucune (lit depuis le store Zustand).

Sources depuis le store :
- `envs: string[]` — liste des environnements disponibles (chargée par `loadEnvs()`)
- `activeEnv: string | null` — environnement courant
- `setActiveEnv: (env: string) => Promise<void>`

Comportement :
- Si `envs.length === 0` : affiche `<span>Aucun env</span>`
- Sinon : `<select>` avec une `<option>` par env
- `onChange` : appelle `setActiveEnv(e.target.value)`

**Styling fallback dark (Slice 5b — v3.0-alpha.16)** : `EnvSelector.module.scss` utilise désormais `@use "@/styles/brand" as *` et le mixin `@include t-small` + `color: rgba(255,255,255,0.72)` pour le span `.empty`. Ce changement assure la lisibilité du texte "Aucun env" sur le fond `--c-surface-dark` du header principal. Le rendu du `<select>` lui-même est délégué au DS RTE dont les `--background-brand-*` / `--content-brand-*` sont surchargés globalement par Slice 5a.

### `setActiveEnv` dans le store

```typescript
setActiveEnv: async (env) => {
  set({ activeEnv: env, selectedNodeEic: null, selectedEdgeId: null });
  await Promise.all([get().loadImports(env), get().loadGraph(env)]);
}
```

Réinitialise la sélection (nœud/edge) et recharge imports + graphe en parallèle.

### `loadEnvs` dans le store

```typescript
loadEnvs: async () => {
  const envs = await api.listEnvs();
  set({ envs });
  // Si activeEnv toujours valide : setActiveEnv(current)
  // Sinon si des envs existent : setActiveEnv(envs[0])
  // Sinon : réinitialiser (activeEnv=null, imports=[], graph=null)
}
```

Appelé au montage de l'application et en fin de batch upload.

---

## Persistance

`activeEnv` est persisté dans `localStorage` via Zustand `persist` avec `partialize: (s) => ({ activeEnv: s.activeEnv })`. Au rechargement de la page, l'env actif est restauré automatiquement (si toujours valide).

---

## Dépendances

- Zustand store — `envs`, `activeEnv`, `setActiveEnv`, `loadEnvs`
- `lib/api.ts` — `api.listEnvs()` (GET /api/envs)
- `@carto-ecp/shared` — type `ImportDetail` (indirectement via loadImports)

---

## Invariants

1. `activeEnv` ne peut prendre une valeur que si elle est dans `envs`.
2. Si l'env persisté n'est plus valide (tous ses imports ont été supprimés), `loadEnvs` bascule sur le premier env disponible ou null.
3. Changer d'env réinitialise `selectedNodeEic` et `selectedEdgeId` (la sélection n'est pas transférable entre envs).

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `EnvSelector.test.tsx` | Rendu "Aucun env" si vide, select avec options, onChange déclenche setActiveEnv |

Ref. croisées : [api/envs](../../api/envs/spec-technique.md) — endpoint consommé. [web/map](../map/spec-technique.md) — EnvSelector intégré dans MapPage.
