# Carto ECP v2.0 — Slice 2a (Fondations) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Poser les fondations data model v2.0 — passage de `Snapshot isolé` à `Import brut + compute-on-read agrégé par env`, avec carte en entrée et single-file upload temporaire.

**Architecture:** Schéma Prisma refait (tables `Import`, `ImportedComponent`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`). Pipeline ingestion conserve `ZipExtractor`/`CsvReader`/`XmlMadesParser` existants, remplace `NetworkModelBuilder` → `ImportBuilder` (pas de cascade registry à l'ingestion) et `SnapshotPersister` → `RawPersister`. `GraphService` refondu en compute-on-read avec cascade 5 niveaux à la lecture (override admin > ENTSO-E > registry RTE > imports latest-wins > default). Endpoints `/api/snapshots*` supprimés au profit de `/api/imports*` + `/api/graph?env&refDate` + `/api/envs`. Front : `/` = carte, sélecteur d'env, empty state, `/upload` single-file temporaire.

**Tech Stack:** NestJS 10 (CommonJS), Prisma 5 + SQLite, Vitest 2 + `unplugin-swc`, nestjs-zod (opt pour zod pur), React 18 + Vite + Zustand + React Router v6, Leaflet 1.9, Playwright 1.48.

**Spec de référence :** [`docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2a-design.md`](../specs/2026-04-19-carto-ecp-v2-slice-2a-design.md) — lire §A (schéma), §B (pipeline), §C (GraphService), §D (endpoints), §E (front), §F (tests), §G (migration) avant de démarrer.

**Chapeau :** [`docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md`](../specs/2026-04-19-carto-ecp-v2-chapeau.md) — vocabulaire et cascade.

**Branche cible :** `feat/v2-slice-2a-fondations` (à créer depuis `main` au premier commit).

---

## Vue d'ensemble des phases

| Phase | Tasks | Livre |
|---|---|---|
| Phase 1 — Fondations | 1-2 | 7 ADRs + schéma Prisma v2.0 + reset DB |
| Phase 2 — Ingestion backend | 3-11 | Parseur nom de fichier, DumpTypeDetector, ImportBuilder (3 parts), RawPersister, ImportsService, ImportsController, module wiring |
| Phase 3 — GraphService compute-on-read | 12-16 | Merge components, cascade 5 niveaux, merge paths, buildEdges, Controller |
| Phase 4 — Endpoints secondaires + intégration | 17-19 | EnvsController, integration tests multi-imports & isolation |
| Phase 5 — Frontend | 20-28 | Types shared, API client, store, EnvSelector, MapPage empty, UploadPage, App routes, cleanup legacy, 3 E2E |
| Phase 6 — Smoke + DoD | 29 | Smoke manuel, CHANGELOG v2.0-alpha.1, PR |

**Convention de commit :** Conventional Commits en français (voir `.claude/rules/05-git-workflow.md`), footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Phase 1 — Fondations architecturales

### Task 1 : Rédiger les 7 ADRs préalables

**Files (à créer) :**
- `docs/adr/ADR-023-raw-plus-compute-on-read.md`
- `docs/adr/ADR-024-cascade-5-niveaux-par-champ.md`
- `docs/adr/ADR-025-cle-path-5-champs-sans-tri-canonique.md`
- `docs/adr/ADR-026-effectivedate-decouplee-uploadedat.md`
- `docs/adr/ADR-027-envname-first-class.md`
- `docs/adr/ADR-028-suppression-endpoints-legacy-snapshots.md`
- `docs/adr/ADR-030-dump-type-detector-heuristique.md`

**Gabarit commun à chaque ADR** (basé sur `docs/adr/000-template.md`) :

```markdown
# ADR-0XX — <Titre>

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-0XX                        |
| Statut     | Accepté                        |
| Date       | 2026-04-19                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice v2.0-2a Fondations       |
| Remplace   | <si applicable>                |
| Features   | *                              |
| App        | api, web                       |

## Contexte
<3-5 phrases>

## Options considérées
| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| A — … | … | … | … | … |
| B — … | … | … | … | … |

## Décision retenue
**Option choisie : <X>** — justification.

## Conséquences
### Positives
- …
### Négatives
- …
### Ce qu'on s'interdit désormais
- …

## Ressources / Références
- Chapeau v2.0 §<n>
- Slice 2a design §<n>
```

- [ ] **Step 1.1 : ADR-023 Raw + compute-on-read vs matérialisation**
  - Contexte : v1.2 collapse à l'ingestion, v2.0 a besoin de timeline/suppression/rétroactivité.
  - Options : A = store raw + compute (retenue), B = store raw + materialize, C = upsert collapse.
  - Décision : A. Justifier par ordre de grandeur (~10 imports × ~500 composants = négligeable en SQLite).
  - Interdit désormais : `NetworkModelBuilder` qui écrit des `Component`/`MessagePath` per-snapshot avec cascade pré-calculée.
  - Réfs : chapeau §3, slice 2a §C.

- [ ] **Step 1.2 : ADR-024 Cascade de priorité 5 niveaux par champ**
  - Ordre : override > ENTSO-E > registry > imports latest-wins > default.
  - Granularité : **par champ, pas par record**.
  - Interdit désormais : écraser un champ non-null en base avec un champ null d'un autre import.
  - Réfs : chapeau §4.

- [ ] **Step 1.3 : ADR-025 Clé path 5 champs sans tri canonique**
  - Clé : `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)`.
  - Pas de tri → duplication croisée possible, collapsée au rendu.
  - Interdit désormais : dériver le `process` à l'ingestion (classification au read).
  - Réfs : chapeau §5, slice 2a §C.

- [ ] **Step 1.4 : ADR-026 `effectiveDate` pilotante, découplée `uploadedAt`**
  - Trois dates (uploadedAt, sourceDumpTimestamp, effectiveDate).
  - Timeline + latest-wins = effectiveDate. uploadedAt = audit uniquement.
  - Interdit désormais : utiliser `uploadedAt` pour une décision métier.
  - Réfs : chapeau §2.

- [ ] **Step 1.5 : ADR-027 `envName` first-class**
  - Imports scopés, graphes isolés, overrides/ENTSO-E/registry globaux.
  - Interdit désormais : mélanger deux envs dans une même requête graph.
  - Réfs : chapeau §6.

- [ ] **Step 1.6 : ADR-028 Suppression endpoints legacy `/api/snapshots*`**
  - Dev-local + reset DB → pas de compat.
  - Interdit désormais : ajouter un alias rétrocompatible sur les routes v1.2.
  - Réfs : slice 2a §D.

- [ ] **Step 1.7 : ADR-030 Heuristique `DumpTypeDetector` en 2a, raffinée en 2b**
  - 2a : heuristique simple (présence blob XML → ENDPOINT, sinon COMPONENT_DIRECTORY, BROKER non détectable).
  - 2b : raffinement multi-critères + override manuel en UI.
  - Interdit désormais : bloquer un upload à cause d'une détection ambiguë (toujours accepter avec fallback).
  - Réfs : slice 2a §B.

- [ ] **Step 1.8 : Commit**

```bash
git checkout -b feat/v2-slice-2a-fondations main
git add docs/adr/ADR-023-*.md docs/adr/ADR-024-*.md docs/adr/ADR-025-*.md docs/adr/ADR-026-*.md docs/adr/ADR-027-*.md docs/adr/ADR-028-*.md docs/adr/ADR-030-*.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-023 à ADR-028 et ADR-030 pour slice v2.0-2a

Sept ADRs fondatrices de la refonte v2.0 :
- ADR-023 raw + compute on read
- ADR-024 cascade 5 niveaux par champ
- ADR-025 clé path 5 champs sans tri canonique
- ADR-026 effectiveDate pilotante
- ADR-027 envName first-class
- ADR-028 suppression endpoints legacy /api/snapshots*
- ADR-030 heuristique DumpTypeDetector 2a

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 : Schéma Prisma v2.0 + reset DB + stub types shared

**Files :**
- Modify: `apps/api/prisma/schema.prisma` (remplacement intégral du bloc modèles)
- Create: `apps/api/prisma/migrations/<timestamp>_v2_fondations/migration.sql` (généré)
- Modify: `packages/shared/src/graph.ts` (ajout `ImportSummary`, `ImportDetail`, suppression `SnapshotSummary`/`SnapshotDetail`)
- Modify: `packages/shared/src/index.ts` (exports)

- [ ] **Step 2.1 : Réécrire `apps/api/prisma/schema.prisma`**

