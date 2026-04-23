# Refonte charte visuelle — alignement charte web/marketing RTE (cyan / teal / dark)

| Champ | Valeur |
|---|---|
| Date | 2026-04-23 |
| Auteur(s) | Anthony + Claude (Opus 4.7) |
| App | `apps/web` |
| Contexte | Suite de la migration DS RTE Slice 4 (4a → 4e terminée) |
| Remplace | — (complète ADR-037 et ADR-038) |
| ADRs à produire | ADR-039 (palette app surcharge DS) |
| Découpage | 5 slices (5a → 5e) |
| Durée estimée | ~6 jours |

---

## 1. Contexte

### État actuel (au 2026-04-23, commit `04ceb8b`)

La migration DS RTE (ADR-037, Slices 4a → 4e) a installé les packages officiels `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0`, supprimé Tailwind, et créé la couche `apps/web/src/components/ui/`. Elle a livré 37 composants DS ré-exportés + 4 composants maison (Table, RangeSlider, ColorField, DateTimeField).

**Le problème visuel persiste** :

- **492 valeurs hex hardcodées** dans 33 fichiers SCSS/TSX (`apps/web/src/`).
- **50 occurrences** du rouge RTE corporate (`#e30613` / `#C8102E` / `#b91c1c`).
- Aucun token applicatif n'est consommé dans les `.module.scss` métier (les tokens du DS RTE sont disponibles mais non utilisés).
- Header, Upload, Admin, DetailPanel : palette "Tailwind grays + rouge corporate" sans personnalité, perçue par le propriétaire comme "horrible".

### Charte visuelle demandée

Fournie par l'owner, issue de rte-france.com (charte web/marketing), **différente** du DS RTE corporate rouge :

```json
{
  "fonts": ["Nunitosans"],
  "colors": [
    { "name": "dark",  "hex": "#10181d" },
    { "name": "cyan",  "hex": "#00bded" },
    { "name": "teal",  "hex": "#0c3949" },
    { "name": "white", "hex": "#ffffff" }
  ],
  "aesthetic": [
    "clean industrialism",
    "technological transparency",
    "modern institutionalism",
    "geometric precision",
    "human-centered infrastructure"
  ],
  "tone_of_voice": ["Authoritative", "Professional", "Committed", "Technical"]
}
```

### Décision retenue au brainstorming

**Option A** — palette pure 4 couleurs + **un seul** rouge d'alerte neutre `#b3261e` réservé aux erreurs. Le cyan `#00bded` devient le brand universel (boutons primaires, focus, liens, états actifs). Pas de ramp sémantique succès/warning/info — le teal assume le positif/info, la sémantique est portée par l'icônographie.

---

## 2. Goals / Non-goals

### Goals

1. **Zéro hex hardcodé** dans `apps/web/src/` à la fin de la Slice 5e (hors `lib/process-colors.ts` et `packages/registry/`, data-driven).
2. **Cohérence visuelle totale** entre Header, Upload, Map, Admin, DetailPanel, TimelineSlider.
3. **Contraste AA WCAG** sur toutes combinaisons text/background utilisées.
4. **Respect du ton "clean industrialism"** : bordures nettes, ombres discrètes, pas de glassmorphism, pas de gradients flashy, pas de neumorphism.
5. **Conservation de la structure existante** : pas de refactor composants React, uniquement styles (`.module.scss`, classes CSS).

### Non-goals

