# Slice 2a — Fondations data model + carte en entrée

> **Statut :** design validé (2026-04-19), prêt pour `/superpowers:write-plan`.
> **Réfère :** [`2026-04-19-carto-ecp-v2-chapeau.md`](./2026-04-19-carto-ecp-v2-chapeau.md) pour vocabulaire, cascades et feuille de route.
> **Branche cible :** `feat/v2-slice-2a-fondations` (à créer depuis `main`).

---

## §1 — Objectif

Livrer les **fondations data model v2.0** :
1. Remplacer le schéma Prisma `Snapshot/Component/MessagePath` par le modèle brut `Import/ImportedComponent/ImportedPath` + tables vides `ComponentOverride`/`EntsoeEntry`.
2. Refondre le pipeline d'ingestion pour produire des données **brutes** (pas de résolution cascade à l'écriture).
3. Refondre le `GraphService` pour calculer `GlobalComponent`/`GlobalEdge` à la lecture (cascade 5 niveaux, dédup paths, agrégation edges).
4. Faire de `/` la page d'entrée (carte, même vide). Conserver `/upload` en single-file comme entrée temporaire.

**Non-goals 2a** (rappel du chapeau §7) : multi-upload (2b), panneau admin (2c), timeline slider (2d), ENTSO-E/registry admin (2e), icônes (2f).

---

## §2 — Scope livré

| # | Livrable | Détail |
|---|---|---|
| 1 | Nouveau schéma Prisma + migration de reset | Voir §A. Tables vides `ComponentOverride`/`EntsoeEntry` créées (sans UI de peuplement). |
| 2 | Pipeline d'ingestion refondu | Voir §B. `ImportBuilder` remplace `NetworkModelBuilder`. `RawPersister` remplace `SnapshotPersister`. |
| 3 | `GraphService` compute-on-read | Voir §C. Même shape de réponse (`GraphResponse`) pour ne pas casser le front au-delà du strict nécessaire. |
| 4 | Endpoints API v2.0 | `POST /api/imports`, `GET /api/imports`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`. Endpoints legacy supprimés. |
| 5 | Front refondu | Route `/ = carte`. `/map` en alias. `/upload` single-file conservé (lien dans header). Empty state. Sélecteur d'env. Store Zustand mis à jour. |
| 6 | Tests | TDD strict (unit + intégration + E2E smoke). Voir §F. |
| 7 | ADRs | ADR-023 à ADR-028 et ADR-030 (8 ADRs posés au fil du plan). |
| 8 | Mise à jour `CHANGELOG.md` | Entrée v2.0-alpha.1 (ou v0.2.0 selon SemVer Zelian en vigueur). |

---

## §A — Schéma Prisma

Remplacement **intégral** de `apps/api/prisma/schema.prisma` (hors `generator`/`datasource`). Reset complet de la DB via `prisma migrate reset --force`.

```prisma
model Import {
  id                    String   @id @default(uuid())
  envName               String
  label                 String
  fileName              String
  fileHash              String   // SHA256 du zip brut
  sourceComponentEic    String?  // Extrait du nom de fichier si pattern reconnu
  sourceDumpTimestamp   DateTime?  // Extrait du nom de fichier si pattern reconnu
  dumpType              String   // 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER'
  zipPath               String   // storage/imports/{id}.zip
  uploadedAt            DateTime @default(now())
  effectiveDate         DateTime // default = sourceDumpTimestamp ?? uploadedAt
  warningsJson          String   @default("[]")

  importedComponents    ImportedComponent[]
  importedPaths         ImportedPath[]
  importedStats         ImportedMessagingStat[]
  importedProps         ImportedAppProperty[]

  @@index([envName])
  @@index([envName, effectiveDate])
  @@index([fileHash])
}

