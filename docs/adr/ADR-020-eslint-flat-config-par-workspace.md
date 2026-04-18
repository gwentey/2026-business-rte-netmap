# ADR-020 — ESLint 9 flat config par workspace

| Champ      | Valeur                                                    |
|------------|-----------------------------------------------------------|
| Numéro     | ADR-020                                                   |
| Statut     | Accepté                                                   |
| Date       | 2026-04-18                                                |
| Auteur(s)  | Anthony Outub                                             |
| Owner      | Anthony Outub                                             |
| Décideurs  | Anthony Outub                                             |
| Contexte   | Phase 1 remédiation — P1-1                                |
| Remplace   | —                                                         |
| Features   | *                                                         |
| App        | api, web                                                  |

## Contexte

Le projet ne disposait d'aucun linter fonctionnel : `pnpm lint` échouait à la racine (`M1`), et les fichiers de test backend (`test/**`) n'étaient couverts par aucune analyse statique (`M5`). L'ancienne config `apps/api/.eslintrc.cjs` (format legacy) était présente mais non câblée. La migration vers ESLint 9 s'imposait pour bénéficier de la flat config (format unique, plus de cascade de configs implicites) et pour unifier la chaîne lint sur les deux workspaces.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Flat config ESLint 9 par workspace | `eslint.config.mjs` dans `apps/api/` et `apps/web/` ; script `lint` racine orchestré par pnpm `--filter` | S | Format stable, type-aware natif, plus de cascade implicite, officiellement recommandé par ESLint | Migration manuelle des overrides legacy |
| B — Garder ESLint 8 legacy (.eslintrc) | Conserver `.eslintrc.cjs` et câbler correctement l'ancien format | XS | Pas de migration | Format déprécié, pas de support type-aware unifié, règles moins précises |
| C — Biome (alternative à ESLint) | Remplacer ESLint par Biome pour lint + format | M | Rapide, un seul outil | Pas d'équivalent des règles NestJS/React type-aware, écosystème plugins limité |

## Décision retenue

**Option choisie : A — Flat config ESLint 9 par workspace** — La flat config est le format officiel d'ESLint depuis v9, elle supprime les ambiguïtés de cascade et permet un ruleset type-aware robuste (`@typescript-eslint/recommended-type-checked`) sans configuration supplémentaire. Chaque workspace dispose de sa propre config adaptée à sa stack (NestJS vs React).

## Conséquences

### Positives

- `pnpm lint` opérationnel à la racine (orchestré via `pnpm -r exec eslint`)
- Règles type-aware actives : `no-floating-promises`, `no-misused-promises`, `await-thenable`, `consistent-type-imports`, `no-unused-vars` strict
- Scope `test/**` inclus dans le lint api avec overrides permissifs (autorise `!` et `any` dans les specs)
- 12 violations pré-existantes corrigées lors du câblage (10 `react/jsx-no-leaked-render`, 2 `no-misused-promises`)
- Gate lint intégrable en CI sans modification

### Negatives

- 12 devDependencies ESLint ajoutées (4 `api`, 8 `web`) — légère augmentation du `node_modules`
- Chaque nouveau workspace doit créer sa propre `eslint.config.mjs`

### Ce qu'on s'interdit desormais

- Ne plus créer de fichier `.eslintrc.cjs` / `.eslintrc.json` / `.eslintrc.js` (format legacy) dans aucun workspace
- Ne plus bypasser le lint avec `eslint-disable` sans commentaire justificatif
- Ne plus pousser du code contenant des violations `no-floating-promises` ou `no-misused-promises`

## Ressources / Références

- [ESLint v9 migration guide](https://eslint.org/docs/latest/use/configure/migration-guide)
- [typescript-eslint flat config](https://typescript-eslint.io/getting-started/)
- Implémentation : `apps/api/eslint.config.mjs`, `apps/web/eslint.config.mjs`
- Commit de référence : `4f8ae25` (Phase 1 remédiation)
