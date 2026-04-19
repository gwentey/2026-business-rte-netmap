# Slice 2b — Multi-upload + détection fiable + parser CD complet

> **Statut :** design validé (2026-04-19), prêt pour `/superpowers:write-plan`.
> **Réfère :** [`2026-04-19-carto-ecp-v2-chapeau.md`](./2026-04-19-carto-ecp-v2-chapeau.md) pour vocabulaire et feuille de route ; [`2026-04-19-carto-ecp-v2-slice-2a-design.md`](./2026-04-19-carto-ecp-v2-slice-2a-design.md) pour le modèle data sous-jacent.
> **Branche cible :** `feat/v2-slice-2b-multi-upload` (créée depuis la tête de `feat/v2-slice-2a-fondations`).
> **Docs sources ECP officielle :** `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20`, `docs/officiel/ECP System Design v4.16.0.pdf §9.2.2`.

---

## §1 — Objectif

Élever `/upload` de single-file à **multi-upload avec preview et confirmation**, construit sur une détection **fiable** du type de dump (ENDPOINT/CD/BROKER) basée sur la signature des fichiers CSV documentée officiellement, et sur un **parser CD complet** qui lit `message_path.csv` directement (au lieu de s'appuyer sur le XML MADES qui n'existe pas dans les dumps CD).

Cette slice répond directement au premier pain point initial de l'utilisateur : *« Aujourd'hui on arrive pas à upload plusieurs ZIP donc quand on upload la configuration d'un CD on ne voit que ce que le CD est configuré alors que on va récupérer peut être 10 ZIP entre les CD et les endpoints. »*

---

## §2 — Scope

### 2b livre

- `DumpTypeDetectorV2` — détection fiable via inspection des noms de fichiers dans le ZIP (remplace la v1 naïve de 2a qui inspectait le contenu XML).
- `CsvPathReader` — parser officiel du format ECP CD pour `message_path.csv`.
- Nouvelle méthode `ImportBuilder.buildFromCdCsv()` spécifique CD (composants depuis `component_directory.csv`, paths depuis `message_path.csv`, pas de XML).
- Nouvel endpoint `POST /api/imports/inspect` — preview multi-fichiers sans persistance.
- `POST /api/imports` étendu avec `replaceImportId?` pour remplacement explicite d'un doublon.
- Nouvelle `UploadPage.tsx` avec dropzone multi-fichiers, table de preview, batch submit best-effort, résumé.
- Acceptation minimale des dumps BROKER (stockage metadata only, sans composants/paths).
- Tests TDD : unit (détecteur v2, parser CD, inspect service, replace flow), intégration (batch mixte 5 fichiers, fixture CD pleine), 1 E2E Playwright (drag 2 fichiers → carte).
- 3 ADRs fondateurs :
  - **ADR-031** — DumpTypeDetectorV2 via signature des CSV
  - **ADR-032** — Parser CD indépendant du XML MADES
  - **ADR-033** — Flow best-effort transactionnel par fichier

### 2b NE livre pas (reporté)

- Admin panel `/admin/imports` (liste, rename, delete via UI, édition `effectiveDate`) → slice **2c**
- Surcharge par EIC (`ComponentOverride`) UI + API CRUD → slice **2c**
- Timeline slider UI → slice **2d**
- Annuaire ENTSO-E refresh, registry admin, purges → slice **2e**
- Icônes différenciées sur la carte (broker ≠ CD ≠ endpoint visuel) → slice **2f**
- Parsing riche d'un dump BROKER (extraction de broker.xml, artemis data) → reporté indéfiniment (pas de valeur métier immédiate — les brokers RTE peuvent être déclarés via le registry overlay ou via `ComponentOverride` en 2c)

---

## §A — Architecture globale

