# Spec Fonctionnelle — web/charte-visuelle

| Champ  | Valeur                                      |
|--------|---------------------------------------------|
| Module | web/charte-visuelle                         |
| Version| 3.0-alpha.15                                |
| Date   | 2026-04-23                                  |
| Source | Slice 5a — Foundation charte web/marketing  |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-039](../../../adr/ADR-039-charte-web-marketing-surcharge-ds.md) | Charte visuelle web/marketing : surcharge palette DS RTE | Actif |
| [ADR-037](../../../adr/ADR-037-adoption-design-system-rte.md) | Adoption du Design System RTE | Actif |
| [ADR-038](../../../adr/ADR-038-components-ui-layer-wrappers-ds.md) | Couche `components/ui/` | Actif |

---

## Contexte et objectif

La feature "charte visuelle app" aligne le frontend `apps/web` sur la charte **web/marketing** de rte-france.com, distincte de la charte corporate interne (rouge `#C8102E`) portée par `@design-system-rte`. L'objectif est de donner à l'application une identité visuelle propre — palette cyan/teal/dark — tout en conservant le Design System RTE comme socle technique.

La Slice 5a pose la **fondation** : elle ne touche aucun composant métier. Elle établit le système de tokens et remplace automatiquement le branding rouge du DS par le cyan partout où le DS consomme ses propres CSS custom properties.

---

## Charte visuelle de référence

