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

8. **Mémoire interne des organisations (Slice 3d).** Table `OrganizationEntry` éditable via `/admin > Organisations` : mapping `organizationName normalisé → {country, address, typeHint}`. Utilisée par la cascade graph pour résoudre le pays et l'adresse d'un composant dont l'organisation est connue mais absente de l'annuaire ENTSO-E. Pré-peuplée au boot via `OrganizationSeederService` depuis `packages/registry/organization-memory-seed.json` (versionné). Import/export JSON au format `{version, entries[]}`.

9. **Seed versionné, édits préservés.** Au boot, si une entrée a `userEdited=false` et `seedVersion < JSON.version`, ses champs sont rafraîchis depuis le JSON ; si elle a `userEdited=true`, seuls `seedVersion` est mis à jour pour tracer — les champs métier restent intacts. Toute modification via `PATCH /api/admin/organizations/:id` ou `POST .../import` passe `userEdited=true`.

10. **Normalisation du nom d'organisation.** Lookup effectué sur `organizationName = raw.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr')`. Le nom affiché est stocké séparément dans `displayName`. Ainsi "Swissgrid AG", "SWISSGRID AG", "  swissgrid ag  " résolvent vers la même entry.

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

### CU-004 — Ajouter une organisation inconnue à la mémoire interne (Slice 3d)

**Acteur** : administrateur (onglet Composants ou Organisations)

**Flux** :
1. Dans `/admin > Composants`, l'administrateur repère une ligne avec un badge `⚠ Manquant [+]` dans la colonne Pays.
2. Il clique sur le badge — `OrganizationEditModal` s'ouvre pré-rempli avec `displayName = organization` du composant.
3. Il renseigne le code pays ISO-2 (datalist), optionnellement l'adresse et le type, et valide.
4. `POST /api/admin/organizations` crée l'entry avec `userEdited=true`, `seedVersion=0`.
5. Au prochain chargement du graphe, tous les composants partageant cette organisation sont placés correctement sur la carte.

### CU-005 — Exporter la mémoire interne pour sauvegarde ou partage (Slice 3d)

**Acteur** : administrateur

**Flux** :
1. Dans `/admin > Organisations`, clic sur ⬇ Exporter JSON.
2. `GET /api/admin/organizations/export` retourne un fichier `organization-memory.json` au format `{version:1, exportedAt, entries:[…]}`.
3. Le navigateur télécharge le fichier.

### CU-006 — Importer un lot d'organisations (Slice 3d)

**Acteur** : administrateur

**Flux** :
1. Clic sur ⬆ Importer JSON, sélection d'un fichier au même format que l'export.
2. `POST /api/admin/organizations/import` upsert chaque entry par `organizationName` normalisé. Chaque ligne matche est `updated` (pas `inserted`), les nouvelles sont `inserted`, les lignes invalides (nom vide, JSON cassé) sont `skipped` avec raison.
3. Un bandeau vert récapitule le bilan `{inserted, updated, skipped, errors}`.

---

## Dépendances

- **api/graph** — consomme `EntsoeEntry` (niveau 2 de la cascade) et `OrganizationEntry` (niveau 4 pour `country/address`, via `OrganizationsService.loadAsMap`)
- **web/admin** — interface DangerZoneTab + EntsoeAdminTab + OrganizationsAdminTab
- **packages/registry/organization-memory-seed.json** — source de vérité du seed, éditable via PR MCO
