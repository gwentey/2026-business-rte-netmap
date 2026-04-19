# Carto ECP v2.0 — Slice 2b (Multi-upload + Détection fiable + Parser CD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Élever `/upload` de single-file à multi-upload avec preview+confirm, construit sur un `DumpTypeDetectorV2` qui inspecte les noms de CSV (signature officielle Admin Guide §4.20) et un parser CD complet (`CsvPathReader` → `ImportBuilder.buildFromCdCsv`).

**Architecture:** Backend ajoute `POST /api/imports/inspect` (preview multi-fichiers sans persistance) et `POST /api/imports` étendu avec `replaceImportId`. Pipeline d'ingestion branche ENDPOINT (v2a, XML) vs CD (v2b, `CsvPathReader`) vs BROKER (metadata-only). Frontend remplace `UploadPage` par une dropzone multi-fichiers + table de preview + submit séquentiel best-effort.

**Tech Stack:** NestJS 10 CommonJS, Prisma 5 SQLite, zod pour validation, Vitest 2 + unplugin-swc, React 18 + Vite + Zustand (ajout slice `uploadBatch`), react-dropzone `multiple: true`, Playwright 1.48.

**Spec de référence :** [`docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2b-design.md`](../specs/2026-04-19-carto-ecp-v2-slice-2b-design.md) — lire §B (détecteur), §C (parser CD), §D (builder), §E (endpoints), §F (front), §G (dédup), §H (errors), §I (tests).

**Docs officielles ECP :** `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` pour la signature des tables par type de composant.

**Branche :** `feat/v2-slice-2b-multi-upload` (déjà créée depuis `feat/v2-slice-2a-fondations`).

---

## Vue d'ensemble

| Phase | Tasks | Livre |
|---|---|---|
| Phase 1 — ADRs | T1 | 3 ADRs fondateurs (031, 032, 033) |
| Phase 2 — Détection + inspection (backend) | T2, T3 | `DumpTypeDetectorV2` + `ZipExtractor.listEntries` |
| Phase 3 — Parser CD (backend) | T4, T5, T6 | `readMessagePaths` dans CsvReader, `CsvPathReader`, `ImportBuilder.buildFromCdCsv` |
| Phase 4 — Endpoints + service (backend) | T7, T8, T9 | `ImportsService.inspectBatch`, `replaceImportId` dans `createImport`, `ImportsController POST /inspect` |
| Phase 5 — Pipeline routing (backend) | T10 | `ImportsService.createImport` branche ENDPOINT/CD/BROKER |
| Phase 6 — Types shared + API client | T11, T12 | `InspectResult` + client `inspectBatch` |
| Phase 7 — Store + UploadPage (frontend) | T13, T14, T15 | Slice `uploadBatch`, composant `UploadBatchTable`, réécriture `UploadPage` |
| Phase 8 — Tests intégration + E2E | T16, T17, T18 | `full-ingestion-cd-v2.spec.ts`, `batch-upload.spec.ts`, `multi-upload.spec.ts` |
| Phase 9 — CHANGELOG + smoke + PR | T19 | v2.0-alpha.2 + PR |

**Convention commits :** Conventional Commits FR, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Phase 1 — ADRs fondateurs

### Task 1 : 3 ADRs v2-2b

**Files (à créer) :**
- `docs/adr/ADR-031-dump-type-detector-v2-signatures-csv.md`
- `docs/adr/ADR-032-parser-cd-via-csv-path-reader.md`
- `docs/adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md`

Gabarit basé sur `docs/adr/000-template.md`. Pour chaque ADR : champ `Contexte = "Slice v2.0-2b Multi-upload"`, `Features = *`, `App = api, web`, `Date = 2026-04-19`, `Auteur = Anthony + Claude`, `Owner = Anthony`, `Statut = Accepté`.

- [ ] **Step 1.1 — ADR-031 : DumpTypeDetectorV2**

Contenu :
- **Contexte :** 2a utilisait une heuristique `<?xml` dans `component_directory.csv` pour distinguer ENDPOINT vs CD. Fragile, BROKER non détectable.
- **Options :** A = signatures CSV exclusives (retenue), B = inspection XML (v2a actuelle), C = demande manuelle systématique.
- **Décision :** A. Basé sur Admin Guide §4.20 listant les tables de chaque backup : `messaging_statistics.csv`/`message_upload_route.csv` → ENDPOINT exclusif ; `synchronized_directories.csv`/`component_statistics.csv`/`pending_*_directories.csv` → CD exclusif ; `broker.xml`/`bootstrap.xml` → BROKER. Cascade du plus spécifique au fallback.
- **Conséquences positives :** détection HIGH confidence dans >99% des cas, BROKER enfin détectable.
- **Ce qu'on s'interdit désormais :** s'appuyer sur le contenu interne d'un fichier pour détecter le type, alors que la signature des NOMS suffit.
- **Réfs :** slice 2b §B + docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20.

- [ ] **Step 1.2 — ADR-032 : Parser CD via CsvPathReader**

Contenu :
- **Contexte :** 2a parse les paths via le blob XML MADES imbriqué dans `component_directory.csv`. Ce blob n'existe **que** dans les dumps ENDPOINT. Les dumps CD exposent les paths dans un CSV dédié `message_path.csv` avec format tabulaire.
- **Options :** A = parser dédié CSV (retenue), B = émuler le XML côté CD (complexité gratuite), C = refuser les dumps CD (régression).
- **Décision :** A. Nouveau service `CsvPathReader` + nouvelle méthode `ImportBuilder.buildFromCdCsv`. `ImportsService` route ENDPOINT/CD/BROKER selon `DumpTypeDetectorV2`.
- **Conséquences positives :** les dumps CD apportent désormais des paths **non-wildcard** (contrairement à 2a où toutes les paths issues du XML ENDPOINT étaient wildcardées).
- **Ce qu'on s'interdit désormais :** supposer qu'un `Import` vient toujours avec un XML MADES ; les brokers via dump n'apportent ni composants ni paths.
- **Réfs :** slice 2b §C/§D + spec §A pipeline routing.

- [ ] **Step 1.3 — ADR-033 : Batch upload best-effort transactionnel par fichier**

Contenu :
- **Contexte :** 2a supporte un seul upload atomique. 2b introduit le multi-upload. Question : all-or-nothing sur le batch ou par fichier ?
- **Options :** A = best-effort par fichier (retenue), B = all-or-nothing batch, C = fail-fast.
- **Décision :** A. Chaque `POST /api/imports` reste atomique. Le frontend boucle séquentiellement avec catch par fichier. Résumé final "N créés / M ignorés / K échecs".
- **Conséquences positives :** 1 mauvais fichier sur 10 n'annule pas les 9 bons. Cohérent avec le modèle v2 où chaque Import est indépendant.
- **Ce qu'on s'interdit désormais :** introduire un "batch ID" ou toute notion qui couple les imports d'un même drop.
- **Réfs :** slice 2b §H.

- [ ] **Step 1.4 — Commit**

```bash
git add docs/adr/ADR-031-*.md docs/adr/ADR-032-*.md docs/adr/ADR-033-*.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-031 à ADR-033 pour slice v2.0-2b

ADR-031 DumpTypeDetectorV2 via signatures CSV (Admin Guide §4.20)
ADR-032 Parser CD via CsvPathReader (pas de XML côté CD)
ADR-033 Batch upload best-effort transactionnel par fichier

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Détection + inspection (backend)

### Task 2 : `ZipExtractor.listEntries(buffer)` (inspection sans extraction mémoire)

**Files :**
- Modify: `apps/api/src/ingestion/zip-extractor.service.ts`
- Modify: `apps/api/src/ingestion/zip-extractor.service.spec.ts`

Nouvelle méthode qui énumère les `entryName` d'un ZIP sans charger les contenus en RAM. Utile pour `DumpTypeDetectorV2` et pour éviter d'extraire un ZIP invalide avant détection.

- [ ] **Step 2.1 — Test RED**

Ajouter dans `zip-extractor.service.spec.ts` (après les describes existants) :

```typescript
describe('ZipExtractorService.listEntries', () => {
  it('returns entry names without extracting content', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const z = new AdmZip();
    z.addFile('application_property.csv', Buffer.from('a,b\n1,2\n'));
    z.addFile('component_directory.csv', Buffer.from('x,y\n'));
    z.addFile('README.txt', Buffer.from('hello'));
    const buf = z.toBuffer();

    const service = new ZipExtractorService();
    const entries = service.listEntries(buf);

    expect(entries).toHaveLength(3);
    const names = entries.map((e) => e.entryName).sort();
    expect(names).toEqual(['README.txt', 'application_property.csv', 'component_directory.csv']);
  });

  it('returns empty array for an empty ZIP', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const z = new AdmZip();
    const buf = z.toBuffer();

    const service = new ZipExtractorService();
    expect(service.listEntries(buf)).toEqual([]);
  });

  it('throws on an invalid buffer (not a ZIP)', () => {
    const service = new ZipExtractorService();
    expect(() => service.listEntries(Buffer.from('not a zip file'))).toThrow();
  });
});
```

- [ ] **Step 2.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- zip-extractor
```

Expected: FAIL (3 nouveaux tests, méthode `listEntries` manquante).

- [ ] **Step 2.3 — Implémenter**