Issue de rte-france.com (octobre 2025, fournie par l'owner) :

| Couleur | Hex | Rôle |
|---------|-----|------|
| cyan    | `#00bded` | Brand principal — boutons primaires, focus, liens, états actifs |
| teal    | `#0c3949` | Header, bandeaux secondaires, navigation sombre |
| dark    | `#10181d` | Fond sombre, fond page header, texte principal |
| white   | `#ffffff` | Fond cartes, panneaux, modales |

Ton de voix : Authoritative, Professional, Committed, Technical.
Esthétique : "clean industrialism, technological transparency, modern institutionalism, geometric precision, human-centered infrastructure".

---

## Règles métier

1. **Aucun hex hardcodé dans les `.module.scss` métier** — toute couleur passe par un token `--c-*` ou via un composant DS. Seules exceptions permanentes : `lib/process-colors.ts` et `packages/registry/eic-rte-overlay.json` (données applicatives).

2. **Un seul rouge dans l'app** — `--c-error` (`#b3261e`) est le seul rouge admis. Il est exclusivement réservé aux alertes d'erreur, états invalides, et zones Danger. Toute autre occurrence de rouge (ancienne charte `#C8102E`, `#e30613`) est interdite à partir de Slice 5b.

3. **Focus ring cyan universel** — tous les éléments interactifs de l'app (hors composants DS auto-gérés) arborent un `outline: 3px solid var(--c-primary)` en `:focus-visible`. Le focus reste visible même sur fond sombre (contraste suffisant cyan sur dark).

4. **Respect de `prefers-reduced-motion`** — toutes les transitions et animations doivent être neutralisées (durée `0.01ms`) quand le système d'exploitation active la préférence de réduction de mouvement.

5. **Contraste AA WCAG 2.1 garanti** — toute combinaison texte/fond utilisée dans l'app doit atteindre :
   - ratio ≥ 4.5 pour le texte courant (< 18px ou < 14px bold)
   - ratio ≥ 3.0 pour le texte large (≥ 18px regular ou ≥ 14px bold), les icônes informatives, et les états disabled (exemptés du WCAG mais vérifiés)

6. **Surcharge DS non-destructive** — la palette est injectée via CSS custom properties au niveau app, après le CSS du DS. Supprimer `ds-override.scss` de `globals.scss` restaure l'aspect rouge corporate sans aucun autre changement.

7. **Les couleurs process métier sont hors périmètre** — `--process-*` dans `lib/process-colors.ts` et les hex dans `packages/registry/eic-rte-overlay.json` sont data-driven. Ils ne seront jamais absorbés dans `brand.scss` (palette cartographique indépendante de la charte UI).

---

## Tokens exposés aux développeurs

Les tokens suivants sont disponibles dans tous les `*.module.scss` (injectés via `globals.scss`) et dans les composants TypeScript via `getComputedStyle(document.documentElement).getPropertyValue()`.

### Couleurs

| Token | Valeur | Usage |
|-------|--------|-------|
| `--c-primary` | `#00bded` | Boutons primaires, focus ring, accents |
| `--c-primary-hover` | `#00a7d1` | Hover état boutons primaires |
| `--c-primary-pressed` | `#0090b4` | Pressed/active, liens DS |
| `--c-primary-soft` | `rgba(0,189,237,.08)` | Hover ligne, dropzone active, sélection fond |
| `--c-surface-dark` | `#10181d` | Header, tooltips sombres |
| `--c-surface-deep` | `#0c3949` | Bandeaux secondaires, badges env |
| `--c-surface` | `#ffffff` | Cards, panneaux, modales |
| `--c-surface-sunken` | `#f4f6f8` | Fond page, zones en retrait |
| `--c-border-subtle` | `#e3e8ec` | Séparateurs légers |
| `--c-border-strong` | `#c7d0d6` | Bordures inputs, cards |
| `--c-text` | `#10181d` | Texte principal, titres |
| `--c-text-muted` | `#4a5a66` | Metadata, sous-titres, hints |
| `--c-text-disabled` | `#7a8a95` | États désactivés |
| `--c-text-inverse` | `#ffffff` | Texte sur fond sombre |
| `--c-text-link` | `var(--c-primary-pressed)` | Liens DS (remappé) |
| `--c-error` | `#b3261e` | Erreurs, Danger Zone |
| `--c-error-bg` | `#fdecea` | Fond alertes erreur |
| `--c-error-border` | `#e8a29c` | Bordure alertes erreur |

### Radius

`--r-xs` (2px), `--r-sm` (4px), `--r-md` (6px), `--r-lg` (10px), `--r-pill` (9999px).

### Elevation

`--shadow-0` à `--shadow-3`, `--shadow-focus` (cyan 3px), `--shadow-error-focus` (rouge 3px).

### Motion

`--motion-fast` (120ms), `--motion-std` (200ms), `--motion-slow` (320ms).

### Typographie

Neuf niveaux de styles : `--t-display-*`, `--t-h1-*` à `--t-h3-*`, `--t-body-*`, `--t-small-*`, `--t-caps-*`, `--t-mono-*`. Police de base : Nunito (déjà chargée par Slice 4a).

---

## Accessibilité (contraste AA vérifié)

Ratios mesurés par les tests automatisés `brand.test.ts` (13 assertions Vitest) :

| Combinaison | Ratio | Seuil |
|-------------|-------|-------|
| `--c-text` sur `--c-surface` | ≥ 16 | AA (4.5) |
| `--c-text-muted` sur `--c-surface` | ≥ 7 | AA (4.5) |
| `--c-text-inverse` sur `--c-surface-dark` | ≥ 15 | AA (4.5) |
| `--c-text-inverse` sur `--c-surface-deep` | ≥ 10 | AA (4.5) |
| `--c-text` sur `--c-primary` (bouton primaire) | ≥ 4.5 | AA (4.5) |
| `--c-text-inverse` sur `--c-primary-pressed` | ≥ 3.0 | AA large (3.0) |
| `--c-primary-pressed` sur `--c-surface` (lien DS) | ≥ 3.0 | AA large (3.0) |
| `--c-text-disabled` sur `--c-surface` | ≥ 3.0 | AA large (3.0) — exempt WCAG |
| `--c-error` sur `--c-surface` | ≥ 4.5 | AA (4.5) |
| `--c-error` sur `--c-error-bg` | ≥ 4.5 | AA (4.5) |
| `--c-text-inverse` sur `--c-error` (Danger button) | ≥ 4.5 | AA (4.5) |

Note : `--c-primary` (`#00bded`) seul sur `--c-surface` blanc donne un ratio < 3.0 — ce cyan pur **ne doit jamais** être utilisé comme texte sur fond blanc. Les liens de l'app utilisent `--c-text` + soulignement cyan (reset.scss), ou `--c-primary-pressed` pour les composants DS.

---

## Cas d'usage

### UC-1 : Affichage d'un écran quelconque après la Slice 5a

L'utilisateur ouvre l'application. Tous les boutons primaires DS (Button primary), tabs actifs, toggles, liens DS affichent le cyan `#00bded` au lieu du rouge corporate. La navigation header est sombre (`#10181d`). L'ergonomie et les interactions fonctionnelles sont inchangées.

### UC-2 : Interaction clavier (focus visible)

L'utilisateur navigue au clavier. Chaque élément interactif (bouton, lien, input, select) affiche un outline cyan 3px à 2px de l'élément. Sur fond sombre, le ring reste visible (contraste cyan/dark ≥ 3.0 AA large).

### UC-3 : Préférence `prefers-reduced-motion` activée

Le système de l'utilisateur active la réduction de mouvement. Tous les `transition-duration` et `animation-duration` passent à `0.01ms`. Aucune animation n'est supprimée visuellement — les états finaux restent, seule la transition est neutralisée.

### UC-4 : Affichage d'une erreur

Un import échoue. L'alerte d'erreur affiche un fond `--c-error-bg`, une bordure `--c-error-border`, et le texte `--c-error`. C'est le seul endroit où du rouge est visible dans l'app.

---

## Périmètre Slice 5a (cette implémentation)

La Slice 5a couvre uniquement l'infrastructure visuelle :
- Tokens CSS (`brand.scss`)
- Surcharge DS (`ds-override.scss`)
- Reset moderne (`reset.scss`)
- Orchestration des imports (`globals.scss`)
- Tests de contraste automatisés (`brand.test.ts` + `_contrast.ts`)

**Les slices suivantes** appliqueront ces tokens aux composants métier :
- **5b** — Shell & navigation (Header, layout, `EnvSelector`)
- **5c** — Upload & Map chrome (UploadPage, overlays carte, TimelineSlider)
- **5d** — Admin & DetailPanel (composants admin, modales, tables)
- **5e** — Finitions UX (empty states, skeletons, toasts, audit final hex)

---
