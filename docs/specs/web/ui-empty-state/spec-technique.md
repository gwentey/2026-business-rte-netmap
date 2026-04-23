# Spec Technique — web/ui-empty-state

| Champ  | Valeur                                    |
|--------|-------------------------------------------|
| Module | web/ui-empty-state                        |
| Version| 1.0.0                                     |
| Date   | 2026-04-23                                |
| Source | Slice 5e — Finitions UX                   |

Accompagne [`spec-fonctionnel.md`](./spec-fonctionnel.md). Documente l'API du composant, ses styles et ses tests.

---

## 1. Arborescence

```
apps/web/src/components/ui/EmptyState/
├── EmptyState.tsx
├── EmptyState.module.scss
└── test.tsx
```

Export via `apps/web/src/components/ui/index.ts` :

```typescript
export { EmptyState } from './EmptyState/EmptyState.js';
```

---

## 2. API TypeScript

```typescript
interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: ReactNode;
  title: ReactNode;          // requis
  description?: ReactNode;
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg'; // défaut : 'md'
}
```

`EmptyStateProps` étend `Omit<HTMLAttributes<HTMLDivElement>, 'title'>` — `title` est omis de `HTMLAttributes` pour éviter le conflit de type avec la prop `title: ReactNode` (l'attribut HTML `title` est `string`).

---

## 3. Logique de rendu

Structure HTML générée :

```html
<div class="root size{Sm|Md|Lg} [className]">
  <!-- si icon -->
  <div class="icon" aria-hidden="true">{icon}</div>
  <!-- toujours -->
  <h2 class="title">{title}</h2>
  <!-- si description -->
  <p class="description">{description}</p>
  <!-- si action -->
  <div class="action">{action}</div>
</div>
```

**Calcul du `rootClass`** : concat de `styles.root`, `styles[size{Capitalised}]` et `className` avec `.trim()` pour éviter les espaces superflus.

---

## 4. `EmptyState.module.scss`

### Classe `.root`

| Propriété CSS | Valeur |
|---------------|--------|
| `display` | `flex` |
| `flex-direction` | `column` |
| `align-items` | `center` |
| `justify-content` | `center` |
| `gap` | `16px` |
| `padding` | `48px 24px` |
| `text-align` | `center` |
| `background` | `var(--c-surface-sunken)` |
| `border-radius` | `var(--r-md)` |
| `color` | `var(--c-text)` |

### Classes de taille

| Classe | Padding | Gap |
|--------|---------|-----|
| `.sizeSm` | `24px 16px` | `12px` |
| `.sizeMd` | `48px 24px` | — (hérite de `.root`) |
| `.sizeLg` | `72px 32px` | `20px` |

### Classe `.icon`

`inline-flex`, centré, `width: 48px`, `height: 48px`, `color: var(--c-primary)`, `opacity: 0.9`.

Surchargé par les modificateurs de taille :
- `.sizeSm .icon` : `32px × 32px`
- `.sizeLg .icon` : `64px × 64px`

### Classes `.title` et `.description`

| Classe | Mixin | Couleur | max-width |
|--------|-------|---------|-----------|
| `.title` | `@include t-h2` (surchargé `@include t-h3` pour `.sizeSm`) | `var(--c-text)` | `520px` |
| `.description` | `@include t-body` | `var(--c-text-muted)` | `420px` |

### Tokens consommés

| Token | Usage |
|-------|-------|
| `--c-surface-sunken` | Fond du conteneur |
| `--c-text` | Couleur du titre |
| `--c-text-muted` | Couleur de la description |
| `--c-primary` | Couleur de l'icône |
| `--r-md` | Border-radius du conteneur |
| `@mixin t-h2` | Titre md/lg |
| `@mixin t-h3` | Titre sm |
| `@mixin t-body` | Description |

---

## 5. Tests (`test.tsx`)

6 tests Vitest dans `apps/web/src/components/ui/EmptyState/test.tsx` :

| # | Description |
|---|-------------|
| 1 | Rend sans erreur avec seulement la prop `title` |
| 2 | Affiche le titre passé |
| 3 | Affiche l'icône quand fournie |
| 4 | Affiche la description quand fournie |
| 5 | Affiche le slot action quand fourni |
| 6 | Applique la classe de taille correspondante à la prop `size` |

---

## 6. Points d'attention

- **`Omit<HTMLAttributes<HTMLDivElement>, 'title'>`** — nécessaire car `HTMLAttributes.title` est `string | undefined`, incompatible avec la prop `title: ReactNode` (ex : `<strong>texte</strong>` ne satisfait pas `string`).
- **Pas de `role` sémantique fort** — le composant n'expose pas `role="status"` contrairement à `Skeleton`. Un EmptyState est un contenu statique, pas un état de chargement dynamique.
- **Composant contrôlé par le parent** — EmptyState ne gère aucun état interne. C'est au composant consommateur de décider quand l'afficher (condition sur `data.length === 0`, etc.).