```
┌── Frontend (apps/web) ───────────────────────────────────────┐
│                                                               │
│  /upload (réécrit)                                            │
│    ├── Dropzone multi-fichiers (react-dropzone, multiple)    │
│    ├── Store uploadBatch (Zustand slice, non-persisté)       │
│    ├── Appel POST /api/imports/inspect au drop               │
│    ├── Table de preview avec états (pending/ok/dup/error)    │
│    ├── Bouton "Importer tout" → boucle séq. POST /api/imports│
│    └── Résumé final → navigate('/')                          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌── Backend (apps/api) ────────────────────────────────────────┐
│                                                               │
│  POST /api/imports/inspect   (NOUVEAU)                        │
│    → ZipExtractor.listEntries() (sans extraction mémoire)    │
│    → DumpTypeDetectorV2 (inspection noms de fichiers)        │
│    → filenameParser → sourceEic + timestamp                  │
│    → SHA256 du buffer                                         │
│    → DB query : duplicateOf ← (sourceEic, timestamp) sinon h │
│    → retourne InspectResult[]                                 │
│                                                               │
│  POST /api/imports (étendu)                                   │
│    → ImportsService.createImport avec replaceImportId?       │
│       si replaceImportId fourni : delete(old) puis create     │
│    → Pipeline : Zip → Csv → [Xml | CsvPathReader] → Builder  │
│       - Si dumpType=ENDPOINT : pipeline v2a (XML blob)       │
│       - Si dumpType=CD : CsvPathReader (nouveau)              │
│       - Si dumpType=BROKER : components=[], paths=[], stop    │
│    → RawPersister.persist                                     │
│                                                               │
│  Services nouveaux :                                          │
│    - DumpTypeDetectorV2 (remplace v1)                         │
│    - CsvPathReader                                            │
│    - ImportBuilder.buildFromCdCsv (nouvelle méthode)          │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## §B — `DumpTypeDetectorV2`

**Fichier cible :** `apps/api/src/ingestion/dump-type-detector.ts` (réécriture intégrale)

**Entrée :** liste des `entryName` d'un ZIP (obtenu via `ZipExtractor.listEntries(buffer)` nouvelle méthode, qui énumère sans extraire les données en mémoire).

**Signature des fichiers selon Admin Guide §4.20 :**

| Fichier CSV | ENDPOINT | CD | Signature |
|---|---|---|---|
| `messaging_statistics.csv` | ✓ | ✗ | **ENDPOINT exclusif** |
| `message_upload_route.csv` | ✓ | ✗ | **ENDPOINT exclusif** |
| `registration_store.csv` | ✓ | ✗ | ENDPOINT (sensible) |
| `synchronized_directories.csv` | ✗ | ✓ | **CD exclusif** |
| `component_statistics.csv` | ✗ | ✓ | **CD exclusif** |
| `registration_requests.csv` | ✗ | ✓ | CD (sensible) |
| `pending_edit_directories.csv` | ✗ | ✓ | CD exclusif |
| `pending_removal_directories.csv` | ✗ | ✓ | CD exclusif |
| `broker.xml`, `bootstrap.xml` | ✗ | ✗ | **BROKER** (file-system backup) |

**Cascade de détection (ordre de spécificité, du plus certain au fallback) :**

```typescript
export type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

export type DumpTypeDetection = {
  dumpType: DumpType;
  confidence: 'HIGH' | 'FALLBACK';
  reason: string;
};

