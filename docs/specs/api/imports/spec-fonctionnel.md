# Spec Fonctionnelle — api/imports

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/imports                     |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-023](../../../adr/ADR-023-raw-plus-compute-on-read.md) | Modèle raw + compute-on-read | Actif |
| [ADR-026](../../../adr/ADR-026-effectivedate-decouplee-uploadedat.md) | effectiveDate découplée de uploadedAt | Actif |
| [ADR-027](../../../adr/ADR-027-envname-first-class.md) | envName first-class | Actif |
| [ADR-028](../../../adr/ADR-028-suppression-endpoints-legacy-snapshots.md) | Suppression endpoints legacy /snapshots | Actif |
| [ADR-030](../../../adr/ADR-030-dump-type-detector-heuristique.md) | DumpTypeDetector heuristique | Actif |
| [ADR-031](../../../adr/ADR-031-dump-type-detector-v2-signatures-csv.md) | DumpTypeDetector v2 signatures CSV | Actif |
| [ADR-033](../../../adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md) | Batch upload best-effort par fichier | Actif |
| [ADR-035](../../../adr/ADR-035-dumptype-immutable-post-ingest.md) | dumpType immuable post-ingestion | Actif |

---

## Contexte et objectif

Le module `imports` est le point d'entrée principal pour charger des données ECP dans l'application. L'utilisateur fournit un ou plusieurs fichiers ZIP exportés depuis un ECP (Endpoint, Component Directory ou Broker) et les associe à un environnement (ex: OPF, PROD, PFRFI). Ces imports constituent la base de données brute à partir de laquelle le graphe réseau est calculé à la demande.

En v2.0, un import est une unité autonome : il ne produit pas de vue enrichie pré-calculée. Plusieurs imports peuvent coexister pour le même environnement — ils forment ensemble l'historique de cet environnement et permettent une navigation temporelle via la `effectiveDate`.

---

## Règles métier

1. **Un import = un ZIP = un environnement.** Un même ZIP peut être importé dans différents environnements indépendamment.

2. **Détection automatique du type de dump.** L'application détecte automatiquement si le ZIP est un dump Endpoint, Component Directory ou Broker en analysant les fichiers présents. L'utilisateur peut forcer le type (override) s'il connaît la source.

3. **Import BROKER accepté sans données.** Un dump Broker (sans CSV ECP structuré) est accepté avec un warning. Il représente la présence d'un broker dans l'environnement sans exposer de composants ou chemins.

4. **Inspection avant import (dry-run).** L'utilisateur peut inspecter N fichiers sans les persister pour voir le type détecté, les éventuels doublons et les warnings avant de confirmer l'import.

5. **Détection des doublons.** Si un ZIP identique existe déjà (même EIC source + même timestamp, ou même hash SHA256), l'import est signalé comme doublon dans l'inspection. L'utilisateur peut choisir de remplacer (option `replaceImportId`).

6. **Remplacement atomique.** Remplacer un import supprime l'ancien avant de créer le nouveau. Le `replaceImportId` doit appartenir au même environnement.

7. **Date effective découplée de la date d'upload.** La `effectiveDate` est extraite du nom de fichier ZIP si le format standard ECP est reconnu (`{EIC}_{TIMESTAMP}Z.zip`). Sinon elle prend la valeur de l'heure d'upload. Elle peut être modifiée après coup via PATCH.

8. **Les fichiers sensibles ne sont jamais lus ni stockés.** Les fichiers `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` sont exclus de l'extraction mémoire et du repackage disque, même s'ils sont présents dans le ZIP original.

9. **Les clés de configuration sensibles sont filtrées.** Les propriétés d'application contenant `password`, `secret`, `keystore.password`, `privateKey` ou `credentials` sont supprimées avant persistance.

10. **Un import est modifiable après création (label, effectiveDate uniquement).** Le type de dump et l'environnement sont immuables.

---

## Cas d'usage

### CU-001 — Importer un dump ECP

**Acteur** : utilisateur web (via UploadPage)

**Flux principal** :
1. L'utilisateur glisse un ou plusieurs ZIPs sur la page d'upload.
2. L'application inspecte automatiquement chaque fichier (POST /api/imports/inspect) et affiche le type détecté, les warnings et les doublons éventuels.
3. L'utilisateur vérifie les informations, ajuste le label si nécessaire, et lance l'import (POST /api/imports par fichier).
4. Chaque import est traité indépendamment. Un échec sur un fichier n'annule pas les autres.
5. À la fin, l'utilisateur est redirigé vers la carte.

**Cas alternatif — doublon détecté** :
L'utilisateur coche "Remplacer" pour chaque doublon identifié. L'option `replaceImportId` est envoyée au backend.

**Cas alternatif — type incorrect** :
L'utilisateur change le type détecté via le sélecteur dans la table de batch avant de valider.

### CU-002 — Consulter les imports d'un environnement

**Acteur** : utilisateur web (via AdminPage, onglet Imports)

**Flux** :
1. L'utilisateur navigue vers la page Admin.
2. L'onglet Imports affiche la liste des imports de l'environnement actif (label, date effective, type, nombre de composants/chemins, warnings).

### CU-003 — Supprimer un import

**Acteur** : utilisateur web (AdminPage, onglet Imports)

**Flux** :
1. L'utilisateur clique sur Supprimer pour un import.
2. L'import et toutes ses données associées (composants, chemins, stats) sont supprimés en cascade.
3. Le ZIP sur disque est également supprimé.

### CU-004 — Modifier le label ou la date effective

**Acteur** : utilisateur web (AdminPage)

**Flux** :
1. L'utilisateur édite le label ou la date effective d'un import existant.
2. PATCH /api/imports/:id met à jour uniquement les champs fournis.

---

## Dépendances

- **api/ingestion** — pipeline de parsing et persistance
- **api/graph** — consomme les données brutes pour construire le graphe
- **api/envs** — liste les environnements existants (extraits des imports)
- **web/upload** — interface d'upload et de batch
- **web/admin** — interface de gestion (liste, suppression, édition)
