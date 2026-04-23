# Spec Technique — web/timeline-slider

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/timeline-slider             |
| Version| 2.0.1                           |
| Date   | 2026-04-23                      |
| Source | v2.0.1 — refonte styling 5c     |

---

## Architecture

Composant de navigation temporelle affiché au-dessus de la carte quand l'environnement actif contient au moins 2 dates distinctes d'imports. Permet de fixer la `refDate` pour observer l'état du réseau à un instant donné.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `components/TimelineSlider/TimelineSlider.tsx` | Composant slider avec label date courante et bouton retour au présent |
| `store/app-store.ts` | État `refDate: Date | null`, action `setRefDate(date)` |

---

## Interfaces

### `TimelineSlider`

Props : aucune (lit depuis le store Zustand).

Sources depuis le store :
- `imports: ImportDetail[]` — liste des imports de l'env actif (pour extraire les dates)
- `refDate: Date | null` — date de référence courante (null = maintenant)
- `setRefDate(date: Date | null) -> Promise<void>` — met à jour `refDate` ET recharge le graphe

Comportement :

- Calcule `distinctDates` : `new Set(imports.map(i => i.effectiveDate)).sort()`
- Si `distinctDates.length < 2` : rendu null (composant masqué)
- Slider : `min=0`, `max=nMax` (où nMax = nombre de dates distinctes)
  - Index nMax = "maintenant" (refDate = null)
  - Index 0..nMax-1 = `distinctDates[idx]`
- Label : date FR locale si refDate fixée, sinon "maintenant"
- Compteur : "N dates distinctes · M inclus jusqu'à [date]"
- Bouton "Retour au présent" : visible si `refDate !== null`, appelle `setRefDate(null)`

### `setRefDate` dans le store

```typescript
setRefDate: async (date: Date | null) => {
  set({ refDate: date });
  const env = get().activeEnv;
  if (env !== null) {
    await get().loadGraph(env, date ?? undefined);
  }
}
```

La `refDate` est persistée dans le store mais PAS dans localStorage (partialize n'inclut que `activeEnv`).

---

## Dépendances

- Zustand store — `imports`, `refDate`, `setRefDate`
- `@carto-ecp/shared` — type `ImportDetail`
- `api.getGraph(env, refDate?)` — rechargé à chaque changement de refDate

---

## Invariants

1. Le composant se masque si < 2 dates distinctes (pas de navigation utile avec 0 ou 1 point).
2. `refDate = null` signifie "pas de filtre temporel" : le graphe inclut tous les imports de l'env.
3. Le slider inclut une position supplémentaire au-delà des dates connues (index nMax) qui représente "maintenant".
4. Les dates sont comparées en string ISO pour la déduplication (`new Set` sur les strings ISO).

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `TimelineSlider.test.tsx` | Rendu null si < 2 dates, slider range, label date, bouton retour, appel setRefDate |

Ref. croisées : [api/graph](../../api/graph/spec-technique.md) — `refDate` transmise comme `?refDate=` en query param. [web/map](../map/spec-technique.md) — TimelineSlider affiché dans MapPage au-dessus de NetworkMap.

---

## Styling — Slice 5c (v2.0.1)

`TimelineSlider.module.scss` a été refondu en Slice 5c. L'`<input type="range">` est entièrement tokenisé avec des pseudo-éléments vendeur explicites :

- Rail WebKit (`-webkit-slider-runnable-track`) : fond `--c-border-subtle`, `accent-color: var(--c-primary)` pour la portion remplie.
- Thumb WebKit (`-webkit-slider-thumb`) et Firefox (`-moz-range-thumb`) : `background: var(--c-primary)`, `box-shadow: var(--shadow-focus)` au `:focus-visible`.
- Focus ring : utilise `--shadow-focus` (token d'élévation focus cyan) au lieu d'un outline ad hoc.
- Typographie label date / compteur : `@mixin t-small` et `@mixin t-mono`.

Aucun hex codé en dur dans ce fichier après Slice 5c. Voir `docs/specs/web/charte-visuelle/spec-technique.md §12.2` pour le tableau complet des tokens.