model ImportedComponent {
  id                 String  @id @default(uuid())
  importId           String
  import             Import  @relation(fields: [importId], references: [id], onDelete: Cascade)
  eic                String
  type               String  // 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA'
  organization       String?
  personName         String?
  email              String?
  phone              String?
  homeCdCode         String?
  networksCsv        String?
  displayName        String?
  country            String?
  lat                Float?
  lng                Float?
  isDefaultPosition  Boolean @default(false)   // Hint : le parser n'a pas trouvé de coord
  sourceType         String  // 'XML_CD' | 'LOCAL_CSV'
  creationTs         DateTime?
  modificationTs     DateTime?

  urls               ImportedComponentUrl[]

  @@index([importId])
  @@index([eic])
  @@unique([importId, eic])
}

model ImportedComponentUrl {
  id                   String @id @default(uuid())
  importedComponentId  String
  importedComponent    ImportedComponent @relation(fields: [importedComponentId], references: [id], onDelete: Cascade)
  network              String
  url                  String

  @@index([importedComponentId])
}

model ImportedPath {
  id                     String   @id @default(uuid())
  importId               String
  import                 Import   @relation(fields: [importId], references: [id], onDelete: Cascade)
  receiverEic            String
  senderEic              String   // "*" autorisé, skippé au rendu
  messageType            String
  transportPattern       String   // 'DIRECT' | 'INDIRECT'
  intermediateBrokerEic  String?
  validFrom              DateTime?
  validTo                DateTime?
  isExpired              Boolean  @default(false)

  @@index([importId])
  @@index([receiverEic, senderEic])
  @@index([receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic], name: "idx_path_identity")
}

model ImportedMessagingStat {
  id                   String @id @default(uuid())
  importId             String
  import               Import @relation(fields: [importId], references: [id], onDelete: Cascade)
  sourceEndpointCode   String
  remoteComponentCode  String
  connectionStatus     String?
  lastMessageUp        DateTime?
  lastMessageDown      DateTime?
  sumMessagesUp        Int     @default(0)
  sumMessagesDown      Int     @default(0)
  deleted              Boolean @default(false)

  @@index([importId])
  @@index([importId, remoteComponentCode])
}

model ImportedAppProperty {
  id         String @id @default(uuid())
  importId   String
  import     Import @relation(fields: [importId], references: [id], onDelete: Cascade)
  key        String
  value      String

  @@index([importId])
}

model ComponentOverride {
  eic            String   @id
  displayName    String?
  type           String?
  organization   String?
  country        String?
  lat            Float?
  lng            Float?
  tagsCsv        String?
  notes          String?
  updatedAt      DateTime @updatedAt
}

