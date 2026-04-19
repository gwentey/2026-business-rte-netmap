# ADR-027 — Frontière `envName` first-class sur les imports

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-027                                                                     |
| Statut     | Accepté                                                                     |
| Date       | 2026-04-19                                                                  |
| Auteur(s)  | Anthony + Claude                                                            |
| Owner      | Anthony                                                                     |
| Décideurs  | Anthony                                                                     |
| Contexte   | Refonte v2.0 — slice 2a fondations                                          |
| Remplace   | —                                                                           |
| Features   | *                                                                           |
| App        | api, web                                                                    |

## Contexte

Le réseau ECP RTE est déployé sur plusieurs environnements physiquement distincts : OPF (opérationnel France), PROD (production inter-TSO), PFRFI (plateforme de recette). Ces environnements ne partagent pas les mêmes composants ni les mêmes flux de messages ; les afficher ensemble sur une même carte serait sémantiquement incorrect et tromperait l'opérateur.

La question est de savoir à quel niveau appliquer la frontière `envName` : uniquement sur les imports (données variables par déploiement), ou également sur les données de référence (overrides admin, annuaire ENTSO-E, registry RTE) qui sont par nature stables et communes à tous les environnements.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Scope `envName` sur imports uniquement ; overrides/ENTSO-E/registry globaux | `Import.envName` est obligatoire et conditionne l'inclusion dans `GraphService.getGraph(env)`. `ComponentOverride`, `EntsoeEntry` et registry RTE sont globaux (cross-env) | S | Pas de duplication des overrides par env, configuration de référence partagée cohérente, modèle mental simple | Les overrides cross-env peuvent masquer une différence de comportement réelle entre envs (rare mais possible) |
| B — Scope `envName` partout | `ComponentOverride` et `EntsoeEntry` ont un champ `envName` | L | Surcharge admin pour maintenir les mêmes overrides dans chaque env ; duplique les tables de référence | — |
| C — Pas de frontière | Tous les imports fusionnés dans une vue globale, pas de sélecteur d'env | XS | Trivial | Mélange des réseaux physiquement distincts, incorrect sémantiquement |

## Décision retenue

**Option choisie : A** — `envName` est un champ obligatoire sur `Import`, utilisé comme filtre exclusif dans toutes les requêtes `GraphService`. Les sources de référence (`ComponentOverride`, `EntsoeEntry`, registry RTE overlay) sont globales. Cette séparation reflète la réalité : les données de référence (qui est `10XAT-APG------Z` ?) sont stables quel que soit l'env ; ce qui change d'un env à l'autre, ce sont les dumps et les flux observés.

## Conséquences

### Positives
- La carte est toujours scopée à un env actif : OPF et PROD ne se mélangent jamais dans une même requête.
- Les overrides admin et l'annuaire ENTSO-E sont définis une seule fois et s'appliquent à tous les envs.
- Le sélecteur d'env dans le header (slice 2a) est le mécanisme unique pour changer de contexte.
- `GET /api/envs` retourne la liste distincte des `envName` présents dans `Import`, sans configuration statique.

### Négatives
- Un `ComponentOverride` posé pour corriger une coord erronée dans OPF s'appliquera aussi dans PROD, même si la topologie est différente. C'est un trade-off accepté : le cas est rare et l'alternative (overrides per-env) crée une charge admin disproportionnée.

### Ce qu'on s'interdit désormais
- Mélanger des imports de plusieurs `envName` dans une même requête `GraphService` ou réponse `GET /api/graph`.
- Créer une vue « env fusionné » ou « tous envs » — cela n'est pas prévu et serait sémantiquement incorrect.
- Omettre `envName` lors d'un upload : c'est un champ requis, validé en Zod dans le body du `POST /api/imports`.

## Ressources / Références

- Chapeau v2.0 §6 — Frontière d'environnement, scope first-class.
- Slice 2a §A — `Import.envName String`, `@@index([envName])`, `@@index([envName, effectiveDate])`.
- Slice 2a §C — `getGraph(env, refDate?)` : `where: { envName: env, effectiveDate: { lte: ... } }`.
- Slice 2a §D — `GET /api/graph?env=OPF`, `GET /api/envs`, validation 400 si `env` absent.
- Slice 2a §E — Sélecteur d'env dans le header, store Zustand `activeEnv`.