export function detectDumpType(
  zipEntries: ReadonlyArray<{ entryName: string }>,
  explicitOverride?: DumpType,
): DumpTypeDetection {
  if (explicitOverride) {
    return { dumpType: explicitOverride, confidence: 'HIGH', reason: 'user override' };
  }
  const names = new Set(zipEntries.map((e) => e.entryName.toLowerCase()));
  const has = (f: string) => names.has(f);

  // CD — signatures exclusives prioritaires
  if (has('synchronized_directories.csv'))
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'synchronized_directories.csv (CD exclusive)' };
  if (has('component_statistics.csv'))
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'component_statistics.csv (CD exclusive)' };
  if (has('pending_edit_directories.csv') || has('pending_removal_directories.csv'))
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'pending_*_directories.csv (CD exclusive)' };

  // ENDPOINT — signatures exclusives
  if (has('messaging_statistics.csv'))
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'messaging_statistics.csv (ENDPOINT exclusive)' };
  if (has('message_upload_route.csv'))
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'message_upload_route.csv (ENDPOINT exclusive)' };

  // BROKER — absence totale de CSV + présence de config Artemis
  if (has('broker.xml') || has('bootstrap.xml'))
    return { dumpType: 'BROKER', confidence: 'HIGH', reason: 'broker.xml/bootstrap.xml (BROKER file-system backup)' };

  // Fallback : si component_directory.csv seul, on suppose CD
  if (has('component_directory.csv'))
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'component_directory.csv seul — défaut CD' };

  // Aucune signature reconnue
  return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'aucune signature ECP reconnue — défaut CD' };
}
```

Le champ `confidence` sert :
- Côté **API** : retourné dans `InspectResult` pour affichage frontend.
- Côté **UI preview** : `FALLBACK` affiche une icône ⚠ invitant l'admin à choisir manuellement le `dumpType`.

---

## §C — `CsvPathReader` (nouveau)

**Fichier cible :** `apps/api/src/ingestion/csv-path-reader.service.ts`

**Motivation :** les dumps CD n'ont **pas** de blob XML MADES (contrairement aux dumps ENDPOINT). Les paths sont directement dans `message_path.csv` avec le format suivant, observé dans la fixture `17V000002014106G_2026-04-17T22_11_50Z/message_path.csv` et confirmé par l'Admin Guide §4.20 (« message_path_receiver [et] message_path_sender included in message_path CSV ») :

```csv
allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil
17V-A|17V-B;;;A06;17V-X|17V-Y;DIRECT;2026-01-01T00:00:00.000Z;;
```

- **`allowedSenders`** et **`receivers`** sont des listes (`List<string>` dans Public Interface §1765). La fixture `17V000002014106G_2026-04-17T22_11_50Z/message_path.csv` ne contient que le header (pas de données) → **le séparateur imbriqué n'est pas observable sur nos données**. Stratégie pragmatique : essayer `|` d'abord, fallback `,`, puis fallback `;` (si csv-parse a restitué le contenu dé-échappé). Les tests unit paramètrent les trois formats. Si un CD réel remonte avec un 4e séparateur, on lève un warning `CSV_PATH_SEPARATOR_UNEXPECTED` et on skippe la ligne. Une ligne = N senders × M receivers = N×M `ImportedPath` logiques.
- **`intermediateBrokerCode`** → `intermediateBrokerEic` (nullable).
- **`intermediateComponent`** → ignoré en 2b (information rarement utile côté carto, on pourra la ré-exposer plus tard si besoin).
- **`validFrom / validTo / validUntil`** → deux dates potentiellement distinctes (`validTo` = fin logique, `validUntil` = fin technique). Règle : `validTo` si présent, sinon `validUntil`, sinon null.
- **`isExpired`** → calculé : `(validTo ?? validUntil) < now`.

**API du service :**

```typescript
// apps/api/src/ingestion/csv-path-reader.service.ts
import { Injectable } from '@nestjs/common';
import type { BuiltImportedPath, Warning } from './types.js';

export type CdMessagePathRow = {
  allowedSenders: string;        // liste "|"-séparée ou "*"
  intermediateBrokerCode?: string | null;
  intermediateComponent?: string | null;
  messageType: string;
  receivers: string;             // liste "|"-séparée
  transportPattern: 'DIRECT' | 'INDIRECT';
  validFrom?: string | null;
  validTo?: string | null;
  validUntil?: string | null;
};

@Injectable()
export class CsvPathReaderService {
  readCdMessagePaths(rows: ReadonlyArray<CdMessagePathRow>): { paths: BuiltImportedPath[]; warnings: Warning[] };
}
```

**Règles d'explosion :**

```typescript
function splitList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  // Format observé : "EIC1|EIC2|EIC3" ou ";" selon échappement CSV
  const trimmed = raw.trim();
  if (trimmed === '*' || trimmed === '') return ['*'];  // wildcard explicite
  return trimmed.split(/[|;]/).map((s) => s.trim()).filter((s) => s.length > 0);
}

