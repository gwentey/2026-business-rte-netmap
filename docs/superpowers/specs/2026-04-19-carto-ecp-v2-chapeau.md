# Carto ECP v2.0 — Document chapeau

> **Statut :** design validé (2026-04-19), remplace `carto-ecp-document-fonctionnel-v1.2.md` pour toute référence future.
> **Scope :** vision, modèle conceptuel, cascades de priorité, feuille de route des slices.
> **Ce document ne décrit pas l'implémentation** — chaque slice (2a, 2b, 2c, …) a son propre design doc qui référence ce chapeau.

---

## §1 — Principe et diagnostic

L'application Carto ECP v1.2 a été développée sous l'hypothèse fausse suivante :

> `1 snapshot = 1 ZIP = 1 vue complète du réseau ECP`.

Cette hypothèse est structurellement erronée :

- Le réseau ECP est composé d'Endpoints, Component Directories (CD), Brokers et Business Applications, répartis entre RTE et ses partenaires TSOs européens.
- Chaque composant possède sa propre base de données interne, dont on peut extraire un dump ZIP.
- **Aucun composant n'a la vue complète du réseau à lui seul** : un CD voit les Endpoints qu'il gère, un Endpoint voit les partenaires avec qui il communique, un Broker voit les flux qu'il route.
- Pour reconstruire la vraie carte, il faut agréger plusieurs dumps provenant de composants différents.

**Nouvelle métaphore (v2.0) :** *la carte est vivante et cumulative, alimentée par des imports successifs* — chaque upload enrichit ou met à jour la connaissance globale du réseau, sans jamais écraser l'historique.

---

## §2 — Lexique

| Terme | Définition |
|---|---|
| `Import` | Un dump ZIP uploadé. Métadonnée : fichier, `uploadedAt`, `effectiveDate`, `sourceDumpTimestamp`, `envName`, `dumpType`, label, utilisateur. Un import conserve **intacte** sa contribution (pas d'écrasement). |
| `ImportedComponent` | Contribution brute d'un import sur un EIC donné (ligne par (`importId`, `eic`)). |
| `ImportedPath` | Contribution brute d'un import sur une relation. Identifié par la clé à 5 champs (§5). |
| `ComponentOverride` | Surcharge admin globale par EIC, **cross-env**, avec effet rétroactif sur tous les imports. |
| `EntsoeEntry` | Ligne de l'annuaire EIC ENTSO-E embarqué (figé, rafraîchi manuellement par l'admin). |
| `Registry RTE` | Overlay JSON existant (`packages/registry/eic-rte-overlay.json`) — source de vérité pour les composants RTE et quelques partenaires connus. |
| `GlobalComponent` | **Vue calculée à la lecture** (non stockée) — résultat de l'agrégation d'un EIC à une date de référence donnée, dans un env donné. |
| `GlobalEdge` | **Vue calculée à la lecture** (non stockée) — edge affiché sur la carte, agrégation par `(fromEic, toEic)` avec détection MIXTE si plusieurs process. |
| `envName` | Frontière d'agrégation (OPF, PROD, PFRFI…). Axe first-class sur les imports. |
| `uploadedAt` | Horodatage serveur à l'upload. Immutable. Usage **audit uniquement**. |
| `sourceDumpTimestamp` | Horodatage extrait du nom de fichier ECP (`{EIC}_YYYY-MM-DDTHH_MM_SSZ.zip`). Nullable si pattern absent. |
| `effectiveDate` | **Date pilotante.** Éditable par l'admin. Default à la création = `sourceDumpTimestamp ?? uploadedAt`. Usage : timeline + latest-wins. |
| `refDate` | Date de référence d'une requête carte (default = `now`). Seuls les imports avec `effectiveDate ≤ refDate` sont inclus dans le calcul. |

---

## §3 — Modèle conceptuel