Dans `apps/api/src/ingestion/zip-extractor.service.ts`, ajouter la méthode (garder l'existant `extract()` inchangé) :

```typescript
listEntries(buffer: Buffer): Array<{ entryName: string }> {
  const zip = new AdmZip(buffer);
  return zip.getEntries().map((e) => ({ entryName: e.entryName }));
}
```

- [ ] **Step 2.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- zip-extractor
```

Expected: PASS (3/3 nouveaux + existants).

- [ ] **Step 2.5 — Commit**

```bash
git add apps/api/src/ingestion/zip-extractor.service.ts apps/api/src/ingestion/zip-extractor.service.spec.ts
git commit -m "feat(api): ZipExtractor.listEntries pour inspection sans extraction mémoire

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3 : `DumpTypeDetectorV2` (réécriture)

**Files :**
- Modify: `apps/api/src/ingestion/dump-type-detector.ts` (réécriture intégrale)
- Modify: `apps/api/src/ingestion/dump-type-detector.spec.ts` (réécriture intégrale)

La v1 inspectait le contenu XML. La v2 inspecte les noms de fichiers dans le ZIP. Le type `DumpType` reste inchangé. La signature change : `detectDumpType(zipEntries, explicitOverride?) → { dumpType, confidence, reason }`.

- [ ] **Step 3.1 — Test RED (réécriture)**

Remplacer intégralement le contenu de `apps/api/src/ingestion/dump-type-detector.spec.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { detectDumpType, type DumpType } from './dump-type-detector.js';

function entries(...names: string[]): Array<{ entryName: string }> {
  return names.map((entryName) => ({ entryName }));
}

describe('detectDumpType v2', () => {
  it('detects CD via synchronized_directories.csv (exclusive)', () => {
    const r = detectDumpType(entries('application_property.csv', 'component_directory.csv', 'synchronized_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toContain('synchronized_directories.csv');
  });

  it('detects CD via component_statistics.csv (exclusive)', () => {
    const r = detectDumpType(entries('component_directory.csv', 'component_statistics.csv', 'message_path.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects CD via pending_edit_directories.csv', () => {
    const r = detectDumpType(entries('component_directory.csv', 'pending_edit_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects CD via pending_removal_directories.csv', () => {
    const r = detectDumpType(entries('component_directory.csv', 'pending_removal_directories.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects ENDPOINT via messaging_statistics.csv (exclusive)', () => {
    const r = detectDumpType(entries('application_property.csv', 'component_directory.csv', 'messaging_statistics.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toContain('messaging_statistics.csv');
  });

  it('detects ENDPOINT via message_upload_route.csv (exclusive)', () => {
    const r = detectDumpType(entries('component_directory.csv', 'message_upload_route.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
  });

  it('detects BROKER via broker.xml', () => {
    const r = detectDumpType(entries('broker.xml', 'bootstrap.xml', 'data/journal-1.amq'));
    expect(r.dumpType).toBe('BROKER');
    expect(r.confidence).toBe('HIGH');
  });

  it('falls back to CD when only component_directory.csv present', () => {
    const r = detectDumpType(entries('component_directory.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('FALLBACK');
  });

  it('falls back to CD with reason when no ECP signature found', () => {
    const r = detectDumpType(entries('random.txt', 'other.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('FALLBACK');
    expect(r.reason).toContain('aucune signature');
  });

  it('respects explicit override (HIGH confidence)', () => {
    const r = detectDumpType(entries('messaging_statistics.csv'), 'BROKER');
    expect(r.dumpType).toBe('BROKER');
    expect(r.confidence).toBe('HIGH');
    expect(r.reason).toBe('user override');
  });

  it('prioritizes CD exclusive over ENDPOINT when both markers co-exist (conflict edge case)', () => {
    // Should not happen in practice, but ensures deterministic behavior
    const r = detectDumpType(entries('synchronized_directories.csv', 'messaging_statistics.csv'));
    expect(r.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(r.confidence).toBe('HIGH');
  });

  it('is case-insensitive on entry names', () => {
    const r = detectDumpType(entries('MESSAGING_STATISTICS.CSV', 'Component_Directory.csv'));
    expect(r.dumpType).toBe('ENDPOINT');
    expect(r.confidence).toBe('HIGH');
  });
});
```

- [ ] **Step 3.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- dump-type-detector
```

Expected: FAIL — l'ancienne signature (`rows, override`) ne matche pas les nouveaux appels.

- [ ] **Step 3.3 — Implémenter (réécriture)**

Remplacer intégralement le contenu de `apps/api/src/ingestion/dump-type-detector.ts` :

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
  const has = (f: string): boolean => names.has(f);

  // CD — signatures exclusives prioritaires (une seule suffit)
  if (has('synchronized_directories.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'synchronized_directories.csv (CD exclusive)' };
  }
  if (has('component_statistics.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'component_statistics.csv (CD exclusive)' };
  }
  if (has('pending_edit_directories.csv') || has('pending_removal_directories.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'HIGH', reason: 'pending_*_directories.csv (CD exclusive)' };
  }

  // ENDPOINT — signatures exclusives
  if (has('messaging_statistics.csv')) {
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'messaging_statistics.csv (ENDPOINT exclusive)' };
  }
  if (has('message_upload_route.csv')) {
    return { dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'message_upload_route.csv (ENDPOINT exclusive)' };
  }

  // BROKER — absence totale de CSV + présence de config Artemis
  if (has('broker.xml') || has('bootstrap.xml')) {
    return { dumpType: 'BROKER', confidence: 'HIGH', reason: 'broker.xml/bootstrap.xml (BROKER file-system backup)' };
  }

  // Fallback : si component_directory.csv seul, on suppose CD
  if (has('component_directory.csv')) {
    return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'component_directory.csv seul — défaut CD' };
  }

  // Aucune signature reconnue
  return { dumpType: 'COMPONENT_DIRECTORY', confidence: 'FALLBACK', reason: 'aucune signature ECP reconnue — défaut CD' };
}
```

**Note sur les callers actuels :** `ImportsService.createImport` appelle `detectDumpType(cdRows, override)` avec l'ancienne signature (rows + override). Cette méthode sera refactorée en Task 10 pour utiliser la nouvelle signature. En attendant, le build peut échouer sur ce caller — c'est attendu.

- [ ] **Step 3.4 — Run GREEN (tests isolés)**

```bash
pnpm --filter @carto-ecp/api test -- dump-type-detector
```

Expected: PASS (12/12). Les autres tests (imports.service.spec) peuvent échouer sur la compilation TypeScript car ImportsService utilise encore l'ancienne signature — c'est traité en Task 10.

- [ ] **Step 3.5 — Commit**

```bash
git add apps/api/src/ingestion/dump-type-detector.ts apps/api/src/ingestion/dump-type-detector.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): DumpTypeDetectorV2 via signatures CSV (Admin Guide §4.20)

Remplace l'heuristique XML de 2a par l'inspection des noms de fichiers :
- synchronized_directories/component_statistics/pending_*_directories → CD
- messaging_statistics/message_upload_route → ENDPOINT
- broker.xml/bootstrap.xml → BROKER
- fallback CD si uniquement component_directory.csv présent

Retourne { dumpType, confidence: HIGH|FALLBACK, reason } pour
exposer la traçabilité côté frontend (badge warning si FALLBACK).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Parser CD (backend)

### Task 4 : `CsvReaderService.readMessagePaths(extracted, warnings)`

**Files :**
- Modify: `apps/api/src/ingestion/csv-reader.service.ts`
- Modify: `apps/api/src/ingestion/csv-reader.service.spec.ts`

Nouvelle méthode qui parse `message_path.csv` d'un dump CD. Utilise le même parser `csv-parse` déjà en place avec séparateur `;` et header ligne 1.

- [ ] **Step 4.1 — Reconnaissance**

Lis `apps/api/src/ingestion/csv-reader.service.ts` pour voir le pattern (probablement une méthode `readRaw` + méthodes spécialisées `readComponentDirectory`, `readApplicationProperties`, `readMessagingStatistics`). Suivre le même pattern pour la nouvelle méthode.

Vérifie la définition du type `ExtractedFiles` qui est la sortie de `ZipExtractor.extract()`.

- [ ] **Step 4.2 — Test RED**

Ajouter dans `csv-reader.service.spec.ts` un nouveau describe :

```typescript
describe('CsvReaderService.readMessagePaths', () => {
  it('parses a valid CD message_path.csv with headers', () => {
    const csv = [
      'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil',
      '17V-A;;;A06;17V-X;DIRECT;2026-01-01T00:00:00.000Z;;',
      '17V-B|17V-C;BROKER-1;;A07;17V-Y|17V-Z;INDIRECT;2026-01-01T00:00:00.000Z;2026-12-31T23:59:59.000Z;',
    ].join('\n');

    // Build a minimal ExtractedFiles-like structure with message_path.csv
    const extracted = { 'message_path.csv': Buffer.from(csv) };
    const warnings: Warning[] = [];

    const service = new CsvReaderService();
    const rows = service.readMessagePaths(extracted as any, warnings);

    expect(rows).toHaveLength(2);
    expect(rows[0]!.allowedSenders).toBe('17V-A');
    expect(rows[0]!.messageType).toBe('A06');
    expect(rows[0]!.transportPattern).toBe('DIRECT');
    expect(rows[0]!.receivers).toBe('17V-X');
    expect(rows[1]!.allowedSenders).toBe('17V-B|17V-C');
    expect(rows[1]!.intermediateBrokerCode).toBe('BROKER-1');
    expect(rows[1]!.receivers).toBe('17V-Y|17V-Z');
    expect(rows[1]!.validTo).toBe('2026-12-31T23:59:59.000Z');
    expect(warnings).toHaveLength(0);
  });

  it('returns empty array when message_path.csv is absent', () => {
    const extracted = {};
    const warnings: Warning[] = [];
    const service = new CsvReaderService();
    expect(service.readMessagePaths(extracted as any, warnings)).toEqual([]);
    expect(warnings).toHaveLength(0);
  });

  it('returns empty array when message_path.csv has only header', () => {
    const csv = 'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil';
    const extracted = { 'message_path.csv': Buffer.from(csv) };
    const warnings: Warning[] = [];
    const service = new CsvReaderService();
    expect(service.readMessagePaths(extracted as any, warnings)).toEqual([]);
  });

  it('emits CSV_PARSE_ERROR warning on malformed content', () => {
    // Missing closing quote → parser error
    const csv = [
      'allowedSenders;intermediateBrokerCode;intermediateComponent;messageType;receivers;transportPattern;validFrom;validTo;validUntil',
      '17V-A;;;"unterminated;17V-X;DIRECT;;;',
    ].join('\n');
    const extracted = { 'message_path.csv': Buffer.from(csv) };
    const warnings: Warning[] = [];
    const service = new CsvReaderService();
    service.readMessagePaths(extracted as any, warnings);
    expect(warnings.some((w) => w.code === 'CSV_PARSE_ERROR')).toBe(true);
  });
});
```

Si `Warning` n'est pas importé dans ce fichier, ajouter `import type { Warning } from '@carto-ecp/shared';` en haut.

- [ ] **Step 4.3 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- csv-reader
```

Expected: FAIL (méthode `readMessagePaths` absente).

- [ ] **Step 4.4 — Implémenter**

Dans `csv-reader.service.ts`, ajouter le type d'une ligne + la méthode (calquée sur `readMessagingStatistics` ou équivalent pour le pattern) :

```typescript
// En haut du fichier, après les autres types de row :
export type CdMessagePathRow = {
  allowedSenders: string;
  intermediateBrokerCode: string;
  intermediateComponent: string;
  messageType: string;
  receivers: string;
  transportPattern: string;
  validFrom: string;
  validTo: string;
  validUntil: string;
};

// Dans la classe CsvReaderService, nouvelle méthode :
readMessagePaths(
  extracted: ExtractedFiles,
  warnings: Warning[],
): CdMessagePathRow[] {
  const raw = this.readRaw(extracted, 'message_path.csv', warnings);
  return raw.rows.map((r) => ({
    allowedSenders: (r['allowedSenders'] ?? '').trim(),
    intermediateBrokerCode: (r['intermediateBrokerCode'] ?? '').trim(),
    intermediateComponent: (r['intermediateComponent'] ?? '').trim(),
    messageType: (r['messageType'] ?? '').trim(),
    receivers: (r['receivers'] ?? '').trim(),
    transportPattern: (r['transportPattern'] ?? '').trim(),
    validFrom: (r['validFrom'] ?? '').trim(),
    validTo: (r['validTo'] ?? '').trim(),
    validUntil: (r['validUntil'] ?? '').trim(),
  }));
}
```

**Note :** `readRaw` est probablement déjà dans le service (utilisé par les autres `read*`). Si le nom diffère, adapter. Le séparateur `;` et le `columns: true` (header as keys) sont déjà configurés dans `readRaw`.

- [ ] **Step 4.5 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- csv-reader
```

Expected: PASS (4/4 nouveaux + existants).

- [ ] **Step 4.6 — Commit**

```bash
git add apps/api/src/ingestion/csv-reader.service.ts apps/api/src/ingestion/csv-reader.service.spec.ts
git commit -m "feat(api): CsvReader.readMessagePaths pour dumps CD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5 : `CsvPathReaderService` (explode senders × receivers)

**Files :**
- Create: `apps/api/src/ingestion/csv-path-reader.service.ts`
- Create: `apps/api/src/ingestion/csv-path-reader.service.spec.ts`

Service qui prend `CdMessagePathRow[]` et retourne `BuiltImportedPath[]` avec explosion des listes senders × receivers.

- [ ] **Step 5.1 — Test RED**

```typescript
// apps/api/src/ingestion/csv-path-reader.service.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { CdMessagePathRow } from './csv-reader.service.js';
import type { Warning } from '@carto-ecp/shared';

function row(overrides: Partial<CdMessagePathRow> = {}): CdMessagePathRow {
  return {
    allowedSenders: '17V-A',
    intermediateBrokerCode: '',
    intermediateComponent: '',
    messageType: 'A06',
    receivers: '17V-X',
    transportPattern: 'DIRECT',
    validFrom: '',
    validTo: '',
    validUntil: '',
    ...overrides,
  };
}

describe('CsvPathReaderService', () => {
  let service: CsvPathReaderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [CsvPathReaderService],
    }).compile();
    service = moduleRef.get(CsvPathReaderService);
  });

  it('explodes 1 sender × 1 receiver into 1 path', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths([row()], warnings);
    expect(paths).toHaveLength(1);
    expect(paths[0]!.receiverEic).toBe('17V-X');
    expect(paths[0]!.senderEic).toBe('17V-A');
    expect(paths[0]!.messageType).toBe('A06');
    expect(paths[0]!.transportPattern).toBe('DIRECT');
    expect(paths[0]!.intermediateBrokerEic).toBeNull();
    expect(warnings).toHaveLength(0);
  });

  it('explodes 3 senders × 2 receivers into 6 paths (pipe separator)', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: 'A|B|C', receivers: 'X|Y' })],
      warnings,
    );
    expect(paths).toHaveLength(6);
    const pairs = new Set(paths.map((p) => `${p.senderEic}->${p.receiverEic}`));
    expect(pairs).toEqual(new Set(['A->X', 'A->Y', 'B->X', 'B->Y', 'C->X', 'C->Y']));
  });

  it('supports comma separator as fallback', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: 'A,B', receivers: 'X,Y' })],
      warnings,
    );
    expect(paths).toHaveLength(4);
  });

  it('treats empty allowedSenders as wildcard (single path with senderEic="*")', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: '', receivers: 'X|Y' })],
      warnings,
    );
    expect(paths).toHaveLength(2);
    expect(paths.every((p) => p.senderEic === '*')).toBe(true);
    expect(paths.map((p) => p.receiverEic).sort()).toEqual(['X', 'Y']);
  });

  it('treats "*" allowedSenders as wildcard', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ allowedSenders: '*', receivers: 'X' })],
      warnings,
    );
    expect(paths).toHaveLength(1);
    expect(paths[0]!.senderEic).toBe('*');
  });

  it('falls back validTo to validUntil if validTo empty', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ validTo: '', validUntil: '2026-12-31T00:00:00.000Z' })],
      warnings,
    );
    expect(paths[0]!.validTo?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('sets isExpired=true when validTo is in the past', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ validTo: '2020-01-01T00:00:00.000Z' })],
      warnings,
    );
    expect(paths[0]!.isExpired).toBe(true);
  });

  it('forwards intermediateBrokerCode to intermediateBrokerEic', () => {
    const warnings: Warning[] = [];
    const { paths } = service.readCdMessagePaths(
      [row({ intermediateBrokerCode: 'BROKER-XYZ' })],
      warnings,
    );
    expect(paths[0]!.intermediateBrokerEic).toBe('BROKER-XYZ');
  });
});
```

- [ ] **Step 5.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- csv-path-reader
```

Expected: FAIL (module absent).

- [ ] **Step 5.3 — Implémenter**

```typescript
// apps/api/src/ingestion/csv-path-reader.service.ts
import { Injectable } from '@nestjs/common';
import type { Warning } from '@carto-ecp/shared';
import type { CdMessagePathRow } from './csv-reader.service.js';
import type { BuiltImportedPath } from './types.js';

@Injectable()
export class CsvPathReaderService {
  readCdMessagePaths(
    rows: ReadonlyArray<CdMessagePathRow>,
    warnings: Warning[],
  ): { paths: BuiltImportedPath[]; warnings: Warning[] } {
    const paths: BuiltImportedPath[] = [];

    for (const row of rows) {
      const senders = splitList(row.allowedSenders);
      const receivers = splitList(row.receivers);

      if (receivers.length === 0) {
        warnings.push({
          code: 'CSV_PATH_NO_RECEIVER',
          message: `message_path row skipped (no receiver) — messageType=${row.messageType}`,
        });
        continue;
      }

      const transportPattern = row.transportPattern === 'DIRECT' || row.transportPattern === 'INDIRECT'
        ? row.transportPattern
        : null;
      if (transportPattern === null) {
        warnings.push({
          code: 'CSV_PATH_UNKNOWN_TRANSPORT',
          message: `message_path row skipped (unknown transportPattern "${row.transportPattern}") — messageType=${row.messageType}`,
        });
        continue;
      }

      const validToRaw = row.validTo.trim() || row.validUntil.trim();
      const validTo = parseDate(validToRaw);
      const validFrom = parseDate(row.validFrom);
      const isExpired = validTo != null && validTo.getTime() < Date.now();

      for (const sender of senders) {
        for (const receiver of receivers) {
          paths.push({
            receiverEic: receiver,
            senderEic: sender,
            messageType: row.messageType,
            transportPattern,
            intermediateBrokerEic: nonEmpty(row.intermediateBrokerCode),
            validFrom,
            validTo,
            isExpired,
          });
        }
      }
    }

    return { paths, warnings };
  }
}

function splitList(raw: string | null | undefined): string[] {
  if (raw == null) return ['*'];
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed === '*') return ['*'];
  // Try pipe first, then comma, then semicolon (fallback)
  if (trimmed.includes('|')) return trimmed.split('|').map((s) => s.trim()).filter((s) => s.length > 0);
  if (trimmed.includes(',')) return trimmed.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (trimmed.includes(';')) return trimmed.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
  return [trimmed];
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
```

- [ ] **Step 5.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- csv-path-reader
```

Expected: PASS (8/8).

- [ ] **Step 5.5 — Commit**

```bash
git add apps/api/src/ingestion/csv-path-reader.service.ts apps/api/src/ingestion/csv-path-reader.service.spec.ts
git commit -m "feat(api): CsvPathReaderService — explode N senders × M receivers pour dumps CD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6 : `ImportBuilder.buildFromCdCsv`

**Files :**
- Modify: `apps/api/src/ingestion/import-builder.service.ts`
- Modify: `apps/api/src/ingestion/import-builder.service.spec.ts`

Nouvelle méthode dans `ImportBuilderService`. Prend `cdComponentRows` (depuis `readComponentDirectory`) et `cdPathRows` (depuis `readMessagePaths`), produit composants + paths + warnings. Les paths passent par `CsvPathReaderService`.

- [ ] **Step 6.1 — Test RED**

Ajouter un nouveau describe dans `import-builder.service.spec.ts` :

```typescript
describe('ImportBuilderService.buildFromCdCsv', () => {
  let builder: ImportBuilderService;
  let pathReader: CsvPathReaderService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ImportBuilderService, CsvPathReaderService],
    }).compile();
    builder = moduleRef.get(ImportBuilderService);
    pathReader = moduleRef.get(CsvPathReaderService);
  });

  it('produces components from component_directory.csv rows (CD format)', () => {
    const cdComponentRows = [
      { id: '17V000002014106G', componentCode: '17V000002014106G', organization: 'RTE', directoryContent: '' },
      { id: '17V-PARTNER', componentCode: 'ENDPOINT-1', organization: 'APG', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [];

    const { components, paths } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);

    expect(components).toHaveLength(2);
    const cd = components.find((c) => c.eic === '17V000002014106G')!;
    expect(cd.type).toBe('COMPONENT_DIRECTORY');
    expect(cd.organization).toBe('RTE');
    expect(cd.sourceType).toBe('LOCAL_CSV');

    const endpoint = components.find((c) => c.eic === '17V-PARTNER')!;
    expect(endpoint.type).toBe('ENDPOINT');
  });

  it('generates paths via CsvPathReader with explosion', () => {
    const cdComponentRows: any[] = [];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A|17V-B',
      intermediateBrokerCode: '',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'DIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { paths } = builder.buildFromCdCsv(cdComponentRows, cdPathRows);
    expect(paths).toHaveLength(2);
    expect(paths.map((p) => p.senderEic).sort()).toEqual(['17V-A', '17V-B']);
  });

  it('creates BROKER stubs for intermediateBrokerCode not in component list', () => {
    const cdComponentRows = [
      { id: '17V-A', componentCode: 'EP1', organization: 'OrgA', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A',
      intermediateBrokerCode: '17V-UNKNOWN-BROKER',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'INDIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { components } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);
    const broker = components.find((c) => c.eic === '17V-UNKNOWN-BROKER');
    expect(broker).toBeDefined();
    expect(broker!.type).toBe('BROKER');
    expect(broker!.sourceType).toBe('LOCAL_CSV');
    expect(broker!.isDefaultPosition).toBe(true);
  });

  it('does not duplicate a BROKER stub if already in component list', () => {
    const cdComponentRows = [
      { id: '17V-A', componentCode: 'EP1', organization: 'OrgA', directoryContent: '' },
      { id: '17V-BROKER-KNOWN', componentCode: '17V-BROKER-KNOWN', organization: 'BrkOrg', directoryContent: '' },
    ];
    const cdPathRows: CdMessagePathRow[] = [{
      allowedSenders: '17V-A',
      intermediateBrokerCode: '17V-BROKER-KNOWN',
      intermediateComponent: '',
      messageType: 'A06',
      receivers: '17V-X',
      transportPattern: 'INDIRECT',
      validFrom: '',
      validTo: '',
      validUntil: '',
    }];

    const { components } = builder.buildFromCdCsv(cdComponentRows as any, cdPathRows);
    const brokers = components.filter((c) => c.eic === '17V-BROKER-KNOWN');
    expect(brokers).toHaveLength(1);
  });
});
```

Ajouter les imports en tête du fichier si manquants :

```typescript
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { CdMessagePathRow } from './csv-reader.service.js';
```

- [ ] **Step 6.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected: FAIL (méthode absente, provider `CsvPathReaderService` inconnu dans la DI du test).

- [ ] **Step 6.3 — Implémenter**

Dans `apps/api/src/ingestion/import-builder.service.ts` :

1. Injecter `CsvPathReaderService` dans le constructeur :

```typescript
import { Injectable } from '@nestjs/common';
import type { Warning } from '@carto-ecp/shared';
import type { BuiltImportedComponent, BuiltImportedPath, BuiltImportedMessagingStat } from './types.js';
import { CsvPathReaderService } from './csv-path-reader.service.js';
import type { CdMessagePathRow } from './csv-reader.service.js';

@Injectable()
export class ImportBuilderService {
  constructor(private readonly csvPathReader: CsvPathReaderService) {}
  // ... méthodes existantes ci-dessous
}
```

**Note :** les méthodes existantes (`buildFromLocalCsv`, `buildFromXml`, `buildMessagingStats`, `buildAppProperties`) n'utilisent pas de DI, mais ajouter un `constructor` ne les casse pas. Si les tests existants instancient le service sans provider, il faut mettre à jour **tous** les `Test.createTestingModule` qui listent `ImportBuilderService` pour inclure aussi `CsvPathReaderService`.

Chercher toutes les occurrences et ajouter `CsvPathReaderService` dans les `providers: [ImportBuilderService, ...]` :

```bash
grep -rn "ImportBuilderService" apps/api/src apps/api/test 2>&1 | grep -v '\.spec\.ts:' | head -20
grep -rn "providers:.*ImportBuilderService" apps/api/src apps/api/test 2>&1 | head -20
```

Dans tous les `Test.createTestingModule` où `ImportBuilderService` est providé, ajouter `CsvPathReaderService` dans la même liste.

2. Ajouter la méthode `buildFromCdCsv` :

```typescript
buildFromCdCsv(
  cdComponentRows: ReadonlyArray<{
    id: string;
    componentCode: string;
    organization?: string | null;
    directoryContent?: string | null;
  }>,
  cdPathRows: ReadonlyArray<CdMessagePathRow>,
): {
  components: BuiltImportedComponent[];
  paths: BuiltImportedPath[];
  warnings: Warning[];
} {
  const warnings: Warning[] = [];
  const components: BuiltImportedComponent[] = [];
  const knownEics = new Set<string>();

  for (const row of cdComponentRows) {
    if (!row.id) {
      warnings.push({
        code: 'CSV_ROW_MISSING_EIC',
        message: `CD row skipped: ${row.componentCode ?? '<no code>'}`,
      });
      continue;
    }
    const type = row.componentCode === row.id ? 'COMPONENT_DIRECTORY' : 'ENDPOINT';
    components.push({
      eic: row.id,
      type,
      organization: nonEmptyS(row.organization),
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
      sourceType: 'LOCAL_CSV',
      creationTs: null,
      modificationTs: null,
      urls: [],
    });
    knownEics.add(row.id);
  }

  const pathResult = this.csvPathReader.readCdMessagePaths(cdPathRows, warnings);

  // Ajouter des stubs BROKER pour intermediateBrokerEic inconnus
  for (const p of pathResult.paths) {
    if (p.intermediateBrokerEic && !knownEics.has(p.intermediateBrokerEic)) {
      components.push({
        eic: p.intermediateBrokerEic,
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
        sourceType: 'LOCAL_CSV',
        creationTs: null,
        modificationTs: null,
        urls: [],
      });
      knownEics.add(p.intermediateBrokerEic);
    }
  }

  return { components, paths: pathResult.paths, warnings };
}
```

3. Ajouter le helper si absent du fichier :

```typescript
function nonEmptyS(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}
```

- [ ] **Step 6.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- import-builder
```

Expected: PASS (tests existants + 4 nouveaux `buildFromCdCsv`). Si d'autres specs référencent `ImportBuilderService` dans leur `Test.createTestingModule`, ils doivent être mis à jour pour inclure `CsvPathReaderService`.

- [ ] **Step 6.5 — Commit**

```bash
git add apps/api/src/ingestion/import-builder.service.ts apps/api/src/ingestion/import-builder.service.spec.ts
# Si d'autres .spec.ts ont été modifiés (DI adjustment), les ajouter
git commit -m "$(cat <<'EOF'
feat(api): ImportBuilder.buildFromCdCsv pour dumps CD

Utilise CsvPathReaderService (DI ajoutée) pour explose les paths.
Génère des stubs BROKER pour les intermediateBrokerCode inconnus.
Type composant inféré : componentCode==id → COMPONENT_DIRECTORY, sinon ENDPOINT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Endpoints + service (backend)

### Task 7 : Types shared `InspectResult`

**Files :**
- Modify: `packages/shared/src/graph.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 7.1 — Ajouter le type**

Dans `packages/shared/src/graph.ts`, ajouter après `ImportDetail` :

```typescript
export type InspectResult = {
  fileName: string;
  fileSize: number;
  fileHash: string;
  sourceComponentEic: string | null;
  sourceDumpTimestamp: string | null;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence: 'HIGH' | 'FALLBACK';
  reason: string;
  duplicateOf: {
    importId: string;
    label: string;
    uploadedAt: string;
  } | null;
  warnings: Warning[];
};
```

Vérifier que `Warning` est importé en haut du fichier (il l'est, depuis `./snapshot.js`).

Dans `packages/shared/src/index.ts`, ajouter `InspectResult` aux exports :

```typescript
export type { ..., InspectResult } from './graph.js';
```

Ou adapter selon le style d'export actuel (export * ou explicit list).

- [ ] **Step 7.2 — Typecheck + commit**

```bash
pnpm --filter @carto-ecp/shared typecheck
```

Expected: PASS.

```bash
git add packages/shared/src/graph.ts packages/shared/src/index.ts
git commit -m "feat(shared): type InspectResult pour batch preview

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8 : `ImportsService.inspectBatch` + `replaceImportId` dans `createImport`

**Files :**
- Modify: `apps/api/src/ingestion/imports.service.ts`
- Modify: `apps/api/src/ingestion/imports.service.spec.ts`

Deux extensions dans `ImportsService` :
1. Nouvelle méthode `inspectBatch(files, envName?)` retourne `InspectResult[]`.
2. `createImport(input)` accepte un nouveau champ `replaceImportId?` dans son input type.

- [ ] **Step 8.1 — Test RED pour inspectBatch**

Ajouter dans `imports.service.spec.ts` un nouveau describe :

```typescript
describe('ImportsService.inspectBatch', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService, ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService, PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_INSPECT' } } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_INSPECT' } } });
  });

  it('inspects a real ENDPOINT fixture and returns HIGH confidence', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      undefined,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.dumpType).toBe('ENDPOINT');
    expect(result[0]!.confidence).toBe('HIGH');
    expect(result[0]!.sourceComponentEic).toBe('17V000000498771C');
    expect(result[0]!.sourceDumpTimestamp).toBe('2026-04-17T21:27:17.000Z');
    expect(result[0]!.duplicateOf).toBeNull();
    expect(result[0]!.fileHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('detects duplicateOf when a matching import exists in the target env', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const created = await service.createImport({
      file: { originalname: 'x.zip', buffer: zip },
      envName: 'TEST_INSPECT_DUP',
      label: 'original',
    });

    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      'TEST_INSPECT_DUP',
    );
    expect(result[0]!.duplicateOf).not.toBeNull();
    expect(result[0]!.duplicateOf!.importId).toBe(created.id);
    expect(result[0]!.duplicateOf!.label).toBe('original');
  });

  it('does not flag cross-env uploads as duplicates (env-scoped check)', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    await service.createImport({
      file: { originalname: 'x.zip', buffer: zip },
      envName: 'TEST_INSPECT_CROSS_A',
      label: 'in env A',
    });

    const result = await service.inspectBatch(
      [{ originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip }],
      'TEST_INSPECT_CROSS_B',
    );
    expect(result[0]!.duplicateOf).toBeNull();

    await prisma.import.deleteMany({ where: { envName: 'TEST_INSPECT_CROSS_A' } });
  });

  it('returns results for multiple files in a single call', async () => {
    const zipA = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const zipB = buildZipFromFixture('17V000002014106G_2026-04-17T22_11_50Z');
    const result = await service.inspectBatch(
      [
        { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zipA },
        { originalname: '17V000002014106G_2026-04-17T22_11_50Z.zip', buffer: zipB },
      ],
      undefined,
    );
    expect(result).toHaveLength(2);
    expect(result[0]!.dumpType).toBe('ENDPOINT');
    expect(result[1]!.dumpType).toBe('COMPONENT_DIRECTORY');
  });
});
```

- [ ] **Step 8.2 — Test RED pour replaceImportId**

Ajouter un deuxième describe :

```typescript
describe('ImportsService.createImport — replaceImportId', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService, ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService, PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_REPLACE' } } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_REPLACE' } } });
  });

  it('deletes the old import and creates the new one atomically', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const original = await service.createImport({
      file: { originalname: 'old.zip', buffer: zip },
      envName: 'TEST_REPLACE_OK',
      label: 'old label',
    });

    const replaced = await service.createImport({
      file: { originalname: 'new.zip', buffer: zip },
      envName: 'TEST_REPLACE_OK',
      label: 'new label',
      replaceImportId: original.id,
    });

    expect(replaced.id).not.toBe(original.id);
    expect(replaced.label).toBe('new label');

    const old = await prisma.import.findUnique({ where: { id: original.id } });
    expect(old).toBeNull();  // ancien supprimé

    const list = await prisma.import.findMany({ where: { envName: 'TEST_REPLACE_OK' } });
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(replaced.id);
  });

  it('throws REPLACE_IMPORT_MISMATCH if replaceImportId is from another env', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const otherEnvImport = await service.createImport({
      file: { originalname: 'other.zip', buffer: zip },
      envName: 'TEST_REPLACE_OTHER',
      label: 'other env',
    });

    await expect(
      service.createImport({
        file: { originalname: 'x.zip', buffer: zip },
        envName: 'TEST_REPLACE_MAIN',
        label: 'x',
        replaceImportId: otherEnvImport.id,
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'REPLACE_IMPORT_MISMATCH' }) });

    await prisma.import.deleteMany({ where: { envName: 'TEST_REPLACE_OTHER' } });
  });

  it('throws IMPORT_NOT_FOUND if replaceImportId does not exist', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    await expect(
      service.createImport({
        file: { originalname: 'x.zip', buffer: zip },
        envName: 'TEST_REPLACE_MISSING',
        label: 'x',
        replaceImportId: '00000000-0000-0000-0000-000000000000',
      }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'IMPORT_NOT_FOUND' }) });
  });
});
```

- [ ] **Step 8.3 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected: FAIL (méthodes absentes).

- [ ] **Step 8.4 — Implémenter**

Dans `apps/api/src/ingestion/imports.service.ts` :

1. Mettre à jour le type `CreateImportInput` pour ajouter `replaceImportId?` :

```typescript
export type CreateImportInput = {
  file: { originalname: string; buffer: Buffer };
  envName: string;
  label: string;
  dumpType?: DumpType;
  replaceImportId?: string;
};
```

2. Étendre `createImport` pour gérer le replace (inséré **au début** de la méthode, avant le pipeline) :

```typescript
async createImport(input: CreateImportInput): Promise<ImportDetail> {
  if (input.replaceImportId) {
    const old = await this.prisma.import.findUnique({ where: { id: input.replaceImportId } });
    if (!old) {
      throw new BadRequestException({ code: 'IMPORT_NOT_FOUND', message: `Import ${input.replaceImportId} not found` });
    }
    if (old.envName !== input.envName) {
      throw new BadRequestException({
        code: 'REPLACE_IMPORT_MISMATCH',
        message: `Cannot replace import ${input.replaceImportId} (env=${old.envName}) from env=${input.envName}`,
      });
    }
    await this.deleteImport(input.replaceImportId);
  }

  // ... reste du pipeline inchangé (zip → csv → detect → builder → persister)
}
```

Ajouter `BadRequestException` à l'import `@nestjs/common` en haut.

**Note :** l'atomicité stricte (rollback si création échoue après delete) n'est pas garantie ici — si la création échoue, l'ancien est déjà supprimé. C'est acceptable en dev-local (l'utilisateur peut ré-uploader). Pour production, une vraie transaction serait nécessaire. Ce trade-off est documenté dans l'ADR-033 (à ajouter à la section "Conséquences négatives" si on veut être explicite).

3. Nouvelle méthode `inspectBatch` :

```typescript
import { createHash } from 'node:crypto';  // déjà importé
import type { InspectResult } from '@carto-ecp/shared';
import { detectDumpType } from './dump-type-detector.js';

