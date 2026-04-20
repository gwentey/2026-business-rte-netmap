# Spec Fonctionnelle — web/map

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/map                         |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-034](../../../adr/ADR-034-divicon-lucide-react-markers.md) | DivIcon Lucide React pour les markers | Actif |
| [RETRO-015](../../../adr/RETRO-015-offset-radial-paris-la-defense-dispersion-noeuds-superposes.md) | Offset radial Paris La Défense | Documenté (rétro) |
| [RETRO-016](../../../adr/RETRO-016-duplication-process-colors-json-ts-synchronisation-manuelle.md) | Duplication process-colors JSON/TS | Documenté (rétro) |

---

## Contexte et objectif

La page carte est la vue principale de l'application. Elle affiche le réseau ECP sous forme de graphe géographique sur un fond de carte OpenStreetMap : les composants (endpoints, CDs, brokers) sont des marqueurs, les chemins de messages sont des courbes colorées par processus métier.

---

## Règles métier

1. **Les nœuds sont différenciés visuellement par kind.** 5 kinds possibles : RTE_ENDPOINT (rouge, éclair), RTE_CD (rouge foncé, réseau), BROKER (noir, routeur), EXTERNAL_CD (gris foncé, réseau), EXTERNAL_ENDPOINT (gris, éclair).

2. **Les nœuds sans coordonnées connues affichent un badge orange.** `isDefaultPosition = true` signifie que le composant est positionné par défaut à Brussels. Un badge ⚠ est visible sur le marqueur, et un avertissement s'affiche dans le tooltip.

3. **Les edges sont colorés par processus métier.** La couleur est définie dans `process-colors.ts` (source de vérité côté web, synchronisée manuellement avec l'overlay RTE JSON).

4. **Les edges inactifs sont en pointillés.** `isRecent = false` -> `dashArray='6 6'`. Les edges actifs sont des traits pleins.

5. **Un seul élément sélectionnable à la fois.** Cliquer sur un nœud ou un edge ouvre le panneau de détail correspondant et désélectionne l'autre.

6. **Les nœuds proches du cluster RTE sont dispersés radialement.** Les endpoints RTE sont proches géographiquement (Paris La Défense). Un offset radial est appliqué côté client pour éviter la superposition.

7. **L'environnement actif est sélectionnable via EnvSelector.** La carte se recharge quand l'env change.

8. **La timeline permet une navigation historique.** Le slider de date de référence est affiché si l'env a >= 2 dates d'import distinctes.

---

## Cas d'usage

### CU-001 — Visualiser le réseau ECP

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur ouvre l'application (`/`).
2. L'env persisté (ou le premier disponible) est chargé automatiquement.
3. La carte affiche les nœuds et edges du graphe.

### CU-002 — Sélectionner un composant

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur clique sur un marqueur de nœud.
2. Le panneau de détail (DetailPanel) s'ouvre avec les informations du composant.

### CU-003 — Sélectionner un chemin de message

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur clique sur une courbe d'edge.
2. Le panneau de détail affiche les informations de l'edge (processus, messageTypes, activité).

---

## Dépendances

- **api/graph** — données du graphe (GET /api/graph)
- **web/env-selector** — sélection d'environnement
- **web/timeline-slider** — navigation historique
- **web/detail-panel** — panneau de détail nœud/edge
