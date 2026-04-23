# ADR-039 — Charte visuelle web/marketing : surcharge de la palette corporate du DS RTE

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-039                        |
| Statut     | Accepté                        |
| Date       | 2026-04-23                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice 5a — Foundation charte   |
| Remplace   | —                              |
| Complète   | ADR-037 (adoption DS), ADR-038 (couche ui/) |
| Features   | web/*                          |
| App        | web                            |

## Contexte

Après la migration DS RTE (Slices 4a → 4e, ADRs 037/038), le frontend `apps/web`
consomme `@design-system-rte/react@1.8.0` avec une palette corporate dominée par
le rouge RTE `#C8102E`. Cette palette est celle de la charte interne historique.

Le propriétaire demande un alignement sur la charte **web/marketing** de
`rte-france.com` : palette cyan (`#00bded`) / teal (`#0c3949`) / dark (`#10181d`)
/ white. Cette charte est plus moderne, plus "tech", correspond aux valeurs
affichées sur le site public : *clean industrialism, technological transparency,
modern institutionalism, geometric precision, human-centered infrastructure*.

Le constat avant cette slice :
- 492 hex hardcodés dans `apps/web/src/` sur 33 fichiers.
- 50 occurrences du rouge RTE dans 20 fichiers.
- Les tokens du DS RTE ne sont jamais consommés dans les `.module.scss` métier.
- Le style "Tailwind gris + rouge corporate" donne une impression "admin générique".

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| **A** — Surcharger par CSS custom properties au niveau app | `styles/brand.scss` + `styles/ds-override.scss` remappent les `--background-brand-*`, `--content-brand-*`, `--border-brand-*`, `--content-link-*` du DS vers les tokens app cyan/teal/dark | S | Aucun fork du DS, maintenable, réversible par 2 vars, n'affecte pas l'API DS | Dépend de la stabilité des noms de CSS vars du DS entre versions mineures |
| B — Forker `@design-system-rte/react` | Maintenance d'une version RTE-web en interne | XL | Contrôle total | Dette massive, maintenance à chaque upgrade DS |
| C — Duplication complète (abandon du DS, composants maison) | Repartir sans DS RTE | XL | Indépendance totale | Jette ADR-037 et 38, perte des 41 composants, régression a11y |

## Décision retenue

**Option A** : surcharge des CSS custom properties dans `apps/web/src/styles/ds-override.scss`, appliqué après le `@import '@design-system-rte/react/style.css'` dans `main.tsx`.

Les CSS vars surchargées ont été extraites du bundle `style.css` du DS
(`grep -oE 'var\(--[a-z-]+' node_modules/@design-system-rte/react/dist/style.css`)
et remappées vers les tokens `--c-*` exposés par `styles/brand.scss`.

Justifications :

1. **Respecte ADR-037** : on maintient l'usage du DS RTE officiel (composants React, a11y, structure SCSS). Seule la palette est localement adaptée.
2. **Réversibilité maximale** : désactiver `ds-override.scss` dans `globals.scss` restaure l'aspect corporate rouge en 1 commit.
3. **Effort minimal** : ~60 CSS vars à remapper, ~200 LOC SCSS au total sur Slice 5a.
4. **Compatibilité forward** : si le DS RTE publie une v2, seuls les noms de CSS vars potentiellement changés sont à auditer.
5. **Pas de fork** : aucune maintenance parallèle du DS RTE.

## Conséquences

### Positives

- Charte web/marketing respectée sans abandonner le DS RTE.
- 41 composants DS automatiquement rebrandés (Button, Modal, Tab, Toast, Badge, Popover, FileUpload, Drawer, Accordion, etc.).
- Point d'entrée unique pour les évolutions de palette : `styles/brand.scss` + `styles/ds-override.scss`.
- Contraste AA WCAG garanti (testé via `brand.test.ts` en Task 6).
- Suppression progressive des 492 hex hardcodés sur Slices 5b → 5e.

### Négatives

- Couplage aux noms de CSS vars du DS (`--background-brand-default`, etc.). Un rename amont casserait la surcharge.
- Léger risque visuel : certains composants du DS peuvent utiliser des hex compilés en dur dans leur SCSS (non remapables par CSS var). Audit à faire en Slice 5b lorsque des composants DS visibles (Button, Modal, Tab) sont effectivement utilisés dans l'UI.
- Les palettes decoratives du DS (`--decorative-bleu-*`, `--decorative-vert-*`, etc.) ne sont PAS surchargées : elles servent aux illustrations/charts et restent dans l'identité DS. Hors scope.

### Ce qu'on s'interdit désormais

- Hardcoder `#C8102E`, `#e30613`, `#b91c1c` ou toute variante du rouge RTE dans les `.module.scss` métier (à partir de Slice 5b).
- Ajouter de nouvelles hex values sans passer par un token `--c-*`. Exception : `lib/process-colors.ts` et `packages/registry/eic-rte-overlay.json` (data-driven).
- Désynchroniser `styles/brand.scss` et `styles/ds-override.scss` : si un nouveau token app est ajouté, tracer son remap DS dans le même commit.

## Ressources / Références

- **Brand source** : <https://www.rte-france.com/>
- **DS RTE Storybook** : <https://opensource.rte-france.com/design-system-rte/>
- **CSS vars du DS extraites** : `apps/web/node_modules/@design-system-rte/react/dist/style.css`
- **Spec Slice 5** : `docs/superpowers/specs/2026-04-23-charte-web-marketing-design.md`
- **Plan Slice 5a** : `docs/superpowers/plans/2026-04-23-web-charte-slice-5a-foundation.md`
- **ADRs liés** :
  - ADR-037 (adoption DS RTE)
  - ADR-038 (couche `components/ui/`)
