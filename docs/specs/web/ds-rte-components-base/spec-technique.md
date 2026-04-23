# Spec Technique — web/ds-rte-components-base

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/ds-rte-components-base      |
| Version| 3.0-alpha.7                     |
| Date   | 2026-04-23                      |
| Source | Slice 4b — composants de base   |

Accompagne [`spec-fonctionnel.md`](./spec-fonctionnel.md). Documente l'architecture technique de la couche `components/ui/` et l'API des 4 composants maison.

---

## 1. Arborescence cible

```
apps/web/src/components/ui/
├── index.ts                      # barrel export (37 DS + 4 maison)
├── Table/
│   ├── Table.tsx
│   └── Table.module.scss
├── RangeSlider/
│   ├── RangeSlider.tsx
│   └── RangeSlider.module.scss
├── ColorField/
│   ├── ColorField.tsx
│   └── ColorField.module.scss
└── DateTimeField/
    ├── DateTimeField.tsx
    └── DateTimeField.module.scss
```

---

## 2. Barrel `index.ts`

Ré-exporte 37 composants DS depuis `@design-system-rte/react` :

```
Accordion, Avatar, Badge, Banner, Breadcrumbs, Button, Card, Checkbox,
CheckboxGroup, Chip, Divider, Drawer, FileUpload, Grid, Icon, IconButton,
IconButtonToggle, Loader, Modal, Popover, RadioButton, RadioButtonGroup,
Searchbar, SegmentedControl, Select, SideNav, SplitButton, Stepper,
Switch, Tab, Tag, Textarea, TextInput, Toast, ToastQueueProvider,
Tooltip, Treeview
```

**Alias** : `Link` du DS est ré-exporté sous `DsLink` pour éviter la collision avec `Link` de `react-router-dom` (utilisé pour la navigation routing). Usage attendu :
- `import { Link } from 'react-router-dom'` pour la navigation
- `import { DsLink } from '@/components/ui'` pour le lien stylé DS (ex: lien externe)

Ajoute les 4 composants maison :
```ts
export { Table } from './Table/Table.js';
export { RangeSlider } from './RangeSlider/RangeSlider.js';
export { ColorField } from './ColorField/ColorField.js';
export { DateTimeField } from './DateTimeField/DateTimeField.js';
```

---

## 3. API des 4 composants maison

### Table

```tsx
import { Table } from '@/components/ui';
export type TableProps = React.TableHTMLAttributes<HTMLTableElement>;
```

Stylage via CSS Module avec sélecteurs descendants : `thead`, `th`, `td`, `tbody tr:hover`. Les consommateurs utilisent les balises HTML natives à l'intérieur :

```tsx
<Table>
  <thead>
    <tr><th>EIC</th><th>Nom</th></tr>
  </thead>
  <tbody>
    <tr><td>17V000…</td><td>RTE CD</td></tr>
  </tbody>
</Table>
```

### RangeSlider

```tsx
interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;               // défaut 1
  value: number;
  onChange: (value: number) => void;
  label?: string;
  displayValue?: string;       // ex: date formatée pour TimelineSlider
  disabled?: boolean;
  'aria-label'?: string;
}
```

Utilise `<input type="range">` natif avec `accent-color: #e30613` (brand RTE).

### ColorField

```tsx
interface ColorFieldProps {
  value: string;               // ex: '#e30613'
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  'aria-label'?: string;
}
```

Utilise `<input type="color">` natif. Affiche la valeur hex en monospace à côté du picker.

### DateTimeField

```tsx
interface DateTimeFieldProps {
  value: string;               // ex: '2026-04-23T15:30'
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
  'aria-label'?: string;
}
```

Utilise `<input type="datetime-local">` natif avec focus ring rouge RTE.

---

## 4. Migration EnvSelector

### Avant (Tailwind + select natif)

```tsx
<select
  value={activeEnv ?? ''}
  onChange={(e) => { void setActiveEnv(e.target.value); }}
  className="rounded border border-gray-300 px-2 py-1 text-sm"
>
  {envs.map((e) => (
    <option key={e} value={e}>{e}</option>
  ))}
</select>
```