// Pour chaque ligne :
for (const sender of splitList(row.allowedSenders)) {
  for (const receiver of splitList(row.receivers)) {
    paths.push({
      receiverEic: receiver,
      senderEic: sender,  // '*' toléré, skippé au rendu carto
      messageType: row.messageType,
      transportPattern: row.transportPattern,
      intermediateBrokerEic: nonEmpty(row.intermediateBrokerCode),
      validFrom: parseDate(row.validFrom),
      validTo: parseDate(row.validTo ?? row.validUntil),
      isExpired: computeExpired(row.validTo ?? row.validUntil),
    });
  }
}
```

**Edge cases à couvrir dans les tests :**
1. Ligne avec `allowedSenders = "*"` + 3 receivers → 3 paths wildcard.
2. Ligne sans `validTo` mais avec `validUntil` → fallback sur `validUntil`.
3. `transportPattern` inconnu (ni DIRECT ni INDIRECT) → warning `CSV_PATH_UNKNOWN_TRANSPORT`, ligne skippée.
4. Séparateur inhabituel (espace, virgule) → warning `CSV_PATH_SEPARATOR_UNEXPECTED`.

---

## §D — `ImportBuilder` étendu

**Fichier modifié :** `apps/api/src/ingestion/import-builder.service.ts`

Nouvelle méthode `buildFromCdCsv()` à côté des existantes (`buildFromLocalCsv`, `buildFromXml`, `buildMessagingStats`, `buildAppProperties`) :

```typescript
// Signature
buildFromCdCsv(
  cdComponentRows: CdComponentDirectoryRow[],
  cdPathRows: CdMessagePathRow[],
): {
  components: BuiltImportedComponent[];
  paths: BuiltImportedPath[];
  warnings: Warning[];
}
```

**Différences avec `buildFromLocalCsv` (ENDPOINT) :**

| Aspect | ENDPOINT (`buildFromLocalCsv`) | CD (`buildFromCdCsv`) |
|---|---|---|
| Source composants | `component_directory.csv` (flat + XML blob imbriqué) | `component_directory.csv` (flat, **sans** XML blob) |
| Source paths | XML MADES dans `directoryContent` | `message_path.csv` via `CsvPathReader` |
| Type détecté par défaut | `ENDPOINT` sauf si `componentCode == eic` | Le composant source = `COMPONENT_DIRECTORY`, les autres = `ENDPOINT` par défaut, broker stubs générés depuis `intermediateBrokerCode` |

**Pipeline d'orchestration dans `ImportsService.createImport` :**

```typescript
const inspect = detectDumpType(zipEntries, input.dumpType);

let components: BuiltImportedComponent[] = [];
let paths: BuiltImportedPath[] = [];

