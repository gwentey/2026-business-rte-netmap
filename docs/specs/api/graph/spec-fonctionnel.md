# Spec Fonctionnelle — api/graph

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/graph                       |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-023](../../../adr/ADR-023-raw-plus-compute-on-read.md) | Modèle raw + compute-on-read | Actif |
| [ADR-024](../../../adr/ADR-024-cascade-5-niveaux-par-champ.md) | Cascade 5 niveaux par champ | Actif |
| [ADR-025](../../../adr/ADR-025-cle-path-5-champs-sans-tri-canonique.md) | Clé path 5 champs sans tri canonique | Actif |
| [ADR-026](../../../adr/ADR-026-effectivedate-decouplee-uploadedat.md) | effectiveDate découplée de uploadedAt | Actif |
| [ADR-027](../../../adr/ADR-027-envname-first-class.md) | envName first-class | Actif |
| [RETRO-005](../../../adr/RETRO-005-direction-in-out-rte-eic-set-autoritatif.md) | Direction IN/OUT basée sur le set EIC RTE autoritatif | Documenté (rétro) |
| [RETRO-009](../../../adr/RETRO-009-aggregation-edges-par-paire-eic-avec-detection-mixte.md) | Agrégation edges par paire EIC avec détection MIXTE | Documenté (rétro) |
| [RETRO-010](../../../adr/RETRO-010-isrecent-relatif-au-snapshot-reproductibilite-historique.md) | isRecent relatif à la date effective (reproductibilité historique) | Documenté (rétro) |
| [RETRO-011](../../../adr/RETRO-011-identifiant-edge-sha1-deterministe.md) | Identifiant edge SHA1 déterministe | Documenté (rétro) |

---

## Contexte et objectif

Le module `graph` est le service de lecture centrale : il calcule à la volée le graphe réseau ECP pour un environnement donné, optionnellement à une date de référence historique. Ce calcul est effectué à chaque requête (compute-on-read) sans table pré-calculée, ce qui permet une navigation temporelle sans retraitement des données brutes.

---

## Règles métier

1. **Le graphe est calculé pour un environnement précis.** Les données d'un environnement ne se mélangent pas avec celles d'un autre.

2. **La date de référence filtre les imports.** Seuls les imports dont `effectiveDate <= refDate` sont inclus dans le calcul. Sans `refDate`, tous les imports sont inclus.

3. **Latest-wins pour les composants.** Si un même EIC apparaît dans plusieurs imports, les données de l'import le plus récent (par `effectiveDate`) prennent la priorité champ par champ.

4. **Cascade 5 niveaux pour l'enrichissement.** Pour chaque composant, les métadonnées sont enrichies en appliquant par ordre de priorité : override manuel > annuaire ENTSO-E uploadé > registry RTE statique > données importées > défaut Brussels.

5. **`isDefaultPosition = true` signale un composant sans coordonnées connues.** Il apparaît sur la carte à la position par défaut (Brussels) avec un indicateur visuel (badge orange).

6. **Agrégation des edges par paire (fromEic, toEic).** Plusieurs chemins entre les mêmes EIC sont agrégés en un seul edge. Si >= 2 processus distincts coexistent sur la même paire, l'edge est classé `MIXTE`.

7. **Direction IN/OUT basée sur l'ensemble EIC RTE autoritatif.** Un chemin est `IN` si le `receiverEic` appartient au set RTE. Pas d'heuristique de préfixe.

8. **Les chemins wildcard sont exclus du rendu.** Les chemins avec `*` comme sender ou receiver sont filtrés.

9. **`isRecent` basé sur la date du dernier import.** `isRecent = true` si le dernier échange remonte à moins de 24h avant `effectiveDate` du dernier import (pas `Date.now()`). Seuil configurable via `ISRECENT_THRESHOLD_MS`.

10. **ID d'edge déterministe.** Calculé via SHA1(`{fromEic}|{toEic}|{process}`).slice(16 chars). Stable entre les rechargements.

11. **Interlocuteurs dérivés des edges agrégées.** Pour chaque `GraphNode`, la liste `interlocutors` est calculée à partir des edges BUSINESS (pas PEERING) : pour chaque edge où le noeud est `fromEic` ou `toEic`, l'autre extrémité est ajoutée avec la direction vue depuis le noeud (IN si le noeud est `toEic`, OUT si `fromEic`, BIDI si présent des deux côtés). Les messageTypes sont unis et triés alphabétiquement. Tri des interlocuteurs : (1) direction BIDI > OUT > IN, (2) nombre de messageTypes décroissant, (3) EIC croissant. Cohérence garantie avec la carte : un interlocuteur affiché ⇔ une edge visible.

---

## Cas d'usage

### CU-001 — Charger le graphe d'un environnement

**Acteur** : frontend web (au changement d'environnement ou d'app)

**Flux** :
1. `GET /api/graph?env=OPF`
2. GraphService agrège tous les imports de l'env OPF
3. Applique la cascade d'enrichissement
4. Retourne `GraphResponse` avec nodes, edges, bounds, mapConfig

### CU-002 — Observer l'état du réseau à une date historique

**Acteur** : frontend web (TimelineSlider)

**Flux** :
1. `GET /api/graph?env=OPF&refDate=2026-03-01T00:00:00.000Z`
2. Seuls les imports avec `effectiveDate <= 2026-03-01` sont inclus
3. Le graphe reflète l'état du réseau au 1er mars 2026

---

## Dépendances

- **api/imports** — fournit les données brutes (ImportedComponent, ImportedPath, ImportedMessagingStat)
- **api/overrides** — niveau 1 de la cascade (ComponentOverride)
- **api/admin** — niveau 2 de la cascade (EntsoeEntry)
- **api/registry** — niveau 3 de la cascade + rteEicSet + mapConfig
- **web/map** — consommateur principal de GraphResponse
- **web/timeline-slider** — fournit la refDate