model EntsoeEntry {
  eic            String   @id
  displayName    String?
  organization   String?
  country        String?
  function       String?
  refreshedAt    DateTime  // Écrit par refresh batch en 2e, null pour 2a (table vide)
}
```

**Notes schéma :**
- `ImportedComponent.lat/lng` deviennent **nullable** (contrairement à v1.2 où Bruxelles était écrit en dur). `isDefaultPosition=true` si l'import n'apporte pas de coord → c'est le niveau 5 de la cascade qui fournira le fallback au rendu.
- Pas de `@@unique` sur la clé 5-champs de `ImportedPath` car plusieurs imports du même env peuvent légitimement la dupliquer — la dédup est faite en **compute-on-read**, pas en contrainte SQL.
- Le `dumpType` dans `Import` n'est pas dérivable trivialement de `ImportedComponent` → stocké explicitement.

---

## §B — Pipeline d'ingestion refondu

```
POST /api/imports (multipart: file, envName, label, [dumpType])
  │
  ├─ Validation (zod) : file mime-type + taille + label + envName
  ├─ Extraction nom de fichier → { sourceComponentEic?, sourceDumpTimestamp? }
  │
  ├─ ZipExtractor (inchangé)
  │     → buffers des CSV autorisés ; filtrage des 3 fichiers sensibles inchangé
  │
  ├─ CsvReader (inchangé)
  │     → component_directory.csv, application_property.csv, messaging_statistics.csv, etc.
  │
  ├─ XmlMadesParser (inchangé)
  │     → parsing du blob XML présent dans component_directory.csv (si ENDPOINT dump)
  │
  ├─ DumpTypeDetector (NOUVEAU)
  │     Heuristique v2a :
  │       - Si component_directory.csv contient un blob XML MADES → 'ENDPOINT'
  │       - Sinon → 'COMPONENT_DIRECTORY' (BROKER pas détectable en 2a, fallback CD)
  │       - Si dumpType fourni dans le body → override manuel (priorité absolue)
  │
  ├─ ImportBuilder (remplace NetworkModelBuilder)
  │     Responsabilité : produire ImportedComponent[] + ImportedPath[] + ImportedMessagingStat[]
  │     à partir des parsers, SANS cascade registry.
  │
  │     Pour chaque composant extrait :
  │       - `eic` : identifiant brut du dump
  │       - `type` : 'BROKER' (trouvé via broker field) | 'COMPONENT_DIRECTORY' (si `ecp.componentCode` présent) | 'ENDPOINT' (default)
  │       - `displayName`, `organization`, etc. : valeurs brutes du CSV/XML ou null si absent
  │       - `lat`, `lng` : si CSV/XML fournit un champ de geocode → utilisé ; sinon null + `isDefaultPosition=true`
  │         (le Registry n'est PAS consulté à l'ingestion)
  │       - `sourceType` : 'XML_CD' ou 'LOCAL_CSV' selon provenance
  │
  │     Pour chaque path extrait :
  │       - Champs bruts (receiver, sender, messageType, transportPattern, intermediateBrokerEic)
  │       - `validFrom/validTo/isExpired` depuis XML
  │       - ⚠ PAS de `process` persisté : la classification `messageType → process` est
  │         appliquée par `GraphService` à la lecture (voir §C). Assure la rétroactivité
  │         sur changement de registry, cohérent avec la règle compute-on-read.
  │
  ├─ RawPersister (remplace SnapshotPersister)
  │     → écrit storage/imports/{newImportId}.zip (repackaging sans sensibles = conservé P3-1)
  │     → Prisma transaction :
  │         prisma.import.create({ data: { ...meta, effectiveDate } })
  │         prisma.importedComponent.createMany(...)
  │         prisma.importedPath.createMany(...)
  │         prisma.importedMessagingStat.createMany(...)
  │         prisma.importedAppProperty.createMany(...)  // filtre clés sensibles P2-2 conservé
  │     → rollback = cleanup zip disque (mécanique P3-6 conservée)
  │
  └─ Response : ImportDetail { id, envName, label, dumpType, effectiveDate, stats: { componentsCount, pathsCount }, warnings }
```

**Services supprimés ou renommés :**
- `NetworkModelBuilder` → supprimé, remplacé par `ImportBuilder`.
- `SnapshotPersister` → supprimé, remplacé par `RawPersister`.
- `RegistryService.resolveComponent` → supprimé (la résolution se fait désormais dans `GraphService`).
- `RegistryService.classifyMessageType` → **conservé** (appelé par `GraphService` au rendu, garantit la rétroactivité sur changement de registry).
- `RegistryService.getRteEicSet` → **conservé** (utilisé par `GraphService` au rendu pour calculer `direction`).
- `RegistryService.getMapConfig` → **conservé** (passé dans `GraphResponse`).

---

## §C — `GraphService` refondu (compute on read)

```ts
// apps/api/src/graph/graph.service.ts

