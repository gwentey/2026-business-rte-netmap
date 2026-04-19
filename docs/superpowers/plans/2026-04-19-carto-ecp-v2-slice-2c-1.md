# Carto ECP v2.0 — Slice 2c-1 (Admin panel : onglet Imports) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer une route `/admin` avec un onglet Imports fonctionnel (liste + édition inline de `label`/`effectiveDate` + delete + filtre env + recherche), et un endpoint `PATCH /api/imports/:id` avec zod strict.

**Architecture:** Backend ajoute un endpoint PATCH pur metadata (2 champs). Frontend introduit une nouvelle page `/admin` avec un shell de tabs (5 entrées, 1 active) et une table d'administration des imports avec édition inline debouncée. `GET /api/imports` élargit son retour de `ImportSummary[]` à `ImportDetail[]` pour exposer stats + warnings en un seul fetch. Scope UI-only côté data (pas de nouveau modèle Prisma).

**Tech Stack:** NestJS 10 + zod + Prisma 5 (patch simple), React 18 + React Router v6 + Zustand, Vitest 2 + happy-dom + @testing-library/react 16.

**Spec de référence :** [`docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2c-1-design.md`](../specs/2026-04-19-carto-ecp-v2-slice-2c-1-design.md) — lire §B (endpoint), §C (AdminPage), §D (ImportsAdminTable), §E (debouncing), §G (migration type), §I (ADR-035).

**Branche :** `feat/v2-slice-2c-admin` (déjà créée depuis le tip de `feat/v2-slice-2f-icons`).

---

## Vue d'ensemble

| Phase | Tasks | Livre |
|---|---|---|
| Phase 1 — ADR | T1 | ADR-035 (dumpType immutable) |
| Phase 2 — Backend | T2, T3, T4 | `ImportsService.listImports → ImportDetail[]`, `updateImport`, `PATCH` controller |
| Phase 3 — Shared + Client | T5 | API client web (`api.updateImport`, `api.listImports` return type) |
| Phase 4 — Frontend shell | T6, T7 | `AdminTabs` component + `AdminPage` route |
| Phase 5 — Frontend table | T8, T9, T10 | Debounce helper, `ImportsAdminTable` component, intégration route |
| Phase 6 — Navigation + smoke + PR | T11 | Header lien "Admin", CHANGELOG, smoke, PR |

**Convention commits :** Conventional Commits FR, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Phase 1 — ADR

### Task 1 : ADR-035

**Files :**
- Create: `docs/adr/ADR-035-dumptype-immutable-post-ingest.md`

Basé sur `docs/adr/000-template.md`. Champs communs : `Contexte = "Slice v2.0-2c-1 Admin imports"`, `Features = *`, `App = api`, `Date = 2026-04-19`, `Auteur = Anthony + Claude`, `Owner = Anthony`, `Statut = Accepté`.

- [ ] **Step 1.1 — Rédiger l'ADR**

**Titre :** "`dumpType` immutable post-ingest — delete + re-upload pour corriger un type mal détecté"

**Contexte (3-5 phrases)**

La slice 2c-1 introduit l'édition admin des imports (`PATCH /api/imports/:id`). Se pose la question : doit-on permettre de réassigner le `dumpType` d'un import existant ? Les `components` et `paths` persistés ont été extraits selon la pipeline du type d'origine (ENDPOINT lit le blob XML, CD lit `message_path.csv`). Modifier seulement la metadata `Import.dumpType` crée une incohérence : la table prétend que c'est un CD mais les paths ont été extraits comme si c'était un ENDPOINT.

**Options considérées**

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| A — Immutable post-ingest | Le `dumpType` est gelé après création. Pour le changer : delete + re-upload (avec override manuel supporté en 2b) | XS | Cohérence DB garantie, simple | 1 delete + 1 re-upload au lieu d'un PATCH |
| B — Re-parse atomique | Nouvel endpoint `POST /api/imports/:id/reingest` qui lit le zip stocké, supprime components/paths, relance la pipeline avec le nouveau type | M | Propre côté UX | Nouveau endpoint + logique atomique (delete puis reparse), le stored zip peut avoir été supprimé si v2.0-alpha.1 bug de cleanup |
| C — Metadata only | Update juste `Import.dumpType` en DB sans toucher aux components/paths | XS | Trivial | Incohérence garantie — **NON RECOMMANDÉ** |

**Décision retenue**

Option A. Pour 2c-1 le scope est UI-only, ajouter un reingest (B) double le scope backend. L'alternative delete + re-upload est parfaitement acceptable avec le flow 2b (preview table + dumpType override manuel).

**Conséquences**

**Positives :**
- Cohérence DB garantie : `Import.dumpType` correspond toujours à ce qui a été extrait.
- Scope 2c-1 simple : zod strict sur `{ label?, effectiveDate? }`, refuse tout le reste.

**Négatives :**
- Corriger un type mal détecté nécessite delete + re-upload (2 clics admin) au lieu d'un PATCH.
- En cas de big batch mal classé, admin doit supprimer N imports avant de re-uploader.

**Ce qu'on s'interdit désormais :**
- Ajouter `dumpType` à la liste des champs éditables dans `UpdateImportSchema`.
- Faire un PATCH de `dumpType` en metadata only sans re-parse.

**Ressources / Références**
- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2c-1-design.md` §B (zod strict), §I (ADR note)
- Slice 2b design §H pour le flow delete + re-upload

- [ ] **Step 1.2 — Commit**

```bash
git add docs/adr/ADR-035-dumptype-immutable-post-ingest.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-035 — dumpType immutable post-ingest

Justifie le scope restreint du PATCH /api/imports/:id (label + effectiveDate
uniquement). Corriger un type mal détecté = delete + re-upload.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Backend

### Task 2 : `ImportsService.listImports` retourne `ImportDetail[]`

**Files :**
- Modify: `apps/api/src/ingestion/imports.service.ts`
- Modify: `apps/api/src/ingestion/imports.service.spec.ts`
- Modify: `packages/shared/src/graph.ts` (retype `listImports`)

