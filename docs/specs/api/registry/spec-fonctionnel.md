# Spec Fonctionnelle — api/registry

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/registry                    |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-012](../../../adr/RETRO-012-registry-singleton-global-in-memory-boot-time.md) | Registry EIC chargé en mémoire au boot comme singleton Global NestJS | Documenté (rétro) |
| [RETRO-013](../../../adr/RETRO-013-registry-path-resolution-process-cwd.md) | Résolution du chemin des fichiers registry via process.cwd() | Documenté (rétro) |
| [RETRO-004](../../../adr/RETRO-004-classification-message-type-a-l-ingestion.md) | Classification messageType | Documenté (rétro) |
| [RETRO-005](../../../adr/RETRO-005-direction-in-out-rte-eic-set-autoritatif.md) | Direction IN/OUT basée sur le set EIC RTE autoritatif | Documenté (rétro) |

---

## Contexte et objectif

Le module `registry` fournit les données de référence statiques nécessaires à l'enrichissement du graphe réseau. Ces données sont chargées une fois au démarrage de l'API et restent en mémoire pour la durée de vie du process. Il n'expose aucun endpoint HTTP public.

Deux sources complémentaires sont chargées :
- **ENTSO-E statique** (~14 929 codes EIC officiels, format CSV) : registre de référence des participants du marché européen de l'énergie.
- **Overlay RTE** (JSON) : données propriétaires RTE — coordonnées précises des endpoints RTE, géocodage des TSOs partenaires, classification des types de messages en processus métier, palette de couleurs, configuration cartographique.

En v2.0, le registry est le niveau 3 de la cascade dans GraphService (après les ComponentOverride niveau 1 et les EntsoeEntry uploadées niveau 2).

---

## Règles métier

1. **Cascade de résolution géographique à 4 niveaux** (`resolveComponent`, utilisé par l'ingestion v1) et **`resolveEic`** (utilisé par le graphe v2 comme niveau 3 de la cascade) :
   - Niveau 1 : overlay RTE endpoints (coordonnées précises)
   - Niveau 2 : overlay RTE CD
   - Niveau 3 : index ENTSO-E statique (displayName, country — sans coords)
   - Null si inconnu

2. **Classification messageType** : exact -> regex -> UNKNOWN. Les regexes sont compilées au boot.

3. **L'ensemble RTE autoritatif** (`rteEicSet`) est calculé au boot : `{rteEndpoints[*].eic} ∪ {rteComponentDirectory.eic}`. Il est la seule source de vérité pour la direction IN/OUT des edges.

4. **`DEFAULT` dans countryGeocode est obligatoire.** Son absence cause une exception au démarrage.

5. **Pas de rechargement à chaud.** Tout changement dans les fichiers de registry nécessite un redémarrage de l'API.

---

## Cas d'usage

### CU-001 — Enrichir un composant lors du build du graphe

**Acteur** : GraphService (interne)

GraphService appelle `resolveEic(eic)` pour chaque EIC traité. Le résultat enrichit la cascade 5 niveaux.

### CU-002 — Classifier un messageType

**Acteur** : GraphService (interne)

GraphService appelle `classifyMessageType(messageType)` pour chaque chemin merged afin de déterminer le processus métier de l'edge.

### CU-003 — Obtenir l'ensemble RTE autoritatif

**Acteur** : GraphService (interne)

`getRteEicSet()` retourne le Set<string> utilisé pour déterminer la direction IN/OUT de chaque edge.

---

## Dépendances

- **packages/registry** — données sources (CSV + JSON)
- **api/graph** — consommateur principal
- **api/ingestion** — consomme `resolveComponent`, `classifyMessageType`