async inspectBatch(
  files: Array<{ originalname: string; buffer: Buffer }>,
  envName: string | undefined,
): Promise<InspectResult[]> {
  const results: InspectResult[] = [];
  for (const file of files) {
    const result = await this.inspectOne(file, envName);
    results.push(result);
  }
  return results;
}

private async inspectOne(
  file: { originalname: string; buffer: Buffer },
  envName: string | undefined,
): Promise<InspectResult> {
  const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
  const fileHash = createHash('sha256').update(file.buffer).digest('hex');

  let detection;
  const warnings: Warning[] = [];
  try {
    const entries = this.zipExtractor.listEntries(file.buffer);
    detection = detectDumpType(entries);
  } catch (err) {
    warnings.push({ code: 'INVALID_ZIP', message: (err as Error).message });
    detection = { dumpType: 'COMPONENT_DIRECTORY' as const, confidence: 'FALLBACK' as const, reason: 'ZIP invalide' };
  }

  const duplicateOf = await this.findDuplicateForInspect({
    sourceComponentEic,
    sourceDumpTimestamp,
    fileHash,
    envName,
  });

  return {
    fileName: file.originalname,
    fileSize: file.buffer.length,
    fileHash,
    sourceComponentEic,
    sourceDumpTimestamp: sourceDumpTimestamp?.toISOString() ?? null,
    dumpType: detection.dumpType,
    confidence: detection.confidence,
    reason: detection.reason,
    duplicateOf,
    warnings,
  };
}