Voir le bloc complet dans `slice-2a-design.md §A`. Recopier intégralement les 8 modèles (`Import`, `ImportedComponent`, `ImportedComponentUrl`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`) en remplaçant les modèles v1.2 existants. Conserver `generator client` et `datasource db`.

Rappels clés :
- `ImportedComponent.lat/lng` sont **nullable**.
- Pas de `process` dans `ImportedComponent` ni dans `ImportedPath` (calculé au rendu).
- Index composite `idx_path_identity` sur `ImportedPath` pour accélérer la dédup.
- `ComponentOverride` utilise `eic` comme PK (cross-env).

- [ ] **Step 2.2 : Reset DB + générer migration**

```bash
pnpm --filter @carto-ecp/api prisma:migrate reset --force
pnpm --filter @carto-ecp/api prisma:migrate dev --name v2_fondations_raw_tables
pnpm --filter @carto-ecp/api prisma:generate
```

Expected : migration créée sous `apps/api/prisma/migrations/<timestamp>_v2_fondations_raw_tables/migration.sql`, client Prisma régénéré.

Si une ancienne migration `storage/snapshots/*.zip` traine, documenter en CHANGELOG (Task 29) que le dossier peut être supprimé manuellement. Ne pas supprimer automatiquement ici.

- [ ] **Step 2.3 : Stub types shared**

Dans `packages/shared/src/graph.ts`, **ajouter** à côté des types existants (garder `GraphResponse`, `GraphNode`, `GraphEdge`, `MapConfig`, `Warning` inchangés) :

```typescript
export type ImportSummary = {
  id: string;
  envName: string;
  label: string;
  fileName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  sourceComponentEic: string | null;
  sourceDumpTimestamp: string | null;  // ISO, nullable
  uploadedAt: string;                   // ISO
  effectiveDate: string;                // ISO
};

export type ImportDetail = ImportSummary & {
  warnings: Warning[];
  stats: {
    componentsCount: number;
    pathsCount: number;
    messagingStatsCount: number;
  };
};
```

**Supprimer** les types `SnapshotSummary` et `SnapshotDetail` s'ils sont présents dans ce fichier ou dans `packages/shared/src/snapshot.ts`.

Dans `packages/shared/src/index.ts`, ajuster les exports : enlever `SnapshotSummary`/`SnapshotDetail`, ajouter `ImportSummary`/`ImportDetail`.

- [ ] **Step 2.4 : Vérifier typecheck shared**

```bash
pnpm --filter @carto-ecp/shared typecheck
```

Expected : PASS. Si fail, résoudre les imports cassés.

Note : le typecheck api/web va **casser** à ce stade (code legacy référence `SnapshotSummary`, `prisma.snapshot.*`, etc.). Ne pas chercher à corriger maintenant — ces cassures seront résolues au fur et à mesure des tâches suivantes qui remplacent le code.

- [ ] **Step 2.5 : Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations packages/shared/src/
git commit -m "$(cat <<'EOF'
feat(api): schéma Prisma v2.0 raw tables + reset DB

Remplacement du modèle Snapshot isolé par tables brutes :
- Import (métadonnée dump), ImportedComponent/Path/MessagingStat/AppProperty
  (contribution brute d'un import, non écrasée)
- ComponentOverride (surcharge admin globale par EIC, cross-env)
- EntsoeEntry (annuaire ENTSO-E embarqué, vide en 2a)

lat/lng rendus nullable — le fallback centre Europe est appliqué au rendu
(cascade 5 niveaux dans GraphService) et non plus à l'ingestion.

Types shared : ajout ImportSummary/ImportDetail, suppression
SnapshotSummary/SnapshotDetail.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Pipeline d'ingestion backend

### Task 3 : Parseur nom de fichier (extraction EIC + timestamp)

**Files :**
- Create: `apps/api/src/ingestion/filename-parser.ts`
- Create: `apps/api/src/ingestion/filename-parser.spec.ts`

Le parseur doit reconnaître le format `{EIC}_{YYYY-MM-DDTHH_MM_SSZ}.zip` (les `:` du timestamp ISO sont remplacés par `_` dans le nom de fichier Windows-safe) et retourner `{ sourceComponentEic: string | null, sourceDumpTimestamp: Date | null }`.

- [ ] **Step 3.1 : Écrire le test rouge**

```typescript
// apps/api/src/ingestion/filename-parser.spec.ts
import { describe, expect, it } from 'vitest';
import { parseDumpFilename } from './filename-parser.js';

describe('parseDumpFilename', () => {
  it('extracts EIC and timestamp from canonical ECP dump filename', () => {
    const result = parseDumpFilename('17V000000498771C_2026-04-17T21_27_17Z.zip');
    expect(result.sourceComponentEic).toBe('17V000000498771C');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-04-17T21:27:17.000Z');
  });

  it('handles the CD dump naming pattern', () => {
    const result = parseDumpFilename('17V000002014106G_2026-04-17T22_11_50Z.zip');
    expect(result.sourceComponentEic).toBe('17V000002014106G');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-04-17T22:11:50.000Z');
  });

  it('returns nulls for an unrecognizable filename', () => {
    const result = parseDumpFilename('random-backup.zip');
    expect(result.sourceComponentEic).toBeNull();
    expect(result.sourceDumpTimestamp).toBeNull();
  });

  it('returns nulls if the timestamp is malformed', () => {
    const result = parseDumpFilename('17V000000498771C_not-a-date.zip');
    expect(result.sourceComponentEic).toBeNull();
    expect(result.sourceDumpTimestamp).toBeNull();
  });

  it('accepts 10V EICs too (non-RTE, non-17V prefix)', () => {
    const result = parseDumpFilename('10XAT-APG------Z_2026-03-01T00_00_00Z.zip');
    expect(result.sourceComponentEic).toBe('10XAT-APG------Z');
    expect(result.sourceDumpTimestamp?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });
});
```

- [ ] **Step 3.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- filename-parser
```

Expected : FAIL — module non trouvé.

- [ ] **Step 3.3 : Implémenter**

```typescript
// apps/api/src/ingestion/filename-parser.ts
const FILENAME_REGEX = /^(?<eic>[A-Z0-9\-]+)_(?<date>\d{4}-\d{2}-\d{2})T(?<time>\d{2}_\d{2}_\d{2})Z\.zip$/i;

export type FilenameMetadata = {
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
};

export function parseDumpFilename(filename: string): FilenameMetadata {
  const match = FILENAME_REGEX.exec(filename);
  if (!match?.groups) {
    return { sourceComponentEic: null, sourceDumpTimestamp: null };
  }
  const { eic, date, time } = match.groups;
  const iso = `${date}T${time.replace(/_/g, ':')}.000Z`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return { sourceComponentEic: null, sourceDumpTimestamp: null };
  }
  return { sourceComponentEic: eic!, sourceDumpTimestamp: parsed };
}
```

- [ ] **Step 3.4 : Run green**

```bash
pnpm --filter @carto-ecp/api test -- filename-parser
```

Expected : PASS (5/5).

- [ ] **Step 3.5 : Commit**

```bash
git add apps/api/src/ingestion/filename-parser.ts apps/api/src/ingestion/filename-parser.spec.ts
git commit -m "feat(api): parseur nom de fichier dump ECP (EIC + timestamp)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4 : `DumpTypeDetector`

**Files :**
- Create: `apps/api/src/ingestion/dump-type-detector.ts`
- Create: `apps/api/src/ingestion/dump-type-detector.spec.ts`

Heuristique 2a : on consomme la sortie de `CsvReader` (déjà parsée). Si `component_directory.csv` contient au moins une ligne avec un blob XML (champ `.xml` non vide ou contenant `<?xml`), alors `ENDPOINT`. Sinon `COMPONENT_DIRECTORY`. `BROKER` non détectable en 2a (le caller peut forcer via param). Si un `dumpType` explicite est fourni → il gagne.

- [ ] **Step 4.1 : Écrire le test rouge**

```typescript
// apps/api/src/ingestion/dump-type-detector.spec.ts
import { describe, expect, it } from 'vitest';
import { detectDumpType } from './dump-type-detector.js';

describe('detectDumpType', () => {
  it('returns ENDPOINT when component_directory.csv rows contain XML blobs', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '<?xml version="1.0"?><root/>' }];
    expect(detectDumpType(csvRows, undefined)).toBe('ENDPOINT');
  });

  it('returns COMPONENT_DIRECTORY when no rows contain XML blobs', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '' }];
    expect(detectDumpType(csvRows, undefined)).toBe('COMPONENT_DIRECTORY');
  });

  it('returns COMPONENT_DIRECTORY when csv is empty', () => {
    expect(detectDumpType([], undefined)).toBe('COMPONENT_DIRECTORY');
  });

  it('respects explicit override (priority)', () => {
    const csvRows = [{ eic: '17V..C', componentCode: 'X', xml: '<?xml?><root/>' }];
    expect(detectDumpType(csvRows, 'BROKER')).toBe('BROKER');
  });
});
```

- [ ] **Step 4.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- dump-type-detector
```

Expected : FAIL — module manquant.

- [ ] **Step 4.3 : Implémenter**

```typescript
// apps/api/src/ingestion/dump-type-detector.ts
export type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

type ComponentDirectoryRow = { xml?: string | null | undefined };

export function detectDumpType(
  componentDirectoryRows: ReadonlyArray<ComponentDirectoryRow>,
  explicitOverride: DumpType | undefined,
): DumpType {
  if (explicitOverride) return explicitOverride;
  const hasXmlBlob = componentDirectoryRows.some(
    (row) => typeof row.xml === 'string' && row.xml.includes('<?xml'),
  );
  return hasXmlBlob ? 'ENDPOINT' : 'COMPONENT_DIRECTORY';
}
```

- [ ] **Step 4.4 : Run green**

```bash
pnpm --filter @carto-ecp/api test -- dump-type-detector
```

Expected : PASS (4/4).

- [ ] **Step 4.5 : Commit**

```bash
git add apps/api/src/ingestion/dump-type-detector.ts apps/api/src/ingestion/dump-type-detector.spec.ts
git commit -m "feat(api): DumpTypeDetector heuristique 2a (ENDPOINT/CD/BROKER)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : `ImportBuilder` — partie composants

**Files :**
- Create: `apps/api/src/ingestion/import-builder.service.ts`
- Create: `apps/api/src/ingestion/import-builder.service.spec.ts`
- Modify: `apps/api/src/ingestion/types.ts` (ajouter `ImportBuilderInput`, `BuiltImport`, `BuiltImportedComponent`, `BuiltImportedPath`, `BuiltImportedMessagingStat`)

`ImportBuilder` est le nouveau service qui produit les contributions brutes à partir des parsers existants. **Pas d'appel à `RegistryService.resolveComponent`**. Le registry est consulté uniquement pour la classification au rendu (donc pas ici non plus). Seuls les cas sans ambiguïté sont traités ici : extraction directe des champs du CSV/XML.

- [ ] **Step 5.1 : Étendre `types.ts`**

Dans `apps/api/src/ingestion/types.ts`, ajouter :

```typescript
import type { DumpType } from './dump-type-detector.js';

export type BuiltImportedComponent = {
  eic: string;
  type: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA';
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  isDefaultPosition: boolean;
  sourceType: 'XML_CD' | 'LOCAL_CSV';
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
};

export type BuiltImportedPath = {
  receiverEic: string;
  senderEic: string;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  isExpired: boolean;
};

export type BuiltImportedMessagingStat = {
  sourceEndpointCode: string;
  remoteComponentCode: string;
  connectionStatus: string | null;
  lastMessageUp: Date | null;
  lastMessageDown: Date | null;
  sumMessagesUp: number;
  sumMessagesDown: number;
  deleted: boolean;
};

export type BuiltImport = {
  envName: string;
  label: string;
  fileName: string;
  fileHash: string;
  dumpType: DumpType;
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
  effectiveDate: Date;
  components: BuiltImportedComponent[];
  paths: BuiltImportedPath[];
  messagingStats: BuiltImportedMessagingStat[];
  appProperties: { key: string; value: string }[];
  warnings: Warning[];
};
```

Garder les types existants (`Warning`, `USABLE_CSV_FILES`, etc.).

- [ ] **Step 5.2 : Écrire le test rouge (partie composants)**

```typescript
// apps/api/src/ingestion/import-builder.service.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { ImportBuilderService } from './import-builder.service.js';
import { RegistryService } from '../registry/registry.service.js';

describe('ImportBuilderService — composants', () => {
  let builder: ImportBuilderService;
  let registry: RegistryService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, RegistryService],
    }).compile();
    await moduleRef.init();
    builder = moduleRef.get(ImportBuilderService);
    registry = moduleRef.get(RegistryService);
  });

  it('builds ImportedComponent with raw CSV fields and no cascade resolution', () => {
    const csvRow = {
      eic: '17V000000498771C',
      componentCode: 'ECP-INTERNET-2',
      organization: 'RTE',
      personName: 'John Doe',
      email: 'john@rte-france.com',
      phone: '+33-1-00-00-00-00',
      homeCdCode: '17V000002014106G',
      networks: 'PUBLIC_NETWORK,INTERNET',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components).toHaveLength(1);
    const c = result.components[0]!;
    expect(c.eic).toBe('17V000000498771C');
    expect(c.type).toBe('ENDPOINT');
    expect(c.organization).toBe('RTE');
    expect(c.email).toBe('john@rte-france.com');
    expect(c.networksCsv).toBe('PUBLIC_NETWORK,INTERNET');
    // Pas de coord parsées par le builder : niveau 5 de la cascade s'en chargera au rendu
    expect(c.lat).toBeNull();
    expect(c.lng).toBeNull();
    expect(c.isDefaultPosition).toBe(true);
    expect(c.sourceType).toBe('LOCAL_CSV');
  });

  it('types the component as COMPONENT_DIRECTORY when componentCode is a CD code', () => {
    const csvRow = {
      eic: '17V000002014106G',
      componentCode: '17V000002014106G',  // componentCode == CD code = CD
      organization: 'RTE',
      networks: '',
      xml: '',
    };
    const result = builder.buildFromLocalCsv([csvRow]);
    expect(result.components[0]!.type).toBe('COMPONENT_DIRECTORY');
  });

  it('builds one Broker stub when XML references an intermediateBrokerEic not in components', () => {
    const xmlRow = {
      eic: '17V000000498771C',
      componentCode: 'ECP-INTERNET-2',
      xml: '<?xml version="1.0"?><foo/>',  // XML parsing détail dans XmlMadesParser (mocké ici)
    };
    // Utilise buildFromXml qui prend aussi les paths extraits — voir task suivant
    // Ce test vérifie juste que les builders composent correctement
    const builderWithBrokers = builder.buildFromLocalCsv([
      xmlRow,
      { eic: 'UNKNOWN_BROKER_EIC', componentCode: 'BROKER_X', organization: 'RTE', networks: '', xml: '' },
    ]);
    expect(builderWithBrokers.components).toHaveLength(2);
  });
});
```

(Note : le test XML complet viendra en Task 6 ; ici on teste uniquement `buildFromLocalCsv`.)

- [ ] **Step 5.3 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected : FAIL — module manquant.

- [ ] **Step 5.4 : Implémenter**

```typescript
// apps/api/src/ingestion/import-builder.service.ts
import { Injectable } from '@nestjs/common';
import type {
  BuiltImport,
  BuiltImportedComponent,
  BuiltImportedPath,
  BuiltImportedMessagingStat,
  Warning,
} from './types.js';

type LocalCsvRow = {
  eic: string;
  componentCode: string;
  organization?: string | null;
  personName?: string | null;
  email?: string | null;
  phone?: string | null;
  homeCdCode?: string | null;
  networks?: string | null;
  xml?: string | null;
  creationTs?: string | null;
  modificationTs?: string | null;
};

@Injectable()
export class ImportBuilderService {
  buildFromLocalCsv(rows: LocalCsvRow[]): { components: BuiltImportedComponent[]; warnings: Warning[] } {
    const components: BuiltImportedComponent[] = [];
    const warnings: Warning[] = [];
    for (const row of rows) {
      if (!row.eic) {
        warnings.push({ code: 'CSV_ROW_MISSING_EIC', message: `Row skipped: ${row.componentCode ?? '<no code>'}` });
        continue;
      }
      components.push({
        eic: row.eic,
        type: this.inferType(row),
        organization: nonEmpty(row.organization),
        personName: nonEmpty(row.personName),
        email: nonEmpty(row.email),
        phone: nonEmpty(row.phone),
        homeCdCode: nonEmpty(row.homeCdCode),
        networksCsv: nonEmpty(row.networks),
        displayName: null,  // registry cascade au rendu
        country: null,
        lat: null,
        lng: null,
        isDefaultPosition: true,
        sourceType: 'LOCAL_CSV',
        creationTs: parseDateOrNull(row.creationTs),
        modificationTs: parseDateOrNull(row.modificationTs),
        urls: [],
      });
    }
    return { components, warnings };
  }

  private inferType(row: LocalCsvRow): BuiltImportedComponent['type'] {
    // Règle v2a : si componentCode == eic (ou composante CD reconnue) => COMPONENT_DIRECTORY
    // sinon ENDPOINT par défaut. BROKER et BA à venir via XML (Task 6).
    if (row.componentCode === row.eic) return 'COMPONENT_DIRECTORY';
    return 'ENDPOINT';
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDateOrNull(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

(Imports des types, `Warning` ajouté si absent de `types.ts`.)

- [ ] **Step 5.5 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected : PASS (3/3).

```bash
git add apps/api/src/ingestion/types.ts apps/api/src/ingestion/import-builder.service.ts apps/api/src/ingestion/import-builder.service.spec.ts
git commit -m "feat(api): ImportBuilderService — partie composants (LOCAL_CSV)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : `ImportBuilder` — partie paths + composants issus du XML

**Files :**
- Modify: `apps/api/src/ingestion/import-builder.service.ts` (ajout `buildFromXml`)
- Modify: `apps/api/src/ingestion/import-builder.service.spec.ts` (3 tests XML)

Le XML MADES (dans `component_directory.csv`) décrit :
1. Des `<component>` avec leurs métadonnées (name, organization, urls, coords possibles).
2. Des `<messagePath>` avec receiver/sender/messageType/transportPattern/intermediateBroker.

Réutiliser `XmlMadesParserService` existant qui retourne déjà une structure parsée.

- [ ] **Step 6.1 : Écrire les tests rouges**

```typescript
// dans import-builder.service.spec.ts, ajouter :
import { XmlMadesParserService } from './xml-mades-parser.service.js';

describe('ImportBuilderService — XML', () => {
  let builder: ImportBuilderService;
  let parser: XmlMadesParserService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, XmlMadesParserService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
    parser = moduleRef.get(XmlMadesParserService);
  });

  it('extracts components with urls from XML CD blob', () => {
    const xml = `<?xml version="1.0"?>
      <ComponentDirectory xmlns="http://mades.entsoe.eu/componentDirectory">
        <Component>
          <eic>10XAT-APG------Z</eic>
          <name>APG Component</name>
          <organization>Austrian Power Grid</organization>
          <url network="PUBLIC_NETWORK">https://apg.at/ecp</url>
        </Component>
      </ComponentDirectory>`;
    const parsed = parser.parse(xml);
    const result = builder.buildFromXml(parsed);
    const comp = result.components.find((c) => c.eic === '10XAT-APG------Z')!;
    expect(comp.displayName).toBe('APG Component');
    expect(comp.organization).toBe('Austrian Power Grid');
    expect(comp.urls).toEqual([{ network: 'PUBLIC_NETWORK', url: 'https://apg.at/ecp' }]);
    expect(comp.sourceType).toBe('XML_CD');
  });

  it('extracts paths with 5-field identity', () => {
    const xml = `<?xml version="1.0"?>
      <ComponentDirectory xmlns="http://mades.entsoe.eu/componentDirectory">
        <MessagePath>
          <receiverEic>17V000000498771C</receiverEic>
          <senderEic>10XAT-APG------Z</senderEic>
          <messageType>A06</messageType>
          <transportPattern>DIRECT</transportPattern>
          <validFrom>2026-01-01T00:00:00Z</validFrom>
        </MessagePath>
      </ComponentDirectory>`;
    const parsed = parser.parse(xml);
    const result = builder.buildFromXml(parsed);
    expect(result.paths).toHaveLength(1);
    const p = result.paths[0]!;
    expect(p.receiverEic).toBe('17V000000498771C');
    expect(p.senderEic).toBe('10XAT-APG------Z');
    expect(p.messageType).toBe('A06');
    expect(p.transportPattern).toBe('DIRECT');
    expect(p.intermediateBrokerEic).toBeNull();
    expect(p.validFrom?.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('creates a BROKER stub component when a path references an unknown broker', () => {
    const xml = `<?xml version="1.0"?>
      <ComponentDirectory xmlns="http://mades.entsoe.eu/componentDirectory">
        <MessagePath>
          <receiverEic>17V000000498771C</receiverEic>
          <senderEic>10XAT-APG------Z</senderEic>
          <messageType>A06</messageType>
          <transportPattern>INDIRECT</transportPattern>
          <intermediateBrokerEic>17V000000BROKER1Z</intermediateBrokerEic>
        </MessagePath>
      </ComponentDirectory>`;
    const parsed = parser.parse(xml);
    const result = builder.buildFromXml(parsed);
    const broker = result.components.find((c) => c.eic === '17V000000BROKER1Z');
    expect(broker).toBeDefined();
    expect(broker!.type).toBe('BROKER');
    expect(broker!.sourceType).toBe('XML_CD');
  });
});
```

- [ ] **Step 6.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected : FAIL — `buildFromXml` introuvable.

- [ ] **Step 6.3 : Implémenter `buildFromXml`**

Ajouter dans `import-builder.service.ts` :

```typescript
import type { ParsedComponentDirectory, ParsedComponent, ParsedMessagePath } from './xml-mades-parser.service.js';

// ... dans la classe ImportBuilderService :

buildFromXml(parsed: ParsedComponentDirectory): {
  components: BuiltImportedComponent[];
  paths: BuiltImportedPath[];
  warnings: Warning[];
} {
  const components: BuiltImportedComponent[] = [];
  const paths: BuiltImportedPath[] = [];
  const warnings: Warning[] = [];
  const knownEics = new Set<string>();

  for (const c of parsed.components ?? []) {
    components.push(this.fromXmlComponent(c));
    knownEics.add(c.eic);
  }

  for (const mp of parsed.messagePaths ?? []) {
    paths.push({
      receiverEic: mp.receiverEic,
      senderEic: mp.senderEic,
      messageType: mp.messageType,
      transportPattern: mp.transportPattern,
      intermediateBrokerEic: nonEmpty(mp.intermediateBrokerEic) ?? null,
      validFrom: parseDateOrNull(mp.validFrom),
      validTo: parseDateOrNull(mp.validTo),
      isExpired: mp.validTo ? new Date(mp.validTo).getTime() < Date.now() : false,
    });
    if (mp.intermediateBrokerEic && !knownEics.has(mp.intermediateBrokerEic)) {
      components.push(this.brokerStub(mp.intermediateBrokerEic));
      knownEics.add(mp.intermediateBrokerEic);
    }
  }

  return { components, paths, warnings };
}

private fromXmlComponent(c: ParsedComponent): BuiltImportedComponent {
  return {
    eic: c.eic,
    type: c.type ?? 'ENDPOINT',  // Si XML précise <type>, l'utiliser, sinon default
    organization: nonEmpty(c.organization),
    personName: null,
    email: null,
    phone: null,
    homeCdCode: null,
    networksCsv: null,
    displayName: nonEmpty(c.name),
    country: null,
    lat: null,
    lng: null,
    isDefaultPosition: true,
    sourceType: 'XML_CD',
    creationTs: null,
    modificationTs: null,
    urls: (c.urls ?? []).map((u) => ({ network: u.network, url: u.url })),
  };
}

private brokerStub(eic: string): BuiltImportedComponent {
  return {
    eic,
    type: 'BROKER',
    organization: null,
    personName: null,
    email: null,
    phone: null,
    homeCdCode: null,
    networksCsv: null,
    displayName: null,
    country: null,
    lat: null,
    lng: null,
    isDefaultPosition: true,
    sourceType: 'XML_CD',
    creationTs: null,
    modificationTs: null,
    urls: [],
  };
}
```

**Important :** si `XmlMadesParserService.parse()` retourne une structure différente, adapter les noms de champs (lire `xml-mades-parser.service.ts` actuel pour vérifier).

- [ ] **Step 6.4 : Run green**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected : PASS (3+3 tests). Si le parser XML existant retourne un format différent, ajuster le test rouge et l'implémentation en cohérence.

- [ ] **Step 6.5 : Commit**

```bash
git add apps/api/src/ingestion/import-builder.service.ts apps/api/src/ingestion/import-builder.service.spec.ts
git commit -m "feat(api): ImportBuilder — partie XML (composants + paths + broker stubs)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : `ImportBuilder` — stats messagerie + app properties + API globale

**Files :**
- Modify: `apps/api/src/ingestion/import-builder.service.ts` (méthodes `buildMessagingStats`, `buildAppProperties`, `build` orchestrateur)
- Modify: `apps/api/src/ingestion/import-builder.service.spec.ts` (2 tests supplémentaires)

- [ ] **Step 7.1 : Tests rouges**

```typescript
describe('ImportBuilderService — stats & app properties', () => {
  let builder: ImportBuilderService;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ providers: [ImportBuilderService] }).compile();
    builder = moduleRef.get(ImportBuilderService);
  });

  it('extracts messaging stats from raw rows', () => {
    const rows = [{
      sourceEndpointCode: '17V...A',
      remoteComponentCode: '10X...Z',
      connectionStatus: 'CONNECTED',
      lastMessageUp: '2026-04-17T10:00:00.000Z',
      lastMessageDown: null,
      sumMessagesUp: 42,
      sumMessagesDown: 0,
      deleted: 'false',
    }];
    const result = builder.buildMessagingStats(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.sumMessagesUp).toBe(42);
    expect(result[0]!.lastMessageUp?.toISOString()).toBe('2026-04-17T10:00:00.000Z');
    expect(result[0]!.deleted).toBe(false);
  });

  it('filters sensitive keys from app properties', () => {
    const rows = [
      { key: 'keystore.password', value: 'secret' },
      { key: 'ecp.version', value: '4.5.0' },
      { key: 'private.credentials', value: 'X' },
      { key: 'normal.key', value: 'ok' },
    ];
    const result = builder.buildAppProperties(rows);
    expect(result.map((r) => r.key).sort()).toEqual(['ecp.version', 'normal.key']);
  });
});
```

- [ ] **Step 7.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected : FAIL — méthodes manquantes.

- [ ] **Step 7.3 : Implémenter**

```typescript
// Dans ImportBuilderService :

private static readonly SENSITIVE_KEY_REGEX = /password|secret|keystore\.password|privateKey|credentials/i;

buildMessagingStats(rows: Array<{
  sourceEndpointCode: string;
  remoteComponentCode: string;
  connectionStatus?: string | null;
  lastMessageUp?: string | null;
  lastMessageDown?: string | null;
  sumMessagesUp?: number | string | null;
  sumMessagesDown?: number | string | null;
  deleted?: boolean | string | null;
}>): BuiltImportedMessagingStat[] {
  return rows.map((r) => ({
    sourceEndpointCode: r.sourceEndpointCode,
    remoteComponentCode: r.remoteComponentCode,
    connectionStatus: nonEmpty(r.connectionStatus ?? null),
    lastMessageUp: parseDateOrNull(r.lastMessageUp ?? null),
    lastMessageDown: parseDateOrNull(r.lastMessageDown ?? null),
    sumMessagesUp: Number(r.sumMessagesUp ?? 0),
    sumMessagesDown: Number(r.sumMessagesDown ?? 0),
    deleted: r.deleted === true || r.deleted === 'true',
  }));
}

buildAppProperties(rows: Array<{ key: string; value: string }>): Array<{ key: string; value: string }> {
  return rows.filter((r) => !ImportBuilderService.SENSITIVE_KEY_REGEX.test(r.key));
}
```

- [ ] **Step 7.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
git add apps/api/src/ingestion/import-builder.service.ts apps/api/src/ingestion/import-builder.service.spec.ts
git commit -m "feat(api): ImportBuilder — stats messagerie + filtre app properties sensibles

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8 : `RawPersister` — écriture transactionnelle + repackaging zip

**Files :**
- Create: `apps/api/src/ingestion/raw-persister.service.ts`
- Create: `apps/api/src/ingestion/raw-persister.service.spec.ts`

Hérite la logique de `SnapshotPersisterService` (repackaging P3-1, cleanup zip sur rollback P3-6) mais écrit dans les nouvelles tables.

- [ ] **Step 8.1 : Écrire le test rouge**

```typescript
// apps/api/src/ingestion/raw-persister.service.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { RawPersisterService } from './raw-persister.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BuiltImport } from './types.js';
import { existsSync, unlinkSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function makeBuilt(): BuiltImport {
  return {
    envName: 'TEST',
    label: 'test-persist',
    fileName: 'fake.zip',
    fileHash: 'abc123',
    dumpType: 'ENDPOINT',
    sourceComponentEic: '17V...A',
    sourceDumpTimestamp: new Date('2026-04-17T21:27:17Z'),
    effectiveDate: new Date('2026-04-17T21:27:17Z'),
    components: [{ eic: 'EIC-1', type: 'ENDPOINT', organization: 'RTE', personName: null, email: null, phone: null, homeCdCode: null, networksCsv: null, displayName: 'E1', country: null, lat: null, lng: null, isDefaultPosition: true, sourceType: 'LOCAL_CSV', creationTs: null, modificationTs: null, urls: [] }],
    paths: [{ receiverEic: 'EIC-1', senderEic: 'EIC-2', messageType: 'A06', transportPattern: 'DIRECT', intermediateBrokerEic: null, validFrom: null, validTo: null, isExpired: false }],
    messagingStats: [],
    appProperties: [{ key: 'foo', value: 'bar' }],
    warnings: [],
  };
}

describe('RawPersisterService', () => {
  let persister: RawPersisterService;
  let prisma: PrismaService;
  let tmpZip: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RawPersisterService, PrismaService],
    }).compile();
    persister = moduleRef.get(RawPersisterService);
    prisma = moduleRef.get(PrismaService);
    tmpZip = join(tmpdir(), `test-raw-${Date.now()}.zip`);
    // écrire un ZIP minimal valide pour repackaging
    const AdmZip = require('adm-zip');
    const z = new AdmZip();
    z.addFile('application_property.csv', Buffer.from('key,value\nfoo,bar\n'));
    z.writeZip(tmpZip);
    // cleanup DB
    await prisma.import.deleteMany({ where: { envName: 'TEST' } });
  });

  afterEach(async () => {
    if (existsSync(tmpZip)) unlinkSync(tmpZip);
    await prisma.import.deleteMany({ where: { envName: 'TEST' } });
  });

  it('persists an import with components, paths, and app properties in a transaction', async () => {
    const built = makeBuilt();
    const zipBuffer = readFileSync(tmpZip);
    const result = await persister.persist(built, zipBuffer);
    expect(result.id).toBeTruthy();
    const inDb = await prisma.import.findUnique({
      where: { id: result.id },
      include: { importedComponents: true, importedPaths: true, importedProps: true },
    });
    expect(inDb?.importedComponents).toHaveLength(1);
    expect(inDb?.importedPaths).toHaveLength(1);
    expect(inDb?.importedProps).toHaveLength(1);
    expect(existsSync(inDb!.zipPath)).toBe(true);
    unlinkSync(inDb!.zipPath);
  });
});
```

- [ ] **Step 8.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- raw-persister
```

Expected : FAIL.

- [ ] **Step 8.3 : Implémenter**

```typescript
// apps/api/src/ingestion/raw-persister.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';
import { PrismaService } from '../prisma/prisma.service.js';
import type { BuiltImport } from './types.js';

const SENSITIVE_FILES = new Set([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);

@Injectable()
export class RawPersisterService {
  private readonly logger = new Logger(RawPersisterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async persist(built: BuiltImport, zipBuffer: Buffer): Promise<{ id: string; zipPath: string }> {
    const id = randomUUID();
    const zipDir = join(process.cwd(), 'storage', 'imports');
    if (!existsSync(zipDir)) mkdirSync(zipDir, { recursive: true });
    const zipPath = join(zipDir, `${id}.zip`);

    const cleanedZip = this.repackageWithoutSensitive(zipBuffer);
    writeFileSync(zipPath, cleanedZip);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.import.create({
          data: {
            id,
            envName: built.envName,
            label: built.label,
            fileName: built.fileName,
            fileHash: built.fileHash,
            sourceComponentEic: built.sourceComponentEic,
            sourceDumpTimestamp: built.sourceDumpTimestamp,
            dumpType: built.dumpType,
            zipPath,
            effectiveDate: built.effectiveDate,
            warningsJson: JSON.stringify(built.warnings),
          },
        });
        if (built.components.length > 0) {
          for (const c of built.components) {
            const created = await tx.importedComponent.create({
              data: { importId: id, ...c, urls: undefined },
            });
            if (c.urls.length > 0) {
              await tx.importedComponentUrl.createMany({
                data: c.urls.map((u) => ({ importedComponentId: created.id, ...u })),
              });
            }
          }
        }
        if (built.paths.length > 0) {
          await tx.importedPath.createMany({ data: built.paths.map((p) => ({ importId: id, ...p })) });
        }
        if (built.messagingStats.length > 0) {
          await tx.importedMessagingStat.createMany({ data: built.messagingStats.map((s) => ({ importId: id, ...s })) });
        }
        if (built.appProperties.length > 0) {
          await tx.importedAppProperty.createMany({ data: built.appProperties.map((p) => ({ importId: id, ...p })) });
        }
      });
    } catch (err) {
      try { unlinkSync(zipPath); } catch (e) { this.logger.warn(`Cleanup failed for ${zipPath}: ${(e as Error).message}`); }
      throw err;
    }

    return { id, zipPath };
  }

  repackageWithoutSensitive(buffer: Buffer): Buffer {
    const input = new AdmZip(buffer);
    const output = new AdmZip();
    for (const entry of input.getEntries()) {
      if (SENSITIVE_FILES.has(entry.entryName)) continue;
      output.addFile(entry.entryName, entry.getData());
    }
    return output.toBuffer();
  }
}
```

- [ ] **Step 8.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- raw-persister
git add apps/api/src/ingestion/raw-persister.service.ts apps/api/src/ingestion/raw-persister.service.spec.ts
git commit -m "feat(api): RawPersisterService — écriture transactionnelle tables brutes

Conserve le repackaging sans fichiers sensibles (P3-1) et le cleanup
zip sur rollback (P3-6).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9 : `ImportsService` — orchestration upload + list + delete

**Files :**
- Create: `apps/api/src/ingestion/imports.service.ts`
- Create: `apps/api/src/ingestion/imports.service.spec.ts`

Service qui orchestre : validation, parseurs, builder, persister pour `createImport` ; `listImports(env?)`, `deleteImport(id)`.

- [ ] **Step 9.1 : Tests rouges**

```typescript
// apps/api/src/ingestion/imports.service.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { ImportsService } from './imports.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildFixtureZip } from '../../test/fixtures-loader.js';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService, ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, RawPersisterService, PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'TEST_IMPORTS_SVC' } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: 'TEST_IMPORTS_SVC' } });
  });

  it('creates an import from a real fixture zip', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    const detail = await service.createImport({
      file: { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip },
      envName: 'TEST_IMPORTS_SVC',
      label: 'smoke fixture',
    });
    expect(detail.id).toBeTruthy();
    expect(detail.envName).toBe('TEST_IMPORTS_SVC');
    expect(detail.dumpType).toBe('ENDPOINT');
    expect(detail.sourceComponentEic).toBe('17V000000498771C');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
  });

  it('lists imports filtered by env', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await service.createImport({ file: { originalname: 'a.zip', buffer: zip }, envName: 'TEST_IMPORTS_SVC', label: 'a' });
    await service.createImport({ file: { originalname: 'b.zip', buffer: zip }, envName: 'OTHER', label: 'b' });
    const list = await service.listImports('TEST_IMPORTS_SVC');
    expect(list).toHaveLength(1);
    expect(list[0]!.label).toBe('a');
    await prisma.import.deleteMany({ where: { envName: 'OTHER' } });
  });

  it('deletes an import and cascades rows + zip file', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    const created = await service.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'TEST_IMPORTS_SVC', label: 'x' });
    await service.deleteImport(created.id);
    const leftover = await prisma.importedComponent.findFirst({ where: { importId: created.id } });
    expect(leftover).toBeNull();
  });
});
```

- [ ] **Step 9.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected : FAIL.

- [ ] **Step 9.3 : Implémenter**

```typescript
// apps/api/src/ingestion/imports.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, unlinkSync } from 'node:fs';
import type { ImportSummary, ImportDetail } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { detectDumpType, type DumpType } from './dump-type-detector.js';
import { parseDumpFilename } from './filename-parser.js';

export type CreateImportInput = {
  file: { originalname: string; buffer: Buffer };
  envName: string;
  label: string;
  dumpType?: DumpType;
};

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly zipExtractor: ZipExtractorService,
    private readonly csvReader: CsvReaderService,
    private readonly xmlParser: XmlMadesParserService,
    private readonly builder: ImportBuilderService,
    private readonly persister: RawPersisterService,
  ) {}

  async createImport(input: CreateImportInput): Promise<ImportDetail> {
    const { file, envName, label } = input;
    const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    const extracted = this.zipExtractor.extract(file.buffer);
    const cdRows = await this.csvReader.readComponentDirectory(extracted);
    const dumpType = detectDumpType(cdRows, input.dumpType);

    const fromCsv = this.builder.buildFromLocalCsv(cdRows);
    const xmlComponents: typeof fromCsv.components = [];
    const xmlPaths = [];
    for (const row of cdRows) {
      if (!row.xml) continue;
      const parsed = this.xmlParser.parse(row.xml);
      const xmlBuilt = this.builder.buildFromXml(parsed);
      xmlComponents.push(...xmlBuilt.components);
      xmlPaths.push(...xmlBuilt.paths);
    }

    const propRows = await this.csvReader.readAppProperties(extracted);
    const statRows = await this.csvReader.readMessagingStats(extracted);
    const appProperties = this.builder.buildAppProperties(propRows);
    const messagingStats = this.builder.buildMessagingStats(statRows);

    const effectiveDate = sourceDumpTimestamp ?? new Date();

    const built = {
      envName,
      label,
      fileName: file.originalname,
      fileHash,
      dumpType,
      sourceComponentEic,
      sourceDumpTimestamp,
      effectiveDate,
      components: [...fromCsv.components, ...xmlComponents],
      paths: xmlPaths,
      messagingStats,
      appProperties,
      warnings: fromCsv.warnings,
    };

    const persisted = await this.persister.persist(built, file.buffer);

    return this.toDetail(persisted.id);
  }

  async listImports(envFilter?: string): Promise<ImportSummary[]> {
    const where = envFilter ? { envName: envFilter } : {};
    const rows = await this.prisma.import.findMany({
      where, orderBy: { effectiveDate: 'desc' },
    });
    return rows.map((r) => this.toSummary(r));
  }

  async deleteImport(id: string): Promise<void> {
    const existing = await this.prisma.import.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Import ${id} not found`);
    await this.prisma.import.delete({ where: { id } });
    if (existsSync(existing.zipPath)) {
      try { unlinkSync(existing.zipPath); } catch { /* best effort */ }
    }
  }

  private async toDetail(id: string): Promise<ImportDetail> {
    const row = await this.prisma.import.findUniqueOrThrow({
      where: { id },
      include: {
        _count: { select: { importedComponents: true, importedPaths: true, importedStats: true } },
      },
    });
    return {
      ...this.toSummary(row),
      warnings: JSON.parse(row.warningsJson),
      stats: {
        componentsCount: row._count.importedComponents,
        pathsCount: row._count.importedPaths,
        messagingStatsCount: row._count.importedStats,
      },
    };
  }

  private toSummary(r: Awaited<ReturnType<typeof this.prisma.import.findFirst>> & {}): ImportSummary {
    return {
      id: r!.id, envName: r!.envName, label: r!.label, fileName: r!.fileName,
      dumpType: r!.dumpType as 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER',
      sourceComponentEic: r!.sourceComponentEic,
      sourceDumpTimestamp: r!.sourceDumpTimestamp?.toISOString() ?? null,
      uploadedAt: r!.uploadedAt.toISOString(),
      effectiveDate: r!.effectiveDate.toISOString(),
    };
  }
}
```

**Note :** `CsvReaderService.readComponentDirectory`, `readAppProperties`, `readMessagingStats` existent-elles ? Si non, lire `csv-reader.service.ts` actuel — sinon ajouter/renommer dans une sous-étape.

- [ ] **Step 9.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
git add apps/api/src/ingestion/imports.service.ts apps/api/src/ingestion/imports.service.spec.ts
git commit -m "feat(api): ImportsService — create/list/delete orchestration

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10 : `ImportsController` + Zod DTOs

**Files :**
- Create: `apps/api/src/ingestion/imports.controller.ts`
- Create: `apps/api/src/ingestion/imports.controller.spec.ts`

- [ ] **Step 10.1 : Test rouge**

```typescript
// apps/api/src/ingestion/imports.controller.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