```
Import (1) ────< (N) ImportedComponent
   │                     (+ ImportedComponentUrl)
   ├──< (N) ImportedPath
   ├──< (N) ImportedMessagingStat
   └──< (N) ImportedAppProperty

ComponentOverride   (1 par EIC, cross-env, éditable admin)
EntsoeEntry         (1 par EIC, cross-env, figé, refresh manuel)
Registry RTE        (fichier JSON, figé, éditable admin en 2e)

GlobalComponent(eic, env, refDate) =
  cascade 5 niveaux (§4) entre :
    ComponentOverride[eic]
  + EntsoeEntry[eic]
  + Registry[eic]
  + LatestWins( ImportedComponent où eic = X
                AND import.envName = env
                AND import.effectiveDate ≤ refDate )
  + Default

GlobalEdge(env, refDate) =
  agrégation par (fromEic, toEic) de :
    LatestWins sur clé 5 champs (§5) de
      ImportedPath où import.envName = env
      AND import.effectiveDate ≤ refDate
```

**Invariant clé :** `GlobalComponent` et `GlobalEdge` ne sont **jamais persistés**. Ils sont calculés à chaque requête. Conséquence : changement de registry / overrides / nouvel import → effet immédiat et rétroactif, sans invalidation de cache.

---

## §4 — Cascade de priorité (5 niveaux, par champ)

Pour chaque champ affichable d'un composant (`displayName`, `lat`, `lng`, `country`, `organization`, `type`, `tagsCsv`, `notes`, `email`, `phone`, `personName`, `networksCsv`, `urls`), le système applique la cascade suivante **champ par champ** (pas record-par-record) :

| Niveau | Source | Écrase tout ce qui suit ? |
|---|---|---|
| 1 | `ComponentOverride.<field>` (si non-null) | ✅ absolu |
| 2 | `EntsoeEntry.<field>` (si non-null) | ✅ si 1 absent |
| 3 | `Registry RTE overlay.<field>` (si non-null) | ✅ si 1-2 absents |
| 4 | `ImportedComponent.<field>` avec `effectiveDate` max parmi les imports éligibles (si non-null) | ✅ si 1-3 absents |
| 5 | Default (placeholder « EIC brut », coords centre Europe) → flag `isDefaultPosition = true` sur le `GlobalComponent` | dernier recours |

**Exemple :** un EIC `10XAT-APG------Z` (APG autrichien) :
- Pas de `ComponentOverride` → niveau 1 skippé
- Présent dans `EntsoeEntry` avec `displayName="APG"`, `country="AT"`, `organization="Austrian Power Grid"` → niveaux 2 gagnent ces champs
- Pas dans le registry RTE → niveau 3 skippé
- Import d'un endpoint RTE mentionne cet EIC avec `lat=48.2`, `lng=16.4`, `email="ops@apg.at"` → niveau 4 fournit ces 3 champs
- `GlobalComponent` final = `{ displayName: "APG", country: "AT", organization: "Austrian Power Grid", lat: 48.2, lng: 16.4, email: "ops@apg.at", isDefaultPosition: false }`

**Cas du `type` (ENDPOINT / COMPONENT_DIRECTORY / BROKER / BA) :** surchargable (cascade complète). Utile si un broker est mal détecté par le parser.

**Cas du `isDefaultPosition` :** `true` ssi les `lat/lng` finales viennent du niveau 5. Sert de hint visuel pour le badge UI « position par défaut » (arrive en 2f).

---

## §5 — Règles d'agrégation des paths

**Clé d'identité** d'un `ImportedPath` :

```
(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)
```

- `direction` (IN/OUT) **n'est pas dans la clé** → elle est recalculée au rendu vs `rteEicSet`.
- `process` n'est pas dans la clé non plus → si deux imports disent deux process différents pour la même clé 5-champs, latest-wins s'applique.

**Dédup inter-imports :** si deux `ImportedPath` (de deux imports différents) partagent la même clé 5-champs, on garde **une seule entrée logique** ; les attributs **mutables** (`validFrom`, `validTo`, `isExpired`, `process`) viennent de l'import avec `effectiveDate` max.

