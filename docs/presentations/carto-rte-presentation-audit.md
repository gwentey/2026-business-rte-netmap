# Carto ECP Network Map — Présentation & Audit fonctionnel

> Document cadre pour présentation PowerPoint (interne RTE).
> Date : 2026-04-24 · Version applicative : v3.0-alpha.21 · Branche : `main`
> Source : specs `docs/specs/`, ADRs `docs/adr/`, doc ECP officielle v4.16.0 (ENTSO-E / Unicorn Systems).

---

## Slide 1 — Le pitch en une phrase

**Carto ECP Network Map** est l'outil cartographique interne RTE qui transforme un dump technique d'un ECP (fichier ZIP de plusieurs dizaines de milliers de lignes CSV/XML) en **une carte d'Europe vivante**, où chaque flux métier entre RTE et ses partenaires TSO devient lisible en un coup d'œil.

> « Remplacer les exports Excel illisibles et les schémas Visio vieillissants par une visualisation interactive, historique et filtrable du réseau ECP RTE. »

---

## Slide 2 — Le problème qu'on résout

Aujourd'hui, comprendre **qui parle à qui, via quel processus métier, depuis quand**, dans le réseau ECP RTE, demande :

- d'ouvrir manuellement des dumps ECP (zips avec une dizaine de CSV + un XML MADES),
- de croiser à la main avec le référentiel ENTSO-E (~15 000 codes EIC),
- de connaître l'overlay RTE (14 applications métier, 6 endpoints RTE, 1 CD central),
- d'extraire les `MessagePath` actifs et de les rattacher à un processus (CORE, MARI, PICASSO, UK-CC, TP, VP…),
- de corriger à la main les coordonnées des tiers manquants.

**Résultat aujourd'hui** : c'est long, répétitif, illisible pour un non-expert, et impossible à partager en réunion.

**Résultat avec Carto ECP** : drag-drop du zip → 5 s plus tard → carte interactive zoomable avec les processus colorés.

---

## Slide 3 — Rappel : qu'est-ce que l'ECP ?

> Source : *ECP High Level Concept v4.16.0*, ENTSO-E / Unicorn Systems.

**ECP = Energy Communication Platform** — standard MADES ENTSO-E pour la messagerie sécurisée entre acteurs du secteur électrique européen (TSOs, market platforms, balancing services…).

Les 4 composants :

| Composant | Rôle |
|---|---|
| **Endpoint** | Interface utilisée par les applications métier pour envoyer/recevoir des messages (API Webservices / AMQP / file-based). |
| **Internal Broker** | Messagerie interne (Artemis) entre Endpoint et son application. |
| **Component Directory (CD)** | Annuaire central de tous les composants ECP connectés + leurs certificats + leurs message paths. |
| **Broker** | Messagerie inter-endpoints (transport indirect). |

**Ce que transporte un ECP** : un message binaire ou texte + métadonnées (sender, recipient, business type, message id, sending BA). RTE a **6 Endpoints** (CWE-RPN, INTERNET-EP1, INTERNET-EP2, PCN-EP1/2/3…) + **1 CD central** (INTERNET-CD) + 14 Business Applications qui poussent/consomment des flux (CORE Flow-Based, MARI, PICASSO, TP Transparency, VP, UK-CC…).

---

## Slide 4 — Ce que fait l'application (vue macro)

```
  ┌──────────────────┐   upload   ┌────────────────┐  parse  ┌───────────┐
  │  Dump ECP (.zip) │ ─────────▶ │  Ingestion API │ ──────▶ │  SQLite   │
  │  + .properties   │            │  (5 services   │         │  snapshot │
  └──────────────────┘            │   en cascade)  │         └─────┬─────┘
                                  └────────────────┘               │
                                                                   │
  ┌──────────────────────────────────────────────────────────┐     │
  │            Visualisation carte Europe (Leaflet)          │ ◀───┘
  │  • Nœuds colorés (endpoints RTE, CDs, brokers, tiers)    │
  │  • Arêtes courbes par process métier                     │
  │  • Timeline historique multi-import                      │
  │  • Panneau détail nœud/edge                              │
  │  • Admin (6 onglets) + overrides manuels                 │
  └──────────────────────────────────────────────────────────┘
```