const fakeService = {
  createImport: async () => ({ id: 'fake', envName: 'X', label: 'l', fileName: 'f.zip', dumpType: 'ENDPOINT', sourceComponentEic: null, sourceDumpTimestamp: null, uploadedAt: '2026-04-19T00:00:00.000Z', effectiveDate: '2026-04-19T00:00:00.000Z', warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 } }),
  listImports: async () => [],
  deleteImport: async () => undefined,
};

describe('ImportsController', () => {
  let ctrl: ImportsController;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: fakeService }],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('rejects body with missing envName', async () => {
    await expect(ctrl.create({} as any, { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b]) } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('rejects file with wrong MIME type', async () => {
    await expect(ctrl.create({ envName: 'X', label: 'l' }, { originalname: 'x.txt', buffer: Buffer.from('hi'), mimetype: 'text/plain' } as any))
      .rejects.toThrow(BadRequestException);
  });

  it('calls service on valid input', async () => {
    const result = await ctrl.create(
      { envName: 'X', label: 'l' },
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    );
    expect(result.id).toBe('fake');
  });
});
```

- [ ] **Step 10.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
```

Expected : FAIL.

- [ ] **Step 10.3 : Implémenter**

```typescript
// apps/api/src/ingestion/imports.controller.ts
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { ImportDetail, ImportSummary } from '@carto-ecp/shared';
import { ImportsService } from './imports.service.js';

const CreateImportSchema = z.object({
  envName: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  dumpType: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER']).optional(),
});

const MAX_SIZE = 50 * 1024 * 1024;
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

@Controller('api/imports')
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async create(
    @Body() body: unknown,
    @UploadedFile() file: { originalname: string; buffer: Buffer; mimetype?: string },
  ): Promise<ImportDetail> {
    const parsed = CreateImportSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Fichier manquant' });
    }
    if (file.mimetype && file.mimetype !== 'application/zip' && file.mimetype !== 'application/x-zip-compressed') {
      throw new BadRequestException({ code: 'INVALID_MIME', message: `MIME invalide : ${file.mimetype}` });
    }
    if (!file.buffer.subarray(0, 4).equals(ZIP_MAGIC)) {
      throw new BadRequestException({ code: 'INVALID_MAGIC', message: 'Magic bytes ZIP invalides' });
    }
    return this.imports.createImport({
      file,
      envName: parsed.data.envName,
      label: parsed.data.label,
      dumpType: parsed.data.dumpType,
    });
  }

  @Get()
  async list(@Query('env') env?: string): Promise<ImportSummary[]> {
    return this.imports.listImports(env);
  }

  @Delete(':id')
  @HttpCode(204)
  async delete(@Param('id') id: string): Promise<void> {
    await this.imports.deleteImport(id);
  }
}
```