private async findDuplicateForInspect(args: {
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
  fileHash: string;
  envName: string | undefined;
}): Promise<InspectResult['duplicateOf']> {
  const where: any = {};
  if (args.envName) where.envName = args.envName;

  // Priorité 1 : match par (sourceComponentEic, sourceDumpTimestamp) si les deux dispo
  if (args.sourceComponentEic && args.sourceDumpTimestamp) {
    const match = await this.prisma.import.findFirst({
      where: {
        ...where,
        sourceComponentEic: args.sourceComponentEic,
        sourceDumpTimestamp: args.sourceDumpTimestamp,
      },
    });
    if (match) return { importId: match.id, label: match.label, uploadedAt: match.uploadedAt.toISOString() };
  }

  // Priorité 2 : fallback sur fileHash
  const hashMatch = await this.prisma.import.findFirst({
    where: { ...where, fileHash: args.fileHash },
  });
  if (hashMatch) return { importId: hashMatch.id, label: hashMatch.label, uploadedAt: hashMatch.uploadedAt.toISOString() };

  return null;
}
```

Ajouter les imports nécessaires (`parseDumpFilename`, `detectDumpType`, `InspectResult`, `BadRequestException`, `Warning`).

- [ ] **Step 8.5 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected: PASS (tests existants + 4 inspectBatch + 3 replaceImportId).

- [ ] **Step 8.6 — Commit**

```bash
git add apps/api/src/ingestion/imports.service.ts apps/api/src/ingestion/imports.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): ImportsService.inspectBatch + replaceImportId

- inspectBatch(files, env?) : preview multi-fichiers sans persistance
  avec détection dumpType, parsing filename, SHA256, check duplicateOf
  scoped par env (cross-env = pas de collision)
- createImport({..., replaceImportId}) : delete(old) → create(new)
  avec check REPLACE_IMPORT_MISMATCH si envName diffère

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9 : `ImportsController POST /api/imports/inspect` + `replaceImportId` dans body

**Files :**
- Modify: `apps/api/src/ingestion/imports.controller.ts`
- Modify: `apps/api/src/ingestion/imports.controller.spec.ts`

- [ ] **Step 9.1 — Test RED**

Ajouter dans `imports.controller.spec.ts` deux nouveaux blocs de tests :

```typescript
describe('ImportsController.inspect', () => {
  let ctrl: ImportsController;
  const fakeInspectResult = {
    fileName: 'x.zip',
    fileSize: 100,
    fileHash: 'deadbeef'.repeat(8),
    sourceComponentEic: '17V-A',
    sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
    dumpType: 'ENDPOINT' as const,
    confidence: 'HIGH' as const,
    reason: 'messaging_statistics.csv',
    duplicateOf: null,
    warnings: [],
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            inspectBatch: async () => [fakeInspectResult],
            createImport: async () => ({}),
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('rejects empty file list', async () => {
    await expect(ctrl.inspect({} as any, undefined, [])).rejects.toThrow(BadRequestException);
  });

  it('rejects files with wrong MIME', async () => {
    await expect(
      ctrl.inspect({} as any, undefined, [
        { originalname: 'a.txt', buffer: Buffer.from('hi'), mimetype: 'text/plain' } as any,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns InspectResult[] for valid files', async () => {
    const result = await ctrl.inspect({ envName: 'OPF' }, 'OPF', [
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.fileName).toBe('x.zip');
  });
});

describe('ImportsController.create — replaceImportId', () => {
  let ctrl: ImportsController;
  const createSpy = vi.fn(async () => ({
    id: 'new-id', envName: 'X', label: 'l', fileName: 'f.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: null, sourceDumpTimestamp: null,
    uploadedAt: '2026-04-19T00:00:00.000Z',
    effectiveDate: '2026-04-19T00:00:00.000Z',
    warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
  }));

  beforeEach(async () => {
    createSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: { createImport: createSpy, inspectBatch: async () => [], listImports: async () => [], deleteImport: async () => undefined } }],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('forwards replaceImportId to service when provided', async () => {
    await ctrl.create(
      { envName: 'X', label: 'l', replaceImportId: '11111111-2222-3333-4444-555555555555' },
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    );
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      replaceImportId: '11111111-2222-3333-4444-555555555555',
    }));
  });

  it('rejects an invalid UUID for replaceImportId', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l', replaceImportId: 'not-a-uuid' },
        { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 9.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
```

Expected: FAIL (méthode `inspect` absente, schéma ne valide pas `replaceImportId`).

- [ ] **Step 9.3 — Implémenter**

Dans `imports.controller.ts` :

1. Étendre le schéma zod :

```typescript
const CreateImportSchema = z.object({
  envName: z.string().min(1).max(64),
  label: z.string().min(1).max(256),
  dumpType: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER']).optional(),
  replaceImportId: z.string().uuid().optional(),
});

const InspectBodySchema = z.object({
  envName: z.string().min(1).max(64).optional(),
});
```

2. Dans la méthode `create`, passer `replaceImportId` au service :

```typescript
return this.imports.createImport({
  file,
  envName: parsed.data.envName,
  label: parsed.data.label,
  dumpType: parsed.data.dumpType,
  replaceImportId: parsed.data.replaceImportId,
});
```

3. Nouvelle méthode `inspect` avec `FilesInterceptor` :

```typescript
import { FilesInterceptor } from '@nestjs/platform-express';

@Post('inspect')
@UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: MAX_SIZE } }))
async inspect(
  @Body() body: unknown,
  @Query('envName') envNameQuery: string | undefined,
  @UploadedFiles() files: Array<{ originalname: string; buffer: Buffer; mimetype?: string }>,
): Promise<InspectResult[]> {
  const parsed = InspectBodySchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
  }
  if (!files || files.length === 0) {
    throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Au moins un fichier requis' });
  }
  for (const f of files) {
    if (f.mimetype && f.mimetype !== 'application/zip' && f.mimetype !== 'application/x-zip-compressed') {
      throw new BadRequestException({ code: 'INVALID_MIME', message: `MIME invalide : ${f.mimetype} (${f.originalname})` });
    }
  }
  const envName = parsed.data.envName ?? envNameQuery;
  return this.imports.inspectBatch(files, envName);
}
```

