# Rules globales — Zelian

> Valables sur tout projet, quelle que soit la stack. Fichier copié depuis le plugin `zelian-framework` par `/zelian:init` — ne pas modifier au projet.
> Pour les règles transverses complètes (SemVer Zelian, protocole /context, dashboard), voir `docs/framework/02-regles-transverses.md §4`.

## Règles absolues

1. Lire les specs AVANT de toucher au code — utiliser le **protocole unique d'injection `/context`** (voir DOC 2 §4.4)
2. Lire l'ADR concerné AVANT toute modification d'architecture ou de BDD
3. **Mettre à jour `CHANGELOG.md` à chaque feature complétée — une entrée par feature, obligatoire** (vérifié par le hook Stop)
4. Aucun `console.log` / `var_dump` / `dd()` commité en production
5. Nouvelle décision architecturale : ADR écrit en amont SI déjà connue avant le dev, sinon `update-writer-after-implement` la proposera en fin de session — JAMAIS d'ADR écrit à la main en plein milieu d'une session Superpowers
6. Superpowers est utilisé **en natif** — aucune surcharge des skills Superpowers

## Workflow imposé

```
lire spec → /superpowers:brainstorm → /superpowers:write-plan → valider plan
         → /superpowers:execute-plan → update-writer-after-implement (auto via hook Stop)
         → review humaine → commit → score qualité envoyé au dashboard Zelian
```

Pas d'implémentation sans avoir suivi les étapes dans l'ordre.

## Subagents Zelian disponibles

- `@update-writer-after-implement` — **obligatoire après chaque implémentation, déclenché automatiquement par le hook Stop bloquant** — synchronise `docs/specs/` avec le code réel
- `@retro-scanner` — découverte de codebase (Phase 1-bis uniquement)
- `@retro-documenter` — documentation par feature (Phase 1-bis uniquement)
- `@retro-auditor` — synthèse et audit (Phase 1-bis uniquement)

## Skills Zelian disponibles (via plugin)

- `/zelian:new-spec` — crée un dossier `docs/specs/<feature>/` conforme au format Superpowers
- `/zelian:init` — scaffolde un nouveau projet (structure `docs/`, `CLAUDE.md`, rules, `CHANGELOG.md`)
- `/zelian:migrate` — migration de version majeure du framework (analyse les écarts, propose les modifications)
- `/zelian:retro` — orchestrateur de rétro-ingénierie (Phase 1-bis, lance les 3 subagents retro en séquence)

## Commande debug

- `/debug` — commande native Claude Code. Aucune surcharge Zelian.

## Règles transverses renvoyées vers DOC 2

- **SemVer Zelian (X.0.0 humain, 0.X.0 feature, 0.0.X patch)** → DOC 2 §4.2
- **Protocole unique d'injection `/context`** → DOC 2 §4.4
- **MCPs par stack** → DOC 2 §4.5
- **Convention commits et branches** → DOC 2 §4.6
- **Dashboard Zelian et events.log** → DOC 2 §4.10

## Conventions universelles (rappel court)

- Commits : Conventional Commits (`feat`, `fix`, `docs`, `refactor`, `chore`, `test`)
- Branches : `feat/<module>-<description>`, `fix/<description>`, `hotfix/<description>`, `retro/<projet>`
- Variables d'env : `SCREAMING_SNAKE_CASE`
- Pas de breaking change sans ADR
- Voir aussi `04-testing.md` (stratégie de tests) et `05-git-workflow.md` (workflow git + MCP GitHub obligatoire)