switch (inspect.dumpType) {
  case 'ENDPOINT': {
    // Pipeline v2a (inchangé) : CSV + XML MADES imbriqué
    const cdRows = this.csvReader.readComponentDirectory(extracted, warnings);
    const fromCsv = this.builder.buildFromLocalCsv(cdRows);
    const xmlComponents = [];
    const xmlPaths = [];
    for (const row of cdRows) {
      if (hasXmlBlob(row)) {
        const parsed = this.xmlParser.parse(row.directoryContent);
        const xmlBuilt = this.builder.buildFromXml(parsed);
        xmlComponents.push(...xmlBuilt.components);
        xmlPaths.push(...xmlBuilt.paths);
      }
    }
    components = dedupByEic([...fromCsv.components, ...xmlComponents]);
    paths = xmlPaths;
    break;
  }
  case 'COMPONENT_DIRECTORY': {
    // Pipeline 2b (NOUVEAU) : deux CSVs, pas de XML
    const cdRows = this.csvReader.readComponentDirectory(extracted, warnings);
    const pathRows = this.csvReader.readMessagePaths(extracted, warnings);  // nouvelle méthode CsvReaderService
    const built = this.builder.buildFromCdCsv(cdRows, pathRows);
    components = built.components;
    paths = built.paths;
    break;
  }
  case 'BROKER': {
    // 2b : metadata only
    components = [];
    paths = [];
    warnings.push({ code: 'BROKER_DUMP_METADATA_ONLY', message: 'Dump BROKER accepté sans extraction de graph' });
    break;
  }
}
```

**Note :** `CsvReaderService` a actuellement `readComponentDirectory` et `readApplicationProperties` et `readMessagingStatistics`. Il faut ajouter `readMessagePaths(extracted, warnings): CdMessagePathRow[]` qui lit `message_path.csv` avec le même parseur `csv-parse` déjà en place (séparateur `;`, header ligne 1).

---

## §E — Endpoints API

### `POST /api/imports/inspect` (nouveau)

**Entrée :** multipart form-data avec N fichiers (key `files`) + `envName` optionnel.

**Limite taille batch** : `FileInterceptor` configuré avec `limits: { fileSize: 50MB, files: 20 }` (20 fichiers × 50MB max = 1GB par requête). Si user veut dépasser, il scinde son batch en deux drops successifs. Le body-parser NestJS accepte ~1GB en multipart par défaut — à surveiller via monitoring si les batches réels dépassent.

**Sortie :** JSON array `InspectResult[]` :

```typescript
// packages/shared/src/graph.ts (nouveau type)
export type InspectResult = {
  fileName: string;
  fileSize: number;
  fileHash: string;                 // SHA256
  sourceComponentEic: string | null;
  sourceDumpTimestamp: string | null;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence: 'HIGH' | 'FALLBACK';
  reason: string;
  duplicateOf: { importId: string; label: string; uploadedAt: string } | null;
  warnings: Warning[];
};
```

**Logique côté service (`ImportsService.inspectBatch(files, envName?)`) :**

```typescript
for (const file of files) {
  const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
  const fileHash = sha256(file.buffer);
  const zipEntries = this.zipExtractor.listEntries(file.buffer);  // nouvelle méthode
  const detection = detectDumpType(zipEntries);
  const duplicate = await this.findDuplicate({ sourceComponentEic, sourceDumpTimestamp, fileHash, envName });
  results.push({ ...detection, fileHash, duplicateOf: duplicate, ... });
}
return results;
```

**Règle dédup (findDuplicate) :**
1. Si `(sourceComponentEic, sourceDumpTimestamp)` tous deux non-null → cherche `Import` avec ces deux champs identiques dans **tous les envs**. Trouvé → retourne son `importId` + meta.
2. Sinon fallback sur `fileHash` → cherche `Import` avec ce même hash.
3. Sinon retourne `null`.

**Pourquoi cross-env pour la dédup :** si le même dump est uploadé sur `OPF` puis `PROD`, c'est bien un cas légitime (même dump, deux envs d'import). Dans ce cas on affiche `duplicateOf` mais on **laisse passer** à l'upload si les envs diffèrent. Le check strict d'unicité se fait plus loin au niveau `(envName, fileHash)`.

Actualisation : **règle simplifiée** — la dédup affichée dans le preview compare **dans l'env cible choisi** (le champ `envName` du form). Cross-env = autorisé sans alerte. Ça colle à la logique "un env = une carte" validée en 2a.

### `POST /api/imports` (étendu)

**Body ajouté :**

```typescript
const CreateImportSchema = z.object({
  envName: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  dumpType: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER']).optional(),
  replaceImportId: z.string().uuid().optional(),  // NOUVEAU
});
```

**Comportement si `replaceImportId` fourni :**
- Vérifie que l'import cible existe **et** est dans le même `envName`. Sinon `400 REPLACE_IMPORT_MISMATCH`.
- Délète l'ancien import (cascade + unlink zip) **avant** de créer le nouveau, **dans la même transaction** (ou équivalent : si la création échoue, rollback inclut la réinsertion de l'ancien — implémenté via `prisma.$transaction`).
- Warnings : le nouveau `Import.warnings` mentionne `{ code: 'REPLACED_IMPORT', message: 'Replaces import {oldLabel} (id: {oldId})' }`.

**Comportement par défaut (`replaceImportId` absent) :** identique v2a. Pas de check dédup automatique à cette étape — le frontend est responsable d'avoir filtré via `/inspect`.

### Nouveau endpoint utilitaire (optionnel, non bloquant)

Pas de nouveau GET `/api/imports/check` — la dédup est embarquée dans `/inspect`. Simplification bienvenue.

---

## §F — Frontend : nouvelle `UploadPage`

### Store Zustand — ajout `uploadBatch`

**Fichier :** `apps/web/src/store/app-store.ts` (extension)

```typescript
type UploadBatchItem = {
  id: string;                    // client-side uuid, pour keys React
  file: File;
  fileName: string;
  fileSize: number;
  fileHash?: string;             // rempli après inspect
  sourceComponentEic?: string | null;
  sourceDumpTimestamp?: string | null;
  dumpType?: DumpType;
  confidence?: 'HIGH' | 'FALLBACK';
  label: string;                 // auto-dérivé, éditable
  overrideDumpType?: DumpType;   // si user override dans le select
  duplicateOf?: { importId: string; label: string } | null;
  forceReplace: boolean;         // si user coche "Remplacer"
  state: 'pending-inspect' | 'inspected' | 'uploading' | 'done' | 'skipped' | 'error';
  errorCode?: string;
  errorMessage?: string;
  createdImportId?: string;
};