- [ ] **Step 2.1 — Test RED**

Ajouter dans `imports.service.spec.ts` un nouveau describe (après les existants) :

```typescript
describe('ImportsService.listImports — retourne ImportDetail[]', () => {
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
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_LIST_DETAIL' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'TEST_LIST_DETAIL' } } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_LIST_DETAIL' } } });
  });

  it('includes stats and warnings in each row', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await service.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_LIST_DETAIL_A',
      label: 'with-stats',
    });

    const list = await service.listImports('TEST_LIST_DETAIL_A');
    expect(list).toHaveLength(1);
    expect(list[0]!.stats).toBeDefined();
    expect(list[0]!.stats.componentsCount).toBeGreaterThan(0);
    expect(list[0]!.stats.pathsCount).toBeGreaterThanOrEqual(0);
    expect(list[0]!.stats.messagingStatsCount).toBeGreaterThanOrEqual(0);
    expect(list[0]!.warnings).toBeInstanceOf(Array);
  });

  it('preserves ordering by effectiveDate desc (unchanged behavior)', async () => {
    const zipA = buildZipFromFixture(ENDPOINT_FIXTURE);
    const zipB = buildZipFromFixture(CD_FIXTURE);
    await service.createImport({ file: { originalname: 'early.zip', buffer: zipA }, envName: 'TEST_LIST_DETAIL_SORT', label: 'early' });
    // Force sourceDumpTimestamp difference via filename
    await service.createImport({ file: { originalname: '17V000002014106G_2030-12-31T12_00_00Z.zip', buffer: zipB }, envName: 'TEST_LIST_DETAIL_SORT', label: 'late' });

    const list = await service.listImports('TEST_LIST_DETAIL_SORT');
    expect(list).toHaveLength(2);
    expect(list[0]!.label).toBe('late');
    expect(list[1]!.label).toBe('early');
  });
});
```

- [ ] **Step 2.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected: FAIL sur les 2 nouveaux tests — `list[0].stats` et `list[0].warnings` sont `undefined` (l'actuel `listImports` retourne `ImportSummary[]` qui n'inclut pas ces champs).

- [ ] **Step 2.3 — Modifier `listImports`**

Dans `apps/api/src/ingestion/imports.service.ts`, remplacer la méthode `listImports` :

```typescript
async listImports(envFilter?: string): Promise<ImportDetail[]> {
  const where = envFilter ? { envName: envFilter } : {};
  const rows = await this.prisma.import.findMany({
    where,
    orderBy: { effectiveDate: 'desc' },
    include: {
      _count: {
        select: {
          importedComponents: true,
          importedPaths: true,
          importedStats: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    ...this.toSummary(r),
    warnings: JSON.parse(r.warningsJson) as Warning[],
    stats: {
      componentsCount: r._count.importedComponents,
      pathsCount: r._count.importedPaths,
      messagingStatsCount: r._count.importedStats,
    },
  }));
}
```

Vérifier que `Warning` est importé depuis `@carto-ecp/shared` (il l'est déjà via `InspectResult`) et que `ImportDetail` l'est aussi.

- [ ] **Step 2.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
pnpm --filter @carto-ecp/api typecheck
```

Expected: tous les tests PASS (anciens + 2 nouveaux) + typecheck PASS.

- [ ] **Step 2.5 — Commit**

```bash
git add apps/api/src/ingestion/imports.service.ts apps/api/src/ingestion/imports.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): listImports retourne ImportDetail[] avec stats et warnings

GET /api/imports inclut désormais stats (counts) et warnings directement
pour éviter un 2e fetch côté admin. ImportDetail extends ImportSummary,
rétrocompatible pour les callers existants (store, UploadPage).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 : `ImportsService.updateImport`

**Files :**
- Modify: `apps/api/src/ingestion/imports.service.ts`
- Modify: `apps/api/src/ingestion/imports.service.spec.ts`

- [ ] **Step 3.1 — Test RED**

Ajouter dans `imports.service.spec.ts` un nouveau describe :

```typescript
describe('ImportsService.updateImport', () => {
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
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_UPDATE' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: { startsWith: 'TEST_UPDATE' } } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: { startsWith: 'TEST_UPDATE' } } });
  });

  it('updates label only without affecting effectiveDate', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await service.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_UPDATE_LABEL',
      label: 'original',
    });
    const before = await prisma.import.findUnique({ where: { id: created.id } });
    const updated = await service.updateImport(created.id, { label: 'renamed' });

    expect(updated.label).toBe('renamed');
    expect(updated.effectiveDate).toBe(before!.effectiveDate.toISOString());
  });

  it('updates effectiveDate only without affecting label', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await service.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_UPDATE_DATE',
      label: 'stay-same',
    });
    const newDate = '2030-01-15T10:00:00.000Z';
    const updated = await service.updateImport(created.id, { effectiveDate: newDate });

    expect(updated.label).toBe('stay-same');
    expect(updated.effectiveDate).toBe(newDate);
  });

  it('updates both fields in one call', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    const created = await service.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_UPDATE_BOTH',
      label: 'old',
    });
    const newDate = '2030-06-20T08:30:00.000Z';
    const updated = await service.updateImport(created.id, { label: 'new', effectiveDate: newDate });

    expect(updated.label).toBe('new');
    expect(updated.effectiveDate).toBe(newDate);
  });

  it('throws NotFoundException for unknown id', async () => {
    await expect(
      service.updateImport('00000000-0000-0000-0000-000000000000', { label: 'x' }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'IMPORT_NOT_FOUND' }) });
  });
});
```

