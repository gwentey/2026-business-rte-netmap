# Spec Fonctionnelle — api/envs

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/envs                        |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-027](../../../adr/ADR-027-envname-first-class.md) | envName first-class | Actif |

---

## Contexte et objectif

Un environnement ECP (OPF, PROD, PFRFI, etc.) est un contexte opérationnel indépendant. Les composants et chemins d'un environnement n'ont pas de relation avec ceux d'un autre. Le module `envs` fournit la liste des environnements connus pour que le frontend puisse proposer un sélecteur.

Les environnements ne sont pas configurés explicitement : ils sont créés implicitement lors du premier import pour cet environnement et disparaissent si tous leurs imports sont supprimés.

---

## Règles métier

1. **Un environnement = un `envName` distinct dans les imports.** Il n'y a pas de table d'environnements.
2. **La liste est dynamique.** Elle reflète l'état actuel des imports en base.
3. **Les noms d'environnements sont libres.** Convention RTE : `OPF`, `PROD`, `PFRFI`, `PFRFI2`, etc.

---

## Cas d'usage

### CU-001 — Sélectionner l'environnement actif

**Acteur** : utilisateur web (EnvSelector)

**Flux** :
1. Au chargement de l'application, GET /api/envs retourne la liste des environnements.
2. L'`EnvSelector` affiche un `<select>` avec les environnements disponibles.
3. L'utilisateur sélectionne un environnement.
4. L'application charge les imports et le graphe de cet environnement.

---

## Dépendances

- **api/imports** — fournit les données (les envs sont extraits des imports)
- **web/env-selector** — interface utilisateur