**Pas de tri canonique du pair** : si dump A décrit `X → Y` et dump B décrit `Y → X`, ce sont **deux clés distinctes** stockées séparément. Au rendu, l'agrégation par `(fromEic, toEic)` les collapsera sur le même edge visuel. Choix pragmatique : évite les bugs de normalisation tant que le format exact des dumps CD/Broker n'est pas connu.

**Wildcards (`senderEic = '*'`) :** stockés dans `ImportedPath` (valeur informative, audit possible), **exclus du rendu carte** (pas de nœud `*`).

**Règle métier cumulative :** les paths non-contradictoires s'additionnent. Exemple : dump A apporte path P1 entre X et Y (process A06), dump B apporte path P2 entre X et Y (process A07) — **les deux coexistent** car ils ont des clés 5-champs différentes (messageType différent), et l'edge `(X, Y)` est marqué `MIXTE` au rendu.

---

## §6 — Frontière d'environnement

- **Imports** scopés par `envName` (`OPF`, `PROD`, `PFRFI`…) — un champ obligatoire à l'upload.
- **Rendu carte** scopé par env → un env actif à la fois dans l'UI, sélecteur dans le header.
- **Overrides / Annuaire ENTSO-E / Registry RTE** = **globaux** (cross-env). Le même EIC `10XAT-APG------Z` a la même surcharge admin quel que soit l'env où il apparaît.
- Pas de fusion entre envs : `OPF + PROD` ne donnent **pas** une troisième carte combinée. Ce choix reflète la réalité métier — ce sont des réseaux physiques distincts.

---

## §7 — Feuille de route v2.0

| # | Slice | Livre | Prérequis | Statut |
|---|---|---|---|---|
| **2a** | Fondations data model + carte en entrée | Nouveau schéma Prisma, ingestion refondue, `GraphService` compute-on-read, route `/ = carte`, single-file upload temporaire sur `/upload`. Reset DB. | — | **à faire** |
| **2b** | Multi-upload + détection auto | Drag-drop N ZIPs, `DumpTypeDetector` avancé (ENDPOINT / CD / Broker), flow de validation manuelle si ambigu, dédup par hash ou (sourceEic, sourceDumpTimestamp), archivage brut. | 2a | à faire |
| **2c** | Admin : Imports + Composants (surcharge EIC) | Route `/admin`, section Imports (liste, renommer, delete, éditer `effectiveDate`, réassigner `dumpType`), section Composants (liste EICs + formulaire `ComponentOverride`), `/upload` déplacé dans admin. | 2a | à faire |
| **2d** | Timeline historique | Curseur/date-picker au-dessus de la carte, crans par `effectiveDate` des imports, recalcul du graph via `refDate`. | 2a (backend prêt dès 2a) | à faire |
| **2e** | Annuaire ENTSO-E + Registry admin + Zone danger | Upload fichier ENTSO-E, refresh manuel, admin registry JSON, 3 boutons purge (imports / overrides / total). | 2c | à faire |
| **2f** | Icônes différenciées + badges UX | Icônes par type (broker, CD, endpoint, BA), badge `isDefaultPosition`, badge « info vient de N imports » (à trancher), signalisation présence ENTSO-E. | 2a (utile), 2c/2e (complet) | à faire |

**Slices 2a + 2b + 2c = MVP v2.0 utilisable** (imports multiples, carte agrégée, surcharge manuelle). 2d/2e/2f = raffinements fonctionnels.

---

## §8 — Non-goals v2.0 initial

- Auth JWT / 3 rôles (reportée à slice ultérieure ; hors scope dev-local).
- Hot reload du registry RTE (rechargement au boot uniquement).
- Diff visuel entre deux imports côté UI.
- Export CSV ou génération de snapshots sortants.
- Format exact des dumps CD et Broker : parseurs à écrire **quand un backup sample sera disponible** (bloque une partie de 2b et 2f).
- Déploiement VM Nginx, Dockerfile, alerting.
- Notification utilisateur en temps réel des conflits (default silencieux, provenance consultable dans admin en 2c).