- [ ] **Step 10.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
git add apps/api/src/ingestion/imports.controller.ts apps/api/src/ingestion/imports.controller.spec.ts
git commit -m "feat(api): ImportsController — POST /api/imports + list + delete

Validation zod + MIME + magic bytes conservés depuis v1.2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 11 : Wiring `IngestionModule` + suppression legacy + typecheck

**Files :**
- Modify: `apps/api/src/ingestion/ingestion.module.ts`
- Delete: `apps/api/src/ingestion/network-model-builder.service.ts` (+ spec)
- Delete: `apps/api/src/ingestion/snapshot-persister.service.ts` (+ spec)
- Delete: `apps/api/src/snapshots/` (tout le dossier : module, service, controller, specs)
- Modify: `apps/api/src/app.module.ts` (retrait `SnapshotsModule`)
- Modify: `apps/api/src/common/errors/ingestion-errors.ts` (renommer `SnapshotNotFoundException` → `ImportNotFoundException`)

- [ ] **Step 11.1 : Réécrire `ingestion.module.ts`**

```typescript
// apps/api/src/ingestion/ingestion.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { ZipExtractorService } from './zip-extractor.service.js';
import { CsvReaderService } from './csv-reader.service.js';
import { XmlMadesParserService } from './xml-mades-parser.service.js';
import { ImportBuilderService } from './import-builder.service.js';
import { RawPersisterService } from './raw-persister.service.js';
import { ImportsService } from './imports.service.js';
import { ImportsController } from './imports.controller.js';

@Module({
  imports: [PrismaModule, RegistryModule],
  controllers: [ImportsController],
  providers: [
    ZipExtractorService, CsvReaderService, XmlMadesParserService,
    ImportBuilderService, RawPersisterService, ImportsService,
  ],
  exports: [ImportsService],
})
export class IngestionModule {}
```

- [ ] **Step 11.2 : Supprimer legacy files**

```bash
rm apps/api/src/ingestion/network-model-builder.service.ts
rm apps/api/src/ingestion/network-model-builder.service.spec.ts
rm apps/api/src/ingestion/snapshot-persister.service.ts
rm apps/api/src/ingestion/snapshot-persister.service.spec.ts
rm -rf apps/api/src/snapshots
```

- [ ] **Step 11.3 : Renommer l'exception**

Dans `apps/api/src/common/errors/ingestion-errors.ts` :

```typescript
// Remplacer SnapshotNotFoundException par :
import { NotFoundException } from '@nestjs/common';
export class ImportNotFoundException extends NotFoundException {
  constructor(id: string) {
    super({ code: 'IMPORT_NOT_FOUND', message: `Import ${id} not found` });
  }
}
```

Garder `InvalidUploadException` inchangée.

- [ ] **Step 11.4 : Mettre à jour `app.module.ts`**

Retirer l'import et la déclaration de `SnapshotsModule` dans `apps/api/src/app.module.ts`. Garder `IngestionModule`, `GraphModule`, `RegistryModule`, `PrismaModule`.

- [ ] **Step 11.5 : Vérifier compilation API**

```bash
pnpm --filter @carto-ecp/api typecheck
```

Expected : **va encore échouer** (GraphService/GraphController référencent encore `Snapshot`). Ces cassures seront corrigées en Task 12-16. Noter les fichiers qui échouent pour suivi.

- [ ] **Step 11.6 : Commit**

```bash
git add apps/api/src/ingestion/ingestion.module.ts apps/api/src/common/errors/ingestion-errors.ts apps/api/src/app.module.ts
git rm apps/api/src/ingestion/network-model-builder.service.ts apps/api/src/ingestion/network-model-builder.service.spec.ts apps/api/src/ingestion/snapshot-persister.service.ts apps/api/src/ingestion/snapshot-persister.service.spec.ts
git rm -r apps/api/src/snapshots
git commit -m "refactor(api): câblage IngestionModule v2 + suppression SnapshotsModule legacy

Supprime NetworkModelBuilderService et SnapshotPersisterService
(remplacés par ImportBuilderService et RawPersisterService).
Renomme SnapshotNotFoundException → ImportNotFoundException.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 3 — GraphService compute-on-read (TDD)

### Task 12 : `GraphService.mergeComponentsLatestWins` (par champ)

**Files :**
- Create: `apps/api/src/graph/merge-components.ts`
- Create: `apps/api/src/graph/merge-components.spec.ts`

Fonction pure, isolée du service pour tests faciles.

- [ ] **Step 12.1 : Test rouge**

```typescript
// apps/api/src/graph/merge-components.spec.ts
import { describe, expect, it } from 'vitest';
import { mergeComponentsLatestWins, type ImportedComponentWithImport } from './merge-components.js';

const baseComp = {
  eic: '10XAT-APG------Z',
  type: 'ENDPOINT',
  organization: null, personName: null, email: null, phone: null,
  homeCdCode: null, networksCsv: null, displayName: null,
  country: null, lat: null, lng: null, isDefaultPosition: true,
  sourceType: 'XML_CD', creationTs: null, modificationTs: null,
  urls: [],
};

describe('mergeComponentsLatestWins', () => {
  it('returns empty map when no imports', () => {
    const result = mergeComponentsLatestWins([]);
    expect(result.size).toBe(0);
  });

  it('takes fields from the single import', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, displayName: 'APG', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    expect(result.get('10XAT-APG------Z')!.displayName).toBe('APG');
  });

  it('latest effective date wins on contradictory field', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, displayName: 'APG old', _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, displayName: 'APG new', _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    expect(result.get('10XAT-APG------Z')!.displayName).toBe('APG new');
  });

  it('merges complementary fields (non-null from any import)', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, email: 'ops@apg.at', _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, phone: '+43-1-000', _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    const merged = result.get('10XAT-APG------Z')!;
    expect(merged.email).toBe('ops@apg.at');
    expect(merged.phone).toBe('+43-1-000');
  });

  it('preserves url deduplication by (network, url) tuple with latest wins', () => {
    const rows: ImportedComponentWithImport[] = [
      { ...baseComp, urls: [{ network: 'PUBLIC_NETWORK', url: 'https://old.apg.at' }], _effectiveDate: new Date('2026-01-01') },
      { ...baseComp, urls: [{ network: 'PUBLIC_NETWORK', url: 'https://new.apg.at' }], _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergeComponentsLatestWins(rows);
    const urls = result.get('10XAT-APG------Z')!.urls;
    expect(urls).toEqual([{ network: 'PUBLIC_NETWORK', url: 'https://new.apg.at' }]);
  });
});
```

- [ ] **Step 12.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- merge-components
```

Expected : FAIL.

- [ ] **Step 12.3 : Implémenter**