Dev-local aujourd'hui (pas d'auth, pas de Docker). Pipeline d'ingestion **stateless** (5 services chainés : `ZipExtractor → CsvReader → XmlMadesParser → NetworkModelBuilder → SnapshotPersister`) — voir ADR RETRO-001.

---

## Slide 5 — Les 3 écrans de l'app

| Route | Écran | Rôle utilisateur |
|---|---|---|
| `/upload` | **Upload** | Déposer un ou plusieurs zips ECP, contrôler la détection automatique (type Endpoint/CD/Broker), renommer le label, corriger la date effective, supprimer les doublons. |
| `/map` | **Carte** | Explorer interactivement le réseau, filtrer par BA, remonter dans le temps via la timeline, ouvrir le panneau détail sur un nœud ou une edge. |
| `/admin` | **Admin** | 6 onglets : `Imports`, `Composants`, `Organisations`, `ENTSO-E`, `Registry RTE`, `Zone danger`. |

Header global `CARTO ECP · RTE` + sélecteur d'environnement (OPF / PFRFI / PROD…) dans le bandeau top. Sub-header par page avec breadcrumb et actions contextuelles (Refresh / Export CSV / Upload).

---

## Slide 6 — Fonctionnalité : l'Upload (slice 3a / batch 3b)

**Ce qu'on fait** : drag-drop d'un `.zip` ECP + son fichier `<EIC>-configuration.properties` (exporté via *Admin ECP > Settings > Runtime Configuration > Export Configuration*).

**Ce qu'on voit** :

1. **Dropzone animée** (spin 24 s, accepte `.zip` et `.properties`, refuse le reste).
2. **Table de batch** : une ligne par fichier déposé avec détection auto :
   - type détecté (`Endpoint` / `CD` / `Broker`) via heuristique v2 (signatures CSV, ADR-031),
   - EIC source extrait du fichier `component_directory.csv`,
   - label éditable, envName éditable (ex. `OPF`, `PFRFI`, `PROD`),
   - effectiveDate (découplée de `uploadedAt`, ADR-026),
   - signalement doublons (même EIC + même envName + même effectiveDate) avec checkbox *Remplacer*.
3. **Bouton** `Importer tout` → l'API reçoit chaque fichier, exécute le pipeline, persiste un snapshot SQLite par fichier, **le zip est archivé** dans `storage/snapshots/<uuid>.zip`.
4. **Summary final** : compteurs (✅ succès / ❌ erreurs / ⚠️ warnings non bloquants, ADR RETRO-002) + CTA `Voir sur la carte →`.

**Sécurité à l'ingestion** (à vendre fort en réunion) : 3 CSVs sont **explicitement exclus de la lecture mémoire** (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` = clés privées + inventaire interne — voir ADR RETRO-003). Les `AppProperty` sensibles (regex `password|secret|keystore.password|privateKey|credentials`) sont filtrées avant persistance.

---

## Slide 7 — Fonctionnalité : la Carte (slice 4e, refonte design 5a–5e)

**Fond de carte** : CartoDB Dark Matter (override `VITE_TILE_URL` possible si blocage firewall).

### Les 5 types de nœuds

| Kind | Icône Lucide | Signification |
|---|---|---|
| `RTE_ENDPOINT` | ⚡ rouge | Endpoint opéré par RTE (6 sur PFRFI). |
| `RTE_CD` | 🌐 rouge foncé | Le CD central RTE (`INTERNET-CD`, 17V000002014106G). |
| `BROKER` | 🔀 noir | Broker inter-endpoints. |
| `EXTERNAL_CD` | 🌐 gris foncé | CD d'un TSO peering avec RTE (REE, Swissgrid, Elia, Tennet…). |
| `EXTERNAL_ENDPOINT` | ⚡ gris | Endpoint d'un tiers. |