async getGraph(env: string, refDate?: Date): Promise<GraphResponse> {
  const effectiveRefDate = refDate ?? new Date();

  const [imports, overrides, entsoe] = await Promise.all([
    this.prisma.import.findMany({
      where: { envName: env, effectiveDate: { lte: effectiveRefDate } },
      orderBy: { effectiveDate: 'asc' },  // Asc pour que latest wins naturellement
      include: {
        importedComponents: { include: { urls: true } },
        importedPaths: true,
        importedStats: true,
      },
    }),
    this.prisma.componentOverride.findMany(),
    this.prisma.entsoeEntry.findMany(),  // vide en 2a
  ]);

  // Étape 1 : agréger ImportedComponent par EIC, latest-per-field
  const componentsByEic = this.mergeComponentsLatestWins(imports);

  // Étape 2 : appliquer la cascade 5 niveaux
  const globalComponents = this.applyCascade(
    componentsByEic,
    new Map(overrides.map((o) => [o.eic, o])),
    new Map(entsoe.map((e) => [e.eic, e])),
    this.registry,  // niveau 3
  );

  // Étape 3 : agréger ImportedPath (clé 5-champs, latest-per-field sur mutables)
  //          + classifier process à la volée via registry.classifyMessageType
  const pathsByKey = this.mergePathsLatestWins(imports);  // produit MergedPath { ...champs, process (classifié maintenant) }

  // Étape 4 : construire edges (agrégation par (fromEic, toEic), MIXTE, direction vs rteEicSet)
  const edges = this.buildEdges(Array.from(pathsByKey.values()), imports, this.registry.getRteEicSet());

  // Étape 5 : bounds + mapConfig
  const nodes = Array.from(globalComponents.values());
  return { bounds: this.computeBounds(nodes), nodes, edges, mapConfig: this.registry.getMapConfig() };
}
```

**Sous-fonctions clés :**

- `mergeComponentsLatestWins(imports)` : pour chaque EIC, merge champ-par-champ en partant de l'import le plus ancien et en écrasant avec les plus récents si le nouveau champ est non-null.
- `applyCascade(componentsByEic, overrides, entsoe, registry)` : pour chaque EIC connu, applique niveau 1→5 et produit un `GlobalComponent`. Flag `isDefaultPosition=true` si niveau 5 atteint pour `lat/lng`.
- `mergePathsLatestWins(imports)` : groupe par clé 5-champs, latest-wins sur `validFrom/validTo/isExpired` ; `process` calculé à la volée via `registry.classifyMessageType(messageType)` sur le `messageType` du path retenu.
- `buildEdges(paths, imports, rteEicSet)` : skip wildcards, agrège par `(fromEic, toEic)`, détecte MIXTE, calcule `direction` et `isRecent` (via `ImportedMessagingStat` du latest import qui contient la stat pour la paire).

**Activity (`isRecent`) :** la logique v1.2 (threshold relatif à `snapshot.uploadedAt`) devient « relatif à l'`effectiveDate` max parmi les imports qui contribuent à la paire ». Plus robuste et cohérent avec la timeline future.

---

## §D — Endpoints API

| Méthode | Route | Body / Query | Réponse | Notes |
|---|---|---|---|---|
| `POST` | `/api/imports` | multipart : `file`, `envName`, `label`, `dumpType?` | `ImportDetail` | Heuristique auto + override manuel via `dumpType`. |
| `GET` | `/api/imports` | `?env=OPF` (optionnel, sinon tous envs) | `ImportSummary[]` | Trié par `effectiveDate` desc. |
| `DELETE` | `/api/imports/:id` | — | `204 No Content` | Cascade sur `ImportedComponent`, `ImportedPath`, etc. Zip sur disque supprimé. |
| `GET` | `/api/graph` | `?env=OPF` (requis), `&refDate=2026-04-19T12:00:00Z` (optionnel) | `GraphResponse` | `refDate` par défaut = now. 400 si env absent. |
| `GET` | `/api/envs` | — | `string[]` | Liste distincte des `envName` présents dans la table `Import`. |

**Endpoints supprimés** (aucune compat, dev-local + reset DB) :
- `POST /api/snapshots`
- `GET /api/snapshots`
- `GET /api/graph/:snapshotId`
- `GET /api/snapshots/:id`

**Types partagés** (`packages/shared`) :
- `SnapshotSummary` → `ImportSummary`
- `SnapshotDetail` → `ImportDetail`
- `GraphResponse` → **inchangé** (même shape `{ bounds, nodes, edges, mapConfig }`).
- `GraphNode` → **inchangé**.
- `GraphEdge` → **inchangé**.
- `NodeKind` → **inchangé** (`RTE_ENDPOINT`, `RTE_CD`, `BROKER`, `EXTERNAL_CD`, `EXTERNAL_ENDPOINT`).

---

## §E — Front

### Routes (React Router)

| Route | Page | Notes |
|---|---|---|
| `/` | `MapPage` | **Nouvelle entrée.** Carte de l'env actif. Empty state si aucun import dans l'env. |
| `/map` | Redirect → `/` | Alias, compat historique courte. |
| `/upload` | `UploadPage` (single-file, conservé) | Lien discret dans header. Après upload, redirect vers `/`. |
| `/upload/:id` | — | Retiré (plus besoin). |

### Header

- Titre « Carto ECP — RTE »
- Sélecteur d'env : `<select>` alimenté par `/api/envs`, default = valeur persistée dans Zustand `activeEnv`.
- Lien « + Importer » → `/upload`
- **Pas** de lien « Admin » (arrive en 2c).

### Empty state (`/` sans import dans l'env actif)

Carte Europe centrée, overlay avec texte :

```
Aucun composant connu pour l'environnement « OPF ».
[Importer un dump]
```

Bouton renvoie vers `/upload?env=OPF`.

### Store Zustand

```ts
type AppState = {
  activeEnv: string | null;       // persisté (localStorage)
  envs: string[];                 // liste des envs disponibles
  imports: ImportSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  loadEnvs: () => Promise<void>;
  loadImports: (env: string) => Promise<void>;
  setActiveEnv: (env: string) => Promise<void>;      // déclenche loadGraph
  loadGraph: (env: string, refDate?: Date) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
};
```

**Champs retirés :** `activeSnapshotId`, `snapshots`, `setActiveSnapshot`.

**Cas pas d'env actif :** au premier load, `loadEnvs()` retourne `[]` → empty state global « Aucun import dans la base. Importer un dump pour commencer ».

---

## §F — Tests (TDD strict)

### Unit `apps/api/src/ingestion/`

- `dump-type-detector.spec.ts` : heuristique ENDPOINT pour les 2 fixtures. Fallback COMPONENT_DIRECTORY si pas de blob XML. Override manuel respecté.
- `import-builder.spec.ts` :
  - Parsing d'1 ZIP ENDPOINT → `ImportedComponent[]` bruts corrects (pas de coord Bruxelles par défaut, `isDefaultPosition=true` si pas de coord dans le dump).
  - `classifyMessageType` appliqué correctement.
- `raw-persister.spec.ts` :
  - Écriture transactionnelle.
  - Repackaging sans sensibles conservé (P3-1).
  - Cleanup zip sur rollback (P3-6).
- `imports.controller.spec.ts` : validation zod du body, appels du pipeline.

### Unit `apps/api/src/graph/`

- `graph.service.compute.spec.ts` — **noyau TDD de la slice** :
  - 0 import dans l'env → graph vide + bounds par défaut.
  - 1 import → parité avec sortie v1.2 (snapshot via fixture).
  - 2 imports même env, EIC commun, champ contradictoire (`displayName`) → latest `effectiveDate` gagne.
  - 2 imports envs distincts (OPF + PROD) → isolation : requête `env=OPF` ne voit pas PROD.
  - 1 import + `ComponentOverride` sur 1 EIC → override gagne niveau 1.
  - Paths clé 5-champs identique sur 2 imports → 1 entrée logique, `isExpired` du latest.
  - `refDate` = date < latest import → import postérieur exclu.
  - `isDefaultPosition` = `true` si aucun import ni registry ni ENTSO-E ni override n'apporte `lat/lng` → fallback centre Europe.

### Intégration `apps/api/test/`

- `full-ingestion-v2.spec.ts` : upload 2 ZIPs fixtures (`17V000000498771C_...` + `17V000002014106G_...`) en `envName='OPF'` ; vérifier nombre de rows brutes + appel graph + cohérence nodes/edges.
- `import-deletion.spec.ts` : upload 1 import, DELETE, vérifier DB vide + graph vide.
- `env-isolation.spec.ts` : upload même fixture dans 2 envs (OPF et PROD), vérifier que `/api/graph?env=OPF` et `?env=PROD` retournent chacun leur propre contenu indépendant.

### E2E `apps/web/tests/`

- `empty-state.spec.ts` : ouvrir `/` sans import → empty state visible + CTA fonctionnel.
- `upload-then-map.spec.ts` : upload via `/upload` → redirect `/` → carte peuplée avec nodes.
- `env-switch.spec.ts` : 2 imports dans 2 envs différents, switch via sélecteur → carte change.

**Toutes les fixtures E2E/integration ré-utilisent les 2 ZIPs existants sous `tests/fixtures/`.**

---

## §G — Migration data

**Stratégie : reset total.**

```bash
pnpm --filter @carto-ecp/api prisma:migrate reset --force
pnpm --filter @carto-ecp/api prisma:migrate dev --name v2_fondations_raw_tables
```

**Conséquences :**
- Tables v1.2 droppées : `Snapshot`, `Component`, `ComponentUrl`, `MessagePath`, `MessagingStatistic`, `AppProperty`.
- Tables v2.0 créées.
- `storage/snapshots/*.zip` existants ignorés (chemin change → `storage/imports/`). Cleanup manuel optionnel (documenté dans CHANGELOG).

**Test de fumée final :** après migration, re-uploader les 2 fixtures dans `envName=OPF` et vérifier que la carte s'affiche correctement.

---

## §H — ADRs à écrire dans le plan

Séquencés, **avant** l'implémentation des blocs correspondants :

| ADR | Sujet | Impact |
|---|---|---|
| ADR-023 | Raw + compute on read (vs matérialisation) | §A + §C |
| ADR-024 | Cascade de priorité 5 niveaux par champ | §C |
| ADR-025 | Clé path 5 champs sans tri canonique | §A + §C |
| ADR-026 | `effectiveDate` pilotante, découplée `uploadedAt` | §A + §C |
| ADR-027 | Frontière `envName` first-class | §A + §D + §E |
| ADR-028 | Suppression endpoints legacy `/api/snapshots*` | §D |
| ADR-030 | Heuristique `DumpTypeDetector` en 2a, évolution en 2b | §B |

---

## §I — Risques & points de vigilance

| Risque | Mitigation |
|---|---|
| `GraphService.compute` devient lent sur gros envs | Bench à faire en fin de 2a avec ≥5 imports ; si >500ms, on ajoute un cache LRU côté service (clé = `env+refDate+overridesHash+entsoeHash`). Matérialisation repoussée à slice ultérieure si vraiment nécessaire. |
| Parité visuelle v1.2 → v2.0 non garantie | Test `graph.service.compute.spec.ts` cas « 1 import » compare byte-à-byte avec une snapshot enregistrée de la sortie v1.2 sur la même fixture. |
| `isDefaultPosition` regressions (plus hardcodé Bruxelles → plus de coord dans certains cas) | Test dédié : EIC inconnu sans registry/ENTSO-E → fallback centre Europe + `isDefaultPosition=true`. Badge visuel prévu en 2f ; en 2a on garde le style actuel (ring grise) pour ces nodes. |
| Frontend casse : `useMapData` / `SnapshotSelector` utilisent l'ancien contrat | Refonte store + suppression `SnapshotSelector` (remplacé par `EnvSelector`). Tests frontend mis à jour. |
| Parseurs CD/Broker absents | Non-bloquant en 2a : fixtures = ENDPOINT uniquement. Dump de type inconnu → parser ENDPOINT appliqué (erreur contrôlée si format autre). |

---

## §J — Checklist de sortie 2a (DoD)

- [ ] Schéma Prisma v2.0 migré, DB reset, `prisma:studio` montre les nouvelles tables vides.
- [ ] `pnpm dev` démarre sans erreur.
- [ ] Upload d'une fixture ENDPOINT via `/upload` → import créé, carte peuplée à `/`.
- [ ] Upload de la seconde fixture dans le même env → carte agrégée, paths dédupés si clé commune.
- [ ] Switch d'env dans le header → carte change, aucun résidu inter-env.
- [ ] `DELETE /api/imports/:id` → import retiré, carte mise à jour, zip disque supprimé.
- [ ] Tous les tests unit/intégration verts ; E2E smoke verts.
- [ ] `typecheck` vert sur tous les workspaces.
- [ ] ADR-023 à ADR-028 et ADR-030 rédigés.
- [ ] `CHANGELOG.md` mis à jour avec l'entrée v2.0-alpha.1.
- [ ] `docs/specs/` : specs techniques api/ingestion + api/graph + api/imports + web/map + web/upload mises à jour par `update-writer-after-implement`.