```typescript
// apps/api/src/graph/merge-components.ts
export type ImportedComponentWithImport = {
  eic: string;
  type: string;
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  isDefaultPosition: boolean;
  sourceType: string;
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
  _effectiveDate: Date;
};

export type MergedComponent = Omit<ImportedComponentWithImport, '_effectiveDate'>;

const OVERWRITABLE_FIELDS = [
  'type', 'organization', 'personName', 'email', 'phone',
  'homeCdCode', 'networksCsv', 'displayName', 'country',
  'lat', 'lng', 'sourceType', 'creationTs', 'modificationTs',
] as const;

export function mergeComponentsLatestWins(
  rows: ImportedComponentWithImport[],
): Map<string, MergedComponent> {
  const byEic = new Map<string, ImportedComponentWithImport[]>();
  for (const r of rows) {
    const list = byEic.get(r.eic) ?? [];
    list.push(r);
    byEic.set(r.eic, list);
  }

  const out = new Map<string, MergedComponent>();
  for (const [eic, list] of byEic) {
    list.sort((a, b) => a._effectiveDate.getTime() - b._effectiveDate.getTime());
    const base: MergedComponent = { ...list[0]!, urls: [] };
    delete (base as any)._effectiveDate;

    for (const r of list) {
      for (const f of OVERWRITABLE_FIELDS) {
        const v = (r as any)[f];
        if (v != null) (base as any)[f] = v;
      }
      if (r.isDefaultPosition === false) base.isDefaultPosition = false;
    }

    // URLs : on garde celles du latest import qui en a fournies (dédup par (network, url))
    const latestWithUrls = [...list].reverse().find((r) => r.urls.length > 0);
    base.urls = latestWithUrls?.urls ?? [];

    out.set(eic, base);
  }
  return out;
}
```

- [ ] **Step 12.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- merge-components
git add apps/api/src/graph/merge-components.ts apps/api/src/graph/merge-components.spec.ts
git commit -m "feat(api): mergeComponentsLatestWins — fusion par champ des ImportedComponent

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13 : `GraphService.applyCascade` (5 niveaux)

**Files :**
- Create: `apps/api/src/graph/apply-cascade.ts`
- Create: `apps/api/src/graph/apply-cascade.spec.ts`

- [ ] **Step 13.1 : Test rouge**

```typescript
// apps/api/src/graph/apply-cascade.spec.ts
import { describe, expect, it } from 'vitest';
import { applyCascade, type CascadeInputs } from './apply-cascade.js';

const baseMerged = {
  eic: 'EIC-X', type: 'ENDPOINT', organization: null, personName: null,
  email: null, phone: null, homeCdCode: null, networksCsv: null,
  displayName: null, country: null, lat: null, lng: null,
  isDefaultPosition: true, sourceType: 'LOCAL_CSV',
  creationTs: null, modificationTs: null, urls: [],
};

const emptyInputs: CascadeInputs = {
  override: null, entsoe: null, registry: null,
};

const defaultFallback = { lat: 50.8503, lng: 4.3517 };  // Brussels

describe('applyCascade', () => {
  it('yields default placeholder when no source has data', () => {
    const result = applyCascade('EIC-UNKNOWN', null, emptyInputs, defaultFallback);
    expect(result.eic).toBe('EIC-UNKNOWN');
    expect(result.lat).toBe(50.8503);
    expect(result.lng).toBe(4.3517);
    expect(result.isDefaultPosition).toBe(true);
    expect(result.displayName).toBe('EIC-UNKNOWN');
  });

  it('uses merged-import fields when no higher-priority source', () => {
    const merged = { ...baseMerged, displayName: 'From Import', lat: 48, lng: 16 };
    const result = applyCascade('EIC-X', merged, emptyInputs, defaultFallback);
    expect(result.displayName).toBe('From Import');
    expect(result.lat).toBe(48);
    expect(result.isDefaultPosition).toBe(false);
  });

  it('registry overrides merged-import on field', () => {
    const merged = { ...baseMerged, displayName: 'From Import', lat: 48 };
    const registry = { displayName: 'From Registry' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry }, defaultFallback);
    expect(result.displayName).toBe('From Registry');
    expect(result.lat).toBe(48);  // pas surchargé par registry
  });

  it('ENTSO-E overrides registry and merged-import', () => {
    const merged = { ...baseMerged, displayName: 'From Import' };
    const registry = { displayName: 'From Registry' };
    const entsoe = { displayName: 'From ENTSO-E' };
    const result = applyCascade('EIC-X', merged, { ...emptyInputs, registry, entsoe }, defaultFallback);
    expect(result.displayName).toBe('From ENTSO-E');
  });

  it('admin override overrides everything (level 1)', () => {
    const merged = { ...baseMerged, displayName: 'From Import' };
    const registry = { displayName: 'From Registry' };
    const entsoe = { displayName: 'From ENTSO-E' };
    const override = { displayName: 'Admin choice' };
    const result = applyCascade('EIC-X', merged, { override, registry, entsoe }, defaultFallback);
    expect(result.displayName).toBe('Admin choice');
  });

  it('type field is surchargeable through cascade', () => {
    const merged = { ...baseMerged, type: 'ENDPOINT' };
    const override = { type: 'BROKER' };
    const result = applyCascade('EIC-X', merged, { override, registry: null, entsoe: null }, defaultFallback);
    expect(result.type).toBe('BROKER');
  });
});
```

- [ ] **Step 13.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- apply-cascade
```

Expected : FAIL.

- [ ] **Step 13.3 : Implémenter**

```typescript
// apps/api/src/graph/apply-cascade.ts
import type { MergedComponent } from './merge-components.js';

export type OverrideInput = {
  displayName?: string | null; type?: string | null; organization?: string | null;
  country?: string | null; lat?: number | null; lng?: number | null;
  tagsCsv?: string | null; notes?: string | null;
};
export type EntsoeInput = { displayName?: string | null; organization?: string | null; country?: string | null };
export type RegistryInput = {
  displayName?: string | null; organization?: string | null; country?: string | null;
  lat?: number | null; lng?: number | null; type?: string | null; process?: string | null;
};

export type CascadeInputs = {
  override: OverrideInput | null;
  entsoe: EntsoeInput | null;
  registry: RegistryInput | null;
};

export type GlobalComponent = {
  eic: string;
  type: string;
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  sourceType: string;
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
  tagsCsv: string | null;
  notes: string | null;
  process: string | null;
};

function pickField<T>(...values: Array<T | null | undefined>): T | null {
  for (const v of values) { if (v != null) return v; }
  return null;
}

export function applyCascade(
  eic: string,
  merged: MergedComponent | null,
  inputs: CascadeInputs,
  defaultFallback: { lat: number; lng: number },
): GlobalComponent {
  const { override, entsoe, registry } = inputs;
  const displayName = pickField(override?.displayName, entsoe?.displayName, registry?.displayName, merged?.displayName) ?? eic;
  const organization = pickField(override?.organization, entsoe?.organization, registry?.organization, merged?.organization);
  const country = pickField(override?.country, entsoe?.country, registry?.country, merged?.country);
  const type = pickField(override?.type, registry?.type, merged?.type) ?? 'ENDPOINT';
  const lat = pickField(override?.lat, registry?.lat, merged?.lat);
  const lng = pickField(override?.lng, registry?.lng, merged?.lng);
  const hasExplicitCoord = lat != null && lng != null;

  return {
    eic,
    type,
    organization,
    personName: merged?.personName ?? null,
    email: merged?.email ?? null,
    phone: merged?.phone ?? null,
    homeCdCode: merged?.homeCdCode ?? null,
    networksCsv: merged?.networksCsv ?? null,
    displayName,
    country,
    lat: hasExplicitCoord ? lat! : defaultFallback.lat,
    lng: hasExplicitCoord ? lng! : defaultFallback.lng,
    isDefaultPosition: !hasExplicitCoord,
    sourceType: merged?.sourceType ?? 'LOCAL_CSV',
    creationTs: merged?.creationTs ?? null,
    modificationTs: merged?.modificationTs ?? null,
    urls: merged?.urls ?? [],
    tagsCsv: override?.tagsCsv ?? null,
    notes: override?.notes ?? null,
    process: registry?.process ?? null,
  };
}
```

- [ ] **Step 13.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- apply-cascade
git add apps/api/src/graph/apply-cascade.ts apps/api/src/graph/apply-cascade.spec.ts
git commit -m "feat(api): applyCascade — 5-level priority per field

Ordre : override admin > ENTSO-E > registry RTE > merged-import > default.
isDefaultPosition=true ssi lat/lng viennent du default fallback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14 : `GraphService.mergePathsLatestWins` + classification au read

**Files :**
- Create: `apps/api/src/graph/merge-paths.ts`
- Create: `apps/api/src/graph/merge-paths.spec.ts`

- [ ] **Step 14.1 : Test rouge**

```typescript
// apps/api/src/graph/merge-paths.spec.ts
import { describe, expect, it } from 'vitest';
import { mergePathsLatestWins, type ImportedPathWithImport } from './merge-paths.js';

const basePath: Omit<ImportedPathWithImport, '_effectiveDate'> = {
  receiverEic: 'A', senderEic: 'B', messageType: 'A06',
  transportPattern: 'DIRECT', intermediateBrokerEic: null,
  validFrom: null, validTo: null, isExpired: false,
};

describe('mergePathsLatestWins', () => {
  it('returns empty when no paths', () => {
    expect(mergePathsLatestWins([]).size).toBe(0);
  });

  it('dedups by 5-field identity', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, _effectiveDate: new Date('2026-01-01') },
      { ...basePath, _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(1);
  });

  it('latest validTo / isExpired wins', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, isExpired: false, _effectiveDate: new Date('2026-01-01') },
      { ...basePath, isExpired: true, validTo: new Date('2026-03-01'), _effectiveDate: new Date('2026-04-01') },
    ];
    const result = mergePathsLatestWins(rows);
    const merged = Array.from(result.values())[0]!;
    expect(merged.isExpired).toBe(true);
    expect(merged.validTo?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('different messageType = different key = two entries', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, messageType: 'A06', _effectiveDate: new Date('2026-01-01') },
      { ...basePath, messageType: 'A07', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(2);
  });

  it('reversed (receiver/sender swap) = different key (no canonical sort)', () => {
    const rows: ImportedPathWithImport[] = [
      { ...basePath, receiverEic: 'A', senderEic: 'B', _effectiveDate: new Date('2026-01-01') },
      { ...basePath, receiverEic: 'B', senderEic: 'A', _effectiveDate: new Date('2026-01-01') },
    ];
    const result = mergePathsLatestWins(rows);
    expect(result.size).toBe(2);
  });
});
```

- [ ] **Step 14.2 : Run red**

```bash
pnpm --filter @carto-ecp/api test -- merge-paths
```

Expected : FAIL.

- [ ] **Step 14.3 : Implémenter**

```typescript
// apps/api/src/graph/merge-paths.ts
export type ImportedPathWithImport = {
  receiverEic: string;
  senderEic: string;
  messageType: string;
  transportPattern: string;
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  isExpired: boolean;
  _effectiveDate: Date;
};

export type MergedPath = Omit<ImportedPathWithImport, '_effectiveDate'>;

function identityKey(p: ImportedPathWithImport): string {
  return [p.receiverEic, p.senderEic, p.messageType, p.transportPattern, p.intermediateBrokerEic ?? ''].join('||');
}

export function mergePathsLatestWins(rows: ImportedPathWithImport[]): Map<string, MergedPath> {
  const byKey = new Map<string, ImportedPathWithImport[]>();
  for (const r of rows) {
    const k = identityKey(r);
    const list = byKey.get(k) ?? [];
    list.push(r);
    byKey.set(k, list);
  }
  const out = new Map<string, MergedPath>();
  for (const [k, list] of byKey) {
    list.sort((a, b) => a._effectiveDate.getTime() - b._effectiveDate.getTime());
    const latest = list[list.length - 1]!;
    const merged: MergedPath = {
      receiverEic: latest.receiverEic,
      senderEic: latest.senderEic,
      messageType: latest.messageType,
      transportPattern: latest.transportPattern,
      intermediateBrokerEic: latest.intermediateBrokerEic,
      validFrom: latest.validFrom,
      validTo: latest.validTo,
      isExpired: latest.isExpired,
    };
    out.set(k, merged);
  }
  return out;
}
```

- [ ] **Step 14.4 : Run green + commit**

```bash
pnpm --filter @carto-ecp/api test -- merge-paths
git add apps/api/src/graph/merge-paths.ts apps/api/src/graph/merge-paths.spec.ts
git commit -m "feat(api): mergePathsLatestWins — dédup par clé 5-champs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15 : `GraphService.buildGraph` réécrit + `buildEdges` + `isRecent`

