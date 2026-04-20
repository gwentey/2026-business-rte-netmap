# Spec Fonctionnelle — api/admin

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/admin                       |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-023](../../../adr/ADR-023-raw-plus-compute-on-read.md) | Modèle raw + compute-on-read | Actif |
| [ADR-024](../../../adr/ADR-024-cascade-5-niveaux-par-champ.md) | Cascade 5 niveaux par champ | Actif |

---

## Contexte et objectif

Le module `admin` regroupe les fonctions d'administration avancées qui ne sont pas liées au flux normal d'import :

1. **Purges** (zone danger) : suppression massive et irréversible de données.
2. **Annuaire ENTSO-E uploadable** : en complément du CSV ENTSO-E statique embarqué dans le package registry, l'administrateur peut uploader une version plus récente ou complète du registre officiel ENTSO-E. Cette version uploadée prend la priorité sur le registry statique dans la cascade (niveau 2 > niveau 3).

---

## Règles métier

1. **Les purges sont irréversibles.** Une confirmation côté client (saisie d'un mot-clé) est requise, mais le backend ne valide pas cette confirmation. La responsabilité de la confirmation est entièrement côté frontend.

2. **Purge imports = suppression de toutes les données d'import.** Supprime tous les imports, leurs composants, chemins, stats et propriétés associés (cascade), ainsi que les ZIPs sur disque. Les overrides et l'annuaire ENTSO-E ne sont pas touchés.

3. **Purge overrides = suppression de toutes les surcharges manuelles.** Les imports et l'annuaire ENTSO-E ne sont pas touchés.

4. **Purge-all = reset total.** Supprime imports + overrides + annuaire ENTSO-E uploadé. Le registry statique RTE (fichier JSON) n'est pas touché.

5. **L'upload ENTSO-E remplace entièrement l'annuaire.** Un nouvel upload supprime les entrées précédentes avant d'insérer les nouvelles. Il n'y a pas de merge.

6. **L'annuaire ENTSO-E uploadé est optionnel.** Si la table est vide (aucun upload), le niveau 2 de la cascade ne contribue pas. Le registry statique (niveau 3) reste actif.

7. **Format attendu du CSV ENTSO-E.** Le format correspond au fichier officiel téléchargeable sur le site ENTSO-E : délimiteur `;`, BOM UTF-8, colonnes `EicCode`, `EicLongName`, `EicDisplayName`, `MarketParticipantIsoCountryCode`, `EicTypeFunctionList`.

---

## Cas d'usage

### CU-001 — Purger tous les imports pour repartir de zéro

**Acteur** : administrateur (DangerZoneTab)

**Préconditions** : l'administrateur a conscience que l'action est irréversible.

**Flux** :
1. L'administrateur clique sur "Purger tous les imports".
2. Un modal demande de saisir le mot-clé `PURGER`.
3. Après confirmation, DELETE /api/admin/purge-imports est appelé.
4. La page affiche le nombre d'imports supprimés.

### CU-002 — Mettre à jour l'annuaire ENTSO-E

**Acteur** : administrateur (onglet ENTSO-E de l'AdminPage)

**Flux** :
1. L'administrateur télécharge le dernier fichier EIC CSV depuis le site ENTSO-E.
2. Il le glisse sur l'onglet ENTSO-E ou utilise le sélecteur de fichier.
3. POST /api/entsoe/upload traite le fichier et retourne le nombre d'entrées chargées.
4. Le statut de l'annuaire affiche le nouveau compte et la date de mise à jour.
5. Au prochain chargement du graphe, les noms d'affichage et pays ENTSO-E à jour sont utilisés.

### CU-003 — Consulter le statut de l'annuaire ENTSO-E

**Acteur** : administrateur

**Flux** :
1. L'onglet ENTSO-E affiche le nombre d'entrées en base et la date du dernier upload (ou "Aucun upload" si la table est vide).

---

## Dépendances

- **api/graph** — consomme `EntsoeEntry` (niveau 2 de la cascade)
- **web/admin** — interface DangerZoneTab + EntsoeAdminTab