---

## §9 — Points à trancher (documentés, par slice)

| Point | Slice | Décision actuelle |
|---|---|---|
| Granularité timeline (continu vs crans par import) | 2d | par défaut **cran par import** (chaque `effectiveDate` distincte = un cran). À revoir si insuffisant. |
| Badge « info vient de N imports » sur un composant | 2f | à trancher au moment du dev UI. |
| Gestion conflits contradictoires | 2c | **silencieux par défaut** (latest-wins s'applique sans alerter) ; la provenance champ-par-champ est consultable dans l'admin. |
| Format dumps CD et Broker | 2b / 2f | **bloqué** jusqu'à obtention d'un backup sample. En 2a/2b, seul le format ENDPOINT (connu) est supporté. |
| Canonical pair sorting pour dédup paths | 2b+ | **non fait** en 2a (clé 5-champs sans tri). À reconsidérer si duplication excessive observée sur dumps CD/Broker. |

---

## §10 — Glossaire de compatibilité v1.2 → v2.0

| v1.2 | v2.0 | Notes |
|---|---|---|
| `Snapshot` | `Import` | Renommage + démétadonnéisé : `Import` ne contient que la métadonnée du dump, pas les composants/paths. |
| `Component (snapshotId, eic, …)` | `ImportedComponent (importId, eic, …)` | Toujours une ligne par `(dump, eic)` — contribution brute conservée. |
| `MessagePath (snapshotId, …)` | `ImportedPath (importId, …)` | Idem, contribution brute. |
| `GraphService.getGraph(snapshotId)` | `GraphService.getGraph(env, refDate?)` | Plus de snapshot actif, mais env actif + date de référence. |
| Résolution registry à l'ingestion (`RegistryService.resolveComponent` dans `NetworkModelBuilder`) | Résolution à la lecture (cascade 5 niveaux dans `GraphService`) | Changement de registry = effet rétroactif. |
| `isDefaultPosition` calculé et écrit en base à l'ingestion | `isDefaultPosition` calculé au rendu (niveau 5 de la cascade atteint) | Plus de donnée hardcodée Bruxelles en base. |
| Endpoint `POST /api/snapshots`, `GET /api/snapshots`, `GET /api/graph/:id` | Endpoints `POST /api/imports`, `GET /api/imports`, `GET /api/graph?env=X&refDate=ISO` | Endpoints legacy supprimés en 2a (dev-local, reset DB). |

---

## §11 — ADRs déclenchés par v2.0

Les ADRs suivants devront être écrits **en amont** des slices concernées (selon la règle `00-global.md`) :

- **ADR-023** — Modèle « raw + compute on read » vs matérialisation (lien slice 2a).
- **ADR-024** — Cascade de priorité 5 niveaux par champ (lien slice 2a).
- **ADR-025** — Clé d'identité d'un path à 5 champs sans tri canonique (lien slice 2a).
- **ADR-026** — `effectiveDate` pilotante, découplée de `uploadedAt` (lien slice 2a).
- **ADR-027** — Frontière `envName` comme axe first-class (lien slice 2a).
- **ADR-028** — Suppression des endpoints legacy `/api/snapshots*` sans compat (lien slice 2a).
- **ADR-029** — Annuaire ENTSO-E embarqué et refresh manuel (lien slice 2e).
- **ADR-030** — Stratégie de détection de type de dump (heuristique 2a, raffinée 2b) (lien slice 2a/2b).

Les ADRs seront posés au fil des slices.

---

## §12 — Références

- `carto-ecp-document-fonctionnel-v1.2.md` — document fonctionnel **v1.2 (obsolète)**, conservé pour historique.
- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2a-design.md` — design détaillé de la slice 2a (fondations).
- `CLAUDE.md` §Ingestion pipeline — description du pipeline v1.2 (valide jusqu'à la livraison de 2a).
- `.claude/rules/00-global.md` §Workflow — protocole specs → brainstorm → plan → exec → update-writer.