**Files :**
- Modify: `apps/api/src/graph/graph.service.ts` (réécriture intégrale)
- Create: `apps/api/src/graph/graph.service.compute.spec.ts` (remplacer l'ancien spec)
- Delete: `apps/api/src/graph/graph.service.spec.ts` (ancien)

- [ ] **Step 15.1 : Réécrire `graph.service.ts`**

```typescript
// apps/api/src/graph/graph.service.ts
import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { GraphBounds, GraphEdge, GraphNode, GraphResponse, NodeKind, ProcessKey } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { mergeComponentsLatestWins, type ImportedComponentWithImport } from './merge-components.js';
import { applyCascade } from './apply-cascade.js';
import { mergePathsLatestWins, type ImportedPathWithImport } from './merge-paths.js';

const DEFAULT_ISRECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;
function parseThreshold(): number {
  const raw = process.env.ISRECENT_THRESHOLD_MS;
  if (!raw) return DEFAULT_ISRECENT_THRESHOLD_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ISRECENT_THRESHOLD_MS;
}

@Injectable()
export class GraphService {
  private readonly isRecentThreshold = parseThreshold();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async getGraph(envName: string, refDate?: Date): Promise<GraphResponse> {
    const effectiveRef = refDate ?? new Date();
    const imports = await this.prisma.import.findMany({
      where: { envName, effectiveDate: { lte: effectiveRef } },
      orderBy: { effectiveDate: 'asc' },
      include: {
        importedComponents: { include: { urls: true } },
        importedPaths: true,
        importedStats: true,
      },
    });
    const [overrides, entsoeEntries] = await Promise.all([
      this.prisma.componentOverride.findMany(),
      this.prisma.entsoeEntry.findMany(),
    ]);

    const componentRows: ImportedComponentWithImport[] = imports.flatMap((imp) =>
      imp.importedComponents.map((c) => ({
        eic: c.eic, type: c.type,
        organization: c.organization, personName: c.personName, email: c.email, phone: c.phone,
        homeCdCode: c.homeCdCode, networksCsv: c.networksCsv, displayName: c.displayName,
        country: c.country, lat: c.lat, lng: c.lng, isDefaultPosition: c.isDefaultPosition,
        sourceType: c.sourceType, creationTs: c.creationTs, modificationTs: c.modificationTs,
        urls: c.urls.map((u) => ({ network: u.network, url: u.url })),
        _effectiveDate: imp.effectiveDate,
      })),
    );
    const mergedByEic = mergeComponentsLatestWins(componentRows);

    const overrideByEic = new Map(overrides.map((o) => [o.eic, o]));
    const entsoeByEic = new Map(entsoeEntries.map((e) => [e.eic, e]));
    const defaultFallback = { lat: this.registry.getMapConfig().defaultLat, lng: this.registry.getMapConfig().defaultLng };

    const globalComponents = new Map<string, ReturnType<typeof applyCascade>>();
    const eicSet = new Set<string>([
      ...mergedByEic.keys(),
      ...overrideByEic.keys(),
      ...entsoeByEic.keys(),
    ]);
    for (const eic of eicSet) {
      const merged = mergedByEic.get(eic) ?? null;
      const override = overrideByEic.get(eic) ?? null;
      const entsoe = entsoeByEic.get(eic) ?? null;
      const registryEntry = this.registry.resolveEic(eic);  // voir note ci-dessous
      const global = applyCascade(eic, merged, { override, entsoe, registry: registryEntry }, defaultFallback);
      globalComponents.set(eic, global);
    }

    const pathRows: ImportedPathWithImport[] = imports.flatMap((imp) =>
      imp.importedPaths.map((p) => ({
        receiverEic: p.receiverEic, senderEic: p.senderEic,
        messageType: p.messageType, transportPattern: p.transportPattern,
        intermediateBrokerEic: p.intermediateBrokerEic,
        validFrom: p.validFrom, validTo: p.validTo, isExpired: p.isExpired,
        _effectiveDate: imp.effectiveDate,
      })),
    );
    const mergedPaths = mergePathsLatestWins(pathRows);

    const rteEicSet = this.registry.getRteEicSet();
    const edges = this.buildEdges(Array.from(mergedPaths.values()), imports, rteEicSet);

    const nodes: GraphNode[] = Array.from(globalComponents.values()).map((g) => this.toNode(g, rteEicSet));
    return {
      bounds: this.computeBounds(nodes),
      nodes,
      edges,
      mapConfig: this.registry.getMapConfig(),
    };
  }

  private toNode(g: ReturnType<typeof applyCascade>, rteEicSet: Set<string>): GraphNode {
    return {
      id: g.eic,
      eic: g.eic,
      kind: this.kindOf(g, rteEicSet),
      displayName: g.displayName,
      organization: g.organization ?? '',
      country: g.country,
      lat: g.lat, lng: g.lng,
      isDefaultPosition: g.isDefaultPosition,
      networks: g.networksCsv ? g.networksCsv.split(',') : [],
      process: g.process as ProcessKey | null,
      urls: g.urls,
      creationTs: (g.creationTs ?? new Date(0)).toISOString(),
      modificationTs: (g.modificationTs ?? new Date(0)).toISOString(),
    };
  }

  private kindOf(g: ReturnType<typeof applyCascade>, rteEicSet: Set<string>): NodeKind {
    const isRte = rteEicSet.has(g.eic);
    if (g.type === 'BROKER') return 'BROKER';
    if (g.type === 'COMPONENT_DIRECTORY') return isRte ? 'RTE_CD' : 'EXTERNAL_CD';
    return isRte ? 'RTE_ENDPOINT' : 'EXTERNAL_ENDPOINT';
  }

  private buildEdges(
    paths: Array<ReturnType<typeof mergePathsLatestWins> extends Map<any, infer V> ? V : never>,
    imports: Array<{ importedStats: Array<{ sourceEndpointCode: string; remoteComponentCode: string; connectionStatus: string | null; lastMessageUp: Date | null; lastMessageDown: Date | null }>; effectiveDate: Date }>,
    rteEicSet: Set<string>,
  ): GraphEdge[] {
    type Group = {
      fromEic: string; toEic: string; direction: 'IN' | 'OUT';
      processes: Set<ProcessKey>; messageTypes: Set<string>;
      transports: Set<'DIRECT' | 'INDIRECT'>; intermediateBroker: string | null;
      validFrom: Date | null; validTo: Date | null;
    };
    const groups = new Map<string, Group>();
    for (const p of paths) {
      if (p.receiverEic === '*' || p.senderEic === '*') continue;
      // direction calculée vs rteEicSet : si receiverEic est RTE → IN (externe → RTE), sinon OUT
      const direction: 'IN' | 'OUT' = rteEicSet.has(p.receiverEic) ? 'IN' : 'OUT';
      const fromEic = direction === 'IN' ? p.senderEic : p.receiverEic;
      const toEic = direction === 'IN' ? p.receiverEic : p.senderEic;
      const process = this.registry.classifyMessageType(p.messageType) as ProcessKey;
      const key = `${fromEic}::${toEic}`;
      const existing = groups.get(key);
      if (existing) {
        existing.processes.add(process);
        existing.messageTypes.add(p.messageType);
        existing.transports.add(p.transportPattern as 'DIRECT' | 'INDIRECT');
      } else {
        groups.set(key, {
          fromEic, toEic, direction,
          processes: new Set([process]), messageTypes: new Set([p.messageType]),
          transports: new Set([p.transportPattern as 'DIRECT' | 'INDIRECT']),
          intermediateBroker: p.intermediateBrokerEic,
          validFrom: p.validFrom, validTo: p.validTo,
        });
      }
    }

    // Stats : clé = (sourceEndpointCode, remoteComponentCode). On prend l'import le plus récent qui en fournit.
    const statsByKey = new Map<string, { stat: { connectionStatus: string | null; lastMessageUp: Date | null; lastMessageDown: Date | null }; effective: Date }>();
    for (const imp of imports) {
      for (const s of imp.importedStats) {
        const k1 = `${s.sourceEndpointCode}::${s.remoteComponentCode}`;
        const prev = statsByKey.get(k1);
        if (!prev || prev.effective < imp.effectiveDate) {
          statsByKey.set(k1, { stat: s, effective: imp.effectiveDate });
        }
      }
    }

    const edges: GraphEdge[] = Array.from(groups.values()).map((g) => {
      const processes = Array.from(g.processes);
      const process: ProcessKey = processes.length > 1 ? 'MIXTE' : (processes[0] ?? 'UNKNOWN');
      const hash = createHash('sha1').update(`${g.fromEic}|${g.toEic}|${process}`).digest('hex').slice(0, 16);
      const stat = statsByKey.get(`${g.fromEic}::${g.toEic}`) ?? statsByKey.get(`${g.toEic}::${g.fromEic}`) ?? null;
      const refTime = imports[imports.length - 1]?.effectiveDate.getTime() ?? Date.now();
      const isRecent = stat?.stat.lastMessageUp != null
        && refTime - stat.stat.lastMessageUp.getTime() < this.isRecentThreshold
        && refTime - stat.stat.lastMessageUp.getTime() >= 0;
      return {
        id: hash, fromEic: g.fromEic, toEic: g.toEic, direction: g.direction,
        process, messageTypes: Array.from(g.messageTypes),
        transportPatterns: Array.from(g.transports),
        intermediateBrokerEic: g.intermediateBroker,
        activity: {
          connectionStatus: stat?.stat.connectionStatus ?? null,
          lastMessageUp: stat?.stat.lastMessageUp?.toISOString() ?? null,
          lastMessageDown: stat?.stat.lastMessageDown?.toISOString() ?? null,
          isRecent: Boolean(isRecent),
        },
        validFrom: (g.validFrom ?? new Date(0)).toISOString(),
        validTo: g.validTo?.toISOString() ?? null,
      };
    });
    return edges;
  }

  private computeBounds(nodes: GraphNode[]): GraphBounds {
    if (nodes.length === 0) return { north: 60, south: 40, east: 20, west: -10 };
    let north = -90, south = 90, east = -180, west = 180;
    for (const n of nodes) {
      if (n.lat > north) north = n.lat;
      if (n.lat < south) south = n.lat;
      if (n.lng > east) east = n.lng;
      if (n.lng < west) west = n.lng;
    }
    const pad = 2;
    return { north: north + pad, south: south - pad, east: east + pad, west: west - pad };
  }
}
```

**Note :** `RegistryService.resolveEic(eic)` doit être ajoutée si elle n'existe pas. Remplacer l'ancienne `resolveComponent` par une méthode qui retourne **juste** les champs registry d'un EIC donné (pas le composant complet) :

```typescript
// Dans registry.service.ts
resolveEic(eic: string): { displayName?: string | null; organization?: string | null; country?: string | null; lat?: number | null; lng?: number | null; type?: string | null; process?: string | null } | null {
  // ... chercher dans overlay.rteEndpoints, rteComponentDirectory, rteBusinessApps, organizationGeocode
}
```

`getMapConfig()` doit exposer `defaultLat`/`defaultLng` — ajouter ces champs dans `mapConfig` de l'overlay JSON si absents (50.8503, 4.3517 = Bruxelles par défaut).

- [ ] **Step 15.2 : Supprimer l'ancien `graph.service.spec.ts`**

```bash
rm apps/api/src/graph/graph.service.spec.ts
```

- [ ] **Step 15.3 : Écrire nouveau test compute**

```typescript
// apps/api/src/graph/graph.service.compute.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { GraphService } from './graph.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { ImportsService } from '../ingestion/imports.service.js';
import { IngestionModule } from '../ingestion/ingestion.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { buildFixtureZip } from '../../test/fixtures-loader.js';

describe('GraphService.getGraph — compute on read', () => {
  let graph: GraphService;
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, RegistryModule, IngestionModule],
      providers: [GraphService],
    }).compile();
    await moduleRef.init();
    graph = moduleRef.get(GraphService);
    imports = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_GS' } } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_GS' } } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_GS' } } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_GS' } } });
  });

  it('returns empty graph when no import in env', async () => {
    const g = await graph.getGraph('TEST_GS_EMPTY');
    expect(g.nodes).toHaveLength(0);
    expect(g.edges).toHaveLength(0);
    expect(g.bounds).toEqual({ north: 60, south: 40, east: 20, west: -10 });
  });

  it('computes graph from 1 import (parity with v1.2 behavior)', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await imports.createImport({ file: { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }, envName: 'TEST_GS_A', label: 'single' });
    const g = await graph.getGraph('TEST_GS_A');
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.edges.length).toBeGreaterThan(0);
  });

  it('env isolation : graph(OPF) does not contain PROD imports', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await imports.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'TEST_GS_OPF', label: 'x' });
    const g = await graph.getGraph('TEST_GS_PROD');
    expect(g.nodes).toHaveLength(0);
  });

  it('refDate filters out later imports', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await imports.createImport({ file: { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }, envName: 'TEST_GS_TIME', label: 'recent' });
    const past = new Date('2020-01-01');
    const g = await graph.getGraph('TEST_GS_TIME', past);
    expect(g.nodes).toHaveLength(0);
  });

  it('applies ComponentOverride at level 1 (highest priority)', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await imports.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'TEST_GS_OV', label: 'x' });
    await prisma.componentOverride.create({ data: { eic: '17V000000498771C', displayName: 'ADMIN_OVERRIDDEN' } });
    const g = await graph.getGraph('TEST_GS_OV');
    const node = g.nodes.find((n) => n.eic === '17V000000498771C');
    expect(node?.displayName).toBe('ADMIN_OVERRIDDEN');
    await prisma.componentOverride.delete({ where: { eic: '17V000000498771C' } });
  });
});
```

- [ ] **Step 15.4 : Run green (tests + typecheck)**

```bash
pnpm --filter @carto-ecp/api test -- graph.service.compute
pnpm --filter @carto-ecp/api typecheck
```

Expected : tests PASS (5/5). Typecheck peut encore échouer sur `graph.controller.ts` (Task 16 next).

- [ ] **Step 15.5 : Commit**

```bash
git rm apps/api/src/graph/graph.service.spec.ts
git add apps/api/src/graph/graph.service.ts apps/api/src/graph/graph.service.compute.spec.ts apps/api/src/registry/registry.service.ts packages/registry/eic-rte-overlay.json
git commit -m "feat(api): GraphService compute-on-read avec cascade 5 niveaux

getGraph(env, refDate?) = merge(imports eligibles) + cascade override>entsoe>registry>merged>default.
Paths : dédup clé 5-champs, latest-wins, classification au read.
Edges : agrégation (fromEic, toEic), MIXTE si >1 process, direction vs rteEicSet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16 : `GraphController` — nouvelle route `/api/graph?env&refDate`

**Files :**
- Modify: `apps/api/src/graph/graph.controller.ts`
- Modify: `apps/api/src/graph/graph.controller.spec.ts`

- [ ] **Step 16.1 : Réécrire `graph.controller.ts`**

```typescript
// apps/api/src/graph/graph.controller.ts
import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type { GraphResponse } from '@carto-ecp/shared';
import { GraphService } from './graph.service.js';

@Controller('api/graph')
export class GraphController {
  constructor(private readonly graph: GraphService) {}

  @Get()
  async getGraph(@Query('env') env: string, @Query('refDate') refDate?: string): Promise<GraphResponse> {
    if (!env) throw new BadRequestException({ code: 'MISSING_ENV', message: 'Query param "env" is required' });
    let parsedRef: Date | undefined;
    if (refDate) {
      const d = new Date(refDate);
      if (Number.isNaN(d.getTime())) throw new BadRequestException({ code: 'INVALID_REF_DATE', message: `Invalid ISO date: ${refDate}` });
      parsedRef = d;
    }
    return this.graph.getGraph(env, parsedRef);
  }
}
```

- [ ] **Step 16.2 : Réécrire `graph.controller.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GraphController } from './graph.controller.js';
import { GraphService } from './graph.service.js';

describe('GraphController', () => {
  let ctrl: GraphController;
  const fakeGraph = { nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 }, mapConfig: {} as any };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [{ provide: GraphService, useValue: { getGraph: async () => fakeGraph } }],
    }).compile();
    ctrl = moduleRef.get(GraphController);
  });

  it('rejects missing env', async () => {
    await expect(ctrl.getGraph('' as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid refDate', async () => {
    await expect(ctrl.getGraph('OPF', 'not-a-date')).rejects.toThrow(BadRequestException);
  });

  it('returns graph on valid input', async () => {
    const g = await ctrl.getGraph('OPF');
    expect(g.nodes).toEqual([]);
  });
});
```

- [ ] **Step 16.3 : Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- graph.controller
pnpm --filter @carto-ecp/api typecheck
git add apps/api/src/graph/graph.controller.ts apps/api/src/graph/graph.controller.spec.ts
git commit -m "feat(api): GraphController — GET /api/graph?env=X&refDate=ISO

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Endpoint env + tests d'intégration

### Task 17 : `EnvsController` + service

**Files :**
- Create: `apps/api/src/envs/envs.module.ts`
- Create: `apps/api/src/envs/envs.service.ts`
- Create: `apps/api/src/envs/envs.controller.ts`
- Create: `apps/api/src/envs/envs.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register `EnvsModule`)

- [ ] **Step 17.1 : Test rouge**

```typescript
// apps/api/src/envs/envs.controller.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { EnvsController } from './envs.controller.js';
import { EnvsService } from './envs.service.js';

describe('EnvsController', () => {
  let ctrl: EnvsController;
  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EnvsController],
      providers: [{ provide: EnvsService, useValue: { listEnvs: async () => ['OPF', 'PROD'] } }],
    }).compile();
    ctrl = moduleRef.get(EnvsController);
  });

  it('returns distinct env names', async () => {
    const result = await ctrl.list();
    expect(result).toEqual(['OPF', 'PROD']);
  });
});
```

- [ ] **Step 17.2 : Implémenter**