type AppState = {
  // ... state v2a existant
  uploadBatch: UploadBatchItem[];
  uploadInProgress: boolean;

  addBatchFiles: (files: File[]) => Promise<void>;          // inspect + add to batch
  removeBatchItem: (id: string) => void;
  updateBatchItem: (id: string, patch: Partial<UploadBatchItem>) => void;
  submitBatch: (envName: string) => Promise<void>;          // boucle séq POST /imports
  clearBatch: () => void;
};
```

**Important :** `uploadBatch` est **non persisté** (absent de `partialize`). Si user refresh la page au milieu, le batch est perdu — acceptable, on n'a pas de use-case justifiant la restauration.

### `UploadPage.tsx` réécrite

**Structure :**

```
┌─ /upload ────────────────────────────────────────────────┐
│  Importer des dumps ECP                                   │
│                                                           │
│  ┌──────────────────────────────────────────┐             │
│  │ Environnement : [OPF          ▼]         │             │
│  └──────────────────────────────────────────┘             │
│                                                           │
│  ┌─ Dropzone multi-files ────────────────────┐            │
│  │  Glissez N fichiers .zip ou cliquez       │            │
│  └────────────────────────────────────────────┘            │
│                                                           │
│  ┌─ Batch (3 fichiers, 2 prêts, 1 doublon) ──────────┐   │
│  │ Fichier         EIC      Type        Label        │   │
│  │ 🗑 a.zip (29K)  17V..C   [ENDPOINT▼] [e2e]   🟢  │   │
│  │ 🗑 b.zip (30K)  17V..G   [CD▼]       [cd-1]  🟡 doublon (id abc123…) │   │
│  │                                       [x] Remplacer  │   │
│  │ 🗑 c.zip (14K)  —        [CD▼]       [c]     🔴 erreur │   │
│  │                                       INVALID_MAGIC  │   │
│  └────────────────────────────────────────────────────┘   │
│                                                           │
│  [ Importer tout (2 prêts) ]    [ Vider le batch ]        │
│                                                           │
│  Progress: 1/3 ██░░░ (1 créé, 0 ignoré, 0 échec)          │
└───────────────────────────────────────────────────────────┘
```

**Interactions :**

- **Drop N fichiers** → `addBatchFiles(files)` → UI ajoute N lignes en état `pending-inspect` → appel `POST /api/imports/inspect` (une requête multipart avec tous les fichiers) → sur réponse, chaque ligne passe à `inspected` avec `dumpType`, `confidence`, `sourceComponentEic`, `duplicateOf`, `fileHash`.
- **Edit label** → input contrôlé dans la colonne.
- **Override dumpType** → `<select>` avec 3 options, pré-rempli selon détection. Un warning ⚠ icône s'affiche si `confidence = FALLBACK`.
- **Cocher « Remplacer »** (visible seulement si `duplicateOf != null`) → `forceReplace = true` → bouton « Importer tout » compte cet item comme actionnable.
- **Importer tout** → `submitBatch(envName)` → boucle séquentielle :
  ```typescript
  for (const item of batch.filter((i) => !i.skipped)) {
    if (item.duplicateOf && !item.forceReplace) {
      updateBatchItem(item.id, { state: 'skipped' });
      continue;
    }
    updateBatchItem(item.id, { state: 'uploading' });
    try {
      const detail = await api.createImport(
        item.file, envName, item.label,
        item.overrideDumpType ?? item.dumpType,
        item.forceReplace ? item.duplicateOf!.importId : undefined,
      );
      updateBatchItem(item.id, { state: 'done', createdImportId: detail.id });
    } catch (err) {
      updateBatchItem(item.id, { state: 'error', errorCode: parseErrorCode(err), errorMessage: parseErrorMessage(err) });
    }
  }
  ```
- **Résumé final** (affiché quand `uploadInProgress = false` et au moins un item en état `done` ou `error`) :
  ```
  Batch terminé : 7 créés · 2 ignorés (doublons) · 1 échec
  [ Voir sur la carte → ]    [ Vider le batch ]
  ```
  Le « Voir sur la carte » navigue vers `/` et appelle `setActiveEnv(envName)` pour recharger.

### API client étendu

**Fichier :** `apps/web/src/lib/api.ts`

```typescript
async inspectBatch(files: File[], envName?: string): Promise<InspectResult[]> {
  const fd = new FormData();
  for (const f of files) fd.append('files', f);
  if (envName) fd.append('envName', envName);
  return request<InspectResult[]>('/api/imports/inspect', { method: 'POST', body: fd });
}

