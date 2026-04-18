# ADR-021 — Stack de test React : @testing-library/react + happy-dom

| Champ      | Valeur                                                    |
|------------|-----------------------------------------------------------|
| Numéro     | ADR-021                                                   |
| Statut     | Accepté                                                   |
| Date       | 2026-04-18                                                |
| Auteur(s)  | Anthony Outub                                             |
| Owner      | Anthony Outub                                             |
| Décideurs  | Anthony Outub                                             |
| Contexte   | Phase 2 remédiation — P2-4, P2-5, P2-6                   |
| Remplace   | —                                                         |
| Features   | web/upload, web/detail-panel, web/snapshot-selector       |
| App        | web                                                       |

## Contexte

Avant la Phase 2, `apps/web` ne disposait d'aucun test unitaire de composant React (dette M4). Vitest était configuré avec l'environnement par défaut `node`, incompatible avec le rendu DOM. Pour couvrir `UploadPage`, `NodeDetails`, `EdgeDetails` et `SnapshotSelector`, une stack de test DOM était nécessaire.

Les options disponibles étaient : jsdom (émulateur DOM historique, inclus dans les exemples Vitest officiels) et happy-dom (émulateur DOM plus léger, performances supérieures, API globale identique).

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — happy-dom + @testing-library/react | `environment: 'happy-dom'` dans `vitest.config.ts`, `@testing-library/react@^16`, setup file minimal | XS | Plus rapide que jsdom, API standard, matchers jest-dom disponibles | Légères divergences de comportement avec les navigateurs réels (cas edge) |
| B — jsdom + @testing-library/react | `environment: 'jsdom'`, setup identique | XS | Plus mature, plus de surface testée avec les navigateurs | Légèrement plus lent, dépendance plus lourde |
| C — Vitest browser mode (Playwright) | Tests dans un vrai navigateur headless | M | Fidélité maximale | Overhead de configuration important, redondant avec les smoke E2E Playwright existants |

## Décision retenue

**Option choisie : A — happy-dom + @testing-library/react**

happy-dom est recommandé dans la documentation Vitest pour les projets Vite/React. Il est suffisant pour les tests de composants de présentation (rendu conditionnel, props null, badges) qui constituent le périmètre Phase 2. Les cas edge où jsdom et happy-dom divergent ne sont pas concernés par les composants testés.

## Conséquences

### Positives

- Suite web passe de 2 à 23 tests unitaires (x11,5) après Phase 2.
- Composants de présentation (`NodeDetails`, `EdgeDetails`, `SnapshotSelector`) couverts à 100 % des cas documentés dans les specs.
- Pas de globals Vitest (`describe`, `it`, `expect`) : imports explicites dans chaque fichier de test, cohérent avec le mode `globals: false` de la config Vitest web.
- `afterEach(cleanup)` dans `test-setup.ts` garantit l'isolation entre les tests (pas de fuite DOM entre cas).

### Negatives

- 4 devDependencies ajoutées dans `apps/web` : `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `happy-dom@^15`.
- Le mock de store Zustand (`vi.mock`) doit être réinitialisé manuellement entre les tests si les actions sont mockées.

### Ce qu'on s'interdit desormais

- Ne plus écrire de tests de composants React sans le fichier setup (`./src/test-setup.ts`) — le `afterEach(cleanup)` est obligatoire.
- Ne pas mélanger `environment: 'node'` et rendu DOM dans la même suite — créer un fichier de config séparé si nécessaire.
- Ne pas utiliser `globals: true` dans la config Vitest web — les imports explicites sont la convention du projet.

## Ressources / Références

- [Vitest — Browser Environment](https://vitest.dev/guide/browser)
- [@testing-library/react — Getting Started](https://testing-library.com/docs/react-testing-library/intro/)
- Implémentation : `apps/web/vitest.config.ts`, `apps/web/src/test-setup.ts`
- Commits de référence : `1df3a8a` (setup), `0fb4955` (P2-4), `95f6b8d` (P2-5), `656e3f3` (P2-6), `9deeafe` (afterEach fix)