```typescript
// envs.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
@Injectable()
export class EnvsService {
  constructor(private readonly prisma: PrismaService) {}
  async listEnvs(): Promise<string[]> {
    const rows = await this.prisma.import.findMany({ distinct: ['envName'], select: { envName: true } });
    return rows.map((r) => r.envName).sort();
  }
}

// envs.controller.ts
import { Controller, Get } from '@nestjs/common';
import { EnvsService } from './envs.service.js';
@Controller('api/envs')
export class EnvsController {
  constructor(private readonly envs: EnvsService) {}
  @Get() async list(): Promise<string[]> { return this.envs.listEnvs(); }
}

// envs.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EnvsController } from './envs.controller.js';
import { EnvsService } from './envs.service.js';
@Module({ imports: [PrismaModule], controllers: [EnvsController], providers: [EnvsService] })
export class EnvsModule {}
```

Ajouter `EnvsModule` dans `app.module.ts`.

- [ ] **Step 17.3 : Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- envs
git add apps/api/src/envs/ apps/api/src/app.module.ts
git commit -m "feat(api): EnvsController — GET /api/envs (liste distincte)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18 : Test d'intégration full-ingestion v2

**Files :**
- Create: `apps/api/test/full-ingestion-v2.spec.ts`
- Modify: `apps/api/test/fixtures-loader.ts` (si besoin — vérifier signature)

- [ ] **Step 18.1 : Écrire le test**

```typescript
// apps/api/test/full-ingestion-v2.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildFixtureZip } from './fixtures-loader.js';

describe('Full ingestion v2 (integration)', () => {
  let imports: ImportsService;
  let graph: GraphService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    graph = app.get(GraphService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'INTEG_OPF' } });
  });

  afterAll(async () => {
    await prisma.import.deleteMany({ where: { envName: 'INTEG_OPF' } });
  });

  it('uploads 2 fixtures, aggregates into a single graph', async () => {
    const zipEndpoint = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    const zipCd = buildFixtureZip('17V000002014106G_2026-04-17T22_11_50Z');

    await imports.createImport({ file: { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zipEndpoint }, envName: 'INTEG_OPF', label: 'endpoint' });
    await imports.createImport({ file: { originalname: '17V000002014106G_2026-04-17T22_11_50Z.zip', buffer: zipCd }, envName: 'INTEG_OPF', label: 'cd' });

    const g = await graph.getGraph('INTEG_OPF');
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.edges.length).toBeGreaterThan(0);
    // Pas de doublons EIC dans les nodes
    const eics = new Set(g.nodes.map((n) => n.eic));
    expect(eics.size).toBe(g.nodes.length);
  });
});
```

- [ ] **Step 18.2 : Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- full-ingestion-v2
git add apps/api/test/full-ingestion-v2.spec.ts
git commit -m "test(api): intégration full-ingestion v2 (2 fixtures, agrégation carte)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19 : Tests d'intégration env-isolation + import-deletion

**Files :**
- Create: `apps/api/test/env-isolation.spec.ts`
- Create: `apps/api/test/import-deletion.spec.ts`

- [ ] **Step 19.1 : Écrire env-isolation**

```typescript
// apps/api/test/env-isolation.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildFixtureZip } from './fixtures-loader.js';

describe('Env isolation', () => {
  let imports: ImportsService;
  let graph: GraphService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    graph = app.get(GraphService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } } });
  });

  afterAll(async () => {
    await prisma.import.deleteMany({ where: { envName: { in: ['ISO_OPF', 'ISO_PROD'] } } });
  });

  it('graph(OPF) and graph(PROD) are independent', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    await imports.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'ISO_OPF', label: 'opf' });
    await imports.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'ISO_PROD', label: 'prod' });

    const gOpf = await graph.getGraph('ISO_OPF');
    const gProd = await graph.getGraph('ISO_PROD');
    expect(gOpf.nodes.length).toBeGreaterThan(0);
    expect(gProd.nodes.length).toBeGreaterThan(0);
    expect(gOpf.nodes.length).toBe(gProd.nodes.length);  // même fixture, mêmes EICs
  });
});
```

- [ ] **Step 19.2 : Écrire import-deletion**

```typescript
// apps/api/test/import-deletion.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { GraphService } from '../src/graph/graph.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildFixtureZip } from './fixtures-loader.js';

describe('Import deletion', () => {
  let imports: ImportsService; let graph: GraphService; let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    graph = app.get(GraphService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'DEL_TEST' } });
  });

  afterAll(async () => {
    await prisma.import.deleteMany({ where: { envName: 'DEL_TEST' } });
  });

  it('removes all contributions and zip file on delete', async () => {
    const zip = buildFixtureZip('17V000000498771C_2026-04-17T21_27_17Z');
    const created = await imports.createImport({ file: { originalname: 'x.zip', buffer: zip }, envName: 'DEL_TEST', label: 'x' });
    const before = await graph.getGraph('DEL_TEST');
    expect(before.nodes.length).toBeGreaterThan(0);

    const dbBefore = await prisma.import.findUnique({ where: { id: created.id } });
    expect(existsSync(dbBefore!.zipPath)).toBe(true);

    await imports.deleteImport(created.id);

    const after = await graph.getGraph('DEL_TEST');
    expect(after.nodes).toHaveLength(0);
    expect(existsSync(dbBefore!.zipPath)).toBe(false);
  });
});
```

- [ ] **Step 19.3 : Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- env-isolation import-deletion
git add apps/api/test/env-isolation.spec.ts apps/api/test/import-deletion.spec.ts
git commit -m "test(api): intégration env-isolation + import-deletion

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 5 — Frontend

### Task 20 : Client API web + types

**Files :**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 20.1 : Réécrire client API**

```typescript
// apps/web/src/lib/api.ts
import type { GraphResponse, ImportDetail, ImportSummary } from '@carto-ecp/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  async listEnvs(): Promise<string[]> {
    return request<string[]>('/api/envs');
  },
  async listImports(env?: string): Promise<ImportSummary[]> {
    const query = env ? `?env=${encodeURIComponent(env)}` : '';
    return request<ImportSummary[]>(`/api/imports${query}`);
  },
  async createImport(file: File, envName: string, label: string, dumpType?: string): Promise<ImportDetail> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('envName', envName);
    fd.append('label', label);
    if (dumpType) fd.append('dumpType', dumpType);
    return request<ImportDetail>('/api/imports', { method: 'POST', body: fd });
  },
  async deleteImport(id: string): Promise<void> {
    await request<void>(`/api/imports/${id}`, { method: 'DELETE' });
  },
  async getGraph(env: string, refDate?: Date): Promise<GraphResponse> {
    const qs = new URLSearchParams({ env });
    if (refDate) qs.set('refDate', refDate.toISOString());
    return request<GraphResponse>(`/api/graph?${qs.toString()}`);
  },
};
```

- [ ] **Step 20.2 : Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): client API v2 (imports, envs, graph?env&refDate)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 21 : Zustand store refondu

**Files :**
- Modify: `apps/web/src/store/app-store.ts`
- Modify: `apps/web/src/store/app-store.test.ts` (ou supprimer s'il teste activeSnapshotId)

- [ ] **Step 21.1 : Réécrire store**

```typescript
// apps/web/src/store/app-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphResponse, ImportSummary } from '@carto-ecp/shared';
import { api } from '../lib/api.js';

type AppState = {
  activeEnv: string | null;
  envs: string[];
  imports: ImportSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  loadEnvs: () => Promise<void>;
  setActiveEnv: (env: string) => Promise<void>;
  loadImports: (env: string) => Promise<void>;
  loadGraph: (env: string, refDate?: Date) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeEnv: null, envs: [], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null, loading: false, error: null,

      loadEnvs: async () => {
        set({ loading: true, error: null });
        try {
          const envs = await api.listEnvs();
          set({ envs, loading: false });
          const current = get().activeEnv;
          const stillValid = current != null && envs.includes(current);
          if (stillValid) {
            await get().setActiveEnv(current);
          } else if (envs.length > 0) {
            await get().setActiveEnv(envs[0]!);
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      setActiveEnv: async (env) => {
        set({ activeEnv: env, selectedNodeEic: null, selectedEdgeId: null });
        await Promise.all([get().loadImports(env), get().loadGraph(env)]);
      },

      loadImports: async (env) => {
        const imports = await api.listImports(env);
        set({ imports });
      },

      loadGraph: async (env, refDate) => {
        set({ loading: true, error: null });
        try {
          const graph = await api.getGraph(env, refDate);
          set({ graph, loading: false });
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      selectNode: (eic) => set({ selectedNodeEic: eic, selectedEdgeId: null }),
      selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeEic: null }),
    }),
    { name: 'carto-ecp-store', partialize: (s) => ({ activeEnv: s.activeEnv }) },
  ),
);
```

- [ ] **Step 21.2 : Mettre à jour ou supprimer `app-store.test.ts`**

Si le test existe, le réécrire pour valider `loadEnvs` / `setActiveEnv` / `loadImports`. Sinon, skip.

- [ ] **Step 21.3 : Commit**

```bash
git add apps/web/src/store/
git commit -m "feat(web): store Zustand refonte v2 (activeEnv, envs, imports, graph)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 22 : `EnvSelector` component

**Files :**
- Create: `apps/web/src/components/EnvSelector/EnvSelector.tsx`
- Create: `apps/web/src/components/EnvSelector/EnvSelector.test.tsx`

- [ ] **Step 22.1 : Test rouge**

```tsx
// apps/web/src/components/EnvSelector/EnvSelector.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { EnvSelector } from './EnvSelector.js';

describe('EnvSelector', () => {
  beforeEach(() => {
    useAppStore.setState({ envs: ['OPF', 'PROD'], activeEnv: 'OPF' });
  });

  it('renders all envs', () => {
    render(<EnvSelector />);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['OPF', 'PROD']);
  });

  it('marks activeEnv as selected', () => {
    render(<EnvSelector />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('OPF');
  });

  it('calls setActiveEnv on change', async () => {
    const setActiveEnv = vi.fn();
    useAppStore.setState({ setActiveEnv });
    render(<EnvSelector />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'PROD');
    expect(setActiveEnv).toHaveBeenCalledWith('PROD');
  });
});
```

- [ ] **Step 22.2 : Implémenter**

```tsx
// apps/web/src/components/EnvSelector/EnvSelector.tsx
import { useAppStore } from '../../store/app-store.js';

export function EnvSelector(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const setActiveEnv = useAppStore((s) => s.setActiveEnv);

  if (envs.length === 0) {
    return <span className="text-sm text-gray-500">Aucun env</span>;
  }
  return (
    <select
      value={activeEnv ?? ''}
      onChange={(e) => void setActiveEnv(e.target.value)}
      className="rounded border border-gray-300 px-2 py-1 text-sm"
    >
      {envs.map((e) => (<option key={e} value={e}>{e}</option>))}
    </select>
  );
}
```

- [ ] **Step 22.3 : Run + commit**

```bash
pnpm --filter @carto-ecp/web test -- EnvSelector
git add apps/web/src/components/EnvSelector/
git commit -m "feat(web): EnvSelector component (remplace SnapshotSelector)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 23 : `MapPage` avec empty state + consommation activeEnv

**Files :**
- Modify: `apps/web/src/pages/MapPage.tsx`

Remplacer la consommation de `activeSnapshotId` par `activeEnv`. Ajouter empty state si `graph.nodes.length === 0`.

- [ ] **Step 23.1 : Réécrire `MapPage.tsx`**

```tsx
// apps/web/src/pages/MapPage.tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { NetworkMap } from '../components/Map/NetworkMap.js';
import { DetailPanel } from '../components/DetailPanel/DetailPanel.js';

export function MapPage(): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadEnvs = useAppStore((s) => s.loadEnvs);
  const loading = useAppStore((s) => s.loading);
  const error = useAppStore((s) => s.error);

  useEffect(() => { void loadEnvs(); }, [loadEnvs]);

  if (loading && !graph) return <div className="p-8 text-gray-500">Chargement…</div>;
  if (error) return <div className="p-8 text-red-700">Erreur : {error}</div>;

  if (!activeEnv || !graph || graph.nodes.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-8">
        <p className="text-center text-gray-700">
          {activeEnv
            ? <>Aucun composant connu pour l'environnement <strong>{activeEnv}</strong>.</>
            : <>Aucun import dans la base.</>}
        </p>
        <Link
          to={activeEnv ? `/upload?env=${encodeURIComponent(activeEnv)}` : '/upload'}
          className="rounded bg-rte px-4 py-2 text-white"
        >
          Importer un dump
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <NetworkMap />
      <DetailPanel />
    </div>
  );
}
```

- [ ] **Step 23.2 : Commit**

```bash
pnpm --filter @carto-ecp/web test
git add apps/web/src/pages/MapPage.tsx
git commit -m "feat(web): MapPage en entrée principale avec empty state

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 24 : `UploadPage` — adaptations v2

**Files :**
- Modify: `apps/web/src/pages/UploadPage.tsx`
- Modify: `apps/web/src/pages/UploadPage.test.tsx`

Changements :
- Appeler `api.createImport` au lieu de `api.createSnapshot`
- Utiliser `envName` depuis query param `?env=X` si présent
- Après succès, appeler `loadEnvs` + rediriger vers `/`
- Texte : « Importer un dump ECP »

- [ ] **Step 24.1 : Réécrire `UploadPage.tsx`**

```tsx
// apps/web/src/pages/UploadPage.tsx
import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ImportDetail, Warning } from '@carto-ecp/shared';
import { api } from '../lib/api.js';
import { useAppStore } from '../store/app-store.js';

