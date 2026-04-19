# RETRO-016 — Duplication de la palette processColors entre overlay JSON et process-colors.ts

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-04-17          |
| Source     | Rétro-ingénierie    |
| Features   | map                 |

## Contexte

La palette de couleurs associant chaque process métier ECP (TP, UK-CC-IN, CORE, MARI, PICASSO, VP, MIXTE, UNKNOWN) à un code hexadécimal est une donnée de référence. Elle est utilisée à deux endroits :

1. **Backend** : `packages/registry/eic-rte-overlay.json` contient la section `processColors` utilisée par `RegistryService` pour la classification et l'enrichissement.
2. **Frontend** : `apps/web/src/lib/process-colors.ts` contient la constante `PROCESS_COLORS` typée `ProcessColorMap`, utilisée pour colorier les `EdgePath`, les bordures `NodeMarker` externes, et la légende du footer.

Le monorepo ne partage pas de code runtime entre backend et frontend (seuls les types TypeScript sont partagés via `@carto-ecp/shared`). `packages/registry` est un package de données-only chargé à boot par l'API ; il n'est pas importé par le frontend.

## Décision identifiée

La palette est **dupliquée manuellement** dans deux fichiers distincts. CLAUDE.md documente explicitement cette situation : _"process → hex color palette (also duplicated in apps/web/src/lib/process-colors.ts — keep them in sync if you change either)"_.

Il n'existe pas de script de vérification automatique de la cohérence entre les deux sources.

## Conséquences observées

### Positives
- Pas de dépendance runtime du frontend vers les fichiers du package registry (isolation propre).
- La palette frontend est typée statiquement via `ProcessColorMap` — les erreurs de type clé sont détectées à la compilation.
- Simple à comprendre pour un développeur qui n'a accès qu'au frontend.

### Négatives / Dette
- Risque de désynchronisation silencieuse : ajouter un process dans l'overlay JSON sans mettre à jour `process-colors.ts` produira un rendu gris (`UNKNOWN`) en frontend sans erreur à la compilation ni au runtime.
- La règle de synchronisation repose uniquement sur la convention documentée dans CLAUDE.md — pas de guard automatisé.
- Si la palette évolue fréquemment (ajout de processes nouveaux), la dette s'accumule.

## Recommandation

Reconsidérer pour un slice ultérieur. Options :

1. **Script de validation** : ajouter un test Vitest ou un script `check-sync` qui lit les deux sources et vérifie leur équivalence. Simple, pas de refonte architecturale.
2. **Endpoint dédié** : exposer `GET /api/registry/process-colors` depuis le backend et charger la palette dynamiquement dans le frontend au démarrage. Élimine la duplication mais ajoute une requête réseau.
3. **Package shared de données** : déplacer la palette dans `packages/shared` sous forme de constante TypeScript exportée. Nécessite que le backend importe également depuis `shared` plutôt que depuis `registry` JSON — impact sur `RegistryService`.

L'option 1 (script de validation) est la plus pragmatique à court terme.