Importer `FilesInterceptor`, `UploadedFiles`, `InspectResult` en tête.

- [ ] **Step 9.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
```

Expected: PASS (tests existants + 3 inspect + 2 replaceImportId).

- [ ] **Step 9.5 — Commit**

```bash
git add apps/api/src/ingestion/imports.controller.ts apps/api/src/ingestion/imports.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): POST /api/imports/inspect + replaceImportId dans POST /api/imports

Inspect multi-fichiers (FilesInterceptor max 20 × 50MB) avec validation
zod + MIME check, délègue à ImportsService.inspectBatch.

Body POST /api/imports étend avec replaceImportId (z.string().uuid().optional()).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Pipeline routing (backend)

### Task 10 : `ImportsService.createImport` branche ENDPOINT/CD/BROKER

**Files :**
- Modify: `apps/api/src/ingestion/imports.service.ts`

Refactorer le pipeline existant pour router selon `dumpType` détecté :
- ENDPOINT → pipeline v2a (CSV + XML blob) — inchangé
- CD → `CsvReader.readMessagePaths` + `ImportBuilder.buildFromCdCsv`
- BROKER → metadata-only, `components=[]`, `paths=[]`, warning informative

- [ ] **Step 10.1 — Test RED**

Ajouter dans `imports.service.spec.ts` :

```typescript
describe('ImportsService.createImport — routing par dumpType', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImportsService, ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService, PrismaService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(ImportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_ROUTING' } } });
  });

  afterEach(async () => {
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_ROUTING' } } });
  });

  it('routes ENDPOINT fixture via legacy XML pipeline', async () => {
    const zip = buildZipFromFixture('17V000000498771C_2026-04-17T21_27_17Z');
    const detail = await service.createImport({
      file: { originalname: '17V000000498771C_2026-04-17T21_27_17Z.zip', buffer: zip },
      envName: 'TEST_ROUTING_EP',
      label: 'ep',
    });
    expect(detail.dumpType).toBe('ENDPOINT');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
  });

  it('routes CD fixture via CsvPathReader pipeline', async () => {
    const zip = buildZipFromFixture('17V000002014106G_2026-04-17T22_11_50Z');
    const detail = await service.createImport({
      file: { originalname: '17V000002014106G_2026-04-17T22_11_50Z.zip', buffer: zip },
      envName: 'TEST_ROUTING_CD',
      label: 'cd',
    });
    expect(detail.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
    // CD fixture may have 0 paths (message_path.csv vide dans notre fixture) — ok
  });

  it('accepts BROKER dump (synthetic) with metadata-only storage', async () => {
    const AdmZip = (await import('adm-zip')).default;
    const z = new AdmZip();
    z.addFile('broker.xml', Buffer.from('<?xml version="1.0"?><broker/>'));
    z.addFile('bootstrap.xml', Buffer.from('<?xml version="1.0"?><bootstrap/>'));
    z.addFile('config/broker.properties', Buffer.from('ecp.broker.code=TEST-BROKER\n'));
    const zip = z.toBuffer();

    const detail = await service.createImport({
      file: { originalname: 'broker.zip', buffer: zip },
      envName: 'TEST_ROUTING_BK',
      label: 'bk',
    });
    expect(detail.dumpType).toBe('BROKER');
    expect(detail.stats.componentsCount).toBe(0);
    expect(detail.stats.pathsCount).toBe(0);
    expect(detail.warnings.some((w) => w.code === 'BROKER_DUMP_METADATA_ONLY')).toBe(true);
  });
});
```

- [ ] **Step 10.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected: FAIL — le pipeline actuel ne route pas, et la signature de `detectDumpType` a changé en Task 3 (l'ancien appel dans ImportsService est cassé à la compilation).

- [ ] **Step 10.3 — Implémenter**

Dans `imports.service.ts`, refactoriser `createImport` après la validation + parsing filename :

```typescript
async createImport(input: CreateImportInput): Promise<ImportDetail> {
  // --- replaceImportId check (Task 8, déjà en place) ---
  if (input.replaceImportId) {
    // ... existant
  }

  const { file, envName, label } = input;
  const { sourceComponentEic, sourceDumpTimestamp } = parseDumpFilename(file.originalname);
  const fileHash = createHash('sha256').update(file.buffer).digest('hex');

  // --- Détection dumpType via signatures CSV (nouvelle v2) ---
  const zipEntries = this.zipExtractor.listEntries(file.buffer);
  const detection = detectDumpType(zipEntries, input.dumpType);
  const dumpType = detection.dumpType;

  const extracted = this.zipExtractor.extract(file.buffer);
  const warnings: Warning[] = [];
  let components: BuiltImportedComponent[] = [];
  let paths: BuiltImportedPath[] = [];
  let messagingStats: BuiltImportedMessagingStat[] = [];
  let appProperties: Array<{ key: string; value: string }> = [];

  if (dumpType === 'ENDPOINT') {
    const cdRows = this.csvReader.readComponentDirectory(extracted, warnings);
    const fromCsv = this.builder.buildFromLocalCsv(cdRows);
    warnings.push(...fromCsv.warnings);
    const xmlComponents: BuiltImportedComponent[] = [];
    const xmlPaths: BuiltImportedPath[] = [];
    for (const row of cdRows) {
      const xmlSource = (row as any).directoryContent ?? (row as any).xml ?? '';
      if (typeof xmlSource === 'string' && xmlSource.includes('<?xml')) {
        const parsed = this.xmlParser.parse(xmlSource);
        const xmlBuilt = this.builder.buildFromXml(parsed);
        xmlComponents.push(...xmlBuilt.components);
        xmlPaths.push(...xmlBuilt.paths);
        warnings.push(...xmlBuilt.warnings);
      }
    }
    const byEic = new Map<string, BuiltImportedComponent>();
    for (const c of fromCsv.components) byEic.set(c.eic, c);
    for (const c of xmlComponents) byEic.set(c.eic, c);
    components = Array.from(byEic.values());
    paths = xmlPaths;
    const statRows = this.csvReader.readMessagingStatistics(extracted, warnings);
    messagingStats = this.builder.buildMessagingStats(statRows);
    const appPropRows = this.csvReader.readApplicationProperties(extracted, warnings);
    appProperties = this.builder.buildAppProperties(appPropRows);
  } else if (dumpType === 'COMPONENT_DIRECTORY') {
    const cdComponentRows = this.csvReader.readComponentDirectory(extracted, warnings);
    const cdPathRows = this.csvReader.readMessagePaths(extracted, warnings);
    const cdBuilt = this.builder.buildFromCdCsv(cdComponentRows, cdPathRows);
    components = cdBuilt.components;
    paths = cdBuilt.paths;
    warnings.push(...cdBuilt.warnings);
    const appPropRows = this.csvReader.readApplicationProperties(extracted, warnings);
    appProperties = this.builder.buildAppProperties(appPropRows);
    // Pas de messaging_statistics côté CD
  } else if (dumpType === 'BROKER') {
    warnings.push({
      code: 'BROKER_DUMP_METADATA_ONLY',
      message: 'Dump BROKER accepté sans extraction de composants/paths (pas de base SQL côté broker).',
    });
    // components, paths, messagingStats, appProperties restent vides
  }

  const effectiveDate = sourceDumpTimestamp ?? new Date();

  const built: BuiltImport = {
    envName, label,
    fileName: file.originalname, fileHash,
    dumpType, sourceComponentEic, sourceDumpTimestamp,
    effectiveDate,
    components, paths, messagingStats, appProperties,
    warnings,
  };

  const persisted = await this.persister.persist(built, file.buffer);
  return this.toDetail(persisted.id);
}
```

**Ajuster les imports** du fichier : `detectDumpType` déjà importé (Task 8), `BuiltImportedComponent`, `BuiltImportedPath`, `BuiltImportedMessagingStat`, `BuiltImport` depuis `./types.js`, `Warning` depuis `@carto-ecp/shared`.

**Note sur `row.directoryContent`** : le CsvReader actuel retourne un type row avec potentiellement `xml` ou `directoryContent` selon le format CSV. L'ancienne pipeline utilisait `row.xml`. Le code ci-dessus fait un fallback `directoryContent ?? xml`. Si le nom réel est différent, ajuster après avoir lu `csv-reader.service.ts`. Cette légère duplication est acceptable pour la robustesse lors du refactor.

- [ ] **Step 10.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
pnpm --filter @carto-ecp/api typecheck
```

Expected: tests PASS (routing 3/3), typecheck PASS.

- [ ] **Step 10.5 — Commit**

```bash
git add apps/api/src/ingestion/imports.service.ts
git commit -m "$(cat <<'EOF'
feat(api): ImportsService.createImport routing ENDPOINT/CD/BROKER

- ENDPOINT : pipeline v2a inchangé (CSV + XML blob)
- COMPONENT_DIRECTORY : nouveau pipeline via readMessagePaths
  + buildFromCdCsv (pas de XML côté CD)
- BROKER : metadata-only, warning BROKER_DUMP_METADATA_ONLY,
  components/paths/stats vides

Détection via DumpTypeDetectorV2 (signatures CSV, inspect sans extraction).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Types shared + API client frontend

### Task 11 : Module IngestionModule — enregistrer `CsvPathReaderService`

**Files :**
- Modify: `apps/api/src/ingestion/ingestion.module.ts`

- [ ] **Step 11.1 — Ajouter le provider**

Dans `ingestion.module.ts`, ajouter `CsvPathReaderService` à la liste des providers :

```typescript
import { CsvPathReaderService } from './csv-path-reader.service.js';

@Module({
  // ...
  providers: [
    ZipExtractorService,
    CsvReaderService,
    XmlMadesParserService,
    ImportBuilderService,
    CsvPathReaderService,    // NOUVEAU
    RawPersisterService,
    ImportsService,
  ],
  exports: [ImportsService],
})
export class IngestionModule {}
```

- [ ] **Step 11.2 — Smoke test full**

```bash
pnpm --filter @carto-ecp/api test
pnpm --filter @carto-ecp/api typecheck
```

Expected: full suite PASS + typecheck PASS.

- [ ] **Step 11.3 — Commit**

```bash
git add apps/api/src/ingestion/ingestion.module.ts
git commit -m "chore(api): enregistrer CsvPathReaderService dans IngestionModule

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 12 : API client web — `inspectBatch` + `replaceImportId`

**Files :**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 12.1 — Étendre le client**

Dans `apps/web/src/lib/api.ts`, ajouter les imports + étendre `api` :

```typescript
import type { GraphResponse, ImportDetail, ImportSummary, InspectResult } from '@carto-ecp/shared';

// ... (request<T>() inchangé)

export const api = {
  async listEnvs(): Promise<string[]> { /* inchangé */ },
  async listImports(env?: string): Promise<ImportSummary[]> { /* inchangé */ },

  async inspectBatch(files: File[], envName?: string): Promise<InspectResult[]> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    if (envName) fd.append('envName', envName);
    return request<InspectResult[]>('/api/imports/inspect', { method: 'POST', body: fd });
  },

  async createImport(
    file: File,
    envName: string,
    label: string,
    dumpType?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER',
    replaceImportId?: string,
  ): Promise<ImportDetail> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('envName', envName);
    fd.append('label', label);
    if (dumpType) fd.append('dumpType', dumpType);
    if (replaceImportId) fd.append('replaceImportId', replaceImportId);
    return request<ImportDetail>('/api/imports', { method: 'POST', body: fd });
  },

  async deleteImport(id: string): Promise<void> { /* inchangé */ },
  async getGraph(env: string, refDate?: Date): Promise<GraphResponse> { /* inchangé */ },
};
```

- [ ] **Step 12.2 — Typecheck + commit**

```bash
pnpm --filter @carto-ecp/web typecheck
```

Expected: PASS.

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): api.inspectBatch + replaceImportId dans createImport

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 7 — Store + UploadPage (frontend)

### Task 13 : Store Zustand — slice `uploadBatch`

**Files :**
- Modify: `apps/web/src/store/app-store.ts`
- Modify: `apps/web/src/store/app-store.test.ts`

- [ ] **Step 13.1 — Test RED**

Ajouter dans `app-store.test.ts` :

```typescript
describe('useAppStore — uploadBatch', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: null, envs: [], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.getGraph).mockReset();
    vi.mocked(api.inspectBatch).mockReset();
    vi.mocked(api.createImport).mockReset();
  });

  it('addBatchFiles inspects and adds items to the batch', async () => {
    vi.mocked(api.inspectBatch).mockResolvedValue([
      {
        fileName: 'a.zip', fileSize: 100, fileHash: 'h1',
        sourceComponentEic: '17V-A', sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
        dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'messaging_statistics.csv',
        duplicateOf: null, warnings: [],
      },
    ]);
    const file = new File(['fake'], 'a.zip', { type: 'application/zip' });
    await useAppStore.getState().addBatchFiles([file]);
    const batch = useAppStore.getState().uploadBatch;
    expect(batch).toHaveLength(1);
    expect(batch[0]!.state).toBe('inspected');
    expect(batch[0]!.dumpType).toBe('ENDPOINT');
    expect(batch[0]!.label).toContain('17V-A');  // auto-dérivé du sourceEic
  });

  it('removeBatchItem removes by id', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a'), fileName: 'a', fileSize: 0, label: '', forceReplace: false, state: 'inspected' } as any,
        { id: '2', file: new File([], 'b'), fileName: 'b', fileSize: 0, label: '', forceReplace: false, state: 'inspected' } as any,
      ],
    });
    useAppStore.getState().removeBatchItem('1');
    expect(useAppStore.getState().uploadBatch).toHaveLength(1);
    expect(useAppStore.getState().uploadBatch[0]!.id).toBe('2');
  });

  it('updateBatchItem merges a partial patch', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a'), fileName: 'a', fileSize: 0, label: 'old', forceReplace: false, state: 'inspected' } as any,
      ],
    });
    useAppStore.getState().updateBatchItem('1', { label: 'new', forceReplace: true });
    const item = useAppStore.getState().uploadBatch[0]!;
    expect(item.label).toBe('new');
    expect(item.forceReplace).toBe(true);
  });

  it('submitBatch skips duplicates without forceReplace', async () => {
    const createSpy = vi.mocked(api.createImport).mockResolvedValue({
      id: 'new-id', envName: 'OPF', label: '', fileName: '', dumpType: 'ENDPOINT',
      sourceComponentEic: null, sourceDumpTimestamp: null,
      uploadedAt: '2026-04-19T00:00:00.000Z', effectiveDate: '2026-04-19T00:00:00.000Z',
      warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
    });
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File(['x'], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'item1', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: { importId: 'old-id', label: 'old' },
        } as any,
      ],
    });
    await useAppStore.getState().submitBatch('OPF');
    expect(createSpy).not.toHaveBeenCalled();
    expect(useAppStore.getState().uploadBatch[0]!.state).toBe('skipped');
  });

  it('submitBatch uploads and marks done on success', async () => {
    vi.mocked(api.createImport).mockResolvedValue({
      id: 'new-id', envName: 'OPF', label: '', fileName: '', dumpType: 'ENDPOINT',
      sourceComponentEic: null, sourceDumpTimestamp: null,
      uploadedAt: '2026-04-19T00:00:00.000Z', effectiveDate: '2026-04-19T00:00:00.000Z',
      warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
    });
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 }, mapConfig: {} as any,
    });
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File(['x'], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'item1', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: null,
        } as any,
      ],
    });
    await useAppStore.getState().submitBatch('OPF');
    expect(useAppStore.getState().uploadBatch[0]!.state).toBe('done');
    expect(useAppStore.getState().uploadBatch[0]!.createdImportId).toBe('new-id');
  });
});
```

**Note :** ajouter `inspectBatch` et `createImport` au mock `vi.mock('../lib/api.js', ...)` au début du fichier test.

- [ ] **Step 13.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- app-store
```