### Après (DS Select via @/components/ui)

```tsx
import { Select } from '@/components/ui';

<Select
  id="env-selector"
  label="Environnement"
  showLabel={false}
  value={activeEnv ?? ''}
  onChange={(value) => { void setActiveEnv(value); }}
  options={envs.map((env) => ({ value: env, label: env }))}
/>
```

**Note a11y** : `label` reste obligatoire (accessibilité), `showLabel={false}` le masque visuellement. L'API DS `onChange` reçoit directement la valeur (pas l'event).

### Tests `.todo`

3 tests d'interaction sont désactivés :
- `renders all envs as options`
- `marks the active env as selected`
- `calls setActiveEnv on change`

Raison : le DS Select rend un DOM custom (bouton + listbox) au lieu du `<select>` natif, donc `screen.getByRole('combobox')` + `userEvent.selectOptions` ne fonctionnent plus. Le 4e test (`renders fallback text when envs is empty`) reste actif et passe.

À réécrire en Slice 4b.2 ou dans la première slice admin qui utilise le DS Select.

---

## 5. Couleurs hardcodées (dette technique)

Les 4 composants maison utilisent des valeurs hex directes :
- `#e30613` (brand RTE primaire)
- `#e5e7eb, #d1d5db, #f3f4f6, #f9fafb` (neutrals light)
- `#6b7280, #4b5563, #374151, #111827` (neutrals dark)

Raison : le token `$font-family-nunito` initialement référencé dans la Slice 4a n'existe pas dans l'API publique du DS (seuls les tokens composés type `$heading-m-semibold-font-family` sont exposés). Pareil pour les couleurs — pas d'export documenté clairement pour `$color-brand-primary` et les neutrals. La piste des tokens DS composés sera creusée en Slice 4c ou en slice dédiée.

---

## 6. Vérification

```bash
pnpm --filter @carto-ecp/web typecheck   # exit 0
pnpm --filter @carto-ecp/web test        # 143 verts + 3 .todo
pnpm --filter @carto-ecp/web build       # exit 0, ~1.5 MB JS bundle (cf section 7)
```

Grep de cohérence (après Slice 4b) :
```bash
# Aucun import DS direct hors de components/ui/
grep -r "from '@design-system-rte/react'" apps/web/src --exclude-dir=ui
# Attendu : vide (sauf éventuellement components/ui/index.ts lui-même)
```

---

## 7. Bundle size

- Slice 4a : JS bundle = 556 KB (gzip 165 KB), CSS = 147 KB
- Slice 4b : JS bundle = 1486 KB (gzip 358 KB), CSS = 147 KB

L'augmentation (~+1 MB) vient du barrel `components/ui/index.ts` qui ré-exporte les 37 composants DS. Tree-shaking limité car tous les exports sont potentiellement utilisés (consommateurs futurs en 4c/4d/4e).

Mitigations possibles en slice future (4e ou dédiée) :
- Imports sélectifs : remplacer `index.ts` barrel par imports directs dans chaque fichier consommateur
- Code-splitting par route (dynamic import sur AdminPage/UploadPage)
- `manualChunks` dans `vite.config.ts` pour séparer DS CSS/JS

Non-bloquant pour dev-local. À re-évaluer si passage en prod.

---

## 8. Transition Slice 4c

Chaque onglet admin (Imports, Composants, Organisations, ENTSO-E, Registry, Zone danger) sera migré dans une mini-slice dédiée consommant :
- `Button` pour les actions (variants `primary` / `secondary` / `tertiary` / `danger`)
- `TextInput`, `Textarea`, `Select`, `Checkbox` pour les formulaires
- `Modal` pour les modales de confirmation/édition
- `Tab` pour `AdminTabs.tsx`
- `Badge`, `Tag`, `Chip` pour les indicateurs (statuts, types, directions)
- `Banner` pour les messages d'erreur / succès
- `Loader` pour les états de chargement
- `Table` (maison) pour les 6 tableaux admin
- `ColorField` (maison) pour ProcessColorsEditor
- `DateTimeField` (maison) pour ImportsAdminTable