- [ ] **Step 3.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
```

Expected: FAIL (méthode `updateImport` absente).

- [ ] **Step 3.3 — Implémenter `updateImport`**

Dans `apps/api/src/ingestion/imports.service.ts`, ajouter la méthode (après `listImports`, avant `deleteImport` pour la cohérence d'ordre CRUD) :

```typescript
async updateImport(
  id: string,
  patch: { label?: string; effectiveDate?: string },
): Promise<ImportDetail> {
  const existing = await this.prisma.import.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException({ code: 'IMPORT_NOT_FOUND', message: `Import ${id} not found` });
  }

  const data: { label?: string; effectiveDate?: Date } = {};
  if (patch.label !== undefined) data.label = patch.label;
  if (patch.effectiveDate !== undefined) data.effectiveDate = new Date(patch.effectiveDate);

  await this.prisma.import.update({ where: { id }, data });
  return this.toDetail(id);
}
```

Vérifier que `NotFoundException` est déjà importé depuis `@nestjs/common` (il l'est pour `deleteImport`).

- [ ] **Step 3.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.service
pnpm --filter @carto-ecp/api typecheck
```

Expected: 4/4 nouveaux tests PASS + typecheck PASS.

- [ ] **Step 3.5 — Commit**

```bash
git add apps/api/src/ingestion/imports.service.ts apps/api/src/ingestion/imports.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): ImportsService.updateImport (label + effectiveDate)

Patch pure metadata, pas de re-parse. Refuse dumpType et autres champs
(policy documentée en ADR-035). NotFoundException si id inconnu.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 : `PATCH /api/imports/:id` endpoint

**Files :**
- Modify: `apps/api/src/ingestion/imports.controller.ts`
- Modify: `apps/api/src/ingestion/imports.controller.spec.ts`

- [ ] **Step 4.1 — Test RED**

Ajouter dans `imports.controller.spec.ts` un nouveau describe :

```typescript
describe('ImportsController.update', () => {
  let ctrl: ImportsController;
  const updateSpy = vi.fn(async () => ({
    id: 'updated-id', envName: 'X', label: 'new-label', fileName: 'f.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: null, sourceDumpTimestamp: null,
    uploadedAt: '2026-04-19T00:00:00.000Z',
    effectiveDate: '2030-01-15T10:00:00.000Z',
    warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
  }));

  beforeEach(async () => {
    updateSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            updateImport: updateSpy,
            createImport: async () => ({}),
            inspectBatch: async () => [],
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('forwards valid body with label only to service', async () => {
    const result = await ctrl.update('abc-id', { label: 'new-label' });
    expect(result.label).toBe('new-label');
    expect(updateSpy).toHaveBeenCalledWith('abc-id', { label: 'new-label' });
  });

  it('forwards valid body with effectiveDate only', async () => {
    await ctrl.update('abc-id', { effectiveDate: '2030-01-15T10:00:00.000Z' });
    expect(updateSpy).toHaveBeenCalledWith('abc-id', { effectiveDate: '2030-01-15T10:00:00.000Z' });
  });

  it('rejects extra fields via zod strict (dumpType)', async () => {
    await expect(
      ctrl.update('abc-id', { dumpType: 'CD' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects extra fields via zod strict (envName)', async () => {
    await expect(
      ctrl.update('abc-id', { envName: 'OTHER' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid effectiveDate format', async () => {
    await expect(
      ctrl.update('abc-id', { effectiveDate: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects empty body', async () => {
    await expect(
      ctrl.update('abc-id', {}),
    ).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 4.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
```

Expected: FAIL (méthode `update` absente).

- [ ] **Step 4.3 — Implémenter**

Dans `apps/api/src/ingestion/imports.controller.ts`, ajouter :

1. Le schéma zod en haut du fichier (à côté de `CreateImportSchema` et `InspectBodySchema`) :

```typescript
const UpdateImportSchema = z.object({
  label: z.string().min(1).max(256).optional(),
  effectiveDate: z.string().datetime().optional(),
}).strict();
```

2. La méthode `update` dans la classe (après `delete` pour l'ordre CRUD) :

```typescript
@Patch(':id')
async update(
  @Param('id') id: string,
  @Body() body: unknown,
): Promise<ImportDetail> {
  const parsed = UpdateImportSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
  }
  if (Object.keys(parsed.data).length === 0) {
    throw new BadRequestException({ code: 'INVALID_BODY', message: 'Au moins un champ à modifier requis' });
  }
  return this.imports.updateImport(id, parsed.data);
}
```

3. Ajouter `Patch` à l'import `@nestjs/common` en haut du fichier :

```typescript
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  Param, Patch, Post, Query, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
```

- [ ] **Step 4.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/api test -- imports.controller
pnpm --filter @carto-ecp/api test
pnpm --filter @carto-ecp/api typecheck
```

Expected: 6/6 nouveaux tests PASS + full suite verte + typecheck PASS.

- [ ] **Step 4.5 — Commit**

```bash
git add apps/api/src/ingestion/imports.controller.ts apps/api/src/ingestion/imports.controller.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): PATCH /api/imports/:id — édition label + effectiveDate

Zod strict à 2 champs, refuse tout extra (dumpType, envName, etc.) ainsi
que body vide. Code INVALID_BODY sur erreur. Délègue à ImportsService.updateImport.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Shared + Client web

### Task 5 : API client web — `api.updateImport` + retype `listImports`

**Files :**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 5.1 — Étendre le client**

Dans `apps/web/src/lib/api.ts` :

1. Changer le type de retour de `listImports` :

```typescript
async listImports(env?: string): Promise<ImportDetail[]> {
  const query = env ? `?env=${encodeURIComponent(env)}` : '';
  return request<ImportDetail[]>(`/api/imports${query}`);
},
```

2. Ajouter `updateImport` après `createImport` :

```typescript
async updateImport(
  id: string,
  patch: { label?: string; effectiveDate?: string },
): Promise<ImportDetail> {
  return request<ImportDetail>(`/api/imports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
},
```

Vérifier que `ImportDetail` est déjà importé en haut du fichier (il l'est via `import type { ..., ImportDetail, ... } from '@carto-ecp/shared';`).

- [ ] **Step 5.2 — Mettre à jour le store Zustand si besoin**

Dans `apps/web/src/store/app-store.ts`, le state `imports: ImportSummary[]` doit être changé en `imports: ImportDetail[]`. Puisque `ImportDetail extends ImportSummary`, les consommateurs actuels (UploadPage qui n'utilise pas `imports` depuis le store, EnvSelector qui ne l'utilise pas non plus) continuent de marcher. Juste le typage est élargi.

Chercher toutes les occurrences de `ImportSummary[]` dans `apps/web/src/store/app-store.ts` et remplacer par `ImportDetail[]`. Si `ImportSummary` n'est plus utilisé ailleurs dans le fichier, supprimer son import.

```bash
grep -n "ImportSummary" apps/web/src/store/app-store.ts
```

Remplacer par `ImportDetail` toutes les occurrences liées à la liste `imports`. Adapter l'import en haut du fichier :

```typescript
import type { GraphResponse, ImportDetail } from '@carto-ecp/shared';
```

- [ ] **Step 5.3 — Typecheck + commit**

```bash
pnpm --filter @carto-ecp/web typecheck
```

Expected: PASS.

```bash
git add apps/web/src/lib/api.ts apps/web/src/store/app-store.ts
git commit -m "$(cat <<'EOF'
feat(web): api.updateImport + retype listImports vers ImportDetail[]

- api.updateImport(id, { label?, effectiveDate? }) → PATCH /api/imports/:id
- api.listImports retourne ImportDetail[] (superset rétrocompatible)
- Store Zustand : imports typé ImportDetail[]

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Frontend shell

### Task 6 : `AdminTabs` component

**Files :**
- Create: `apps/web/src/components/Admin/AdminTabs.tsx`
- Create: `apps/web/src/components/Admin/AdminTabs.test.tsx`

- [ ] **Step 6.1 — Test RED**

```tsx
// apps/web/src/components/Admin/AdminTabs.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTabs } from './AdminTabs.js';

describe('AdminTabs', () => {
  it('renders 5 tabs with only Imports enabled', () => {
    render(<AdminTabs active="imports" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Imports/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Composants/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Annuaire ENTSO-E/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Registry RTE/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Zone danger/i })).toBeDisabled();
  });

  it('calls onChange with the clicked tab id for enabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Imports/i }));
    expect(onChange).toHaveBeenCalledWith('imports');
  });

  it('does not call onChange for disabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    const componentsTab = screen.getByRole('button', { name: /Composants/i });
    await userEvent.click(componentsTab).catch(() => {}); // click on disabled button may reject
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- AdminTabs
```

Expected: FAIL (composant absent).

- [ ] **Step 6.3 — Implémenter**

```tsx
// apps/web/src/components/Admin/AdminTabs.tsx

export type AdminTabId = 'imports' | 'components' | 'entsoe' | 'registry' | 'danger';

type TabDef = { id: AdminTabId; label: string; enabled: boolean; tooltip: string };

const TABS: TabDef[] = [
  { id: 'imports', label: 'Imports', enabled: true, tooltip: '' },
  { id: 'components', label: 'Composants', enabled: false, tooltip: 'Disponible en slice 2c-2' },
  { id: 'entsoe', label: 'Annuaire ENTSO-E', enabled: false, tooltip: 'Disponible en slice 2e' },
  { id: 'registry', label: 'Registry RTE', enabled: false, tooltip: 'Disponible en slice 2e' },
  { id: 'danger', label: '⚠ Zone danger', enabled: false, tooltip: 'Disponible en slice 2e' },
];

type Props = {
  active: AdminTabId;
  onChange: (id: AdminTabId) => void;
};

export function AdminTabs({ active, onChange }: Props): JSX.Element {
  return (
    <nav className="flex gap-1 border-b border-gray-200" role="tablist">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          onClick={() => { if (tab.enabled) onChange(tab.id); }}
          disabled={!tab.enabled}
          title={tab.tooltip}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
            active === tab.id
              ? 'border-rte text-rte'
              : tab.enabled
                ? 'border-transparent text-gray-700 hover:text-gray-900'
                : 'border-transparent text-gray-300 cursor-not-allowed'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
```

- [ ] **Step 6.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test -- AdminTabs
```

Expected: 3/3 PASS.

```bash
git add apps/web/src/components/Admin/AdminTabs.tsx apps/web/src/components/Admin/AdminTabs.test.tsx
git commit -m "feat(web): AdminTabs component (5 tabs, Imports seul actif)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7 : `AdminPage` (shell de route)

**Files :**
- Create: `apps/web/src/pages/AdminPage.tsx`
- Create: `apps/web/src/pages/AdminPage.test.tsx`

- [ ] **Step 7.1 — Test RED**

```tsx
// apps/web/src/pages/AdminPage.test.tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage.js';

// ImportsAdminTable n'existe pas encore en Task 7 — on le mocke ici
vi.mock('../components/Admin/ImportsAdminTable.js', () => ({
  ImportsAdminTable: () => <div data-testid="imports-admin-table">Imports Table</div>,
}));

describe('AdminPage', () => {
  it('renders title, tabs, and ImportsAdminTable by default', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(screen.getByText(/Administration/i)).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByTestId('imports-admin-table')).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- AdminPage
```

Expected: FAIL (composant absent).

- [ ] **Step 7.3 — Implémenter**

```tsx
// apps/web/src/pages/AdminPage.tsx
import { useState } from 'react';
import { AdminTabs, type AdminTabId } from '../components/Admin/AdminTabs.js';
import { ImportsAdminTable } from '../components/Admin/ImportsAdminTable.js';

export function AdminPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<AdminTabId>('imports');

  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Administration</h1>
      <AdminTabs active={activeTab} onChange={setActiveTab} />
      <div className="mt-4">
        {activeTab === 'imports' ? <ImportsAdminTable /> : null}
      </div>
    </div>
  );
}
```

**Note** : le composant `ImportsAdminTable` est importé mais n'existe pas encore. Sa création est **Task 9**. Pour que le typecheck passe maintenant, on crée un stub temporaire en Task 9 step 9.0. Le test `AdminPage.test.tsx` mock le composant pour ne pas dépendre de son implémentation.

- [ ] **Step 7.4 — Créer un stub temporaire `ImportsAdminTable` pour typecheck**

Crée `apps/web/src/components/Admin/ImportsAdminTable.tsx` avec un stub minimal :

```tsx
// apps/web/src/components/Admin/ImportsAdminTable.tsx (stub temporaire, sera complété en Task 9)
export function ImportsAdminTable(): JSX.Element {
  return <div className="p-4 text-sm text-gray-500">Chargement…</div>;
}
```

- [ ] **Step 7.5 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test -- AdminPage
pnpm --filter @carto-ecp/web typecheck
```

Expected: 1/1 PASS + typecheck PASS.

```bash
git add apps/web/src/pages/AdminPage.tsx apps/web/src/pages/AdminPage.test.tsx apps/web/src/components/Admin/ImportsAdminTable.tsx
git commit -m "$(cat <<'EOF'
feat(web): AdminPage shell avec tabs + stub ImportsAdminTable

Page /admin avec AdminTabs (5 onglets, Imports actif) et slot pour
ImportsAdminTable. Le stub sera remplacé par l'implémentation complète
en Task 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Frontend table

### Task 8 : Debounce helper

**Files :**
- Create: `apps/web/src/lib/debounce.ts`
- Create: `apps/web/src/lib/debounce.test.ts`

- [ ] **Step 8.1 — Test RED**

```typescript
// apps/web/src/lib/debounce.test.ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce.js';

describe('debounce', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('calls the function only after wait time', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('a');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('resets the wait timer on repeated calls', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a');
    vi.advanceTimersByTime(50);
    debounced('b');
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledWith('b');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('passes the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);
    debounced('a', 1);
    debounced('b', 2);
    debounced('c', 3);
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith('c', 3);
  });
});
```

- [ ] **Step 8.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- debounce
```

Expected: FAIL.

- [ ] **Step 8.3 — Implémenter**

```typescript
// apps/web/src/lib/debounce.ts
export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, wait);
  };
}
```

- [ ] **Step 8.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test -- debounce
```

Expected: 3/3 PASS.

```bash
git add apps/web/src/lib/debounce.ts apps/web/src/lib/debounce.test.ts
git commit -m "feat(web): debounce helper pour édition inline

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9 : `ImportsAdminTable` — implémentation complète

**Files :**
- Modify (remplace le stub de Task 7) : `apps/web/src/components/Admin/ImportsAdminTable.tsx`
- Create: `apps/web/src/components/Admin/ImportsAdminTable.test.tsx`

- [ ] **Step 9.1 — Test RED**

```tsx
// apps/web/src/components/Admin/ImportsAdminTable.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { ImportsAdminTable } from './ImportsAdminTable.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    listEnvs: vi.fn().mockResolvedValue(['OPF', 'PROD']),
    listImports: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    getGraph: vi.fn(),
  },
}));

function fakeImportDetail(overrides: Partial<any> = {}) {
  return {
    id: 'i1', envName: 'OPF', label: 'Import 1', fileName: 'file1.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: '17V-A', sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
    uploadedAt: '2026-04-17T22:00:00.000Z',
    effectiveDate: '2026-04-17T21:27:17.000Z',
    warnings: [],
    stats: { componentsCount: 10, pathsCount: 5, messagingStatsCount: 2 },
    ...overrides,
  };
}

describe('ImportsAdminTable', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: 'OPF', envs: ['OPF', 'PROD'], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null, loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.updateImport).mockReset();
    vi.mocked(api.deleteImport).mockReset();
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF', 'PROD']);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('renders a row per import with label and sourceEic', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'Alpha', sourceComponentEic: '17V-A' }),
      fakeImportDetail({ id: 'i2', label: 'Beta', sourceComponentEic: '17V-B', fileName: 'file2.zip' }),
    ]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
    expect(screen.getByText('17V-A')).toBeInTheDocument();
    expect(screen.getByText('17V-B')).toBeInTheDocument();
  });

  it('filters imports by search text (label, fileName, sourceEic)', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'Alpha', fileName: 'a.zip', sourceComponentEic: '17V-AAA' }),
      fakeImportDetail({ id: 'i2', label: 'Beta', fileName: 'b.zip', sourceComponentEic: '17V-BBB' }),
    ]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/label, filename/i);
    await userEvent.type(searchInput, 'BBB');
    await waitFor(() => {
      expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });

  it('calls api.updateImport with debounced label edit', async () => {
    vi.useFakeTimers();
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'Original' }),
    ]);
    vi.mocked(api.updateImport).mockResolvedValue(fakeImportDetail({ id: 'i1', label: 'Changed' }));
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    // attendre le 1er render via real timers court-circuité
    await vi.runAllTimersAsync();
    const input = await waitFor(() => screen.getByDisplayValue('Original'));
    // userEvent avec fake timers nécessite `advanceTimers`
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await user.clear(input);
    await user.type(input, 'Renamed');
    // Avant 500ms : pas d'appel
    vi.advanceTimersByTime(300);
    expect(api.updateImport).not.toHaveBeenCalled();
    // Après 500ms supplémentaires
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    expect(api.updateImport).toHaveBeenCalledWith('i1', { label: 'Renamed' });
    vi.useRealTimers();
  });

  it('opens confirm modal on delete click and calls api.deleteImport on confirm', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'To delete' }),
    ]);
    vi.mocked(api.deleteImport).mockResolvedValue(undefined);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('To delete')).toBeInTheDocument());

    const deleteBtn = screen.getByRole('button', { name: /retirer|supprimer import/i });
    await userEvent.click(deleteBtn);
    expect(screen.getByRole('heading', { name: /Supprimer l'import/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^Supprimer$/ });
    await userEvent.click(confirmBtn);
    expect(api.deleteImport).toHaveBeenCalledWith('i1');
  });

  it('filters by env when env select is changed', async () => {
    vi.mocked(api.listImports).mockResolvedValue([]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith('OPF'));
    const envSelect = screen.getByLabelText(/Env/i);
    await userEvent.selectOptions(envSelect, 'PROD');
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith('PROD'));
  });
});
```

- [ ] **Step 9.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- ImportsAdminTable
```

Expected: FAIL (le stub n'a pas les fonctionnalités attendues).

- [ ] **Step 9.3 — Remplacer le stub par l'implémentation**

Remplacer **intégralement** le contenu de `apps/web/src/components/Admin/ImportsAdminTable.tsx` :

```tsx
// apps/web/src/components/Admin/ImportsAdminTable.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ImportDetail } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';
import { debounce } from '../../lib/debounce.js';

export function ImportsAdminTable(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadEnvs = useAppStore((s) => s.loadEnvs);

  const [envFilter, setEnvFilter] = useState<string>(activeEnv ?? '');
  const [search, setSearch] = useState('');
  const [imports, setImports] = useState<ImportDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => { void loadEnvs(); }, [loadEnvs]);

  const reloadImports = async (env: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listImports(env || undefined);
      setImports(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reloadImports(envFilter); }, [envFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return imports;
    return imports.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.fileName.toLowerCase().includes(q) ||
      (i.sourceComponentEic ?? '').toLowerCase().includes(q),
    );
  }, [imports, search]);

  const handleDeleteConfirmed = async (): Promise<void> => {
    if (confirmDeleteId === null) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await api.deleteImport(id);
      await reloadImports(envFilter);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deletingItem = confirmDeleteId !== null
    ? imports.find((i) => i.id === confirmDeleteId) ?? null
    : null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <label className="text-sm">
          <span className="mr-2">Env :</span>
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            aria-label="Env"
          >
            <option value="">Tous</option>
            {envs.map((e) => (<option key={e} value={e}>{e}</option>))}
          </select>
        </label>

        <label className="flex-1 max-w-md text-sm">
          <span className="mr-2">Recherche :</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="label, filename, EIC..."
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <Link
          to={`/upload${envFilter ? `?env=${encodeURIComponent(envFilter)}` : ''}`}
          className="rounded bg-rte px-3 py-1.5 text-sm text-white hover:bg-red-700"
        >
          + Importer des dumps
        </Link>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}

      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">Fichier</th>
            <th className="px-2 py-1 text-left">Source EIC</th>
            <th className="px-2 py-1 text-left">Label</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Effective date</th>
            <th className="px-2 py-1 text-left">Uploaded at</th>
            <th className="px-2 py-1 text-left">Stats</th>
            <th className="px-2 py-1 text-left">Warn.</th>
            <th className="px-2 py-1 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((item) => (
            <AdminImportRow
              key={item.id}
              item={item}
              onDelete={() => setConfirmDeleteId(item.id)}
              onReload={() => reloadImports(envFilter)}
            />
          ))}
          {filtered.length === 0 && !loading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
                Aucun import pour ce filtre.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {deletingItem !== null ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-w-md rounded-lg bg-white p-6">
            <h3 className="mb-2 text-lg font-semibold">Supprimer l'import ?</h3>
            <p className="mb-4 text-sm text-gray-600">
              L'import « {deletingItem.label} » sera définitivement supprimé. Les composants
              et paths qu'il apportait seront retirés du graph (sauf s'ils sont apportés
              aussi par un autre import).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="rounded px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => { void handleDeleteConfirmed(); }}
                className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type RowProps = {
  item: ImportDetail;
  onDelete: () => void;
  onReload: () => Promise<void>;
};

function AdminImportRow({ item, onDelete, onReload }: RowProps): JSX.Element {
  const [labelValue, setLabelValue] = useState(item.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setLabelValue(item.label); }, [item.label]);

  const saveLabel = useMemo(
    () => debounce(async (newValue: string) => {
      const trimmed = newValue.trim();
      if (trimmed.length === 0 || trimmed === item.label) return;
      setSaving(true);
      try {
        await api.updateImport(item.id, { label: trimmed });
        await onReload();
      } finally {
        setSaving(false);
      }
    }, 500),
    [item.id, item.label, onReload],
  );

  const saveEffectiveDate = async (newValue: string): Promise<void> => {
    const asDate = new Date(newValue);
    if (Number.isNaN(asDate.getTime())) return;
    const iso = asDate.toISOString();
    if (iso === item.effectiveDate) return;
    setSaving(true);
    try {
      await api.updateImport(item.id, { effectiveDate: iso });
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const statsLabel = `${item.stats.componentsCount} comp · ${item.stats.pathsCount} paths · ${item.stats.messagingStatsCount} stats`;
  const uploadedDisplay = formatDateTime(item.uploadedAt);

  return (
    <tr className="border-t border-gray-200">
      <td className="px-2 py-1">
        <div className="font-mono text-xs" title={item.fileName}>
          {item.fileName.length > 36 ? `${item.fileName.slice(0, 33)}…` : item.fileName}
        </div>
      </td>
      <td className="px-2 py-1 font-mono text-xs">{item.sourceComponentEic ?? '—'}</td>
      <td className="px-2 py-1">
        <input
          type="text"
          value={labelValue}
          onChange={(e) => { setLabelValue(e.target.value); saveLabel(e.target.value); }}
          className="w-40 rounded border border-gray-300 px-1 py-0.5 text-xs"
        />
        {saving ? <span className="ml-1 text-xs text-gray-400">…</span> : null}
      </td>
      <td className="px-2 py-1">
        <TypeBadge dumpType={item.dumpType} />
      </td>
      <td className="px-2 py-1">
        <input
          type="datetime-local"
          defaultValue={toDatetimeLocalInput(item.effectiveDate)}
          onBlur={(e) => { void saveEffectiveDate(e.target.value); }}
          className="w-44 rounded border border-gray-300 px-1 py-0.5 text-xs"
        />
      </td>
      <td className="px-2 py-1 text-xs">{uploadedDisplay}</td>
      <td className="px-2 py-1 text-xs text-gray-700">{statsLabel}</td>
      <td className="px-2 py-1">
        {item.warnings.length > 0 ? (
          <span
            className="inline-block rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800"
            title={item.warnings.map((w) => w.code).join(', ')}
          >
            {item.warnings.length}
          </span>
        ) : (
          <span className="text-xs text-gray-400">0</span>
        )}
      </td>
      <td className="px-2 py-1">
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Supprimer import ${item.label}`}
          className="text-red-600 hover:text-red-800"
        >
          🗑
        </button>
      </td>
    </tr>
  );
}

function TypeBadge({ dumpType }: { dumpType: ImportDetail['dumpType'] }): JSX.Element {
  const colorMap: Record<ImportDetail['dumpType'], string> = {
    ENDPOINT: 'bg-red-600',
    COMPONENT_DIRECTORY: 'bg-red-900',
    BROKER: 'bg-gray-900',
  };
  const shortMap: Record<ImportDetail['dumpType'], string> = {
    ENDPOINT: 'ENDPOINT',
    COMPONENT_DIRECTORY: 'CD',
    BROKER: 'BROKER',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs text-white ${colorMap[dumpType]}`}>
      {shortMap[dumpType]}
    </span>
  );
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toDatetimeLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // yyyy-MM-ddTHH:mm (locale navigateur)
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
```

- [ ] **Step 9.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/web test -- ImportsAdminTable
pnpm --filter @carto-ecp/web typecheck
```

Expected: 5/5 PASS + typecheck PASS.

Si un test échoue sur le debounce avec fake timers (flaky), c'est un problème connu de `userEvent` + `vi.useFakeTimers`. Alternative : remplacer le test "debounced label edit" par un test plus simple qui vérifie juste que `api.updateImport` finit par être appelé avec la bonne valeur, sans assertions sur le timing exact. Ajuster si nécessaire.

- [ ] **Step 9.5 — Commit**

```bash
git add apps/web/src/components/Admin/ImportsAdminTable.tsx apps/web/src/components/Admin/ImportsAdminTable.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ImportsAdminTable — liste, filtre, édit inline, delete

- Filtre env (select) + recherche client-side (label/fileName/sourceEic)
- 9 colonnes dont 2 éditables : label (debounced 500ms) + effectiveDate (onBlur)
- Delete avec confirm modale custom (zero dep)
- Badge Type coloré, badge Warnings, stats inline
- Rafraîchit la liste après chaque édition réussie

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10 : Enregistrer `/admin` route dans `App.tsx`

**Files :**
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 10.1 — Ajouter la route**

Lire `apps/web/src/App.tsx` actuel. Ajouter l'import + la route.

```tsx
// apps/web/src/App.tsx (ajustement)
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { AdminPage } from './pages/AdminPage.js';    // NOUVEAU
import { EnvSelector } from './components/EnvSelector/EnvSelector.js';

export function App(): JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/" className="text-lg font-semibold">Carto ECP — RTE</Link>
        <div className="flex items-center gap-3">
          <EnvSelector />
          <Link to="/admin" className="text-sm text-rte underline">Admin</Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/map" element={<Navigate to="/" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/admin" element={<AdminPage />} />    {/* NOUVEAU */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
```

**Note** : le lien header `+ Importer` devient `Admin`. L'accès à l'upload se fait maintenant via le bouton « + Importer des dumps » dans `/admin` (déjà présent dans `ImportsAdminTable`).

- [ ] **Step 10.2 — Typecheck + commit**

```bash
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
```

Expected: typecheck PASS + full suite verte.

```bash
git add apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
feat(web): route /admin + lien "Admin" dans header

Remplace le lien "+ Importer" par "Admin" qui pointe sur /admin.
L'upload reste accessible via le bouton "+ Importer des dumps" dans
l'onglet Imports du panneau admin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — CHANGELOG + smoke + PR

### Task 11 : CHANGELOG + smoke + PR

**Files :**
- Modify: `CHANGELOG.md`

- [ ] **Step 11.1 — Ajouter entrée v2.0-alpha.4 au CHANGELOG**

Ouvrir `CHANGELOG.md`. Sous `## [Unreleased]`, insérer **au-dessus** du bloc `v2.0-alpha.3` :

```markdown
### v2.0-alpha.4 — Slice 2c-1 Admin panel onglet Imports (2026-04-19)

**Panneau d'administration** accessible via le lien `Admin` du header. Répond à la demande du gros spec fonctionnel : *« Un panneau d'administration centralise upload, surcharge des données, gestion du registry, purge »*.

Cette slice livre uniquement **l'onglet Imports** (les 4 autres onglets sont visibles mais désactivés avec tooltip vers leur slice d'origine). Splits originaux de la slice 2c en **2c-1 (imports)** et **2c-2 (composants surcharge — à venir)**.

**Highlights :**

- **Route `/admin`** avec `AdminTabs` à 5 onglets (Imports actif + 4 stubs désactivés).
- **`ImportsAdminTable`** : liste complète des imports avec filtre par `envName`, recherche texte client-side (label / fileName / sourceEic), édition inline du `label` (debounced 500ms) et de `effectiveDate` (onBlur), delete avec modale de confirmation custom.
- **Nouveau endpoint `PATCH /api/imports/:id`** : zod strict à 2 champs (`label`, `effectiveDate`), refuse tout extra (`dumpType`, `envName`, etc.) et body vide. Code `INVALID_BODY` sur erreur.
- **`GET /api/imports` étendu** : retourne désormais `ImportDetail[]` (superset de `ImportSummary`, ajoute `stats` et `warnings`) — évite un 2e fetch côté admin. Rétrocompatible côté callers existants.
- **Header** : lien `+ Importer` remplacé par `Admin`. L'upload reste accessible via le bouton « + Importer des dumps » dans `/admin`.
- **ADR-035** : `dumpType` immutable post-ingest (corriger un type mal détecté = delete + re-upload).

**Tests :**
- 2 tests `listImports` (stats + ordering) + 4 tests `updateImport` (label, date, combined, not found)
- 6 tests `controller.update` (happy path × 2, reject extras × 2, reject invalid date, reject empty body)
- 3 tests `AdminTabs` (5 tabs visibles, 4 désactivés, onChange behavior)
- 1 test `AdminPage` smoke
- 5 tests `ImportsAdminTable` (render, search, debounced edit, delete flow, env filter)
- 3 tests `debounce` helper

**Breaking changes :** aucun. L'élargissement de `listImports` vers `ImportDetail[]` est rétrocompatible.
```

- [ ] **Step 11.2 — Smoke manuel**

```bash
pnpm dev
```

Dans un navigateur, ouvrir **http://localhost:5173/admin** :

1. Page `/admin` affiche "Administration" + 5 tabs (Imports actif, 4 désactivés avec tooltip).
2. Clic sur les tabs désactivés ne change rien (disabled).
3. Si des imports existent dans la DB, ils apparaissent dans la table.
4. Filtre "Env" : basculer entre "Tous" et un env spécifique → le contenu change.
5. Recherche "TEST" ou partie d'un label → filtrage immédiat.
6. Modifier le label d'un import → attendre 500ms → reload automatique avec le nouveau label.
7. Modifier `effectiveDate` d'un import → blur de l'input → reload automatique avec la nouvelle date.
8. Cliquer sur 🗑 → modale de confirmation → annuler OU supprimer → reload de la liste.
9. Cliquer sur "+ Importer des dumps" → navigation vers `/upload`.
10. Vérifier que le header a bien un lien "Admin" (et plus "+ Importer").

**Validation DB** (via psql ou `prisma:studio`) :

- Après édition de label : `prisma.import.findUnique({ where: { id } })` renvoie bien le nouveau `label`.
- Après édition de `effectiveDate` : date mise à jour en DB.
- Après refresh de la carte `/`, l'`effectiveDate` modifié est pris en compte dans le filtre `refDate ≤ now` (si `effectiveDate` est dans le futur, l'import peut disparaître du graph actuel).

Si tout va bien → 11.3. Sinon, corriger.

- [ ] **Step 11.3 — Tests full + typecheck**

```bash
pnpm test
pnpm typecheck
```

Expected: tous verts.

- [ ] **Step 11.4 — Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG v2.0-alpha.4 — slice 2c-1 admin imports

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 11.5 — Push + PR**

```bash
git push -u origin feat/v2-slice-2c-admin
```

```bash
gh pr create --base feat/v2-slice-2f-icons --title "feat(v2): slice 2c-1 Admin panel onglet Imports (v2.0-alpha.4)" --body "$(cat <<'EOF'
## Summary

Panneau d'administration ``/admin`` avec onglet Imports fonctionnel. Répond à la demande du spec fonctionnel v2.0 (« panneau centralise upload, surcharge, gestion ») pour la partie gestion des imports.

Slice 2c originale split en **2c-1 (imports, cette PR)** + **2c-2 (composants surcharge, à venir)**.

- Route ``/admin`` avec ``AdminTabs`` (5 onglets, 1 actif)
- ``ImportsAdminTable`` : liste + filtre env + recherche + édition inline (label debounced, effectiveDate onBlur) + delete avec confirmation
- Nouveau ``PATCH /api/imports/:id`` zod strict (label + effectiveDate)
- ``GET /api/imports`` étendu vers ``ImportDetail[]`` (stats + warnings inclus)
- Header : lien ``Admin`` remplace ``+ Importer``
- ADR-035 : ``dumpType`` immutable post-ingest

## Docs / Spec

- [Chapeau v2.0](docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md)
- [Slice 2c-1 design](docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2c-1-design.md)
- [Plan d'implémentation](docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2c-1.md)
- ADR : [035](docs/adr/ADR-035-dumptype-immutable-post-ingest.md)

## Breaking changes

Aucun. ``GET /api/imports`` retourne désormais ``ImportDetail[]`` mais c'est un superset rétrocompatible.

## Base branche

PR stackée sur ``feat/v2-slice-2f-icons`` (PR #8). Merge order : #6 → #7 → #8 → cette PR.

## Test plan

- [x] Tests backend (service + controller) PASS (~12 nouveaux)
- [x] Tests frontend (AdminTabs, AdminPage, ImportsAdminTable, debounce) PASS (~12 nouveaux)
- [x] ``pnpm typecheck`` — PASS api + web + shared
- [x] Smoke manuel validé : route /admin accessible, édition inline fonctionne, filtres opérationnels, delete avec confirmation
- [ ] Review humaine du design 2c-1

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review du plan

**Spec coverage :**

- §1 objectif → Tasks 1 (ADR) + 2-11 (implémentation)
- §2 scope inside → tout couvert, hors-scope respecté
- §A architecture → Tasks 2-4 (backend), 5-10 (frontend)
- §B endpoint PATCH → Tasks 3 (service) + 4 (controller)
- §C AdminPage + AdminTabs → Tasks 6 (Tabs) + 7 (AdminPage)
- §D ImportsAdminTable → Task 9
- §E debouncing → Task 8 (helper) + Task 9 (utilisation)
- §F tests → couverts par les `describe` dans chaque task
- §G migration ImportSummary → ImportDetail → Task 2 (backend) + Task 5 (client)
- §H DoD → Task 11 checklist
- §I ADR-035 → Task 1

**Placeholder scan :** aucun `TBD`, `TODO`, `implement later`. Les notes "si test flaky, ajuster" (Task 9) donnent une alternative concrète, pas un placeholder.

**Type consistency :**
- `AdminTabId` défini en Task 6, consommé en Task 7
- `ImportDetail` (existant depuis 2a) consommé en Task 2, 3, 4, 5, 9
- `UpdateImportSchema` défini en Task 4, correspond au body signé `{ label?, effectiveDate? }` utilisé par Task 3
- `api.updateImport(id, patch)` signature cohérente entre Task 5 (client) et Task 9 (usage)
- `debounce(fn, wait)` défini en Task 8, consommé en Task 9

Aucune incohérence détectée. Plan cohérent.

---

## Execution Handoff

Plan complet sauvegardé à `docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2c-1.md`.

**11 tasks** structurées en 6 phases. Scope moyen (plus gros que 2f mais plus petit que 2b).

Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — dispatch d'un subagent frais par task, review entre chaque. ~22-33 dispatches total. Plus safe pour les refactos multi-fichiers (backend + shared + frontend).

**2. Inline Execution** — plus rapide sur un plan de cette taille si tu veux économiser les dispatches.

Laquelle tu préfères ?