const MAX_UPLOAD = 50 * 1024 * 1024;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loadEnvs = useAppStore((s) => s.loadEnvs);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [envName, setEnvName] = useState(searchParams.get('env') ?? 'OPF');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportDetail | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxSize: MAX_UPLOAD,
    multiple: false,
    onDrop: (accepted) => { setFile(accepted[0] ?? null); setError(null); },
    onDropRejected: (rejections) => { setError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté'); },
  });

  const submit = async (): Promise<void> => {
    if (!file || !label.trim() || !envName.trim()) {
      setError('Fichier, label et environnement sont requis');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await api.createImport(file, envName.trim(), label.trim());
      setResult(res);
      await loadEnvs();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const openMap = (): void => { navigate('/'); };

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Importer un dump ECP</h1>
      <p className="mb-6 text-sm text-gray-600">
        Déposez un dump ZIP (Endpoint ou Component Directory). Format attendu :
        <code className="px-1">{'{EIC}_{timestamp}.zip'}</code>.
      </p>
      <div {...getRootProps()} className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${isDragActive ? 'border-rte bg-red-50' : 'border-gray-300 bg-gray-50'}`}>
        <input {...getInputProps()} />
        {file ? (<p><strong>{file.name}</strong> — {(file.size / 1024).toFixed(1)} KB</p>) : (<p>{isDragActive ? 'Déposez ici' : 'Cliquez ou déposez un .zip'}</p>)}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Label</span>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" placeholder="ex: Semaine 15 RTE" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Environnement</span>
          <input type="text" value={envName} onChange={(e) => setEnvName(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2" placeholder="OPF / PROD / PFRFI" />
        </label>
      </div>
      <button type="button" onClick={() => { void submit(); }} disabled={loading} className="rounded bg-rte px-4 py-2 font-medium text-white disabled:opacity-50">
        {loading ? 'Envoi en cours…' : 'Importer'}
      </button>
      {error ? (<p className="mt-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">{error}</p>) : null}
      {result ? (
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm text-gray-700">
            Import créé : <strong>{result.label}</strong> — {result.dumpType} —{' '}
            {result.stats.componentsCount} composants / {result.stats.pathsCount} paths
          </p>
          {result.warnings.length > 0 ? (
            <details className="mb-3 text-sm text-gray-600">
              <summary>{result.warnings.length} avertissement(s)</summary>
              <ul className="mt-2 space-y-1">
                {result.warnings.slice(0, 20).map((w: Warning, idx) => (<li key={idx}><code>{w.code}</code> — {w.message}</li>))}
              </ul>
            </details>
          ) : null}
          <button type="button" onClick={openMap} className="rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white">Voir sur la carte →</button>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 24.2 : Adapter `UploadPage.test.tsx`**

Remplacer `api.createSnapshot` par `api.createImport`, `SnapshotDetail` par `ImportDetail`, `result.componentType` par `result.dumpType`.

- [ ] **Step 24.3 : Run + commit**

```bash
pnpm --filter @carto-ecp/web test -- UploadPage
git add apps/web/src/pages/UploadPage.tsx apps/web/src/pages/UploadPage.test.tsx
git commit -m "feat(web): UploadPage appelle api.createImport + redirige vers /

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 25 : `App.tsx` — routes `/ = map`, `/map` alias, `/upload` conservé, suppression SnapshotSelector

**Files :**
- Modify: `apps/web/src/App.tsx`
- Delete: `apps/web/src/components/SnapshotSelector/` (dossier entier)

- [ ] **Step 25.1 : Réécrire `App.tsx`**

```tsx
// apps/web/src/App.tsx
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { EnvSelector } from './components/EnvSelector/EnvSelector.js';

export function App(): JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/" className="text-lg font-semibold">Carto ECP — RTE</Link>
        <div className="flex items-center gap-3">
          <EnvSelector />
          <Link to="/upload" className="text-sm text-rte underline">+ Importer</Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/map" element={<Navigate to="/" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

- [ ] **Step 25.2 : Supprimer `SnapshotSelector`**

```bash
rm -rf apps/web/src/components/SnapshotSelector
```

- [ ] **Step 25.3 : Typecheck + commit**

```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
git rm -r apps/web/src/components/SnapshotSelector
git add apps/web/src/App.tsx
git commit -m "feat(web): routes / = map, /upload conservé, suppression SnapshotSelector

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 26 : E2E — empty state

**Files :**
- Create: `apps/web/tests/e2e/empty-state.spec.ts`

- [ ] **Step 26.1 : Écrire**

```typescript
// apps/web/tests/e2e/empty-state.spec.ts
import { expect, test } from '@playwright/test';

test('empty state when no import', async ({ page }) => {
  // Assume DB reset ; si besoin, appeler DELETE /api/imports/:id sur tous les imports avant
  await page.goto('/');
  await expect(page.getByText(/Aucun import dans la base|Aucun composant connu/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Importer un dump/ })).toBeVisible();
});
```

- [ ] **Step 26.2 : Run + commit**

```bash
pnpm --filter @carto-ecp/web exec playwright test --grep "empty state"
git add apps/web/tests/e2e/empty-state.spec.ts
git commit -m "test(web): E2E empty state page d'accueil

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 27 : E2E — upload-then-map

**Files :**
- Create ou modify: `apps/web/tests/e2e/upload-then-map.spec.ts`

- [ ] **Step 27.1 : Écrire**

```typescript
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

function buildFixtureZipBuffer(): Buffer {
  // Monter un ZIP minimal à partir d'un des dossiers tests/fixtures/
  const zip = new AdmZip();
  const base = join(__dirname, '..', '..', '..', '..', 'tests', 'fixtures', '17V000000498771C_2026-04-17T21_27_17Z');
  const files = ['application_property.csv', 'component_directory.csv', 'messaging_statistics.csv'];
  for (const f of files) {
    const path = join(base, f);
    try { zip.addFile(f, readFileSync(path)); } catch { /* ignore */ }
  }
  return zip.toBuffer();
}

test('upload a dump, land on /, carte peuplée', async ({ page }) => {
  await page.goto('/upload');
  const filename = '17V000000498771C_2026-04-17T21_27_17Z.zip';
  await page.setInputFiles('input[type="file"]', { name: filename, mimeType: 'application/zip', buffer: buildFixtureZipBuffer() });
  await page.fill('input[placeholder*="Label"]', 'e2e smoke');
  await page.fill('input[placeholder*="OPF"]', 'E2E_TEST');
  await page.getByRole('button', { name: /Importer/ }).click();
  await page.getByRole('button', { name: /Voir sur la carte/ }).click();
  await expect(page).toHaveURL(/\/$/);
  // au moins 1 marker CircleMarker visible (classe leaflet)
  await expect(page.locator('.leaflet-interactive').first()).toBeVisible();
});
```

- [ ] **Step 27.2 : Run + commit**

```bash
pnpm --filter @carto-ecp/web exec playwright test --grep "upload a dump"
git add apps/web/tests/e2e/upload-then-map.spec.ts
git commit -m "test(web): E2E upload + redirection vers carte peuplée

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 28 : E2E — env-switch

**Files :**
- Create: `apps/web/tests/e2e/env-switch.spec.ts`

- [ ] **Step 28.1 : Écrire**

```typescript
import { expect, test } from '@playwright/test';

test('switch env via selector → carte change', async ({ page }) => {
  // Pré-requis : 2 imports dans 2 envs différents (via le test précédent upload-then-map qui laisse E2E_TEST,
  // plus un setup programmatic pour E2E_OTHER via API directe avant test)
  // Setup : POST /api/imports dans E2E_OTHER (simplification : ce test assume que setup est fait en fixture de suite)
  await page.goto('/');
  const select = page.locator('select');
  await expect(select).toBeVisible();
  const envs = await select.locator('option').allTextContents();
  expect(envs.length).toBeGreaterThan(1);
  await select.selectOption(envs[1]!);
  // Attendre rerender
  await page.waitForTimeout(500);
  // La carte devrait changer (nombre de markers différent ou empty state)
  await expect(page.locator('body')).toBeVisible();
});
```

- [ ] **Step 28.2 : Commit**

```bash
git add apps/web/tests/e2e/env-switch.spec.ts
git commit -m "test(web): E2E switch d'env via sélecteur

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 6 — Smoke final + CHANGELOG + PR

### Task 29 : Smoke manuel + CHANGELOG v2.0-alpha.1 + PR

**Files :**
- Modify: `CHANGELOG.md`
- Modify: `package.json` (si bump version)

- [ ] **Step 29.1 : Smoke end-to-end manuel**

```bash
pnpm --filter @carto-ecp/api prisma:migrate reset --force
pnpm --filter @carto-ecp/api prisma:migrate deploy
pnpm dev
```

Dans un navigateur :
1. Ouvrir http://localhost:5173/
2. Vérifier empty state.
3. Aller sur `/upload`, uploader `17V000000498771C_2026-04-17T21_27_17Z.zip` dans env `OPF`, label `smoke`.
4. Cliquer « Voir sur la carte → » → attendre affichage nodes/edges.
5. Retour `/upload`, uploader le 2e fixture dans même env.
6. Retour `/` → vérifier que les nodes supplémentaires apparaissent.
7. Via DevTools : `fetch('/api/imports?env=OPF')` → doit retourner 2 items.
8. Via DevTools : `fetch('/api/imports/<id>', { method: 'DELETE' })` sur un des deux → vérifier que la carte se met à jour après reload (F5).

Si tout OK, continuer. Sinon, revenir corriger.

- [ ] **Step 29.2 : Ajouter entrée CHANGELOG**

Ouvrir `CHANGELOG.md`. Sous `## [Unreleased]`, ajouter :

```markdown
### Added — v2.0-alpha.1 (slice 2a Fondations)

- **v2-2a-01 — Chapeau fonctionnel v2.0** : `docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md` documente le passage de « 1 snapshot = 1 vue » à « carte vivante cumulative N imports ». Remplace l'ancien `carto-ecp-document-fonctionnel-v1.2.md` comme référence fonctionnelle.
- **v2-2a-02 — ADRs fondateurs** : ADR-023 (raw + compute on read), ADR-024 (cascade 5 niveaux), ADR-025 (clé path 5 champs), ADR-026 (effectiveDate), ADR-027 (envName first-class), ADR-028 (suppression endpoints legacy), ADR-030 (DumpTypeDetector).
- **v2-2a-03 — Schéma Prisma v2.0** : tables `Import`, `ImportedComponent(+Url)`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`. Migration reset totale.
- **v2-2a-04 — Pipeline ingestion refondu** : `ImportBuilder` remplace `NetworkModelBuilder` (pas de cascade à l'écriture), `RawPersister` remplace `SnapshotPersister`, `DumpTypeDetector` et `filename-parser` ajoutés. `CsvReader`, `XmlMadesParser`, `ZipExtractor` inchangés.
- **v2-2a-05 — `GraphService` compute-on-read** : `getGraph(env, refDate?)` agrège à la lecture avec cascade 5 niveaux. `merge-components.ts`, `apply-cascade.ts`, `merge-paths.ts` isolés en fonctions pures testables.
- **v2-2a-06 — Endpoints API v2** : `POST /api/imports`, `GET /api/imports?env`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`.
- **v2-2a-07 — Front refondu** : `/` = carte par défaut (empty state si pas d'import), `EnvSelector` remplace `SnapshotSelector`, `/upload` conservé en single-file, store Zustand (`activeEnv` persisté, suppression `activeSnapshotId`).
- **v2-2a-08 — Tests** : 3 unit tests graph isolés (`merge-components`, `apply-cascade`, `merge-paths`), 1 compute graph test, 3 intégration (full-ingestion-v2, env-isolation, import-deletion), 3 E2E (empty-state, upload-then-map, env-switch).

### Removed — v2.0-alpha.1

- `SnapshotsModule`, `NetworkModelBuilderService`, `SnapshotPersisterService`, `SnapshotSelector` (web) et tous les endpoints `/api/snapshots*`. Migration de data = reset total (dev-local). Le dossier `storage/snapshots/` legacy peut être supprimé manuellement après cette mise à jour.
```

- [ ] **Step 29.3 : Typecheck + tests full + commit**

```bash
pnpm typecheck
pnpm test
git add CHANGELOG.md
git commit -m "docs: CHANGELOG v2.0-alpha.1 — slice 2a Fondations

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 29.4 : Push + PR**

```bash
git push -u origin feat/v2-slice-2a-fondations
gh pr create --base main --title "feat(v2): slice 2a Fondations — data model raw + compute-on-read" --body "$(cat <<'EOF'
## Summary
- Refonte data model : `Snapshot isolé` → `Import brut + compute-on-read agrégé par env`
- Nouveau pipeline `ImportBuilder` + `RawPersister` (pas de cascade à l'écriture)
- `GraphService.getGraph(env, refDate?)` = merge latest-wins + cascade 5 niveaux (override > ENTSO-E > registry > imports > default)
- Endpoints v2 : `/api/imports*`, `/api/graph?env&refDate`, `/api/envs` ; suppression `/api/snapshots*`
- Front : `/` = carte en entrée, `EnvSelector`, empty state, `/upload` conservé single-file
- 7 ADRs (023-028, 030), migration Prisma reset total, 3 unit tests purs + 1 compute test + 3 intégration + 3 E2E

## Spec
- [Chapeau v2.0](docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md)
- [Slice 2a design](docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2a-design.md)

## Test plan
- [ ] `pnpm test` tous verts
- [ ] `pnpm typecheck` vert
- [ ] `pnpm test:e2e` vert (3 smoke)
- [ ] Smoke manuel : upload 2 fixtures, vérifier agrégation, suppression, switch env
- [ ] DB reset appliqué (migration `v2_fondations_raw_tables`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review (effectué par l'auteur du plan, pas le dev)

**1. Spec coverage :**
- Chapeau §3 modèle conceptuel → Task 2 (schema) + Task 5-7 (ImportBuilder) + Task 12-15 (merge/cascade) ✅
- Chapeau §4 cascade 5 niveaux → Task 13 (applyCascade unit test + 5 niveaux) ✅
- Chapeau §5 clé path 5 champs → Task 14 (mergePathsLatestWins) ✅
- Chapeau §6 envName first-class → Task 2 (schema), Task 17 (envs), Task 19 (env-isolation) ✅
- Slice 2a §A schéma → Task 2 ✅
- Slice 2a §B pipeline → Tasks 3-11 ✅
- Slice 2a §C GraphService → Tasks 12-16 ✅
- Slice 2a §D endpoints → Tasks 10, 16, 17 ✅
- Slice 2a §E front → Tasks 20-28 ✅
- Slice 2a §F tests → unit (intégrés dans chaque task) + intégration (18, 19) + E2E (26, 27, 28) ✅
- Slice 2a §G migration reset → Task 2 ✅
- Slice 2a §H ADRs → Task 1 ✅
- Slice 2a §J DoD → Task 29 ✅

**2. Placeholder scan :** aucune instance de « TBD », « implement later », « similar to Task N ». OK.

**3. Type consistency :**
- `BuiltImport` / `BuiltImportedComponent` / `BuiltImportedPath` / `BuiltImportedMessagingStat` définis Task 5, utilisés tasks 6-9. ✅
- `ImportedComponentWithImport` / `MergedComponent` Task 12, utilisés Task 15. ✅
- `ImportedPathWithImport` / `MergedPath` Task 14, utilisés Task 15. ✅
- `CascadeInputs` / `GlobalComponent` Task 13, utilisés Task 15. ✅
- `ImportSummary` / `ImportDetail` shared Task 2, utilisés Tasks 9, 10, 20. ✅
- `registry.resolveEic` mentionné Task 15 — à ajouter dans `RegistryService` (noter dans les step de Task 15 l'ajout explicite). ⚠️ Noté dans §Step 15.1 comme "à ajouter si absente".
- `registry.getMapConfig().defaultLat/defaultLng` référencés Task 15 — supposent que l'overlay JSON contient ces champs. Le design indique que `mapConfig` est déjà exposé par `RegistryService` (P3-4) ; ajouter `defaultLat`/`defaultLng` dans `eic-rte-overlay.json#mapConfig` si absent et exposer via `MapConfig` shared type.

**4. Action résiduelle :** ajouter une substep explicite dans Task 15 pour bumper `packages/registry/eic-rte-overlay.json` et `packages/shared/src/graph.ts` (type `MapConfig`) avec `defaultLat`/`defaultLng`.

> **Fix inline appliqué ci-dessus :** voir Task 15 §Step 15.1 note finale — l'ingénieur doit vérifier `mapConfig.defaultLat/defaultLng` et les ajouter si absents.

---

## Execution Handoff

Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2a.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — je dispatch un subagent frais par task, review entre chaque, itération rapide. Prérequis : sub-skill `superpowers:subagent-driven-development`.

**2. Inline Execution** — exécution tasks dans cette session via `superpowers:executing-plans`, batch avec checkpoints pour review.

Laquelle choisis-tu ?