Un badge ⚠️ orange est ajouté si `isDefaultPosition=true` (géocodage manquant — fallback Bruxelles).

### Les arêtes (edges)

- Une edge par paire `(fromEic, toEic)` — agrégation de tous les `MessagePath` de ce couple (ADR RETRO-009).
- **Couleur = processus métier** :

| Processus | Couleur |
|---|---|
| TP (Transparency Platform) | cyan |
| CORE (Flow-Based Allocation) | violet |
| MARI (balancing aFRR) | vert |
| PICASSO (balancing mFRR) | jaune |
| UK-CC (UK cross-border) | orange |
| VP (Virtual Power Plant) | rose |
| MIXTE (≥ 2 process sur la même paire) | gris |
| UNKNOWN | gris clair |

- **Trait plein** si `isRecent = true` (`lastMessageUp < 24 h relatif au snapshot`, ADR RETRO-010 — reproductible historiquement, pas un `Date.now()`).
- **Trait pointillé** `6 6` si inactif.
- Courbes Leaflet-curve (ADR RETRO-014) avec offset radial Paris/La Défense pour disperser les nœuds superposés (ADR RETRO-015).

### Overlays top-right

3 cartes empilées dans le coin haut-droit :
1. **Toggle hiérarchie CD** — affiche/masque les liens CD↔CD (peering inter-TSOs).
2. **Filtre Business Application** — multi-select des 14 applis RTE.
3. **Actions icônes** — recentrer, snapshot PNG (disabled TODO), etc.

### Legend bottom

Swatches par process + légende des kinds de nœuds + compteur total d'edges affichées.

### États UI

- **Empty** : aucun snapshot actif, illustration + CTA vers `/upload`.
- **Loading** : spinner + skeleton.
- **Error** : bannière rouge + bouton `Réessayer`.

---

## Slide 8 — Fonctionnalité : la Timeline (slice 3c)

**Visible** dès qu'on a ≥ 2 imports distincts sur l'environnement actif.

**Principe** : un curseur horizontal en bas de la carte. Chaque tick = un `effectiveDate` d'import. On déplace le curseur, la carte se recalcule pour ne prendre que les imports dont `effectiveDate <= dateCurseur`.

**Position max = "maintenant"** (aucun filtre temporel).

Bouton `Retour au présent` pour reset. **La position n'est pas persistée** entre sessions (ADR RETRO-018 — Zustand `partialize` sur `activeSnapshotId` uniquement).

**Pourquoi c'est important** : on peut répondre à "est-ce que le lien CORE entre RTE et Amprion existait déjà en 2024 ?" sans exporter manuellement les dumps d'époque. Un futur audit RGPD ou ACER peut remonter l'état du réseau à une date donnée en 3 clics.

---

## Slide 9 — Fonctionnalité : le Detail Panel (slice 3b)

Panneau latéral fixe 400 px qui s'ouvre au clic sur un nœud ou une edge. Sélection exclusive (cliquer un autre élément ferme le précédent).

### Fiche nœud

- **Identité** : EIC (en `JetBrains Mono`, copiable), kind, displayName, organizationName.
- **Localisation** : pays (drapeau), coordonnées lat/lng, badge `⚠ Position par défaut (Bruxelles)` si applicable.
- **Réseau technique** : liste `networks` (subnets ECP), `natEnabled` (bool), URL `homeComponentDirectoryPrimaryUrl`.
- **Processus** : liste des process métier portés par ce nœud (swatches colorés).
- **Timestamps fr-FR** : dernier `lastMessageUp`, `uploadedAt`.
- **Business Applications** : pour un endpoint RTE, liste des BA + criticité (`Critical` / `Major` / `Normal`).

### Fiche edge

