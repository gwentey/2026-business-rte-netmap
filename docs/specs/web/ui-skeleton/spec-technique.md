# Spec Technique — web/ui-skeleton

| Champ  | Valeur                                    |
|--------|-------------------------------------------|
| Module | web/ui-skeleton                           |
| Version| 1.0.0                                     |
| Date   | 2026-04-23                                |
| Source | Slice 5e — Finitions UX                   |

Accompagne [`spec-fonctionnel.md`](./spec-fonctionnel.md). Documente l'API du composant, ses styles et ses tests.

---

## 1. Arborescence

```
apps/web/src/components/ui/Skeleton/
├── Skeleton.tsx
├── Skeleton.module.scss
└── test.tsx
```

Export via `apps/web/src/components/ui/index.ts` :

```typescript
export { Skeleton, type SkeletonVariant } from './Skeleton/Skeleton.js';
```

---

## 2. API TypeScript

```typescript
export type SkeletonVariant = 'text' | 'title' | 'card' | 'circle' | 'rect';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;   // défaut : 'text'
  width?: string | number;     // override inline style — number → px
  height?: string | number;    // override inline style — number → px
  lines?: number;              // défaut : 1 — multi-ligne (variant text uniquement)
}
```

`SkeletonProps` étend `HTMLAttributes<HTMLDivElement>` — toutes les props HTML standard (`className`, `style`, `data-*`, etc.) sont transmises au `<div>` racine.

---

## 3. Logique de rendu

### Cas multi-ligne (`variant === 'text' && lines > 1`)

Rend un `<div className={styles.group}>` contenant `lines` divs `.base.text`. La dernière div reçoit `width: '60%'` en style inline (ou la largeur surchargée si `width` est fourni explicitement).

Attributs accessibilité sur le conteneur `.group` : `role="status"`, `aria-label="Chargement"`, `aria-live="polite"`.

### Cas standard (toutes autres combinaisons)

Rend un unique `<div>` avec les classes `.base` + `.{variant}`. Attributs accessibilité sur le div lui-même.

---

## 4. `Skeleton.module.scss`

### Animation shimmer

```scss
@keyframes skeleton-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position:  200% 0; }
}
```

Durée : `1.6s ease-in-out infinite`. Le gradient `rgba(255,255,255,0.6)` est une valeur d'effet visuel non tokenisée (intentionnel — pas une couleur sémantique).

### Classe `.base`

| Propriété CSS | Valeur |
|---------------|--------|
| `background-color` | `var(--c-surface-sunken)` |
| `background-image` | gradient shimmer horizontal |
| `background-size` | `200% 100%` |
| `animation` | `skeleton-shimmer 1.6s ease-in-out infinite` |
| `border-radius` | `var(--r-sm)` (surchargé par variants) |

### Media query `prefers-reduced-motion`

```scss
@media (prefers-reduced-motion: reduce) {
  .base { animation: none; background-image: none; }
}
```

### Tokens consommés

| Token | Usage |
|-------|-------|
| `--c-surface-sunken` | Fond du squelette |
| `--r-sm` | Border-radius `.text`, `.title` |
| `--r-md` | Border-radius `.card` |
| `--r-pill` | Border-radius `.circle` |

---

## 5. Tests (`test.tsx`)

6 tests Vitest dans `apps/web/src/components/ui/Skeleton/test.tsx` :

| # | Description |
|---|-------------|
| 1 | Rend sans erreur avec les props par défaut |
| 2 | Applique la classe du variant passé |
| 3 | Applique les styles inline `width` et `height` |
| 4 | Rend `lines` divs pour le variant `text` multi-ligne |
| 5 | La dernière ligne d'un multi-ligne est à 60% de largeur |
| 6 | Expose `role="status"` et `aria-label="Chargement"` |

---

## 6. Points d'attention

- **`rgba(255,255,255,0.6)` non tokenisé** — valeur d'effet visuel shimmer. Elle passerait le garde-fou `check:no-hex` (la regex cible `#rrggbb` / `#rgb`, pas les `rgba()`).
- **Classe `.rect`** — hauteur et largeur à `100%` : le composant consommateur doit définir les dimensions du conteneur parent pour que le variant `rect` soit visible.
- **Conflict de className** — `Skeleton.tsx` concat manuellement `styles.base`, `variantClass` et la `className` externe pour éviter une dépendance à `clsx` non nécessaire ici.
