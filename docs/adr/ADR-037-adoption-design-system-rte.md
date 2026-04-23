# ADR-037 — Adoption du Design System RTE (packages npm officiels)

> **⚠ SUPERSEDED par ADR-040 (2026-04-24)** — Le DS RTE est désinstallé. La
> skin web migre vers un design system custom dark "carto-rte" à base de
> classes CSS globales. Voir `docs/adr/ADR-040-refonte-design-carto-rte-custom-dark.md`.


| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-037                        |
| Statut     | Accepté                        |
| Date       | 2026-04-23                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice 4a — Foundation DS RTE   |
| Remplace   | —                              |
| Features   | web/*                          |
| App        | web                            |

## Contexte

Le frontend `apps/web` n'applique aucune conformité au Design System officiel RTE. Inventaire constaté :

- **Tailwind inliné partout**, sans tokens, sans composants UI partagés. Chaque `className="bg-rte text-white px-4 py-2 hover:bg-red-700"` est réécrit à la main dans chaque fichier.
- **7 dépendances UI jamais utilisées** : `@radix-ui/react-dialog`, `@radix-ui/react-slot`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `class-variance-authority`, `clsx`, `tailwind-merge`. Tout est dans le `package.json` mais zéro import.
- **Modales, onglets, tooltips** tous bricolés à la main avec `<div fixed inset-0 bg-black/40>`, `<button aria-selected>`, etc.
- **~20 couleurs hex hardcodées** dans `Map/`, `DetailPanel/`, `Admin/`.
- **Police Inter** en fallback système sans chargement explicite (aucun `<link>`, aucun `@import`, aucune WOFF2).
- **Incohérence `#e30613` vs `#C8102E`** entre `tailwind.config.ts` et `HomeCdOverlay.tsx`.

RTE publie officiellement son Design System sur npm depuis 2025 : `@design-system-rte/react@1.8.0` + `@design-system-rte/core@1.7.0`, Apache-2.0, peer `react >= 18.0.0`. Le DS expose 41 composants React (Button, TextInput, Modal, Tab, Badge, Drawer, FileUpload, Popover, Toast, ...), une police officielle Nunito (4 poids WOFF2), un système d'icônes SVG Material-like, et un ensemble de tokens SCSS (spacing 0→80px, radius none→pill, typography, elevation 1→6, opacity, layout).

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| **A** — Adopter `@design-system-rte/*` + SCSS/CSS Modules + suppression Tailwind | Migration totale sur 5 slices (4a–4e) | L | Conforme directive groupe, 41 composants DS prêts, a11y WCAG AA out-of-the-box, suppression de 7 deps UI mortes, tokens centralisés | Refactor lourd réparti sur ~15 jours, bundle augmenté (DS CSS + fonts), régression visuelle temporaire entre 4a et fin 4b |
| B — Garder Tailwind + custom classes mimant le DS | Tailwind theming avec tokens DS copiés en dur | M | Moins de refactor immédiat | Perpétue la divergence avec le DS officiel, pas les vrais composants, maintenance manuelle des tokens, directive groupe non respectée |
| C — Tailwind + DS en coexistence (hybride) | Deux systèmes en parallèle | M | Transition "douce" | Bundle doublé, règles CSS en conflit, confusion pour les développeurs, dette technique accrue, pas viable long terme |

## Décision retenue

**Option A : adoption totale de `@design-system-rte/react@^1.8.0` + `@design-system-rte/core@^1.7.0`, suppression complète de Tailwind, pipeline SCSS + CSS Modules, tokens RTE officiels.**

Justifications :
1. **Directive groupe** — RTE impose le DS officiel pour toute nouvelle app interne. Les options B et C ne respectent pas cette directive.
2. **Accès immédiat à 41 composants** — économise le développement/maintenance de primitives UI (Button, Modal, Tab, Drawer, Popover, FileUpload...).
3. **Accessibilité WCAG AA** — le DS fournit des composants a11y-ready, contrairement à nos DIV+aria-* faits main.
4. **Cleanup majeur** — la suppression de Tailwind + 7 deps UI mortes simplifie le bundle et la dépendance graph.
5. **SCSS + CSS Modules** — aligne avec la structure du DS core (SCSS natif), évite le mélange Tailwind+DS qui créerait des conflits.
6. **Police officielle Nunito** — marque RTE respectée, chargée depuis `apps/web/public/fonts/` pour contrôle local.

## Conséquences

### Positives

- Conformité visuelle RTE (charte, Nunito, tokens officiels)
- 41 composants DS accessibles out-of-the-box
- Tokens SCSS centralisés (`@design-system-rte/core/design-tokens/main`)
- Code cleanup majeur (suppression 7 deps UI mortes + Tailwind)
- A11y WCAG AA fournie par le DS
- Incohérence `#e30613` vs `#C8102E` résolue en Slice 4e par le token `$color-brand-primary` du DS

### Négatives

- Migration étalée sur 5 slices (~15j)
- Régression visuelle temporaire entre Slice 4a et fin de Slice 4b (les classes Tailwind dans les 40+ composants métier deviennent inertes)
- Bundle augmenté (DS CSS + 4 WOFF2 Nunito ~120 KB)
- Composant `Table` absent du DS → composant maison CSS Module (ADR dédié en Slice 4c)
- Composant `Slider` absent → `RangeSlider` maison pour le `TimelineSlider` (ADR dédié en 4c)
- Composant `ColorPicker` absent → `ColorField` maison pour `ProcessColorsEditor` (ADR dédié en 4c)
- Le token `$font-family-nunito` initialement référencé dans le plan n'existe pas dans l'API publique du DS ; le string literal `"Nunito", sans-serif` est utilisé dans `globals.scss`. À remplacer par un token composé approprié en Slice 4b.

### Ce qu'on s'interdit désormais

- Rajouter `tailwindcss` ou des classes Tailwind dans le frontend
- Importer des composants UI tiers non-DS (shadcn/ui, MUI, Ant Design, Chakra, Radix UI direct...)
- Hardcoder des valeurs hex, font-size, spacing, radius, shadow dans les composants : tout passe par les tokens DS (`$color-*`, `$positive-spacing_*`, `$radius-*`, `$font-family-*` via tokens composés)
- Déclarer des `@font-face` sans WOFF2 servi depuis `apps/web/public/fonts/`
- Redéclarer la couleur `rte` dans un config local — la source unique est `$color-brand-primary` exposé par `@design-system-rte/core`

## Ressources / Références

- **Repo officiel** : <https://github.com/rte-france/design-system-rte>
- **Storybook** : <https://opensource.rte-france.com/design-system-rte/>
- **npm React package** : <https://www.npmjs.com/package/@design-system-rte/react>
- **npm Core package** : <https://www.npmjs.com/package/@design-system-rte/core>
- **Licence** : Apache-2.0 (compatible usage interne RTE et open-source)
- **Plan global de migration** : `C:\Users\ANTHONY\.claude\plans\nous-allons-devoir-faire-immutable-bachman.md`
- **Design doc Slice 4a** : `docs/superpowers/specs/2026-04-23-ds-rte-slice-4a-foundation-design.md`
- **Plan d'implémentation Slice 4a** : `docs/superpowers/plans/2026-04-23-ds-rte-slice-4a-foundation.md`
- **Related ADRs** :
  - ADR-034 (divIcon lucide-react markers) — sera amendé en Slice 4e (remplacement lucide par icônes DS)
  - ADR-038 à ADR-04X — à venir en Slices 4c/4d pour Table/Slider/ColorPicker maison
