# Spec Fonctionnelle — api/overrides

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/overrides                   |
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

Le registre ENTSO-E et l'overlay RTE sont des sources de données statiques. Pour certains composants ECP tiers, les coordonnées ou les métadonnées peuvent être incorrectes, absentes ou simplement insuffisantes pour une présentation claire sur la carte. Le module `overrides` permet à l'administrateur de corriger ou compléter ces informations sans modifier les fichiers de registry (qui sont versionés).

Ces surcharges constituent le niveau de priorité le plus élevé dans la cascade : elles priment sur toutes les autres sources (ENTSO-E uploadé, registry RTE, données importées).

---

## Règles métier

1. **Un override par EIC.** On ne peut avoir qu'une seule surcharge par code EIC. Un second PUT sur le même EIC écrase la surcharge existante.

2. **Surcharge partielle.** Chaque champ est indépendant. Surcharger uniquement `lat/lng` sans toucher à `displayName` est possible. Un champ null dans l'override signifie "ne pas surcharger ce champ".

3. **La surcharge n'existe que si elle a été créée.** Si aucune surcharge n'existe pour un EIC, le composant utilise les niveaux inférieurs de la cascade (ENTSO-E, registry, données importées, défaut Brussels).

4. **La suppression d'un override ne supprime pas le composant.** Le composant reste visible dans le graphe via les autres niveaux de la cascade.

5. **Validation stricte des coordonnées.** lat : -90..90, lng : -180..180, country : exactement 2 caractères ISO.

---

## Cas d'usage

### CU-001 — Corriger les coordonnées d'un composant tiers

**Acteur** : administrateur (via AdminPage, onglet Composants)

**Flux** :
1. L'administrateur recherche un composant par EIC, nom ou organisation.
2. Il clique sur "Éditer".
3. Il saisit des coordonnées correctes (lat/lng) et/ou un nom d'affichage plus lisible.
4. PUT /api/overrides/:eic sauvegarde la surcharge.
5. Le graphe reflète immédiatement les nouvelles coordonnées au prochain chargement.

### CU-002 — Consulter les composants avec surcharges actives

**Acteur** : administrateur

**Flux** :
1. L'administrateur coche "N'afficher que les composants avec surcharge" dans l'onglet Composants.
2. La liste filtrée montre uniquement les composants ayant un `ComponentOverride` en base.

### CU-003 — Supprimer une surcharge

**Acteur** : administrateur

**Flux** :
1. L'administrateur clique sur "Supprimer l'override" pour un composant.
2. DELETE /api/overrides/:eic supprime la surcharge.
3. Le composant revient à ses valeurs calculées par la cascade sans le niveau 1.

---

## Dépendances

- **api/graph** — consomme les overrides comme niveau 1 de la cascade compute-on-read
- **web/admin** — interface de gestion (ComponentsAdminTable + ComponentOverrideModal)