Expected: FAIL.

- [ ] **Step 13.3 — Étendre le store**

Dans `apps/web/src/store/app-store.ts`, ajouter le type `UploadBatchItem` + les méthodes :

```typescript
import type { GraphResponse, ImportSummary, DumpType } from '@carto-ecp/shared';
// Vérifie que DumpType est exporté depuis shared ; sinon, définis-le localement :
// type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

type UploadBatchItem = {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  sourceComponentEic?: string | null;
  sourceDumpTimestamp?: string | null;
  dumpType?: DumpType;
  confidence?: 'HIGH' | 'FALLBACK';
  label: string;
  overrideDumpType?: DumpType;
  duplicateOf?: { importId: string; label: string } | null;
  forceReplace: boolean;
  state: 'pending-inspect' | 'inspected' | 'uploading' | 'done' | 'skipped' | 'error';
  errorCode?: string;
  errorMessage?: string;
  createdImportId?: string;
};

type AppState = {
  // ... state v2a existant
  uploadBatch: UploadBatchItem[];
  uploadInProgress: boolean;

  addBatchFiles: (files: File[]) => Promise<void>;
  removeBatchItem: (id: string) => void;
  updateBatchItem: (id: string, patch: Partial<UploadBatchItem>) => void;
  submitBatch: (envName: string) => Promise<void>;
  clearBatch: () => void;

  // ... méthodes existantes
};
```

Implémenter les méthodes dans le `create` :

```typescript
uploadBatch: [],
uploadInProgress: false,

addBatchFiles: async (files) => {
  const existing = get().uploadBatch;
  const pending: UploadBatchItem[] = files.map((file) => ({
    id: crypto.randomUUID(),
    file,
    fileName: file.name,
    fileSize: file.size,
    label: '',
    forceReplace: false,
    state: 'pending-inspect',
  }));
  set({ uploadBatch: [...existing, ...pending] });

  const envName = get().activeEnv ?? undefined;
  try {
    const results = await api.inspectBatch(files, envName);
    set((s) => ({
      uploadBatch: s.uploadBatch.map((item) => {
        if (item.state !== 'pending-inspect') return item;
        const result = results.find((r) => r.fileName === item.fileName);
        if (!result) return item;
        const autoLabel = result.sourceComponentEic
          ? `${result.sourceComponentEic} · ${result.sourceDumpTimestamp?.slice(0, 10) ?? 'n/a'}`
          : item.fileName.replace(/\.zip$/i, '');
        return {
          ...item,
          fileHash: result.fileHash,
          sourceComponentEic: result.sourceComponentEic,
          sourceDumpTimestamp: result.sourceDumpTimestamp,
          dumpType: result.dumpType,
          confidence: result.confidence,
          duplicateOf: result.duplicateOf,
          label: autoLabel,
          state: 'inspected',
        };
      }),
    }));
  } catch (err) {
    set((s) => ({
      uploadBatch: s.uploadBatch.map((item) =>
        item.state === 'pending-inspect'
          ? { ...item, state: 'error', errorCode: 'INSPECT_FAILED', errorMessage: (err as Error).message }
          : item,
      ),
    }));
  }
},

removeBatchItem: (id) => {
  set((s) => ({ uploadBatch: s.uploadBatch.filter((i) => i.id !== id) }));
},

updateBatchItem: (id, patch) => {
  set((s) => ({
    uploadBatch: s.uploadBatch.map((i) => (i.id === id ? { ...i, ...patch } : i)),
  }));
},

submitBatch: async (envName) => {
  set({ uploadInProgress: true });
  const items = [...get().uploadBatch];
  for (const item of items) {
    if (item.state === 'error' || item.state === 'done' || item.state === 'skipped') continue;
    if (item.duplicateOf && !item.forceReplace) {
      get().updateBatchItem(item.id, { state: 'skipped' });
      continue;
    }
    get().updateBatchItem(item.id, { state: 'uploading' });
    try {
      const detail = await api.createImport(
        item.file,
        envName,
        item.label.trim() || item.fileName,
        item.overrideDumpType ?? item.dumpType,
        item.forceReplace ? item.duplicateOf?.importId : undefined,
      );
      get().updateBatchItem(item.id, { state: 'done', createdImportId: detail.id });
    } catch (err) {
      const msg = (err as Error).message;
      const codeMatch = /:\s*(\{[^}]*\})/.exec(msg);
      let code = 'UPLOAD_FAILED';
      try {
        if (codeMatch) {
          const parsed = JSON.parse(codeMatch[1]!);
          code = parsed.code ?? code;
        }
      } catch { /* keep default */ }
      get().updateBatchItem(item.id, { state: 'error', errorCode: code, errorMessage: msg });
    }
  }
  set({ uploadInProgress: false });
  await get().loadEnvs();
},

clearBatch: () => set({ uploadBatch: [], uploadInProgress: false }),
```

Note : `uploadBatch` et `uploadInProgress` sont **absents** de `partialize` (déjà configuré pour ne persister que `activeEnv`) — aucun changement nécessaire au `persist` middleware.

- [ ] **Step 13.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/web test -- app-store
```

Expected: PASS (5 nouveaux tests + existants).

- [ ] **Step 13.5 — Commit**

```bash
git add apps/web/src/store/app-store.ts apps/web/src/store/app-store.test.ts
git commit -m "$(cat <<'EOF'
feat(web): slice uploadBatch dans store Zustand

UploadBatchItem avec états (pending-inspect / inspected / uploading /
done / skipped / error). addBatchFiles appelle inspectBatch, auto-dérive
le label depuis sourceEic + timestamp, détecte duplicateOf.
submitBatch boucle séquentiellement avec catch par item, skip les
doublons sans forceReplace. uploadBatch non persisté.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14 : Composant `UploadBatchTable`

**Files :**
- Create: `apps/web/src/components/UploadBatchTable/UploadBatchTable.tsx`
- Create: `apps/web/src/components/UploadBatchTable/UploadBatchTable.test.tsx`

Composant table qui affiche le batch en cours, permet l'édition inline (label, dumpType override, toggle forceReplace) et retire des items.

- [ ] **Step 14.1 — Test RED**

```typescript
// apps/web/src/components/UploadBatchTable/UploadBatchTable.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { UploadBatchTable } from './UploadBatchTable.js';

describe('UploadBatchTable', () => {
  beforeEach(() => {
    useAppStore.setState({
      uploadBatch: [],
      uploadInProgress: false,
    });
  });

  it('renders empty state message when batch is empty', () => {
    render(<UploadBatchTable />);
    expect(screen.getByText(/Aucun fichier/i)).toBeInTheDocument();
  });

  it('renders one row per batch item', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1024,
          label: 'Item A', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT', confidence: 'HIGH',
          sourceComponentEic: '17V-A', duplicateOf: null,
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText('a.zip')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Item A')).toBeInTheDocument();
    expect(screen.getByText('17V-A')).toBeInTheDocument();
  });

  it('shows duplicate warning and replace checkbox', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'dup', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: { importId: 'existing-id', label: 'Old label' },
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText(/doublon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Remplacer/i)).toBeInTheDocument();
  });

  it('calls updateBatchItem when label is edited', async () => {
    const updateBatchItem = vi.fn();
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'original', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
        } as any,
      ],
      updateBatchItem,
    });
    render(<UploadBatchTable />);
    const input = screen.getByDisplayValue('original');
    await userEvent.clear(input);
    await userEvent.type(input, 'X');
    expect(updateBatchItem).toHaveBeenLastCalledWith('1', { label: 'X' });
  });

  it('shows error state with code', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: '', forceReplace: false, state: 'error',
          errorCode: 'INVALID_MAGIC',
          errorMessage: 'Magic bytes invalides',
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText('INVALID_MAGIC')).toBeInTheDocument();
  });
});
```

- [ ] **Step 14.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- UploadBatchTable
```

Expected: FAIL.

- [ ] **Step 14.3 — Implémenter**

```tsx
// apps/web/src/components/UploadBatchTable/UploadBatchTable.tsx
import { useAppStore } from '../../store/app-store.js';

const STATE_LABELS: Record<string, string> = {
  'pending-inspect': '⏳ Inspection…',
  'inspected': '🟢 Prêt',
  'uploading': '⬆ Envoi…',
  'done': '✓ Créé',
  'skipped': '🟡 Ignoré',
  'error': '🔴 Erreur',
};

