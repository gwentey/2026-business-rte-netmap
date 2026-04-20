# Spec Fonctionnelle — web/env-selector

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/env-selector                |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-027](../../../adr/ADR-027-envname-first-class.md) | envName first-class | Actif |
| [RETRO-018](../../../adr/RETRO-018-partialize-persist-activeSnapshotId-uniquement.md) | Persist partialize activeEnv uniquement | Actif (nom migré de activeSnapshotId vers activeEnv) |

---

## Contexte et objectif

L'application peut gérer plusieurs environnements ECP distincts (OPF, PROD, PFRFI...). L'EnvSelector est le point d'entrée de navigation entre ces environnements. Il remplace l'ancien `SnapshotSelector` de v1 (qui sélectionnait un snapshot par ID) par une sélection d'environnement, cohérente avec l'architecture v2 où un environnement agrège plusieurs imports.

---

## Règles métier

1. **L'environnement actif est mémorisé entre sessions.** Quand l'utilisateur revient sur l'application, l'env sélectionné la dernière fois est automatiquement rechargé (si toujours valide).

2. **Si l'env mémorisé n'existe plus, le premier env disponible est sélectionné.** Si aucun env n'existe, la carte est vide.

3. **Changer d'env recharge le graphe et les imports.** Les données de l'ancien env ne sont plus affichées.

4. **La sélection (nœud/edge) est réinitialisée lors du changement d'env.**

---

## Cas d'usage

### CU-001 — Changer d'environnement

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur voit le sélecteur d'environnement dans la barre de la carte.
2. Il choisit un autre env dans la liste déroulante.
3. Le graphe et les imports se rechargent pour le nouvel environnement.
4. La timeline slider se met à jour avec les dates du nouvel env.

---

## Dépendances

- **api/envs** — liste des environnements
- **web/map** — EnvSelector intégré dans MapPage
