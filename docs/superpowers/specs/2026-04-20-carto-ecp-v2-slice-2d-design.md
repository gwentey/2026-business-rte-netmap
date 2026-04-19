# Slice 2d — Timeline slider UI

> **Statut :** design validé autonome (2026-04-20). Backend refDate déjà prêt depuis 2a.
> **Branche :** `feat/v2-slice-2d-timeline` (depuis tip de 2c-2).

---

## §1 — Objectif

Ajouter un **curseur temporel** au-dessus de la carte qui permet à l'utilisateur de rejouer l'état du réseau à une date passée. Chaque cran du slider = une `effectiveDate` distincte parmi les imports de l'env actif. Position "now" (dernière) par défaut.

Le backend supporte déjà `GET /api/graph?env=X&refDate=ISO` depuis slice 2a. 2d = **pure UI**.

---

## §2 — Scope

### 2d livre

- Nouveau composant `TimelineSlider` inséré au-dessus de `NetworkMap` dans `MapPage`
- Extension du store Zustand : champ `refDate: Date | null` (non persisté, session-only) + méthode `setRefDate(date | null)` qui déclenche `loadGraph(env, date)`
- Le slider affiche :
  - Une piste horizontale avec N crans (N = count of distinct `effectiveDate` dans les imports de l'env)
  - Label "maintenant" à droite (state default, refDate=null)
  - Labels de date au survol des crans
  - Bouton "⟲ Retour au présent" quand refDate != null

### 2d ne livre pas

- ❌ Granularité continue (scroll/drag libre) — crans par import seulement
- ❌ Play/pause animation automatique
- ❌ Comparaison 2 dates (diff view)
- ❌ Timeline cross-env
- ❌ Persistance refDate entre sessions

---

## §A — Architecture

```
MapPage
  ├── <TimelineSlider /> (NOUVEAU, inséré en top)
  └── <NetworkMap />
  └── <DetailPanel />

Store Zustand
  + refDate: Date | null
  + setRefDate: (date: Date | null) => Promise<void>

TimelineSlider
  ├── reads imports + activeEnv + refDate from store
  ├── computes distinct effectiveDates sorted asc
  ├── range input [0..N] where N = distinctDates.length
  ├── value N = "now" (refDate=null)
  ├── value i = refDate = distinctDates[i]
  └── onChange → store.setRefDate(date or null)
```

Pas de changement backend. `graph.getGraph` accepte déjà un `refDate` optionnel.

---

## §B — Store : `refDate` + `setRefDate`

Dans `apps/web/src/store/app-store.ts` :

```typescript
type AppState = {
  // ... existants
  refDate: Date | null;
  setRefDate: (date: Date | null) => Promise<void>;
  // ...
};

// Dans le create :
refDate: null,

setRefDate: async (date) => {
  set({ refDate: date });
  const env = get().activeEnv;
  if (env !== null) {
    await get().loadGraph(env, date ?? undefined);
  }
},
```

**Important** : `refDate` n'est PAS persisté (absent de `partialize`). Au reload de la page, retour à "now" automatique.

Pour `setActiveEnv` existant : garder le comportement actuel (passe `undefined` = "now"). On peut ignorer `refDate` lors du switch env (intuitif : changer d'env réinitialise à now).

---

## §C — Composant `TimelineSlider`

**Fichier :** `apps/web/src/components/TimelineSlider/TimelineSlider.tsx`

```tsx
import { useMemo } from 'react';
import { useAppStore } from '../../store/app-store.js';

export function TimelineSlider(): JSX.Element | null {
  const imports = useAppStore((s) => s.imports);
  const refDate = useAppStore((s) => s.refDate);
  const setRefDate = useAppStore((s) => s.setRefDate);

  // Dates distinctes triées asc, issues des imports de l'env actif (filtrées par store)
  const distinctDates = useMemo(() => {
    const set = new Set(imports.map((i) => i.effectiveDate));
    return Array.from(set).sort();
  }, [imports]);

  if (distinctDates.length < 2) return null;  // Pas la peine de montrer un slider à 1 cran

  const nMax = distinctDates.length;  // value N = "now"
  const currentIndex = refDate === null
    ? nMax
    : distinctDates.findIndex((iso) => iso === refDate.toISOString());

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const idx = Number(e.target.value);
    if (idx === nMax) {
      void setRefDate(null);
    } else {
      const iso = distinctDates[idx];
      if (iso !== undefined) {
        void setRefDate(new Date(iso));
      }
    }
  };

  const currentLabel = refDate === null
    ? 'maintenant'
    : new Date(refDate).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="border-b border-gray-200 bg-gray-50 px-4 py-2">
      <div className="flex items-center gap-3">
        <label className="flex flex-1 items-center gap-3 text-sm">
          <span className="text-gray-700 whitespace-nowrap">Date de référence :</span>
          <input
            type="range"
            min={0}
            max={nMax}
            value={currentIndex >= 0 ? currentIndex : nMax}
            onChange={handleChange}
            className="flex-1"
            aria-label="Date de référence timeline"
          />
          <span className="font-mono text-xs text-gray-900 w-36 text-right">{currentLabel}</span>
        </label>
        {refDate !== null ? (
          <button
            type="button"
            onClick={() => { void setRefDate(null); }}
            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
          >
            ⟲ Retour au présent
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-xs text-gray-500">
        {nMax} imports · {refDate === null ? `tous inclus (état actuel)` : `${distinctDates.filter((d) => d <= refDate.toISOString()).length} inclus jusqu'à ${currentLabel}`}
      </div>
    </div>
  );
}
```

---

## §D — Intégration dans `MapPage`

Dans `apps/web/src/pages/MapPage.tsx`, insérer `TimelineSlider` au-dessus de la zone `NetworkMap + DetailPanel`. Ne pas l'afficher si empty state (pas d'imports → pas de timeline à montrer).

```tsx
import { TimelineSlider } from '../components/TimelineSlider/TimelineSlider.js';

// ...dans le return (cas normal avec graph non vide) :
return (
  <div className="flex h-full flex-col">
    <TimelineSlider />
    <div className="flex flex-1">
      <NetworkMap />
      <DetailPanel />
    </div>
  </div>
);
```

---

## §E — Tests

### Unit (3-4 tests) : `TimelineSlider.test.tsx`

1. Renders nothing when <2 distinct dates
2. Renders "maintenant" label when refDate is null
3. Renders formatted date label when refDate set
4. Calls setRefDate(null) when "Retour au présent" button clicked

### Store (1 test) : ajouter dans `app-store.test.ts`

- `setRefDate` sets the refDate state and triggers loadGraph with the date

---

## §F — DoD

- [ ] `TimelineSlider` component livré avec 4 tests
- [ ] Store Zustand étendu avec `refDate` + `setRefDate`
- [ ] `MapPage` intègre le slider au-dessus de la carte
- [ ] typecheck api + web + shared PASS (pas de changement api)
- [ ] Test manuel : switcher date = carte change, retour présent = carte redevient actuelle
- [ ] CHANGELOG v2.0-alpha.6
