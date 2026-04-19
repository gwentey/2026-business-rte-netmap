# RETRO-012 — Registry EIC chargé en mémoire au boot comme singleton Global NestJS

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-012                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | registry                       |
| App        | api                            |

## Contexte

Le pipeline d'ingestion doit géocoder chaque composant ECP (lookup par EIC dans ~14 929 entrées) et classifier chaque messageType lors du traitement d'un backup. Ces opérations sont effectuées en boucle sur potentiellement des centaines de composants et chemins de messages par ingestion. Deux options étaient envisageables : une base de données (SQLite/PostgreSQL) ou un index en mémoire.

## Décision identifiée

Le `RegistryService` charge intégralement les deux fichiers de référence en mémoire au démarrage de l'application via `OnModuleInit` :
- Le CSV ENTSO-E (~14 929 codes) est indexé dans un `Map<string, EntsoeEntry>` pour des lookups O(1).
- L'overlay JSON RTE est parsé et stocké tel quel dans un champ privé.
- Les patterns regex de classification sont compilés en objets `RegExp` au boot.

Le module est déclaré `@Global()`, ce qui le rend disponible dans tous les modules NestJS sans import explicite. Il est exporté une seule fois depuis `RegistryModule`.

Il n'y a pas de rechargement à chaud — toute modification des fichiers de référence requiert un redémarrage de l'API (explicitement hors scope slice #1, documenté dans CLAUDE.md).

## Conséquences observées

### Positives
- Les lookups ENTSO-E sont O(1) — aucune latence I/O par ingestion.
- La compilation des regexes au boot évite la recompilation à chaque classification.
- Le pattern `@Global()` simplifie l'injection : `NetworkModelBuilderService` reçoit `RegistryService` sans configuration de module.
- L'empreinte mémoire reste modeste (~14 929 entrées légères) — estimée à quelques dizaines de Mo au maximum.

### Négatives / Dette
- Toute mise à jour des données de référence (nouveau code EIC, nouvelle règle de classification) requiert un redémarrage. Pour slice #1 (usage interne, < 10 utilisateurs), c'est acceptable.
- Si le fichier CSV ENTSO-E grossit significativement (peu probable — c'est un registre stable), l'empreinte mémoire augmenterait proportionnellement.
- Le rechargement à chaud est une feature explicitement identifiée comme future dans CLAUDE.md ("admin registry hot reload").
- En cas d'échec du chargement (fichier absent, JSON malformé), l'exception remonte dans `onModuleInit` sans handler dédié — comportement NestJS standard : crash applicatif au boot.

## Recommandation

Garder pour slice #1 et au-delà, tant que les fichiers de référence restent stables et la charge faible. Implémenter le rechargement à chaud dans un slice futur si le besoin opérationnel (mise à jour fréquente du registry sans redémarrage) est confirmé.
