# Spec Fonctionnelle — web/admin

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/admin                       |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-024](../../../adr/ADR-024-cascade-5-niveaux-par-champ.md) | Cascade 5 niveaux par champ | Actif |
| [ADR-036](../../../adr/ADR-036-put-upsert-overrides.md) | PUT upsert pour les overrides | Actif |

---

## Contexte et objectif

La page Admin centralise les opérations administratives qui ne font pas partie du flux normal d'utilisation (consultation de la carte). Elle est accessible depuis le menu de navigation. Elle est destinée aux administrateurs de l'application qui gèrent les données en base.

La page est organisée en 6 onglets thématiques :
1. **Imports** — gestion des imports (liste, suppression, édition label/date)
2. **Composants** — surcharges manuelles des métadonnées de composants
3. **Organisations** — mémoire interne (mapping organisation → pays/adresse/type), CRUD + import/export JSON *(Slice 3d)*
4. **ENTSO-E** — mise à jour de l'annuaire EIC depuis le site officiel
5. **Registry RTE** — édition des couleurs de process et des endpoints RTE
6. **Zone danger** — purges irréversibles

---

## Règles métier

1. **Imports** : L'administrateur peut consulter tous les imports de tous les environnements, supprimer un import (et ses données associées) ou corriger son label ou sa date effective.

2. **Composants** : L'administrateur peut surcharger manuellement les métadonnées d'un composant EIC visible dans n'importe quel import. La surcharge est persistée et s'applique immédiatement au prochain chargement du graphe.

3. **ENTSO-E** : L'administrateur peut uploader le CSV officiel ENTSO-E pour mettre à jour l'annuaire en base. Cet annuaire enrichit les noms d'affichage et pays des composants qui ne sont pas dans l'overlay RTE.

4. **Zone danger** : Trois niveaux de purge. Chacun requiert la saisie d'un mot-clé de confirmation dans un modal. Le bouton Confirmer n'est actif que si le mot-clé est correct. Les purges sont irréversibles.

5. **Onglet Organisations (Slice 3d)** : tableau CRUD de la mémoire interne avec recherche libre sur nom/pays/type/adresse, badge d'édition utilisateur, boutons « + Nouvelle organisation », « ⬆ Importer JSON », « ⬇ Exporter JSON ». Import par `organizationName` normalisé (upsert).

6. **Badge « ⚠ pays manquant » dans l'onglet Composants (Slice 3d)** : si un composant a `country === null` après cascade et que `organization` est connue, la cellule Pays affiche un badge orange cliquable `⚠ Manquant [+]` qui ouvre le modal d'édition de la mémoire interne en mode création, pré-rempli avec `displayName = organization` du composant. Si organization est aussi null, le badge est un simple `⚠` non-cliquable.

---

## Cas d'usage

### CU-001 — Corriger la date effective d'un import

**Acteur** : administrateur (onglet Imports)

**Flux** : L'administrateur identifie un import dont la `effectiveDate` est incorrecte (ex: import manuel sans timestamp dans le nom de fichier). Il clique sur Éditer, corrige la date et sauvegarde.

### CU-002 — Corriger les coordonnées d'un composant tiers

**Acteur** : administrateur (onglet Composants)

Voir [api/overrides spec-fonctionnel](../../api/overrides/spec-fonctionnel.md) CU-001.

### CU-003 — Mettre à jour l'annuaire ENTSO-E

**Acteur** : administrateur (onglet ENTSO-E)

Voir [api/admin spec-fonctionnel](../../api/admin/spec-fonctionnel.md) CU-002.

### CU-004 — Purger tous les imports pour repartir de zéro

**Acteur** : administrateur (onglet Zone danger)

Voir [api/admin spec-fonctionnel](../../api/admin/spec-fonctionnel.md) CU-001.

---

## Dépendances

- **api/imports** — liste, suppression, édition des imports
- **api/overrides** — gestion des surcharges de composants
- **api/admin** — purges + annuaire ENTSO-E