- **Processus** principal + message types (badges).
- **Direction** : `IN` (message entrant RTE) / `OUT` (sortant) / `BIDI` (dans les deux sens) — calculé via l'ensemble autoritatif des EIC RTE (ADR RETRO-005), pas un heuristique `17V…`.
- **EIC src/dst** avec liens cliquables vers les nœuds correspondants.
- **Transports** : direct / indirect via broker (lequel).
- **Statut** : actif / inactif + `lastMessageUp` + plage `validFrom → validTo`.
- **Message types** : liste exhaustive des `messageType` agrégés sur la paire (utile pour debug d'une BA).

---

## Slide 10 — Fonctionnalité : l'Admin (slice 3d → 5d)

**6 onglets** accessibles sur `/admin`.

### 1. `Imports`

Tableau de tous les imports faits (tous environnements confondus).
11 colonnes : Date / Fichier / EIC / Type / Label / EffectiveDate / Props / Stats / Opérateur / État / Actions.
Toolbar : barre de recherche + filtre *Type de dump* + **Export CSV** (client-side) + **Bouton Upload**.
Modales : édition label/date, suppression avec confirmation.

### 2. `Composants`

Vue dense de tous les composants connus (agrégés depuis tous les snapshots).
Colonnes : EIC / DisplayName / Organisation / Pays / Kind / Badges.
Badges :
- `✓ surcharge active` si un override existe sur cet EIC,
- `⚠ Manquant` rouge si `country = null` et org connue → cliquable → pré-remplit la modale de création d'organisation.

Modales : `ComponentConfigModal` (lecture seule — propriétés `.properties` d'origine) et `ComponentOverrideModal` (édition des coords/nom affiché).

### 3. `Organisations`

CRUD des organisations (TSOs partenaires, sociétés tierces).
Import / Export JSON.
Badge `userEdited=true` pour distinguer une entrée manuelle d'une entrée auto-seedée.
Normalisation stricte du nom (lowercase + trim + espaces collapse) pour éviter les doublons `Amprion GmbH` / `amprion gmbh`.

### 4. `ENTSO-E`

Upload du CSV officiel ENTSO-E (format `X_eicCodes.csv`, ~15 000 codes, délimiteur `;`, BOM UTF-8, colonnes `EicCode;EicLongName;EicDisplayName;MarketParticipantIsoCountryCode;EicTypeFunctionList`).
2 cartes statut : nombre d'entrées actuellement en base, date du dernier upload.

### 5. `Registry RTE`

Éditeur visuel de l'**overlay RTE** (`packages/registry/eic-rte-overlay.json`) :
- **ProcessColorsEditor** — palette des 8 processus RTE avec hex éditables en place (attention : duplication `apps/web/src/lib/process-colors.ts` à synchroniser — ADR RETRO-016).
- **RteEndpointsTable** — table des 6 EIC RTE + 1 CD, checkboxes de sélection.
- Banner info sur l'usage de la palette.

### 6. `Zone danger`

3 cartes rouges de purge :
- **Purger imports** (mot-clé confirm : `PURGER`)
- **Purger overrides** (mot-clé confirm : `SUPPRIMER OVERRIDES`)
- **Purger tout** (mot-clé confirm : `RESET TOTAL`)

Bouton `Confirmer` désactivé tant que l'utilisateur n'a pas tapé exactement le mot-clé. Pas de Ctrl+Z : l'action est définitive.

---

## Slide 11 — Fonctionnalité : les Overrides (slice 3d → ADR-036)

**Problème réel** : l'ENTSO-E EIC registry n'a pas de coordonnées géo pour tous les codes. Les tiers (petites coops, traders, nouveaux BRP) arrivent souvent sans `country` ni lat/lng → nœud planté à Bruxelles (fallback).

**La cascade de résolution** (4 niveaux, ADR-024) :

```
  Override RTE manuel  →  ENTSO-E CSV  →  Overlay RTE  →  Bruxelles (fallback)
       (priorité 1)        (priorité 2)   (priorité 3)     (priorité 4)
```

**Ce qu'on peut surcharger par EIC** :
- latitude (-90 à 90, validé),
- longitude (-180 à 180, validé),
- country (ISO-2),
- displayName.

API : `PUT /api/overrides/:eic` (upsert) et `DELETE /api/overrides/:eic` (rétabli la cascade).

Impact carte : le nœud se réaffiche à sa nouvelle position au rafraîchissement, et le badge `✓ surcharge active` apparaît dans le panneau détail + dans l'onglet Composants.

---

## Slide 12 — Ce que l'app **apporte par rapport à la GUI ECP native**

L'ECP Endpoint / CD fournit déjà un dashboard web. Mais :

| Dimension | GUI ECP native | Carto ECP Network Map |
|---|---|---|
| **Périmètre** | 1 Endpoint à la fois | **Vue globale** : tous les endpoints RTE + tiers peering |
| **Géographie** | Liste textuelle | **Carte d'Europe** avec nœuds positionnés |
| **Processus métier** | Implicite (faut lire les `messageType`) | **Classification + couleurs** (TP, CORE, MARI, PICASSO, UK-CC, VP) |
| **Historique** | Dashboard temps-réel seulement | **Timeline N imports** + reproductibilité historique (ADR RETRO-010) |
| **Partage** | Compte technique requis sur chaque ECP | **Dump ZIP partageable**, import local, pas de creds |
| **Filtres métier** | Aucun | **Par BA / par process / par env** (OPF, PFRFI, PROD) |
| **Correction données** | Impossible (données vendor-managed) | **Overrides RTE** (coords + noms des tiers) |

**Notre valeur ajoutée** : on croise les dumps ECP avec l'**overlay métier RTE** (14 BA, palette de process, criticité, peering peers) que la GUI vendor ne connaît pas.

---

## Slide 13 — Stack technique (à flasher en 1 slide)

```
┌─────────────────────────────────────────────────────────────────┐
│  apps/api  — NestJS 10 + Prisma 5 + SQLite                      │
│    Ingestion ZIP : adm-zip + csv-parse + fast-xml-parser        │
│    Validation : zod                                             │
│    Sécurité : helmet + @nestjs/throttler + filtrage CSV/props   │
│    Tests : Vitest + unplugin-swc (décorateurs)                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  apps/web  — React 18 + Vite 5 + Leaflet 1.9 + Zustand          │
│    Cartographie : react-leaflet + leaflet-curve                 │
│    Design "carto-rte" dark custom (ADR-040)                     │
│    Polices : Nunito Sans + JetBrains Mono (data)                │
│    Tests : Vitest (unit) + Playwright (E2E)                     │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  packages/shared    — DTOs partagés (TS pur, pas de build)      │
│  packages/registry  — ENTSO-E CSV (~15k) + overlay RTE JSON     │
└─────────────────────────────────────────────────────────────────┘

Monorepo : pnpm workspaces 9+ · Node ≥ 20.11 · TS 5.5
Commande one-liner : pnpm dev  →  API :3000 + Web :5173
Tests actuels : 159/159 verts
```

---

## Slide 14 — Ce que l'app **ne fait pas encore** (transparence)

Hors scope aujourd'hui — documenté explicitement dans le spec de slice 1 :

- ❌ **Pas d'authentification** (dev-local only).
- ❌ **Pas de temps réel** : le dump est une photo à `uploadedAt`. Zéro WebSocket, zéro push.
- ❌ **Pas d'alerting** (ni Slack, ni mail, ni Teams).
- ❌ **Pas de déploiement prod** : pas de Dockerfile, pas de CI/CD, pas de reverse-proxy Nginx.
- ❌ **Pas de diff view** (comparer 2 snapshots côte-à-côte).
- ❌ **Pas de hot-reload de l'overlay RTE** : modifier `eic-rte-overlay.json` demande un restart backend.
- ❌ **Pas d'export PNG/SVG** de la carte (bouton UI en disabled, `TODO`).
- ❌ **Le filtre BA côté store Zustand existe mais n'est pas exposé dans l'UI carte** (dette alpha.17).

**Dette technique visible** : `pnpm lint` est cassé au niveau root (ESLint flat config non wiré — ADR-020), duplication palette process JSON↔TS (ADR RETRO-016), DB SQLite gitignorée pas rejouable sans les fixtures.

---

## Slide 15 — Les évolutions possibles (le vrai sujet de vente)

### Axe 1 — Monitoring **live** des ECP RTE ⭐⭐⭐

**Ce qu'on sait déjà** (source : *ECP Functional Specification §4.5.2 Dashboard* + *§4.5.3 Message Statistics* + *ECP Operational Manual §6.1 Health Check*) :
chaque Endpoint ECP RTE expose nativement :

- un endpoint **Readiness Actuator** : `GET /ECP_MODULE/actuator/readiness` → `READY` / `NOT_READY` (rafraîchi toutes les 5 s).
  Conditions : *registered · certificat non expiré · pas en reload · connecté au broker interne · synchronisé avec le CD · ≥ 1 message path valide*.
- un **Monitoring Data** via l'API (méthode `Get Monitoring Data`).
- des **Message Statistics** par Broker/Endpoint peer : `connected`, `sum received`, `last received`, `sum sent`, `last sent`.
- un **Connectivity Test** (méthode API `Test Connectivity`) qui renvoie `CONNECTED`.

**Ce qu'on peut en tirer dans Carto ECP** :

1. **Pastille verte/rouge live sur chaque nœud RTE** — poll toutes les 30 s du Readiness Actuator.
2. **Tooltip santé** au survol : "Certificate expire dans 12 j ⚠ / Dernier message il y a 3 min / CD sync OK".
3. **Edges qui clignotent** quand un message passe (via log `ecp.log` tail ou webhook custom côté ECP). Traffic-map temps réel.
4. **Vue BA (Business Application)** — filtrer par appli métier et voir **en temps réel** quelles BA ont une edge rouge :
   > « **ALERTE** : l'appli **CORE Flow-Based** n'a plus reçu de message de Amprion depuis 14 min — ECP `INTERNET-EP1` : Readiness = NOT_READY (broker déconnecté). »
5. **Heatmap de criticité** : superposer la criticité BA (Critical / Major / Normal, déjà dans l'overlay RTE) sur la carte.

### Axe 2 — Alerting et incidents

- **Webhook Teams / Slack** dès qu'un Readiness passe à `NOT_READY` > 5 min.
- **Calendrier d'incidents** : agréger les périodes où un ECP/edge a été rouge, afficher un timeline heat-map par mois.
- **SLO / SLA par BA** : "CORE-FB doit être UP 99,9 %" → calculer le respect à partir de l'historique Readiness.
- **Intégration ticketing** : bouton "Créer un incident ServiceNow" avec pre-fill (EIC, timestamps, last error log).

### Axe 3 — Diff & conformité

- **Diff view** entre 2 snapshots : "entre le 2025-12-01 et aujourd'hui, 3 nouveaux peerings, 2 supprimés, 5 message paths modifiés".
- **Export conformité** : PDF horodaté signé "état du réseau ECP RTE au 2026-04-24 14:32" pour audit ACER / RTE DSI sécurité.
- **Alerte drift** : si la config `eic-rte-overlay.json` diverge de la réalité observée dans les dumps (ex: un ECP RTE a été renommé sans MAJ de l'overlay).

### Axe 4 — Vue orientée Business Application

Aujourd'hui, on colore les edges par **process** ECP. Demain, faire l'inverse :

- **Une vue "mon appli métier"** : on choisit `CORE Flow-Based`, la carte ne garde que les endpoints/edges pertinents + heat-bar temps-réel des messages sent/received.
- **Par BA, afficher** :
  - nombre de partenaires TSO impliqués,
  - volume de messages 24h / 7j / 30j (via `Message Statistics`),
  - santé composite (moyenne Readiness des ECP qui la portent),
  - plage horaire d'activité (un flux CORE actif 24/7 vs un flux VP actif juste en heures de marché).

### Axe 5 — Connectivity matrix

- Page `/connectivity` : matrice N × N (endpoints RTE × endpoints tiers) avec case verte/jaune/rouge.
- Le Connectivity Test ECP (`POST /connectivity-test`) peut être déclenché en batch depuis Carto → rapport visuel en 2 min.
- Utile en **préparation de go-live** d'un nouveau partenaire (valider que tous les flux attendus passent avant mise en prod).

### Axe 6 — Certificats et alerting d'expiration

L'ECP trace les certificats (endpoint + root CA) avec date d'expiration.
→ Vue `/certificates` : timeline Gantt des expirations à venir.
→ Alerte J-30 / J-7 / J-1 sur un certif qui va expirer.
→ Criticité visuelle : "le certif root de REE expire dans 12 j et 4 BA en dépendent".

### Axe 7 — Intégrations et ouvertures

- **Authentification Azure AD / OIDC** (prérequis déploiement RTE).
- **Déploiement Kubernetes** (helm chart, OpenShift interne RTE).
- **API publique** pour d'autres outils RTE internes (DSI, Exploitation).
- **Export OpenTelemetry** des métriques (→ Grafana / Datadog existants).
- **Mobile friendly** : une PWA tablette pour l'astreinte.
- **Internationalisation** FR / EN (collègues ENTSO-E en visio).

---

## Slide 16 — Roadmap proposée (ordre logique)

| Horizon | Lot | Valeur | Effort |
|---|---|---|---|
| **Court terme (v3.1)** | Auth Azure AD + Docker + CI GitHub + filtre BA exposé UI | Déployable interne RTE | 2–3 semaines |
| **Court terme (v3.2)** | Diff snapshots + Export PNG/PDF + hot-reload overlay | Conformité + ergonomie | 1–2 semaines |
| **Moyen terme (v4.0)** | Polling Readiness Actuator + pastille live + tooltip santé | Gain monitoring majeur | 3–4 semaines |
| **Moyen terme (v4.1)** | Vue BA + heatmap criticité + matrice connectivity | Valeur DSI / Exploit | 3 semaines |
| **Long terme (v5.0)** | Alerting Teams/Slack + SLO par BA + incidents Gantt | Remplace Nagios partiel | 6+ semaines |
| **Long terme (v5.1)** | API publique + OpenTelemetry + mobile PWA | Écosystème RTE | 4+ semaines |

---

## Slide 17 — KPIs de succès (à mesurer en pilote)

- **Temps moyen pour répondre à "qui parle à qui avec tel TSO sur le process X ?"** : **< 30 s** (aujourd'hui : 10 min+ en Excel).
- **Taux d'erreurs de routing identifiées proactivement** : +50 % vs détection passive par les BA.
- **Diminution du TTR (time to resolve) incidents ECP** : cible **-40 %** grâce à la vue live.
- **Taux d'adoption** par les équipes Exploitation + DSI + MOE métiers : ≥ 3 squads en 6 mois.

---

## Slide 18 — Audit qualité : forces & points d'attention

### Forces (à vendre)

✅ **Architecture propre** : pipeline d'ingestion stateless 5 services + 40 ADRs documentés.
✅ **Sécurité à l'ingestion** : exclusion explicite des 3 CSVs sensibles + filtrage des AppProperty (whitelist, pas blacklist — ADR RETRO-003).
✅ **Reproductibilité historique** : `isRecent` relatif au snapshot, pas à `Date.now()` (ADR RETRO-010).
✅ **Design system cohérent** : refonte complète "carto-rte" dark, pas de Tailwind, pas de CSS modules dispersés (ADR-040).
✅ **Tests** : 159/159 verts, couverture ingestion critique couverte.
✅ **Documentation** : 22 specs fonctionnelles + 22 specs techniques + 40 ADRs + CHANGELOG par slice.

### Points d'attention (à corriger)

⚠ **Pas d'auth** → bloquant pour déploiement RTE. Priorité #1.
⚠ **Pas de CI** → tests ne tournent qu'en local, ESLint root cassé.
⚠ **Duplication palette process** (JSON overlay ↔ TS `process-colors.ts`) : risque de divergence visuelle.
⚠ **Résolution `packages/registry/` via `process.cwd()`** (ADR RETRO-013) : cassera en Docker sans variable d'env dédiée.
⚠ **Pas de `Dockerfile`** → déploiement manuel obligatoire.
⚠ **Filtre BA dans le store mais pas dans l'UI** → dette fonctionnelle visible.

### Dette courante acceptée

- Overlay RTE pas hot-reload (slice 1 explicite).
- SQLite gitignorée → pas de reprise d'état multi-machines.
- Pas de Storybook / catalogue UI — assumé par le design system custom global.

---

## Slide 19 — En conclusion

**Aujourd'hui** : un outil interne robuste qui fait gagner des heures à l'exploitation ECP + un vrai gain pédagogique pour expliquer le réseau RTE à des non-experts (managers, MOE, audit).

**Demain** : une plateforme de **supervision temps réel du réseau ECP RTE** — pastilles live, alerting, vue BA orientée métier, matrice de connectivité, conformité horodatée.

**Ce qui est déjà prêt** pour demain :

- Le modèle de données supporte l'historique (timeline + reproductibilité).
- L'overlay RTE embarque déjà la criticité BA.
- L'API NestJS est prête à accepter des endpoints supplémentaires (`/live`, `/health`, `/alerts`).
- Le design system dark est scalable (cards, badges, toasts, modals déjà dispos).

**Ce qui manque pour demain** :

1. Auth + déploiement.
2. Un worker qui poll les Readiness Actuators (ou webhook ECP → API).
3. L'exposition UI des données déjà collectées (filtre BA, heatmap critique).

> « Carto ECP est aujourd'hui une **photo exploratoire**. Avec 3 mois de roadmap, c'est **la tour de contrôle du réseau ECP RTE**. »

---

## Annexe A — Glossaire rapide pour la réunion

| Sigle | Signification |
|---|---|
| **ECP** | Energy Communication Platform — messagerie ENTSO-E |
| **CD** | Component Directory — annuaire central ECP |
| **EIC** | Energy Identification Code — identifiant unique ENTSO-E (~15 000 enregistrés) |
| **MADES** | Multi-Agent Dispatching Exchange Service — standard XML ENTSO-E |
| **BA** | Business Application — appli métier RTE (CORE, MARI, PICASSO, TP, VP, UK-CC…) |
| **TSO** | Transmission System Operator — gestionnaire de réseau de transport |
| **RTE** | Réseau de Transport d'Électricité — le TSO français |
| **PFRFI / OPF / PROD** | environnements ECP RTE (PFRFI = *Pre-Production FR Integration*) |
| **Readiness Actuator** | endpoint de santé de l'ECP (spring-boot), poll toutes les 5 s |
| **Snapshot** | une instance d'import dans notre app (= un `.zip` ingéré à un instant T) |
| **Override** | surcharge manuelle d'un champ de composant (coords, nom, pays) |

---

## Annexe B — Ressources pour aller plus loin

- `CLAUDE.md` — conventions, friction points
- `docs/specs/web/refonte-design-carto-rte/` — spec active du design
- `docs/specs/api/ingestion/` — détails du pipeline
- `docs/adr/` — 40 ADRs (décisions techniques)
- `docs/officiel/` — doc ECP v4.16.0 (HLC, Functional Spec, System Design, Op Manual)
- `CHANGELOG.md` — historique par slice (alpha.1 → alpha.21)