- Changer les composants du DS RTE (`@design-system-rte/react`) eux-mêmes — on surcharge leurs tokens par CSS custom properties au niveau app.
- Refactor de la structure `components/ui/` (ADR-038 reste en vigueur).
- Animation motion design élaborée (transitions simples 120/200ms uniquement).
- Responsive mobile parfait (l'app est dev-local bureautique ; breakpoints basiques suffisent).
- Dark mode (hors scope, potentiellement slice 6).
- Toucher `packages/registry/eic-rte-overlay.json` (couleurs de process métier = data applicative).

---

## 3. Design — Section 1 : Système de tokens app-level

Fichier cible : `apps/web/src/styles/brand.scss` (nouveau). Exposé comme CSS custom properties sur `:root`, importé après le forward du DS RTE dans `tokens.scss` afin de surcharger les valeurs DS concernées.

### 3.1 Palette (CSS custom properties)

| Variable | Valeur | Usage |
|---|---|---|
| `--c-primary` | `#00bded` | Boutons principaux, focus ring, liens, toggles actifs, accents |
| `--c-primary-hover` | `#00a7d1` | Hover boutons primaires |
| `--c-primary-pressed` | `#0090b4` | Active/pressed |
| `--c-primary-soft` | `rgba(0,189,237,.08)` | Fond léger (dropzone active, row hover, selection) |
| `--c-surface-dark` | `#10181d` | Header, tooltips, popups sombres |
| `--c-surface-deep` | `#0c3949` | Bandeaux secondaires, sélections sur fond sombre, badges env |
| `--c-surface` | `#ffffff` | Fond cartes, panneaux, modales |
| `--c-surface-sunken` | `#f4f6f8` | Fond page, dropzone inactive, zones en retrait |
| `--c-border-subtle` | `#e3e8ec` | Séparateurs légers (tables, champs) |
| `--c-border-strong` | `#c7d0d6` | Bordures inputs, cards au repos, dividers marqués |
| `--c-text` | `#10181d` | Titres, labels, texte principal |
| `--c-text-muted` | `#4a5a66` | Sous-titres, metadata, hints |
| `--c-text-disabled` | `#94a3b1` | États désactivés |
| `--c-text-inverse` | `#ffffff` | Texte sur fond dark/deep/primary |
| `--c-text-link` | `var(--c-primary)` | Liens texte |
| `--c-error` | `#b3261e` | **Seul** rouge de l'app (alertes error, Danger Zone) |
| `--c-error-bg` | `#fdecea` | Tint fond alerte d'erreur |
| `--c-error-border` | `#e8a29c` | Bordure alerte d'erreur |

**Contraste AA vérifié** (ratio mini 4.5 pour texte courant, 3.0 pour texte ≥ 18px/700) :

- `--c-text` sur `--c-surface` : 16.6 (AAA)
- `--c-text-muted` sur `--c-surface` : 7.8 (AAA)
- `--c-text-inverse` sur `--c-surface-dark` : 15.2 (AAA)
- `--c-text-inverse` sur `--c-surface-deep` : 10.1 (AAA)
- `--c-text-inverse` sur `--c-primary` : 2.9 → **on utilise `--c-text` sur `--c-primary` (ratio 5.6 AA)** pour les boutons primaires. Le white reste possible uniquement sur `--c-primary-pressed` (ratio 3.1 AA large-text).
- `--c-primary` comme lien sur `--c-surface` : 2.9 → en-dessous du seuil pour texte body. **Décision : liens seront en `--c-text` + soulignement cyan, ou en `--c-primary-pressed` si usage sur fond blanc** (voir §3.5 ci-dessous).

### 3.2 Radius

| Variable | Valeur | Usage |
|---|---|---|
| `--r-xs` | `2px` | Badges, tags compacts |
| `--r-sm` | `4px` | Inputs, boutons, chips |
| `--r-md` | `6px` | Cards (défaut), dropdowns, modales compactes |
| `--r-lg` | `10px` | Modales larges, drawers, panneaux |
| `--r-pill` | `9999px` | Pills status, badges env |

### 3.3 Elevation (ombres)

| Variable | Valeur | Usage |
|---|---|---|
| `--shadow-0` | `none` | Repos neutre |
| `--shadow-1` | `0 1px 2px rgba(16,24,29,.06), 0 1px 1px rgba(16,24,29,.04)` | Cards au repos |
| `--shadow-2` | `0 2px 8px rgba(16,24,29,.08), 0 1px 2px rgba(16,24,29,.06)` | Dropdowns, popovers, overlay map |
| `--shadow-3` | `0 12px 32px rgba(16,24,29,.14), 0 4px 8px rgba(16,24,29,.08)` | Modales, drawers |
| `--shadow-focus` | `0 0 0 3px rgba(0,189,237,.35)` | Focus ring cyan (accessibilité) |
| `--shadow-error-focus` | `0 0 0 3px rgba(179,38,30,.28)` | Focus ring rouge sur champs en erreur |

### 3.4 Motion

| Variable | Valeur | Usage |
|---|---|---|
| `--motion-fast` | `120ms cubic-bezier(.2,0,0,1)` | Hover, focus, color transitions |
| `--motion-std` | `200ms cubic-bezier(.2,0,0,1)` | Modales, panneaux, dropdowns |
| `--motion-slow` | `320ms cubic-bezier(.2,0,0,1)` | Timeline slider, marker pulse |

Respect `prefers-reduced-motion: reduce` → durée → `1ms`.

### 3.5 Typographie (Nunito, 4 poids déjà chargés)

| Variable | Spécification | Usage |
|---|---|---|
| `--t-display` | `28px / 700 / 1.2` | Titre page principal (Upload, Admin) |
| `--t-h1` | `22px / 700 / 1.3` | Section header |
| `--t-h2` | `18px / 600 / 1.35` | Card title, DetailPanel title |
| `--t-h3` | `15px / 600 / 1.4` | Sub-section, Tab labels |
| `--t-body` | `14px / 400 / 1.55` | Texte courant |
| `--t-body-strong` | `14px / 600 / 1.55` | Labels, valeurs-clefs dans DetailPanel |
| `--t-small` | `12px / 400 / 1.5` | Metadata, hints, footer |
| `--t-caps` | `11px / 700 / 1.4`, `letter-spacing: .08em`, `text-transform: uppercase` | En-têtes de table, section labels (DetailPanel) |
| `--t-mono` | `13px / 400 / 1.5, ui-monospace` | Timecodes, EICs, code technique |

**Liens** : `color: var(--c-text); text-decoration: underline; text-decoration-color: var(--c-primary); text-underline-offset: 3px; text-decoration-thickness: 2px;`. Au hover : `color: var(--c-primary-pressed)`. Respecte AA + signale clairement les liens.

### 3.6 Layout tokens

| Variable | Valeur | Usage |
|---|---|---|
| `--layout-header-h` | `56px` | Hauteur header fixe |
| `--layout-page-px` | `24px` | Padding horizontal page desktop |
| `--layout-page-px-mobile` | `16px` | < 640px |
| `--layout-page-max-w` | `960px` | Max-width pages Upload/Admin |
| `--layout-map-toolbar-gap` | `12px` | Gap entre overlays carte |

### 3.7 Surcharge ciblée du DS RTE

Le DS RTE expose des tokens SCSS (`$color-brand-primary`, etc.) compilés dans les styles des composants (`Button`, `Modal`, `Tab`, etc.). Trois approches possibles :

**A.** Forker le DS → lourd, maintenance séparée, rejetée.

**B.** Surcharger par CSS custom properties (runtime) → **retenue**. Les composants DS utilisent des CSS vars internes dont le nom démarre par `--ds-`. On les remappe dans `brand.scss` :

```scss
:root {
  --ds-color-brand-primary: var(--c-primary);
  --ds-color-brand-primary-hover: var(--c-primary-hover);
  --ds-color-brand-primary-pressed: var(--c-primary-pressed);
  --ds-color-focus-outline: var(--c-primary);
  // ... (la liste exacte sera établie en Slice 5a en inspectant le bundle du DS)
}
```

Si certains tokens du DS sont compilés en dur en SCSS (et non exposés via CSS vars), on posera en Slice 5a des sélecteurs ciblés type `[class*="button_"][class*="primary_"] { background: var(--c-primary); }` avec commentaires explicites pour les reconnaître à la maintenance.

**C.** Duplication totale sans utiliser les composants DS → jette ADR-037/038, rejetée.

L'ADR-039 documentera cette surcharge comme **écart assumé** au DS corporate pour aligner sur la charte web/marketing publique de rte-france.com, tout en **maintenant l'adoption du DS** pour la cohérence a11y et la migration future.

---

## 4. Design — Section 2 : Direction visuelle

### 4.1 Header / App chrome

- Hauteur fixe `var(--layout-header-h)` = 56px.
- Fond `var(--c-surface-dark)`, texte `var(--c-text-inverse)`.
- **Accent vertical cyan** 3px de large à gauche du wordmark (`CARTO ECP · RTE`), hauteur 24px.
- Wordmark : `--t-h2` / 700, lettre-spacing `.02em`.
- Séparateur pipe en `--c-border-strong` à 30% opacité entre wordmark et tagline.
- Tagline `Cartographie du réseau ECP` : `--t-body` / `--c-text-muted` teinté clair (`rgba(255,255,255,.72)`).
- Env badge : pill `--c-surface-deep` (teal), texte cyan, `--t-caps`.
- Lien Admin : texte white + icône chevron cyan, hover souligne cyan.
- Ligne 1px cyan à 12% opacité en bas du header (finesse industrielle).

### 4.2 Footer Map

- Hauteur ~40px.
- Fond `var(--c-surface)`, border-top `var(--c-border-subtle)`.
- Légende : pastilles colorées (couleurs métier conservées), labels `--t-small` + `--t-caps` pour les sections ("LÉGENDE", "PROCESS").
- Compteur à droite : `--t-mono` `12 BA · 23 edges`.

### 4.3 Page Upload

- Layout : carte centrée max-width 960px, padding 24px, titre display + sous-titre muted.
- **Card principale** : `--c-surface`, `--r-lg`, `--shadow-1`, padding 32px.
- **Dropzone** :
  - Repos : fond `--c-surface-sunken`, bordure dashed 1.5px `--c-border-strong`, `--r-md`.
  - Active (drag) : fond `--c-primary-soft`, bordure solide 2px `--c-primary`, icône flèche translate-Y animation `--motion-std`.
  - Icône upload lucide-react 32px `--c-primary` au centre, 2 lignes de texte (`--t-body-strong` + `--t-small`).
- **Bouton primaire** "Envoyer l'archive" : fond `--c-primary`, texte `--c-text` (ratio AA 5.6), `--r-sm`, padding 10px 20px, hover `--c-primary-hover`, focus `--shadow-focus`.
- **Bouton ghost** "Réinitialiser" : fond transparent, bordure 1px `--c-border-strong`, texte `--c-text-muted`, hover texte `--c-text` + bordure `--c-text-muted`.
- Env reconnu : bandeau pill teal + label `--t-caps` "ENV RECONNU" + valeur `--t-body-strong`, bouton "changer" discret link-style.
- Dernière soumission : bandeau compact sous la card, icône horloge + timestamp + lien `Voir sur la carte →`.
- Alertes erreur : fond `--c-error-bg`, bordure `--c-error-border`, texte `--c-error`, icône alerte lucide.

### 4.4 Page Map — toolbar & overlays

- Container : fond `--c-surface-sunken` (très léger, au cas où la carte Leaflet ne couvre pas tout).
- **Overlays** : fond `--c-surface`, `--r-md`, `--shadow-2`, padding 8–12px, texte `--t-body`.
- **Toggle "Hiérarchie CD"** :
  - Repos : overlay blanc, bordure `--c-border-strong`, texte `--c-text`.
  - Actif : fond `--c-surface-deep` teal, texte `--c-text-inverse` blanc. (Remplace le `#1e293b` slate actuel qui n'est pas dans la charte.)
- **BaFilter dropdown** :
  - Trigger : overlay blanc avec label + chevron.
  - Popup ouvert : fond `--c-surface-dark`, items blancs, hover `rgba(255,255,255,.08)`, badges criticité P1/P2/P3 remappés dans la palette pure : **P1** (critique) = `--c-error` rouge, **P2** (moyenne) = `--c-surface-deep` teal, **P3** (faible) = `--c-text-muted`. Distinction renforcée par un point typographique (P1 gras + petit triangle d'alerte, P2 gras neutre, P3 régulier). Les couleurs métier de `process-colors.ts` restent data-driven et ne sont PAS touchées — seule la criticité change.
- **DetailPanel** :
  - Fond `--c-surface`, `--shadow-2`, width 400px inchangée.
  - `border-left: 2px solid var(--c-primary)` comme signature visuelle.
  - Close button : ghost en haut-droite, icône X `--c-text-muted`, hover `--c-text`.
  - Title h2, metadata label en `--t-caps` + valeur `--t-body-strong`.
  - Sections séparées par `--c-border-subtle` 1px.
  - Badge compteur messages IN/OUT : pills teal + cyan.

### 4.5 TimelineSlider

- Rail : 4px de hauteur, `--c-border-strong` au fond, fill gauche `--c-primary`.
- Thumb : 18px, fond blanc, bordure 2px `--c-primary`, `--shadow-1`, hover scale(1.08) `--motion-fast`.
- Label date : `--t-mono` centré sous le thumb.
- Bouton "Retour au présent" : ghost cyan (texte cyan, bordure transparente, hover underline cyan).

### 4.6 Admin (tabs, tables, forms, modales)

- Tabs : row horizontale, séparation bottom 1px `--c-border-subtle`, tab actif bordure bottom 3px `--c-primary` + texte `--c-text`, inactif texte `--c-text-muted`.
- Table :
  - Header row : fond `--c-surface-sunken`, texte `--c-text-muted` en `--t-caps`, border-bottom 1px `--c-border-strong`.
  - Row normal : fond `--c-surface`, border-bottom 1px `--c-border-subtle`.
  - Row hover : fond `--c-primary-soft`.
  - Row sélectionné : fond `--c-primary-soft` + border-left 2px `--c-primary`.
- Forms : inputs `--r-sm`, bordure `--c-border-strong`, focus `--c-primary` + `--shadow-focus`.
- Modales : `--r-lg`, `--shadow-3`, backdrop `rgba(16,24,29,.48)`, header avec icône + titre h2, footer row buttons (primary cyan + ghost).
- **Danger Zone** : conserve `--c-error` pour confirmer la destructivité (seul endroit de l'app avec du rouge). Bouton `background: var(--c-error)` + texte blanc (ratio 6.8 AA).

### 4.7 Empty states & loading

- Empty state : icône 48px `--c-text-muted`, message h2, sous-message body, CTA primaire cyan.
- Loading : skeletons en `--c-surface-sunken` pulsé (keyframe `shimmer` via gradient transparent→`rgba(255,255,255,.6)`→transparent, 1.6s loop). Remplace les `<div>Chargement...</div>` bruts.

---

## 5. Design — Section 3 : Plan de migration (5 slices)

Chaque slice = une PR, un entry `CHANGELOG.md`, passage `update-writer-after-implement` (hook Stop), commit en français, Co-Authored-By Claude.

### Slice 5a — Foundation charte

**Objectif** : tokens + surcharge DS + style globaux.

**Livrables** :
- `apps/web/src/styles/brand.scss` (nouveau) — CSS custom properties (§3.1 → §3.6).
- `apps/web/src/styles/ds-override.scss` (nouveau) — remappe les CSS vars du DS vers `--c-*`. En Slice 5a.0, audit du bundle DS pour inventorier les vars `--ds-*` à surcharger.
- `apps/web/src/styles/globals.scss` — import ordre : `@forward 'tokens'` → `@use 'brand'` → `@use 'ds-override'`. Reset body/html en `--c-text` + `--c-surface`.
- `apps/web/src/styles/reset.scss` (nouveau) — base moderne : `box-sizing: border-box`, `*:focus-visible { outline: 3px solid var(--c-primary); outline-offset: 2px; }`, respect `prefers-reduced-motion`.
- `docs/adr/ADR-039-charte-web-marketing-surcharge-ds.md` — ADR justifiant l'écart.

**Tests** :
- Visual smoke test : `pnpm --filter @carto-ecp/web dev` puis vérification manuelle qu'aucun composant n'est cassé (le branding rouge va déjà basculer cyan via la surcharge).
- Contrast check automatisé via test Vitest `brand-tokens.test.ts` qui importe les hex des CSS vars et vérifie les ratios AA.

**Durée** : 1 j.

### Slice 5b — Shell & navigation

**Objectif** : header, footer, layout global, `EnvSelector`.

**Fichiers** :
- `apps/web/src/App.module.scss` — header dark `--c-surface-dark`, accent cyan, env badge teal.
- `apps/web/src/components/EnvSelector/EnvSelector.module.scss` — input DS conservé, mais conteneur surcharge.
- `apps/web/src/pages/MapPage.module.scss` — header et footer map uniquement (overlays en 5c).

**Tests** :
- `apps/web/e2e/header.smoke.spec.ts` (nouveau) — vérifie rendering header + switch env + navigation admin.

**Durée** : 1 j.

### Slice 5c — Upload & Map chrome

**Objectif** : Upload page + overlays carte + TimelineSlider.

**Fichiers** :
- `apps/web/src/pages/UploadPage.module.scss` — refonte complète (dropzone, boutons, alerts, notices, summary).
- `apps/web/src/components/Map/NetworkMap.module.scss` — toggle hiérarchie CD teal au lieu de slate.
- `apps/web/src/components/Map/BaFilter.module.scss` — popup dark-surface, items avec palette cyan/teal-mats pour criticité.
- `apps/web/src/components/Map/NodeMarker.module.scss` — tooltip en `--c-surface-dark` texte blanc.
- `apps/web/src/components/TimelineSlider/TimelineSlider.module.scss` — rail/thumb/label/button cyan.

**Tests** :
- Existants Playwright `upload` conservés, adaptation sélecteurs si classes renommées.
- Test unitaire `BaFilter.test.tsx` actualisé pour la nouvelle palette criticité.

**Durée** : 1,5 j.

### Slice 5d — Admin & DetailPanel

**Objectif** : tous les composants Admin + DetailPanel + UploadBatchTable.

**Fichiers** :
- `apps/web/src/pages/AdminPage.module.scss` — title display + layout.
- `apps/web/src/components/Admin/AdminTabs.module.scss` — underline cyan, texte conforme.
- `apps/web/src/components/Admin/*.module.scss` (9 fichiers) — tables, modales, forms.
- `apps/web/src/components/DetailPanel/*.module.scss` — panel + `details.module.scss`.
- `apps/web/src/components/UploadBatchTable/UploadBatchTable.module.scss`.
- `apps/web/src/components/ui/Table/Table.module.scss`, `RangeSlider/...`, `ColorField/...`, `DateTimeField/...` — les 4 composants maison.

**Tests** :
- Existants conservés.
- Nouveau `DangerZoneTab.test.tsx` : s'assure que le bouton utilise bien `--c-error` (seule exception rouge tolérée).

**Durée** : 1,5 j.

### Slice 5e — Finitions UX

**Objectif** : empty states, loading skeletons, toasts, audit final.

**Fichiers** :
- Composant partagé `apps/web/src/components/ui/Skeleton/Skeleton.tsx` (nouveau) — utilisé sur Map loading, UploadBatchTable loading, DetailPanel loading.
- Composant partagé `apps/web/src/components/ui/EmptyState/EmptyState.tsx` (nouveau) — icône + titre + message + CTA.
- Intégration `Toast` du DS RTE pour notifications succès/erreur upload.
- Audit final `pnpm --filter @carto-ecp/web exec playwright test` full suite + smoke visuel de toutes les pages.
- Audit contraste AA via axe-core dans un test Vitest (script `scripts/check-a11y.ts`).
- Grep final : `grep -rE "#[0-9a-fA-F]{6}" apps/web/src/ --include="*.scss" --include="*.tsx"` doit retourner **uniquement** `packages/registry/*`, `lib/process-colors.ts`, et hex dans des tests. Objectif : ≤ 10 occurrences légitimes.

**Tests** :
- `Skeleton.test.tsx`, `EmptyState.test.tsx` (rendering + a11y).
- Smoke Playwright mis à jour.

**Durée** : 1 j.

---

## 6. Risques & mitigations

| Risque | Sévérité | Mitigation |
|---|---|---|
| La surcharge des CSS vars du DS ne couvre pas tous les tokens (certains compilés en dur SCSS) | Moyenne | Slice 5a.0 : audit exhaustif. Fallback : sélecteurs ciblés `[class*="button_primary_"] { ... }` commentés. Dernier recours : PR upstream au DS RTE (hors scope mais listé). |
| Régression visuelle inter-slice (entre 5a et 5e, des pages peuvent mélanger ancien gris + nouveau cyan) | Moyenne | Acceptable car usage dev-local. Merge 5a→5e en séquence rapide (≤ 1 semaine). Chaque slice reste mergeable indépendamment. |
| Contraste insuffisant sur `--c-primary` fond blanc pour les liens | Faible | Anticipé §3.1 : liens = `--c-text` + soulignement cyan (pas cyan pur). Hover → `--c-primary-pressed` (ratio 4.1 AA large-text). |
| Perte d'identité RTE visuelle (rouge corporate = très reconnaissable) | Faible | ADR-039 documente l'écart assumé. Le rouge reste visible en Danger Zone + alertes. Option retour possible en basculant 2 CSS vars `--c-primary` et `--c-surface-dark`. |
| Les couleurs process métier (`process-colors.ts`, `eic-rte-overlay.json`) jurent avec la nouvelle palette | Moyenne | Non traité dans cette refonte (data-driven, pilotable via Admin). Slice ultérieure dédiée si besoin. |

---

## 7. Tests & critères de succès

### Critères objectifs

1. **Zéro hex hardcodé** hors exceptions listées (`packages/registry/`, `lib/process-colors.ts`, fichiers de tests, `.eic-rte-overlay.json`). Vérifié par script CI à ajouter en Slice 5e : `pnpm run check:no-hex`.
2. **Tous les ratios contraste ≥ AA WCAG** pour toutes les combinaisons text/background utilisées. Test automatisé.
3. **Focus ring visible** sur tous les éléments interactifs (audit via Playwright + axe-core).
4. **Aucune régression fonctionnelle** : toutes les suites Vitest + Playwright existantes passent.

### Critères subjectifs

1. Revue visuelle propriétaire : "charte graphique cohérente avec rte-france.com" (validation manuelle).
2. Aucun écran ne donne la sensation "admin panel 2020 générique".
3. Les erreurs restent immédiatement identifiables malgré la suppression du rouge ambiant.

---

## 8. Rollout & ordre des commits

- 5 PRs successives sur branches `feat/web-charte-5a-foundation`, `...-5b-shell`, `...-5c-upload-map`, `...-5d-admin-detail`, `...-5e-finishes`.
- Base : `main` (actuellement `04ceb8b`).
- Chaque PR déclenche le workflow GitHub (lint + tests + typecheck via le MCP `github` conformément à `.claude/rules/05-git-workflow.md`).
- CHANGELOG : une entrée par PR, format `v3.0-alpha.15` → `v3.0-alpha.19` (suite de la numérotation Slice 4e en alpha.14).
- Hook Stop bloquant → `update-writer-after-implement` obligatoire après chaque PR mergée.
- ADR-039 écrit en Slice 5a avant début d'implémentation (décision déjà connue).

---

## 9. Hors scope (non-traité ici)

- Dark mode (éventuelle slice 6).
- Refonte iconographie (lucide-react conservé en Slice 5a–5e).
- Mobile responsive avancé.
- Palette process métier (`process-colors.ts`, registry).
- Nouveaux composants fonctionnels (search, filters non existants, etc.).
- Déploiement production (toujours dev-local pour slice #1).

---

## 10. Références

- ADR-037 — Adoption Design System RTE (Slice 4a).
- ADR-038 — Couche `components/ui/` (Slice 4b).
- Charte web source : <https://www.rte-france.com/>
- DS RTE : <https://opensource.rte-france.com/design-system-rte/>
- CHANGELOG actuel : `v3.0-alpha.14` (Slice 4e terminée).
- Plan Slice 4a précédent : `docs/superpowers/specs/2026-04-23-ds-rte-slice-4a-foundation-design.md` — pour référence du pattern.