async createImport(
  file: File,
  envName: string,
  label: string,
  dumpType?: DumpType,
  replaceImportId?: string,      // NOUVEAU
): Promise<ImportDetail> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('envName', envName);
  fd.append('label', label);
  if (dumpType) fd.append('dumpType', dumpType);
  if (replaceImportId) fd.append('replaceImportId', replaceImportId);
  return request<ImportDetail>('/api/imports', { method: 'POST', body: fd });
}
```

---

## §G — Règles de dédup (synthèse)

| Situation | Clé de match | Affiché en preview | Action par défaut | Action possible |
|---|---|---|---|---|
| Même fichier re-uploadé dans le même env | `(sourceEic, sourceDumpTimestamp)` identique OU `fileHash` identique (si pattern filename absent) | 🟡 « Doublon connu : {label existant} (uploadé le …) » | Skip silencieux | Cocher « Remplacer » → `replaceImportId` envoyé |
| Nouveau dump du même composant (même EIC, timestamp plus récent) | timestamp ≠ | 🟢 rien d'anormal | Import normal | — |
| Même fichier dans un **autre env** | cross-env : pas de match (la recherche est scopée à `envName` du form) | 🟢 rien d'anormal | Import normal | — |
| Filename non-canonique (`sourceEic/timestamp = null`) + hash identique à un existant | `fileHash` | 🟡 « Contenu déjà importé (hash) » | Skip silencieux | Cocher « Remplacer » |

---

## §H — Error handling (synthèse)

- **Par fichier** (pas par batch) : chaque `POST /api/imports` est transactionnel et indépendant. Un crash sur le fichier 3 n'affecte pas les fichiers 1, 2, 4, 5…
- **Codes d'erreur backend exposés dans l'UI :**
  - `INVALID_UPLOAD` — fichier manquant/vide
  - `INVALID_MIME` — MIME type inattendu
  - `INVALID_MAGIC` — signature ZIP absente
  - `INVALID_BODY` — validation zod (envName/label)
  - `REPLACE_IMPORT_MISMATCH` — `replaceImportId` pointe sur un autre env
  - `IMPORT_NOT_FOUND` — suppression d'un import inexistant (peut arriver si concurrency)
  - `CSV_PARSE_ERROR` — warning non-bloquant dans la majorité des cas, devient erreur seulement si `component_directory.csv` vide (mécanique P1-4 conservée)
  - `BROKER_DUMP_METADATA_ONLY` — warning informatif (pas une erreur)
- **Résumé final** : N créés / M ignorés / K échecs avec ligne par ligne visible dans le tableau (reste à l'écran après le traitement).

---

## §I — Tests (grain TDD)

### Unit (`apps/api/src/`)

- **`dump-type-detector.v2.spec.ts`** (réécrit) — 9 cas couvrant le tableau §B (chaque signature exclusive + fallback + override manuel).
- **`csv-path-reader.service.spec.ts`** (nouveau) — 7 cas :
  - Ligne basique 1 sender × 1 receiver
  - Ligne 3 senders × 2 receivers = 6 paths
  - Wildcard `*` dans allowedSenders
  - Fallback `validUntil` si `validTo` null
  - `isExpired = true` si date passée
  - Séparateur inconnu → warning + ligne skippée
  - Ligne avec `intermediateBrokerCode` → broker propagé
- **`import-builder.service.spec.ts`** (étendu) — nouveau describe "`buildFromCdCsv`" avec 4 cas (composants depuis CSV pur, type inféré CD pour le source, broker stubs depuis paths, pas de XML consommé).
- **`imports.service.spec.ts`** (étendu) — nouveaux cas : `inspectBatch` (3 fichiers variés), `createImport` avec `replaceImportId` (delete-then-create atomique), `createImport` avec `replaceImportId` d'un autre env → `REPLACE_IMPORT_MISMATCH`.
- **`imports.controller.spec.ts`** (étendu) — nouveau endpoint `POST /api/imports/inspect`, validation `replaceImportId` UUID.
- **`zip-extractor.service.spec.ts`** (étendu) — nouvelle méthode `listEntries(buffer)` qui retourne les noms sans extraction mémoire.
- **`csv-reader.service.spec.ts`** (étendu) — nouvelle méthode `readMessagePaths(extracted, warnings)` avec parser `csv-parse`.

### Intégration (`apps/api/test/`)

- **`full-ingestion-cd-v2.spec.ts`** (nouveau) — upload fixture CD `17V000002014106G_...` via `ImportsService` → vérif :
  - `dumpType = 'COMPONENT_DIRECTORY'`
  - `components.length > 0` (source CD + partners listés)
  - `paths.length > 0` (paths issus de `message_path.csv` exploded)
  - Au moins un path n'a PAS de `senderEic = '*'` (contrairement à 2a où seul le XML ENDPOINT produisait des paths, tous wildcard)
- **`batch-upload.spec.ts`** (nouveau) — scénario mixte 5 fichiers :
  - Fichier 1 : ENDPOINT valide → succès
  - Fichier 2 : CD valide (même fixture CD, env différent) → succès
  - Fichier 3 : doublon du fichier 1 (même hash) → skipped par défaut
  - Fichier 4 : fichier corrompu (pas ZIP) → `INVALID_MAGIC`
  - Fichier 5 : ENDPOINT valide → succès
  - Vérif : 3 imports créés, 1 skipped, 1 error. DB contient 3 rows `Import`.

### E2E (`apps/web/e2e/`)

- **`multi-upload.spec.ts`** (nouveau) — drag 2 zips → preview table visible avec les 2 lignes → click « Importer tout » → résumé « 2 créés » → navigue sur `/` → markers visibles.

---

## §J — DoD slice 2b

- [ ] `DumpTypeDetectorV2` couvre 100% des fixtures actuelles + un bloc BROKER synthétique
- [ ] `CsvPathReader` explode correctement les paths d'un dump CD réel (fixture `17V000002014106G_...`)
- [ ] `ImportBuilder.buildFromCdCsv` produit des `components + paths` non vides sur fixture CD
- [ ] `POST /api/imports/inspect` retourne les résultats attendus pour 3 fixtures variées
- [ ] `POST /api/imports` avec `replaceImportId` fait delete + create atomiquement
- [ ] `UploadPage` permet drag N fichiers, preview, override dumpType, marquage doublons, import séquentiel, résumé final
- [ ] Flow best-effort : 1 fichier corrompu dans un batch de 5 → 4 créés, 1 en erreur, barre de progression cohérente
- [ ] Tous tests unit + intégration verts ; E2E `multi-upload.spec.ts` vert
- [ ] `typecheck` api + web + shared PASS
- [ ] ADR-031, ADR-032, ADR-033 rédigés en amont
- [ ] CHANGELOG mis à jour (v2.0-alpha.2)
- [ ] Smoke manuel : drag 2 fixtures → table de preview → import → carte peuplée avec composants ET paths non-wildcard