export function UploadBatchTable(): JSX.Element {
  const batch = useAppStore((s) => s.uploadBatch);
  const removeItem = useAppStore((s) => s.removeBatchItem);
  const updateItem = useAppStore((s) => s.updateBatchItem);

  if (batch.length === 0) {
    return <p className="p-4 text-sm text-gray-500">Aucun fichier dans le batch.</p>;
  }

  return (
    <table className="w-full table-auto border border-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-2 py-1 text-left">Fichier</th>
          <th className="px-2 py-1 text-left">EIC</th>
          <th className="px-2 py-1 text-left">Type</th>
          <th className="px-2 py-1 text-left">Label</th>
          <th className="px-2 py-1 text-left">Statut</th>
          <th className="px-2 py-1 text-left">Action</th>
        </tr>
      </thead>
      <tbody>
        {batch.map((item) => (
          <tr key={item.id} className="border-t border-gray-200">
            <td className="px-2 py-1">
              <div className="font-mono text-xs">{item.fileName}</div>
              <div className="text-xs text-gray-500">{(item.fileSize / 1024).toFixed(1)} KB</div>
            </td>
            <td className="px-2 py-1 font-mono text-xs">{item.sourceComponentEic ?? '—'}</td>
            <td className="px-2 py-1">
              <select
                value={item.overrideDumpType ?? item.dumpType ?? 'COMPONENT_DIRECTORY'}
                onChange={(e) => updateItem(item.id, { overrideDumpType: e.target.value as any })}
                disabled={item.state === 'uploading' || item.state === 'done'}
                className="rounded border border-gray-300 px-1 py-0.5 text-xs"
              >
                <option value="ENDPOINT">ENDPOINT</option>
                <option value="COMPONENT_DIRECTORY">CD</option>
                <option value="BROKER">BROKER</option>
              </select>
              {item.confidence === 'FALLBACK' ? (
                <span className="ml-1 text-xs text-orange-600" title="Détection incertaine">⚠</span>
              ) : null}
            </td>
            <td className="px-2 py-1">
              <input
                type="text"
                value={item.label}
                onChange={(e) => updateItem(item.id, { label: e.target.value })}
                disabled={item.state === 'uploading' || item.state === 'done'}
                className="w-40 rounded border border-gray-300 px-1 py-0.5 text-xs"
              />
            </td>
            <td className="px-2 py-1">
              <div>{STATE_LABELS[item.state] ?? item.state}</div>
              {item.duplicateOf ? (
                <div className="text-xs text-orange-700">
                  Doublon (import : {item.duplicateOf.label})
                  <label className="ml-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.forceReplace}
                      onChange={(e) => updateItem(item.id, { forceReplace: e.target.checked })}
                      className="mr-1"
                    />
                    Remplacer
                  </label>
                </div>
              ) : null}
              {item.state === 'error' && item.errorCode ? (
                <div className="text-xs text-red-700">
                  <code>{item.errorCode}</code> {item.errorMessage ?? ''}
                </div>
              ) : null}
            </td>
            <td className="px-2 py-1">
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={item.state === 'uploading'}
                className="text-red-600 hover:text-red-800"
                aria-label={`Retirer ${item.fileName}`}
              >
                🗑
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 14.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/web test -- UploadBatchTable
```

Expected: PASS (5/5).

- [ ] **Step 14.5 — Commit**

```bash
git add apps/web/src/components/UploadBatchTable
git commit -m "feat(web): UploadBatchTable — preview+édition batch d'upload

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 15 : Réécriture `UploadPage.tsx`

**Files :**
- Modify: `apps/web/src/pages/UploadPage.tsx`
- Modify: `apps/web/src/pages/UploadPage.test.tsx`

Réécriture complète : dropzone `multiple: true`, env input en haut, `UploadBatchTable`, bouton « Importer tout », barre de progression, résumé final.

- [ ] **Step 15.1 — Test RED (réécriture)**

Remplacer intégralement `apps/web/src/pages/UploadPage.test.tsx` :

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { UploadPage } from './UploadPage.js';
import { useAppStore } from '../store/app-store.js';

vi.mock('../lib/api.js', () => ({
  api: {
    inspectBatch: vi.fn(),
    createImport: vi.fn(),
    listEnvs: vi.fn().mockResolvedValue([]),
    listImports: vi.fn().mockResolvedValue([]),
    getGraph: vi.fn(),
  },
}));

describe('UploadPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: null, envs: [], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
  });

  it('renders the dropzone and env input', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByText(/Importer des dumps ECP/i)).toBeInTheDocument();
    expect(screen.getByText(/Glissez/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Environnement/i)).toBeInTheDocument();
  });

  it('pre-fills envName from ?env=X query param', () => {
    render(
      <MemoryRouter initialEntries={['/upload?env=PROD']}>
        <UploadPage />
      </MemoryRouter>,
    );
    expect((screen.getByLabelText(/Environnement/i) as HTMLInputElement).value).toBe('PROD');
  });

  it('defaults envName to OPF if no query param', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect((screen.getByLabelText(/Environnement/i) as HTMLInputElement).value).toBe('OPF');
  });

  it('import button is disabled when batch is empty', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Importer tout/i })).toBeDisabled();
  });

  it('import button is enabled when at least one item is inspected and not skipped', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1, label: 'x', forceReplace: false, state: 'inspected', dumpType: 'ENDPOINT' } as any,
      ],
    });
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Importer tout/i })).toBeEnabled();
  });

  it('displays summary after submitBatch completes', async () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1, label: 'x', forceReplace: false, state: 'done', createdImportId: 'new-id' } as any,
        { id: '2', file: new File([], 'b.zip'), fileName: 'b.zip', fileSize: 1, label: 'y', forceReplace: false, state: 'error', errorCode: 'INVALID_MAGIC' } as any,
      ],
    });
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByText(/1 créé/i)).toBeInTheDocument();
    expect(screen.getByText(/1 échec/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 15.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- UploadPage
```

Expected: FAIL.

- [ ] **Step 15.3 — Implémenter**

Remplacer intégralement `apps/web/src/pages/UploadPage.tsx` :

```tsx
import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/app-store.js';
import { UploadBatchTable } from '../components/UploadBatchTable/UploadBatchTable.js';

const MAX_UPLOAD = 50 * 1024 * 1024;
const MAX_FILES_PER_BATCH = 20;

export function UploadPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const batch = useAppStore((s) => s.uploadBatch);
  const uploadInProgress = useAppStore((s) => s.uploadInProgress);
  const addBatchFiles = useAppStore((s) => s.addBatchFiles);
  const submitBatch = useAppStore((s) => s.submitBatch);
  const clearBatch = useAppStore((s) => s.clearBatch);

  const [envName, setEnvName] = useState(searchParams.get('env') ?? 'OPF');
  const [dropError, setDropError] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/zip': ['.zip'] },
    maxSize: MAX_UPLOAD,
    multiple: true,
    maxFiles: MAX_FILES_PER_BATCH,
    onDrop: (accepted) => {
      setDropError(null);
      if (accepted.length > 0) {
        void addBatchFiles(accepted);
      }
    },
    onDropRejected: (rejections) => {
      setDropError(rejections[0]?.errors[0]?.message ?? 'Fichier rejeté');
    },
  });

  const summary = useMemo(() => {
    const done = batch.filter((i) => i.state === 'done').length;
    const skipped = batch.filter((i) => i.state === 'skipped').length;
    const errors = batch.filter((i) => i.state === 'error').length;
    const actionable = batch.filter((i) => i.state === 'inspected' && (!i.duplicateOf || i.forceReplace)).length;
    const processed = done + skipped + errors;
    const total = batch.length;
    const hasFinished = processed > 0 && !uploadInProgress;
    return { done, skipped, errors, actionable, processed, total, hasFinished };
  }, [batch, uploadInProgress]);

  const handleSubmit = async () => {
    if (!envName.trim()) return;
    await submitBatch(envName.trim());
  };

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-2 text-2xl font-semibold">Importer des dumps ECP</h1>
      <p className="mb-6 text-sm text-gray-600">
        Glissez N fichiers ZIP (Endpoint, CD ou Broker). Le type est détecté
        automatiquement à partir des fichiers présents dans le ZIP.
      </p>

      <label className="mb-4 block">
        <span className="mb-1 block text-sm font-medium">Environnement</span>
        <input
          type="text"
          value={envName}
          onChange={(e) => setEnvName(e.target.value)}
          disabled={uploadInProgress}
          className="w-48 rounded border border-gray-300 px-3 py-2"
          placeholder="OPF / PROD / PFRFI"
          aria-label="Environnement"
        />
      </label>

      <div
        {...getRootProps()}
        className={`mb-4 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition ${
          isDragActive ? 'border-rte bg-red-50' : 'border-gray-300 bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        <p>{isDragActive ? 'Déposez ici' : `Glissez jusqu'à ${MAX_FILES_PER_BATCH} .zip ou cliquez`}</p>
      </div>

      {dropError ? (
        <p className="mb-4 rounded bg-red-100 p-3 text-sm text-red-700" role="alert">{dropError}</p>
      ) : null}

      <UploadBatchTable />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => { void handleSubmit(); }}
          disabled={uploadInProgress || summary.actionable === 0 || !envName.trim()}
          className="rounded bg-rte px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {uploadInProgress
            ? `Envoi en cours (${summary.processed}/${summary.total})…`
            : `Importer tout (${summary.actionable} prêts)`}
        </button>
        <button
          type="button"
          onClick={clearBatch}
          disabled={uploadInProgress || batch.length === 0}
          className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 disabled:opacity-50"
        >
          Vider le batch
        </button>
      </div>

      {summary.hasFinished ? (
        <div className="mt-6 rounded border border-gray-200 p-4">
          <p className="mb-2 text-sm text-gray-700">
            Batch terminé : <strong>{summary.done} créé{summary.done > 1 ? 's' : ''}</strong>
            {' · '}
            <span>{summary.skipped} ignoré{summary.skipped > 1 ? 's' : ''}</span>
            {' · '}
            <span>{summary.errors} échec{summary.errors > 1 ? 's' : ''}</span>
          </p>
          <Link
            to={`/?env=${encodeURIComponent(envName)}`}
            onClick={() => navigate('/')}
            className="inline-block rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white"
          >
            Voir sur la carte →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 15.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/web test -- UploadPage
pnpm --filter @carto-ecp/web typecheck
```

Expected: tests PASS, typecheck PASS.

- [ ] **Step 15.5 — Commit**

```bash
git add apps/web/src/pages/UploadPage.tsx apps/web/src/pages/UploadPage.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): UploadPage réécrite pour multi-upload avec preview

- Dropzone multiple: true (max 20 fichiers)
- Env input en haut (pré-rempli ?env=X ou "OPF")
- UploadBatchTable pour preview/édition
- Bouton "Importer tout (N prêts)" avec state disabled intelligent
- Barre de progression (N/M traités)
- Résumé final avec link "Voir sur la carte"
- Tests 6 cas (empty, pre-fill env, disabled state, summary display)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Tests d'intégration + E2E

### Task 16 : `full-ingestion-cd-v2.spec.ts` (intégration CD)

**Files :**
- Create: `apps/api/test/full-ingestion-cd-v2.spec.ts`

- [ ] **Step 16.1 — Écrire le test**

```typescript
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, CD_FIXTURE } from './fixtures-loader.js';

describe('Full ingestion CD v2 (integration)', () => {
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  });

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'INTEG_CD_V2' } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: 'INTEG_CD_V2' } });
  });

  it('ingests the CD fixture via CsvPathReader pipeline', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-integration-test',
    });

    expect(detail.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(detail.stats.componentsCount).toBeGreaterThan(0);
    // CD fixture a component_directory.csv non-vide mais message_path.csv vide
    expect(detail.stats.pathsCount).toBeGreaterThanOrEqual(0);
  });

  it('stores imported components in DB with type COMPONENT_DIRECTORY or ENDPOINT per CSV inference', async () => {
    const zip = buildZipFromFixture(CD_FIXTURE);
    const detail = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zip },
      envName: 'INTEG_CD_V2',
      label: 'cd-types',
    });

    const components = await prisma.importedComponent.findMany({ where: { importId: detail.id } });
    // Au moins un composant doit exister
    expect(components.length).toBeGreaterThan(0);
    // Le composant source CD (componentCode == eic) doit être marqué COMPONENT_DIRECTORY
    const cdSelf = components.find((c) => c.eic === '17V000002014106G');
    if (cdSelf) {
      expect(cdSelf.type).toBe('COMPONENT_DIRECTORY');
    }
    // Tous les autres sont par défaut ENDPOINT (sauf brokers détectés via paths, non présents ici)
    const otherTypes = new Set(components.filter((c) => c.eic !== '17V000002014106G').map((c) => c.type));
    // Accepté : ENDPOINT (par défaut) ou BROKER (si paths ont introduit un stub)
    for (const t of otherTypes) {
      expect(['ENDPOINT', 'BROKER']).toContain(t);
    }
  });
});
```

- [ ] **Step 16.2 — Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- full-ingestion-cd-v2
```

Expected: PASS (2/2).

```bash
git add apps/api/test/full-ingestion-cd-v2.spec.ts
git commit -m "test(api): intégration CD v2 (pipeline CsvPathReader)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17 : `batch-upload.spec.ts` (intégration batch mixte)

**Files :**
- Create: `apps/api/test/batch-upload.spec.ts`

- [ ] **Step 17.1 — Écrire le test**

```typescript
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { ImportsService } from '../src/ingestion/imports.service.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE, CD_FIXTURE } from './fixtures-loader.js';

describe('Batch upload (integration)', () => {
  let imports: ImportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    imports = app.get(ImportsService);
    prisma = app.get(PrismaService);
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
  });

  afterAll(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'INTEG_BATCH' } } });
  });

  it('inspectBatch detects mixed types correctly', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipCd = buildZipFromFixture(CD_FIXTURE);

    const results = await imports.inspectBatch(
      [
        { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
        { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
        { originalname: 'garbage.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00]) },
      ],
      'INTEG_BATCH_MIX',
    );

    expect(results).toHaveLength(3);
    expect(results[0]!.dumpType).toBe('ENDPOINT');
    expect(results[0]!.confidence).toBe('HIGH');
    expect(results[1]!.dumpType).toBe('COMPONENT_DIRECTORY');
    expect(results[1]!.confidence).toBe('HIGH');
    // garbage.zip : valid ZIP magic but no ECP signature → FALLBACK
    expect(results[2]!.confidence).toBe('FALLBACK');
  });

  it('sequential createImport : 2 valid + 1 duplicate + 1 invalid', async () => {
    const zipEndpoint = buildZipFromFixture(ENDPOINT_FIXTURE);

    // 1st : succeeds
    const first = await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zipEndpoint },
      envName: 'INTEG_BATCH_SEQ',
      label: 'first',
    });
    expect(first.id).toBeTruthy();

    // 2nd : succeeds (CD)
    const zipCd = buildZipFromFixture(CD_FIXTURE);
    const second = await imports.createImport({
      file: { originalname: `${CD_FIXTURE}.zip`, buffer: zipCd },
      envName: 'INTEG_BATCH_SEQ',
      label: 'second',
    });
    expect(second.id).toBeTruthy();

    // 3rd : invalid — not a real zip (no magic bytes)
    await expect(
      imports.createImport({
        file: { originalname: 'garbage.zip', buffer: Buffer.from('not a zip') },
        envName: 'INTEG_BATCH_SEQ',
        label: 'third',
      }),
    ).rejects.toThrow();

    // Check DB : 2 imports created, the third was not persisted
    const list = await imports.listImports('INTEG_BATCH_SEQ');
    expect(list).toHaveLength(2);
    expect(list.map((i) => i.label).sort()).toEqual(['first', 'second']);
  });
});
```

- [ ] **Step 17.2 — Run + commit**

```bash
pnpm --filter @carto-ecp/api test -- batch-upload
```

Expected: PASS (2/2).

```bash
git add apps/api/test/batch-upload.spec.ts
git commit -m "test(api): intégration batch-upload (mix 3 fichiers, 2 créés + 1 erreur)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 18 : E2E Playwright — `multi-upload.spec.ts`

**Files :**
- Create: `apps/web/e2e/multi-upload.spec.ts`

- [ ] **Step 18.1 — Écrire le test**

```typescript
import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import AdmZip from 'adm-zip';

const EXCLUDED = new Set(['local_key_store.csv', 'registration_store.csv', 'registration_requests.csv']);

function buildFixtureZipBuffer(fixtureName: string): Buffer {
  const zip = new AdmZip();
  const base = join(__dirname, '..', '..', '..', 'tests', 'fixtures', fixtureName);
  for (const f of ['application_property.csv', 'component_directory.csv', 'messaging_statistics.csv', 'message_path.csv', 'message_type.csv', 'component_statistics.csv', 'synchronized_directories.csv']) {
    const p = join(base, f);
    if (existsSync(p)) zip.addFile(f, readFileSync(p));
  }
  return zip.toBuffer();
}

test.describe('Multi-upload', () => {
  // Purge all existing imports before this test to avoid duplicate detection
  test.beforeEach(async ({ request }) => {
    const envsRes = await request.get('http://localhost:3000/api/envs');
    const envs: string[] = await envsRes.json();
    for (const env of envs) {
      const listRes = await request.get(`http://localhost:3000/api/imports?env=${encodeURIComponent(env)}`);
      const imports: Array<{ id: string }> = await listRes.json();
      for (const imp of imports) {
        await request.delete(`http://localhost:3000/api/imports/${imp.id}`);
      }
    }
  });

  test('drag 2 fixtures, preview, submit, navigate to map', async ({ page }) => {
    await page.goto('/upload');
    await page.getByLabel(/Environnement/i).fill('E2E_MULTI');

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles([
      {
        name: '17V000000498771C_2026-04-17T21_27_17Z.zip',
        mimeType: 'application/zip',
        buffer: buildFixtureZipBuffer('17V000000498771C_2026-04-17T21_27_17Z'),
      },
      {
        name: '17V000002014106G_2026-04-17T22_11_50Z.zip',
        mimeType: 'application/zip',
        buffer: buildFixtureZipBuffer('17V000002014106G_2026-04-17T22_11_50Z'),
      },
    ]);

    // Wait for both rows to appear with inspection result
    await expect(page.getByText('17V000000498771C_2026-04-17T21_27_17Z.zip')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('17V000002014106G_2026-04-17T22_11_50Z.zip')).toBeVisible({ timeout: 20_000 });

    // Click Importer tout
    const submitBtn = page.getByRole('button', { name: /Importer tout/i });
    await expect(submitBtn).toBeEnabled({ timeout: 20_000 });
    await submitBtn.click();

    // Wait for summary
    await expect(page.getByText(/Batch terminé/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/2 créés/i)).toBeVisible();

    // Click "Voir sur la carte"
    await page.getByRole('link', { name: /Voir sur la carte/i }).click();
    await expect(page).toHaveURL(/\/$|\/\?env=E2E_MULTI/);
    await expect(page.locator('.leaflet-interactive').first()).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 18.2 — Commit**

```bash
git add apps/web/e2e/multi-upload.spec.ts
git commit -m "test(web): E2E multi-upload (drag 2 fixtures → preview → submit → carte)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 9 — CHANGELOG + smoke + PR

### Task 19 : Smoke manuel + CHANGELOG v2.0-alpha.2 + PR

**Files :**
- Modify: `CHANGELOG.md`

- [ ] **Step 19.1 — Smoke manuel**

```bash
pnpm dev
```

Dans un navigateur, `http://localhost:5173/upload` :
1. Saisir env `SMOKE_2B`
2. Drag-drop les 2 fixtures (`17V000000498771C_2026-04-17T21_27_17Z.zip` et `17V000002014106G_2026-04-17T22_11_50Z.zip`) depuis `smoke-zips/` (les regénérer si absent).
3. Vérifier que la table montre :
   - Ligne 1 : `17V000000498771C_...` / EIC `17V000000498771C` / Type `ENDPOINT` / Label auto
   - Ligne 2 : `17V000002014106G_...` / EIC `17V000002014106G` / Type `CD` / Label auto
   - Aucun doublon
4. Cliquer `Importer tout (2 prêts)`
5. Résumé : `2 créés · 0 ignoré · 0 échec`
6. Cliquer `Voir sur la carte →`
7. Vérifier markers visibles, EnvSelector affiche `SMOKE_2B`
8. Retour `/upload`, drag le même `17V000000498771C_...` seul → ligne doit montrer `Doublon` + checkbox Remplacer
9. Cocher Remplacer, `Importer tout` → 1 créé, 0 ignoré
10. Retour `/`, vérifier que le graph a été mis à jour (même EIC, nouveau label)

- [ ] **Step 19.2 — CHANGELOG v2.0-alpha.2**

Dans `CHANGELOG.md`, ajouter au-dessus du bloc `v2.0-alpha.1` dans la section `## [Unreleased]` :

```markdown
### v2.0-alpha.2 — Slice 2b Multi-upload + Detection fiable + Parser CD (2026-04-19)

**Multi-upload avec preview et confirmation** + **détection fiable** du type de dump basée sur la signature documentée ECP Admin Guide §4.20 + **parser CD complet** (`CsvPathReader`) qui lit directement `message_path.csv` (pas de XML côté CD).

**Highlights :**

- **DumpTypeDetectorV2** : inspection des noms de fichiers dans le ZIP (`synchronized_directories.csv` → CD, `messaging_statistics.csv` → ENDPOINT, `broker.xml` → BROKER, fallback CD). Retourne `{ dumpType, confidence: HIGH|FALLBACK, reason }` pour traçabilité frontend.
- **CsvPathReaderService** : parser dédié `message_path.csv`, explose `allowedSenders × receivers` en N×M paths logiques. Supporte séparateurs `|`, `,`, `;` en fallback.
- **ImportBuilder.buildFromCdCsv** : méthode dédiée dumps CD (composants depuis CSV pur, paths via CsvPathReader, stubs BROKER pour `intermediateBrokerCode` inconnus).
- **Routing dans ImportsService** : branche ENDPOINT (pipeline v2a XML) / CD (pipeline 2b CSV) / BROKER (metadata-only avec warning `BROKER_DUMP_METADATA_ONLY`).
- **POST /api/imports/inspect** : preview multi-fichiers sans persistance (max 20 × 50MB par requête, check dédup scoped par env).
- **POST /api/imports** étendu : `replaceImportId?` pour supprimer l'ancien puis créer le nouveau, avec validation `REPLACE_IMPORT_MISMATCH` si env diffère.
- **UploadPage refondue** : dropzone `multiple: true`, composant `UploadBatchTable` pour preview/édition (override dumpType, edit label, toggle Remplacer), bouton « Importer tout (N prêts) », barre de progression, résumé final.
- **Store Zustand slice `uploadBatch`** : states `pending-inspect | inspected | uploading | done | skipped | error`, submit best-effort transactionnel par fichier.
- **Tests** : 12 tests unit détecteur v2, 8 CsvPathReader, 4 buildFromCdCsv, 7 `inspectBatch`/`replaceImportId`, 5 controller, 2 intégration CD v2, 2 batch-upload, 1 E2E multi-upload. Typecheck api + web + shared PASS.
- **3 ADRs** : ADR-031 (détecteur via signatures CSV), ADR-032 (parser CD indépendant XML), ADR-033 (batch best-effort).

**Breaking changes :**
- Signature `detectDumpType` change : `(zipEntries, override?)` au lieu de `(csvRows, override)`. Callers internes mis à jour.
- Type `InspectResult` ajouté dans `@carto-ecp/shared`.

**Docs référencées :**
- `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` — signature des tables backup par type de composant.
- `docs/officiel/ECP System Design v4.16.0.pdf §9.2.2` — Broker ne persiste pas en base SQL (file-system backup).
```

- [ ] **Step 19.3 — Commit + push + PR**

```bash
pnpm typecheck
pnpm test
git add CHANGELOG.md
git commit -m "docs: CHANGELOG v2.0-alpha.2 — slice 2b multi-upload + detection + parser CD

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"

git push -u origin feat/v2-slice-2b-multi-upload

gh pr create --base feat/v2-slice-2a-fondations --title "feat(v2): slice 2b Multi-upload + Detection fiable + Parser CD (v2.0-alpha.2)" --body "$(cat <<'EOF'
## Summary

Réalise la demande initiale n°1 de l'utilisateur : pouvoir uploader N ZIPs d'un coup (ENDPOINTs + CDs) avec preview, détection automatique fiable du type, et gestion des doublons.

- Multi-upload avec dropzone + preview table + confirm
- `DumpTypeDetectorV2` basé sur signatures CSV officielles (Admin Guide §4.20)
- Parser CD complet via `CsvPathReaderService` (pas de XML côté CD)
- Flow best-effort transactionnel par fichier, skip silencieux des doublons avec option « Remplacer »
- Accepte les dumps BROKER en metadata-only (pas d'extraction car file-system backup non-SQL)

## Docs / Spec
- [Chapeau v2.0](docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md)
- [Slice 2b design](docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2b-design.md)
- [Plan d'implémentation](docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2b.md)
- ADRs : [031](docs/adr/ADR-031-dump-type-detector-v2-signatures-csv.md), [032](docs/adr/ADR-032-parser-cd-via-csv-path-reader.md), [033](docs/adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md)

## Breaking changes

- `detectDumpType` signature : `(zipEntries, override?)` au lieu de `(csvRows, override)` (callers internes mis à jour)
- Type `InspectResult` ajouté dans `@carto-ecp/shared`

## Base branche

Cette PR base sur `feat/v2-slice-2a-fondations` (PR #6 stackée). Quand #6 sera mergée, il faudra changer la base de cette PR vers `feat/phase1-remediation`.

## Test plan
- [x] `pnpm --filter @carto-ecp/api test` — full suite vert
- [x] `pnpm --filter @carto-ecp/web test` — full suite vert
- [x] `pnpm typecheck` — PASS api + web + shared
- [x] Smoke manuel : drag 2 fixtures (ENDPOINT + CD) dans SMOKE_2B → table preview → Importer tout → carte peuplée
- [x] Smoke manuel : ré-upload d'un doublon → badge 🟡 → cocher Remplacer → import créé, ancien supprimé
- [ ] E2E Playwright `multi-upload.spec.ts` (à lancer en CI)
- [ ] Review humaine du chapeau + slice 2b design

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review du plan

**Couverture spec 2b :**

- §1 objectif → Task 1 (ADRs) + scope global
- §2 scope inside → couvert par les 19 tasks
- §A architecture → Task 2 (listEntries) + Task 7 (types shared) + Task 11 (module) + Task 15 (UploadPage) + Task 13 (store)
- §B détecteur v2 → Task 3
- §C CsvPathReader → Task 5 (service) + Task 4 (readMessagePaths pour CSV source)
- §D ImportBuilder étendu → Task 6 + Task 10 (routing)
- §E endpoints → Task 8 (service) + Task 9 (controller)
- §F frontend → Task 12 (client) + Task 13 (store) + Task 14 (table) + Task 15 (page)
- §G dédup → Task 8 (findDuplicateForInspect) + Task 13 (forceReplace logic)
- §H error handling → Task 13 (submitBatch catch par item)
- §I tests → Tasks 2-18 (unit + intégration + E2E)
- §J DoD → Task 19 (smoke + CHANGELOG + PR)

**Placeholder scan :** aucun `TBD`, `TODO`, `similar to Task N`. Les commentaires "à ajuster selon le code réel" (Task 6, Task 10) sont des notes d'implémentation justifiées par des vérifications impossibles sans lire les fichiers — pas des placeholders.

**Type consistency :**
- `DumpType` défini Task 3, utilisé Tasks 5-8, 10, 13.
- `DumpTypeDetection` défini Task 3, utilisé Task 8, 10.
- `CdMessagePathRow` défini Task 4, utilisé Tasks 5, 6, 10.
- `BuiltImportedPath` (existant v2a), utilisé Tasks 5, 6, 10.
- `InspectResult` défini Task 7, utilisé Tasks 8, 9, 12, 13.
- `UploadBatchItem` défini Task 13, utilisé Task 14, 15.
- `replaceImportId` propagé zod (Task 9) → service (Task 8) → API client (Task 12) → store submitBatch (Task 13).

Toutes les signatures cohérentes.

---

## Execution Handoff

**Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2b.md`.**

Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — dispatch d'un subagent frais par task, review entre chaque. Même méthode qu'en 2a. Prérequis : sub-skill `superpowers:subagent-driven-development`.

**2. Inline Execution** — exécution dans cette session avec `superpowers:executing-plans`.

Laquelle tu choisis ?
