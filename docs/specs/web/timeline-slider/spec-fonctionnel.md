# Spec Fonctionnelle — web/timeline-slider

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/timeline-slider             |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-023](../../../adr/ADR-023-raw-plus-compute-on-read.md) | Modèle raw + compute-on-read | Actif |
| [ADR-026](../../../adr/ADR-026-effectivedate-decouplee-uploadedat.md) | effectiveDate découplée de uploadedAt | Actif |

---

## Contexte et objectif

Lorsque plusieurs dumps ECP ont été importés pour le même environnement à des dates différentes, l'utilisateur peut vouloir observer l'état du réseau à un instant passé. Le timeline slider permet de naviguer temporellement entre les imports disponibles sans recharger la page.

Ce composant n'est visible que lorsqu'il y a au moins 2 dates d'imports distinctes pour l'environnement actif.

---

## Règles métier

1. **La date de référence filtre les imports.** Seuls les imports dont `effectiveDate <= refDate` sont inclus dans le calcul du graphe.

2. **"Maintenant" = pas de filtre.** Quand le slider est en position maximale (ou après clic sur "Retour au présent"), le graphe inclut tous les imports de l'environnement.

3. **La navigation est réversible.** Le bouton "Retour au présent" ramène immédiatement à l'état sans filtre temporel.

4. **La date de référence n'est pas persistée entre sessions.** À chaque ouverture de l'application, `refDate = null` (état actuel).

---

## Cas d'usage

### CU-001 — Observer l'état du réseau à une date passée

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur est sur la page carte avec un environnement actif ayant plusieurs imports.
2. Le slider apparaît en haut de la carte.
3. L'utilisateur déplace le slider vers une date antérieure.
4. Le graphe se recharge avec uniquement les imports effectifs à cette date.
5. La carte affiche l'état historique du réseau.

### CU-002 — Revenir à l'état actuel

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur est en mode historique (refDate fixée).
2. Il clique sur "Retour au présent".
3. Le graphe se recharge avec tous les imports disponibles.

---

## Dépendances

- **api/graph** — paramètre `?refDate=` transmis à GET /api/graph
- **web/map** — affiché dans MapPage au-dessus de la carte
