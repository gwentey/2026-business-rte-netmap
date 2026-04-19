# Carto ECP v2.0 — Slice 2c-2 (Admin composants surcharge EIC) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Activer l'onglet "Composants" dans `/admin` avec une table des EICs rencontrés + modale de surcharge (displayName, type, organization, country, lat/lng, tags, notes).

**Architecture:** 3 endpoints backend (GET admin/components, PUT/DELETE overrides/:eic) dans un nouveau `OverridesService`. Frontend active l'onglet Composants + 2 composants (table + modale d'édition). Réutilise la cascade 5 niveaux existante.

**Tech Stack:** NestJS 10, Prisma 5, zod, React 18, Vitest 2, @testing-library/react 16.

**Spec :** `docs/superpowers/specs/2026-04-20-carto-ecp-v2-slice-2c-2-design.md`.

**Branche :** `feat/v2-slice-2c-2-overrides` (depuis tip de 2c-1).

---

## Vue d'ensemble

| Phase | Tasks | Livre |
|---|---|---|
| Phase 1 — ADR | T1 | ADR-036 |
| Phase 2 — Backend service | T2, T3 | OverridesService (upsert + delete + listAdminComponents) |
| Phase 3 — Backend controller | T4 | OverridesController + routes + wiring |
| Phase 4 — Shared + client | T5 | Types `AdminComponentRow`+`OverrideUpsertInput`, API client |
| Phase 5 — Frontend | T6, T7, T8 | Activation tab + ComponentsAdminTable + ComponentOverrideModal |
| Phase 6 — CHANGELOG + PR | T9 | v2.0-alpha.5 + PR |

---

## Task 1 — ADR-036

**Files :**
- Create: `docs/adr/ADR-036-put-upsert-overrides.md`

- [ ] **Step 1.1 — Rédiger**

Basé sur `docs/adr/000-template.md`. Champs :
```
Numéro : ADR-036
Statut : Accepté
Date : 2026-04-20
Auteur(s) : Anthony + Claude
Owner : Anthony
Décideurs : Anthony
Contexte : Slice v2.0-2c-2 Admin composants
Remplace : —
Features : *
App : api
```

**Titre :** "Endpoint upsert `PUT /api/overrides/:eic` (vs POST+PATCH)"

**Contexte :** Les `ComponentOverride` sont keyés par `eic` (PK stable). Deux styles d'API possibles pour CRUD : PUT upsert vs POST create + PATCH update.

**Options :**
- A — `PUT /api/overrides/:eic` upsert (retenue) : 1 endpoint, sémantique idempotente, cohérent avec EIC PK
- B — `POST /api/overrides` + `PATCH /api/overrides/:eic` : 2 endpoints, 409 sur duplicate à gérer côté client
- C — `POST /api/overrides/:eic/upsert` : hybride, moins clean que A

**Décision :** A. PUT idempotent, ressource identifiée par l'URL. Le client envoie l'état souhaité pour un EIC donné.

**Conséquences :**
- Positives : 1 seul endpoint simple, cohérent avec `ComponentOverride.eic` PK stable, idempotent (retry safe)
- Négatives : un POST/PATCH plus canonique REST pourrait sembler plus conventionnel — acceptable
- Interdit : ajouter un POST duplicata pour la même ressource

- [ ] **Step 1.2 — Commit**

```bash
git add docs/adr/ADR-036-put-upsert-overrides.md
git commit -m "docs(adr): ADR-036 — PUT /api/overrides/:eic upsert

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 — OverridesService : `upsert` + `delete`

**Files :**
- Create: `apps/api/src/overrides/overrides.service.ts`
- Create: `apps/api/src/overrides/overrides.service.spec.ts`

- [ ] **Step 2.1 — Test RED**

```typescript
// apps/api/src/overrides/overrides.service.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { OverridesService } from './overrides.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('OverridesService', () => {
  let service: OverridesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [OverridesService, PrismaService],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OverridesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  afterEach(async () => {
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  describe('upsert', () => {
    it('creates a new override row on first call', async () => {
      const result = await service.upsert('TEST_OV_A', { displayName: 'Test A', lat: 48.8, lng: 2.3 });
      expect(result.eic).toBe('TEST_OV_A');
      expect(result.displayName).toBe('Test A');
      expect(result.lat).toBe(48.8);
      expect(result.lng).toBe(2.3);
    });

    it('updates existing override on second call', async () => {
      await service.upsert('TEST_OV_B', { displayName: 'First' });
      const updated = await service.upsert('TEST_OV_B', { displayName: 'Second', country: 'FR' });
      expect(updated.displayName).toBe('Second');
      expect(updated.country).toBe('FR');
    });

    it('sets field to null explicitly', async () => {
      await service.upsert('TEST_OV_C', { displayName: 'Set', lat: 48 });
      const cleared = await service.upsert('TEST_OV_C', { lat: null });
      expect(cleared.lat).toBeNull();
      expect(cleared.displayName).toBe('Set');  // untouched
    });
  });

  describe('delete', () => {
    it('removes an existing override', async () => {
      await service.upsert('TEST_OV_D', { displayName: 'To delete' });
      await service.delete('TEST_OV_D');
      const found = await prisma.componentOverride.findUnique({ where: { eic: 'TEST_OV_D' } });
      expect(found).toBeNull();
    });

    it('throws NotFoundException if override does not exist', async () => {
      await expect(service.delete('TEST_OV_UNKNOWN')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'OVERRIDE_NOT_FOUND' }),
      });
    });
  });
});
```

- [ ] **Step 2.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- overrides.service
```

Expected: FAIL (module absent).

- [ ] **Step 2.3 — Implémenter**

```typescript
// apps/api/src/overrides/overrides.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { OverrideUpsertInput } from '@carto-ecp/shared';

@Injectable()
export class OverridesService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(eic: string, patch: OverrideUpsertInput): Promise<{
    eic: string;
    displayName: string | null;
    type: string | null;
    organization: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
    tagsCsv: string | null;
    notes: string | null;
    updatedAt: Date;
  }> {
    return this.prisma.componentOverride.upsert({
      where: { eic },
      create: { eic, ...patch },
      update: { ...patch },
    });
  }

  async delete(eic: string): Promise<void> {
    const existing = await this.prisma.componentOverride.findUnique({ where: { eic } });
    if (!existing) {
      throw new NotFoundException({
        code: 'OVERRIDE_NOT_FOUND',
        message: `Override for EIC ${eic} not found`,
      });
    }
    await this.prisma.componentOverride.delete({ where: { eic } });
  }
}
```

**Note** : `OverrideUpsertInput` sera défini en Task 5 dans shared. Pour l'instant, définir un type local temporaire :

```typescript
type OverrideUpsertInput = {
  displayName?: string | null;
  type?: string | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tagsCsv?: string | null;
  notes?: string | null;
};
```

Et remplacer l'import shared par ce type local. En Task 5, on basculera sur l'import shared.

- [ ] **Step 2.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/api test -- overrides.service
```

Expected: 5/5 PASS.

```bash
git add apps/api/src/overrides/overrides.service.ts apps/api/src/overrides/overrides.service.spec.ts
git commit -m "feat(api): OverridesService — upsert + delete par EIC

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 — OverridesService : `listAdminComponents`

**Files :**
- Modify: `apps/api/src/overrides/overrides.service.ts`
- Modify: `apps/api/src/overrides/overrides.service.spec.ts`

- [ ] **Step 3.1 — Test RED**

Ajouter dans `overrides.service.spec.ts` un nouveau describe (après les existants) :

```typescript
describe('listAdminComponents', () => {
  let service: OverridesService;
  let prisma: PrismaService;
  let imports: ImportsService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        OverridesService, ImportsService, PrismaService,
        ZipExtractorService, CsvReaderService, XmlMadesParserService,
        ImportBuilderService, CsvPathReaderService, RawPersisterService,
        RegistryService,
      ],
    }).compile();
    await moduleRef.init();
    service = moduleRef.get(OverridesService);
    prisma = moduleRef.get(PrismaService);
    imports = moduleRef.get(ImportsService);
    await prisma.import.deleteMany({ where: { envName: 'TEST_AC' } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  afterEach(async () => {
    const rows = await prisma.import.findMany({ where: { envName: 'TEST_AC' } });
    const { existsSync, unlinkSync } = await import('node:fs');
    for (const r of rows) {
      if (existsSync(r.zipPath)) { try { unlinkSync(r.zipPath); } catch {} }
    }
    await prisma.import.deleteMany({ where: { envName: 'TEST_AC' } });
    await prisma.componentOverride.deleteMany({ where: { eic: { startsWith: 'TEST_OV_' } } });
  });

  it('returns empty array when no imports exist', async () => {
    // Cleanup agressive au cas où d'autres tests ont laissé des choses
    await prisma.import.deleteMany();
    const list = await service.listAdminComponents();
    expect(list).toEqual([]);
  });

  it('returns one row per distinct EIC from imports', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_AC',
      label: 'fixture',
    });
    const list = await service.listAdminComponents();
    expect(list.length).toBeGreaterThan(0);
    const eics = list.map((r) => r.eic);
    expect(new Set(eics).size).toBe(eics.length);  // no duplicates
    // Chaque row a `current` + `importsCount` >= 1 + `override` (null ou populated)
    for (const row of list) {
      expect(row.current).toBeDefined();
      expect(row.current.displayName).toBeDefined();
      expect(row.importsCount).toBeGreaterThanOrEqual(1);
    }
  });

  it('merges override into row.override field when override exists for EIC', async () => {
    const zip = buildZipFromFixture(ENDPOINT_FIXTURE);
    await imports.createImport({
      file: { originalname: `${ENDPOINT_FIXTURE}.zip`, buffer: zip },
      envName: 'TEST_AC',
      label: 'fixture',
    });
    // Pick an EIC from the import
    const list0 = await service.listAdminComponents();
    const firstEic = list0[0]!.eic;

    // Add override
    await service.upsert(firstEic, { displayName: 'OverrideName', country: 'FR' });

    const list1 = await service.listAdminComponents();
    const row = list1.find((r) => r.eic === firstEic)!;
    expect(row.override).not.toBeNull();
    expect(row.override!.displayName).toBe('OverrideName');
    expect(row.override!.country).toBe('FR');
    expect(row.current.displayName).toBe('OverrideName');  // cascade applied
  });
});
```

Ajouter les imports en tête du fichier test si manquants :
```typescript
import { ImportsService } from '../ingestion/imports.service.js';
import { ZipExtractorService } from '../ingestion/zip-extractor.service.js';
import { CsvReaderService } from '../ingestion/csv-reader.service.js';
import { XmlMadesParserService } from '../ingestion/xml-mades-parser.service.js';
import { ImportBuilderService } from '../ingestion/import-builder.service.js';
import { CsvPathReaderService } from '../ingestion/csv-path-reader.service.js';
import { RawPersisterService } from '../ingestion/raw-persister.service.js';
import { RegistryService } from '../registry/registry.service.js';
import { buildZipFromFixture, ENDPOINT_FIXTURE } from '../../test/fixtures-loader.js';
```

- [ ] **Step 3.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- overrides.service
```

Expected: FAIL (méthode `listAdminComponents` absente).

- [ ] **Step 3.3 — Implémenter**

Dans `apps/api/src/overrides/overrides.service.ts`, ajouter :

1. Les imports en haut :
```typescript
import { mergeComponentsLatestWins, type ImportedComponentWithImport } from '../graph/merge-components.js';
import { applyCascade } from '../graph/apply-cascade.js';
import { RegistryService } from '../registry/registry.service.js';
```

2. Le constructeur avec RegistryService :
```typescript
constructor(
  private readonly prisma: PrismaService,
  private readonly registry: RegistryService,
) {}
```

3. La méthode `listAdminComponents` :

```typescript
async listAdminComponents(): Promise<AdminComponentRow[]> {
  const [importedComponents, overrides, entsoeEntries] = await Promise.all([
    this.prisma.importedComponent.findMany({
      include: { urls: true, import: { select: { effectiveDate: true } } },
    }),
    this.prisma.componentOverride.findMany(),
    this.prisma.entsoeEntry.findMany(),
  ]);

  // Map to ImportedComponentWithImport shape
  const componentRows: ImportedComponentWithImport[] = importedComponents.map((c) => ({
    eic: c.eic,
    type: c.type,
    organization: c.organization,
    personName: c.personName,
    email: c.email,
    phone: c.phone,
    homeCdCode: c.homeCdCode,
    networksCsv: c.networksCsv,
    displayName: c.displayName,
    country: c.country,
    lat: c.lat,
    lng: c.lng,
    isDefaultPosition: c.isDefaultPosition,
    sourceType: c.sourceType,
    creationTs: c.creationTs,
    modificationTs: c.modificationTs,
    urls: c.urls.map((u) => ({ network: u.network, url: u.url })),
    _effectiveDate: c.import.effectiveDate,
  }));

  const mergedByEic = mergeComponentsLatestWins(componentRows);
  const overrideByEic = new Map(overrides.map((o) => [o.eic, o]));
  const entsoeByEic = new Map(entsoeEntries.map((e) => [e.eic, e]));
  const mapConfig = this.registry.getMapConfig();
  const defaultFallback = {
    lat: (mapConfig as { defaultLat?: number }).defaultLat ?? 50.8503,
    lng: (mapConfig as { defaultLng?: number }).defaultLng ?? 4.3517,
  };

  // Count imports par EIC (pour importsCount)
  const importsCountByEic = new Map<string, Set<string>>();
  for (const c of importedComponents) {
    const set = importsCountByEic.get(c.eic) ?? new Set<string>();
    set.add(c.importId);
    importsCountByEic.set(c.eic, set);
  }

  const rows: AdminComponentRow[] = [];
  for (const [eic, merged] of mergedByEic) {
    const override = overrideByEic.get(eic) ?? null;
    const entsoe = entsoeByEic.get(eic) ?? null;
    const registryEntry = this.registry.resolveEic(eic);
    const global = applyCascade(eic, merged, { override, entsoe, registry: registryEntry }, defaultFallback);

    rows.push({
      eic,
      current: {
        displayName: global.displayName,
        type: global.type,
        organization: global.organization,
        country: global.country,
        lat: global.lat,
        lng: global.lng,
        isDefaultPosition: global.isDefaultPosition,
      },
      override: override
        ? {
            displayName: override.displayName,
            type: override.type,
            organization: override.organization,
            country: override.country,
            lat: override.lat,
            lng: override.lng,
            tagsCsv: override.tagsCsv,
            notes: override.notes,
            updatedAt: override.updatedAt.toISOString(),
          }
        : null,
      importsCount: importsCountByEic.get(eic)?.size ?? 0,
    });
  }

  rows.sort((a, b) => a.eic.localeCompare(b.eic));
  return rows;
}
```

4. Importer le type `AdminComponentRow` (localement pour l'instant, sera remplacé par shared en Task 5) :

```typescript
type AdminComponentRow = {
  eic: string;
  current: {
    displayName: string;
    type: string;
    organization: string | null;
    country: string | null;
    lat: number;
    lng: number;
    isDefaultPosition: boolean;
  };
  override: {
    displayName: string | null;
    type: string | null;
    organization: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
    tagsCsv: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
  importsCount: number;
};
```

- [ ] **Step 3.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/api test -- overrides.service
```

Expected: 3 nouveaux tests PASS + existants.

```bash
git add apps/api/src/overrides/overrides.service.ts apps/api/src/overrides/overrides.service.spec.ts
git commit -m "feat(api): OverridesService.listAdminComponents

Retourne la liste des EICs des imports avec current (cascade 5 niveaux) +
override existant + importsCount. Réutilise mergeComponentsLatestWins
et applyCascade du graph module.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4 — OverridesController + Module + AppModule wiring

**Files :**
- Create: `apps/api/src/overrides/overrides.controller.ts`
- Create: `apps/api/src/overrides/overrides.controller.spec.ts`
- Create: `apps/api/src/overrides/overrides.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 4.1 — Test RED (controller)**

```typescript
// apps/api/src/overrides/overrides.controller.spec.ts
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OverridesController } from './overrides.controller.js';
import { OverridesService } from './overrides.service.js';

const fakeRow = {
  eic: 'X', displayName: 'x', type: null, organization: null, country: null,
  lat: null, lng: null, tagsCsv: null, notes: null, updatedAt: new Date(),
};

describe('OverridesController', () => {
  let ctrl: OverridesController;
  const upsertSpy = vi.fn(async () => fakeRow);
  const deleteSpy = vi.fn(async () => undefined);
  const listSpy = vi.fn(async () => []);

  beforeEach(async () => {
    upsertSpy.mockClear();
    deleteSpy.mockClear();
    listSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [OverridesController],
      providers: [
        {
          provide: OverridesService,
          useValue: { upsert: upsertSpy, delete: deleteSpy, listAdminComponents: listSpy },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(OverridesController);
  });

  it('GET /admin/components delegates to listAdminComponents', async () => {
    await ctrl.listAdminComponents();
    expect(listSpy).toHaveBeenCalled();
  });

  it('PUT /overrides/:eic with valid body forwards to upsert', async () => {
    await ctrl.upsert('10XAT-APG------Z', { displayName: 'APG', lat: 48.2, lng: 16.4 });
    expect(upsertSpy).toHaveBeenCalledWith('10XAT-APG------Z', { displayName: 'APG', lat: 48.2, lng: 16.4 });
  });

  it('rejects invalid country length (not ISO-2)', async () => {
    await expect(
      ctrl.upsert('X', { country: 'FRA' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects lat out of range', async () => {
    await expect(
      ctrl.upsert('X', { lat: 99 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown extra fields', async () => {
    await expect(
      ctrl.upsert('X', { foo: 'bar' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('DELETE /overrides/:eic delegates to delete', async () => {
    await ctrl.delete('X');
    expect(deleteSpy).toHaveBeenCalledWith('X');
  });
});
```

- [ ] **Step 4.2 — Run RED**

```bash
pnpm --filter @carto-ecp/api test -- overrides.controller
```

Expected: FAIL.

- [ ] **Step 4.3 — Implémenter controller**

```typescript
// apps/api/src/overrides/overrides.controller.ts
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Put,
} from '@nestjs/common';
import { z } from 'zod';
import { OverridesService } from './overrides.service.js';

const OverrideUpsertSchema = z.object({
  displayName: z.string().min(1).max(256).nullable().optional(),
  type: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER', 'BA']).nullable().optional(),
  organization: z.string().max(256).nullable().optional(),
  country: z.string().length(2).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tagsCsv: z.string().max(512).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

@Controller()
export class OverridesController {
  constructor(private readonly overrides: OverridesService) {}

  @Get('admin/components')
  async listAdminComponents() {
    return this.overrides.listAdminComponents();
  }

  @Put('overrides/:eic')
  async upsert(@Param('eic') eic: string, @Body() body: unknown) {
    const parsed = OverrideUpsertSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({ code: 'INVALID_BODY', errors: parsed.error.issues });
    }
    return this.overrides.upsert(eic, parsed.data);
  }

  @Delete('overrides/:eic')
  @HttpCode(204)
  async delete(@Param('eic') eic: string): Promise<void> {
    await this.overrides.delete(eic);
  }
}
```

- [ ] **Step 4.4 — Créer le module**

```typescript
// apps/api/src/overrides/overrides.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { RegistryModule } from '../registry/registry.module.js';
import { OverridesController } from './overrides.controller.js';
import { OverridesService } from './overrides.service.js';

@Module({
  imports: [PrismaModule, RegistryModule],
  controllers: [OverridesController],
  providers: [OverridesService],
  exports: [OverridesService],
})
export class OverridesModule {}
```

- [ ] **Step 4.5 — Enregistrer dans AppModule**

Modifier `apps/api/src/app.module.ts` : ajouter `OverridesModule` à la liste `imports`.

- [ ] **Step 4.6 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/api test
pnpm --filter @carto-ecp/api typecheck
```

Expected: full suite PASS.

```bash
git add apps/api/src/overrides apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): OverridesController + module — 3 routes (GET+PUT+DELETE)

- GET /api/admin/components : liste EICs des imports + cascade + overrides
- PUT /api/overrides/:eic : upsert zod strict 8 champs nullable
- DELETE /api/overrides/:eic : retire (204 ou 404)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Shared types + API client web

**Files :**
- Modify: `packages/shared/src/graph.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/api/src/overrides/overrides.service.ts` (remplacer types locaux par import shared)

- [ ] **Step 5.1 — Ajouter types dans shared**

Dans `packages/shared/src/graph.ts`, ajouter :

```typescript
export type AdminComponentRow = {
  eic: string;
  current: {
    displayName: string;
    type: string;
    organization: string | null;
    country: string | null;
    lat: number;
    lng: number;
    isDefaultPosition: boolean;
  };
  override: {
    displayName: string | null;
    type: string | null;
    organization: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
    tagsCsv: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
  importsCount: number;
};

export type OverrideUpsertInput = {
  displayName?: string | null;
  type?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA' | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tagsCsv?: string | null;
  notes?: string | null;
};
```

- [ ] **Step 5.2 — Remplacer les types locaux côté api**

Dans `apps/api/src/overrides/overrides.service.ts`, supprimer les types locaux `AdminComponentRow` et `OverrideUpsertInput`, et les remplacer par :

```typescript
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';
```

- [ ] **Step 5.3 — Étendre API client web**

Dans `apps/web/src/lib/api.ts`, ajouter `AdminComponentRow` et `OverrideUpsertInput` à l'import shared, puis 3 méthodes :

```typescript
import type { ..., AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';

// Dans l'objet api :
async listAdminComponents(): Promise<AdminComponentRow[]> {
  return request<AdminComponentRow[]>('/api/admin/components');
},

async upsertOverride(eic: string, patch: OverrideUpsertInput): Promise<unknown> {
  return request<unknown>(`/api/overrides/${encodeURIComponent(eic)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
},

async deleteOverride(eic: string): Promise<void> {
  await request<void>(`/api/overrides/${encodeURIComponent(eic)}`, { method: 'DELETE' });
},
```

- [ ] **Step 5.4 — Typecheck + commit**

```bash
pnpm --filter @carto-ecp/shared typecheck
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/api test -- overrides
pnpm --filter @carto-ecp/web test
```

Expected: tous verts.

```bash
git add packages/shared/src/graph.ts apps/api/src/overrides/overrides.service.ts apps/web/src/lib/api.ts
git commit -m "feat(shared+web): types AdminComponentRow + OverrideUpsertInput + API client

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6 — Activer l'onglet Composants dans `AdminTabs`

**Files :**
- Modify: `apps/web/src/components/Admin/AdminTabs.tsx`
- Modify: `apps/web/src/components/Admin/AdminTabs.test.tsx`
- Modify: `apps/web/src/pages/AdminPage.tsx`

- [ ] **Step 6.1 — Activer le tab**

Dans `AdminTabs.tsx`, changer la ligne `components` :

```typescript
{ id: 'components', label: 'Composants', enabled: true, tooltip: '' },
```

- [ ] **Step 6.2 — Mettre à jour le test**

Dans `AdminTabs.test.tsx`, ajuster le test du rendu : `Composants` doit maintenant être `toBeEnabled()`.

```typescript
it('renders 5 tabs with Imports and Composants enabled', () => {
  render(<AdminTabs active="imports" onChange={() => {}} />);
  expect(screen.getByRole('button', { name: /Imports/i })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Composants/i })).toBeEnabled();  // was disabled
  expect(screen.getByRole('button', { name: /Annuaire ENTSO-E/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Registry RTE/i })).toBeDisabled();
  expect(screen.getByRole('button', { name: /Zone danger/i })).toBeDisabled();
});
```

(Adapter le nom du premier test si différent dans le fichier actuel.)

- [ ] **Step 6.3 — Brancher le tab dans AdminPage**

Dans `apps/web/src/pages/AdminPage.tsx`, importer `ComponentsAdminTable` et l'afficher quand `activeTab === 'components'` :

```tsx
import { ComponentsAdminTable } from '../components/Admin/ComponentsAdminTable.js';

// ... dans le return, après ImportsAdminTable :
{activeTab === 'imports' ? <ImportsAdminTable /> : null}
{activeTab === 'components' ? <ComponentsAdminTable /> : null}
```

Stub temporaire `ComponentsAdminTable` à créer avant (la vraie implémentation vient en Task 7) :

```tsx
// apps/web/src/components/Admin/ComponentsAdminTable.tsx (stub temporaire)
export function ComponentsAdminTable(): JSX.Element {
  return <div className="p-4 text-sm text-gray-500">Chargement des composants…</div>;
}
```

- [ ] **Step 6.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test
pnpm --filter @carto-ecp/web typecheck
```

Expected: tous PASS.

```bash
git add apps/web/src/components/Admin/AdminTabs.tsx apps/web/src/components/Admin/AdminTabs.test.tsx apps/web/src/pages/AdminPage.tsx apps/web/src/components/Admin/ComponentsAdminTable.tsx
git commit -m "feat(web): activer onglet Composants + stub ComponentsAdminTable

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7 — `ComponentsAdminTable` (remplace le stub)

**Files :**
- Modify (remplace stub) : `apps/web/src/components/Admin/ComponentsAdminTable.tsx`
- Create: `apps/web/src/components/Admin/ComponentsAdminTable.test.tsx`

- [ ] **Step 7.1 — Test RED**

```tsx
// apps/web/src/components/Admin/ComponentsAdminTable.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { ComponentsAdminTable } from './ComponentsAdminTable.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    listAdminComponents: vi.fn(),
    upsertOverride: vi.fn(),
    deleteOverride: vi.fn(),
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
  },
}));

function fakeRow(overrides: Partial<any> = {}): any {
  return {
    eic: '17V-A',
    current: {
      displayName: 'Test Endpoint',
      type: 'ENDPOINT',
      organization: 'RTE',
      country: 'FR',
      lat: 48.85,
      lng: 2.35,
      isDefaultPosition: false,
    },
    override: null,
    importsCount: 2,
    ...overrides,
  };
}

describe('ComponentsAdminTable', () => {
  beforeEach(() => {
    vi.mocked(api.listAdminComponents).mockReset();
    vi.mocked(api.upsertOverride).mockReset();
    vi.mocked(api.deleteOverride).mockReset();
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('renders one row per component with EIC and displayName', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-A', current: { ...fakeRow().current, displayName: 'Alpha' } }),
      fakeRow({ eic: '17V-B', current: { ...fakeRow().current, displayName: 'Beta' } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => {
      expect(screen.getByText('17V-A')).toBeInTheDocument();
      expect(screen.getByText('17V-B')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });

  it('filters by search text (eic, displayName, organization, country)', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-AAA', current: { ...fakeRow().current, displayName: 'Alpha', organization: 'APG' } }),
      fakeRow({ eic: '17V-BBB', current: { ...fakeRow().current, displayName: 'Beta', organization: 'Tennet' } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/EIC, nom/i);
    await userEvent.type(searchInput, 'APG');
    await waitFor(() => {
      expect(screen.getByText('17V-AAA')).toBeInTheDocument();
      expect(screen.queryByText('17V-BBB')).not.toBeInTheDocument();
    });
  });

  it('filters to overridden only when toggle is checked', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-A', override: null }),
      fakeRow({ eic: '17V-B', override: {
        displayName: null, type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-A')).toBeInTheDocument());
    const toggle = screen.getByLabelText(/surchargés/i);
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByText('17V-A')).not.toBeInTheDocument();
      expect(screen.getByText('17V-B')).toBeInTheDocument();
    });
  });

  it('opens override modal on row click', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-EDIT' }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-EDIT')).toBeInTheDocument());
    const editBtn = screen.getByRole('button', { name: /éditer/i });
    await userEvent.click(editBtn);
    expect(screen.getByRole('heading', { name: /Surcharge pour 17V-EDIT/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- ComponentsAdminTable
```

Expected: FAIL (stub ne fait pas le boulot).

- [ ] **Step 7.3 — Implémenter**

Remplacer intégralement `apps/web/src/components/Admin/ComponentsAdminTable.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react';
import type { AdminComponentRow } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';

export function ComponentsAdminTable(): JSX.Element {
  const [rows, setRows] = useState<AdminComponentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyOverridden, setOnlyOverridden] = useState(false);
  const [editing, setEditing] = useState<AdminComponentRow | null>(null);

  const reload = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listAdminComponents();
      setRows(list);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => {
    let result = rows;
    if (onlyOverridden) result = result.filter((r) => r.override !== null);
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((r) =>
        r.eic.toLowerCase().includes(q) ||
        r.current.displayName.toLowerCase().includes(q) ||
        (r.current.organization ?? '').toLowerCase().includes(q) ||
        (r.current.country ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [rows, search, onlyOverridden]);

  const handleModalSaved = async (): Promise<void> => {
    setEditing(null);
    await reload();
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="EIC, nom, organisation, pays…"
          className="max-w-md flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyOverridden}
            onChange={(e) => setOnlyOverridden(e.target.checked)}
          />
          Seulement surchargés
        </label>
        <span className="text-sm text-gray-500">{filtered.length} / {rows.length} composants</span>
      </div>

      {error ? (
        <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}
      {loading ? <p className="text-sm text-gray-500">Chargement…</p> : null}

      <table className="w-full table-auto border-collapse border border-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 text-left">EIC</th>
            <th className="px-2 py-1 text-left">Nom</th>
            <th className="px-2 py-1 text-left">Type</th>
            <th className="px-2 py-1 text-left">Organisation</th>
            <th className="px-2 py-1 text-left">Pays</th>
            <th className="px-2 py-1 text-left">Coord</th>
            <th className="px-2 py-1 text-left">Imports</th>
            <th className="px-2 py-1 text-left">Surchargé</th>
            <th className="px-2 py-1 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.eic} className="border-t border-gray-200 hover:bg-gray-50">
              <td className="px-2 py-1 font-mono text-xs">{row.eic}</td>
              <td className="px-2 py-1 text-xs">{row.current.displayName}</td>
              <td className="px-2 py-1 text-xs">{row.current.type}</td>
              <td className="px-2 py-1 text-xs">{row.current.organization ?? '—'}</td>
              <td className="px-2 py-1 text-xs">{row.current.country ?? '—'}</td>
              <td className="px-2 py-1 text-xs">
                {row.current.isDefaultPosition ? (
                  <span className="text-orange-600">⚠ défaut</span>
                ) : (
                  `${row.current.lat.toFixed(3)}, ${row.current.lng.toFixed(3)}`
                )}
              </td>
              <td className="px-2 py-1 text-xs">{row.importsCount}</td>
              <td className="px-2 py-1 text-xs">{row.override !== null ? '🏷' : '—'}</td>
              <td className="px-2 py-1">
                <button
                  type="button"
                  onClick={() => setEditing(row)}
                  className="text-blue-600 hover:text-blue-800 text-xs"
                  aria-label={`Éditer ${row.eic}`}
                >
                  🖊 Éditer
                </button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && !loading ? (
            <tr>
              <td colSpan={9} className="p-4 text-center text-sm text-gray-500">
                Aucun composant.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {editing !== null ? (
        <ComponentOverrideModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={handleModalSaved}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 7.4 — Créer le stub `ComponentOverrideModal`**

Avant de run GREEN, crée un stub temporaire pour que le composant compile (sera remplacé en Task 8) :

```tsx
// apps/web/src/components/Admin/ComponentOverrideModal.tsx (stub Task 8)
import type { AdminComponentRow } from '@carto-ecp/shared';

type Props = {
  row: AdminComponentRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

export function ComponentOverrideModal({ row, onClose }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="max-w-md rounded-lg bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold">Surcharge pour {row.eic}</h3>
        <p className="text-sm text-gray-500">Stub — remplacé en Task 8</p>
        <button type="button" onClick={onClose} className="mt-4 rounded px-4 py-1.5 text-sm hover:bg-gray-100">
          Fermer
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7.5 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test -- ComponentsAdminTable
pnpm --filter @carto-ecp/web typecheck
```

Expected: 4/4 PASS + typecheck PASS.

```bash
git add apps/web/src/components/Admin/ComponentsAdminTable.tsx apps/web/src/components/Admin/ComponentsAdminTable.test.tsx apps/web/src/components/Admin/ComponentOverrideModal.tsx
git commit -m "feat(web): ComponentsAdminTable + stub ComponentOverrideModal

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8 — `ComponentOverrideModal` (implémentation)

**Files :**
- Modify (remplace stub) : `apps/web/src/components/Admin/ComponentOverrideModal.tsx`
- Create: `apps/web/src/components/Admin/ComponentOverrideModal.test.tsx`

- [ ] **Step 8.1 — Test RED**

```tsx
// apps/web/src/components/Admin/ComponentOverrideModal.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    upsertOverride: vi.fn().mockResolvedValue({}),
    deleteOverride: vi.fn().mockResolvedValue(undefined),
    listAdminComponents: vi.fn(),
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
  },
}));

function fakeRow(overrides: Partial<any> = {}): any {
  return {
    eic: '17V-TEST',
    current: {
      displayName: 'Current Name', type: 'ENDPOINT',
      organization: 'CurrentOrg', country: 'FR',
      lat: 48.85, lng: 2.35, isDefaultPosition: false,
    },
    override: null,
    importsCount: 1,
    ...overrides,
  };
}

describe('ComponentOverrideModal', () => {
  beforeEach(() => {
    vi.mocked(api.upsertOverride).mockReset();
    vi.mocked(api.deleteOverride).mockReset();
    vi.mocked(api.upsertOverride).mockResolvedValue({});
    vi.mocked(api.deleteOverride).mockResolvedValue(undefined);
  });

  it('renders title with EIC and placeholders from current cascade', () => {
    const row = fakeRow();
    render(<ComponentOverrideModal row={row} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.getByRole('heading', { name: /Surcharge pour 17V-TEST/i })).toBeInTheDocument();
    // Placeholders affichent les valeurs current
    const nameInput = screen.getByLabelText(/Nom affiché/i) as HTMLInputElement;
    expect(nameInput.placeholder).toContain('Current Name');
  });

  it('calls api.upsertOverride with only modified fields on save', async () => {
    const row = fakeRow();
    const onSaved = vi.fn(async () => {});
    render(<ComponentOverrideModal row={row} onClose={() => {}} onSaved={onSaved} />);
    const nameInput = screen.getByLabelText(/Nom affiché/i);
    await userEvent.type(nameInput, 'New Name');
    const saveBtn = screen.getByRole('button', { name: /Enregistrer/i });
    await userEvent.click(saveBtn);
    expect(api.upsertOverride).toHaveBeenCalledWith('17V-TEST', expect.objectContaining({ displayName: 'New Name' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows "Retirer surcharge" button only when override exists', () => {
    const rowNoOverride = fakeRow({ override: null });
    const { rerender } = render(<ComponentOverrideModal row={rowNoOverride} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.queryByRole('button', { name: /Retirer surcharge/i })).not.toBeInTheDocument();

    const rowWithOverride = fakeRow({
      override: {
        displayName: 'Custom', type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    });
    rerender(<ComponentOverrideModal row={rowWithOverride} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.getByRole('button', { name: /Retirer surcharge/i })).toBeInTheDocument();
  });

  it('calls api.deleteOverride on "Retirer surcharge" click (with confirm)', async () => {
    const rowWithOverride = fakeRow({
      override: {
        displayName: 'Custom', type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    });
    // Auto-confirm window.confirm
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    const onSaved = vi.fn(async () => {});
    render(<ComponentOverrideModal row={rowWithOverride} onClose={() => {}} onSaved={onSaved} />);
    const removeBtn = screen.getByRole('button', { name: /Retirer surcharge/i });
    await userEvent.click(removeBtn);
    expect(api.deleteOverride).toHaveBeenCalledWith('17V-TEST');

    window.confirm = originalConfirm;
  });
});
```

- [ ] **Step 8.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- ComponentOverrideModal
```

Expected: FAIL.

- [ ] **Step 8.3 — Implémenter**

Remplacer intégralement `apps/web/src/components/Admin/ComponentOverrideModal.tsx` :

```tsx
import { useState } from 'react';
import type { AdminComponentRow, OverrideUpsertInput } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

type Props = {
  row: AdminComponentRow;
  onClose: () => void;
  onSaved: () => Promise<void>;
};

type FormState = {
  displayName: string;
  type: string;
  organization: string;
  country: string;
  lat: string;
  lng: string;
  tagsCsv: string;
  notes: string;
};

export function ComponentOverrideModal({ row, onClose, onSaved }: Props): JSX.Element {
  const override = row.override;

  const [form, setForm] = useState<FormState>({
    displayName: override?.displayName ?? '',
    type: override?.type ?? '',
    organization: override?.organization ?? '',
    country: override?.country ?? '',
    lat: override?.lat !== null && override?.lat !== undefined ? String(override.lat) : '',
    lng: override?.lng !== null && override?.lng !== undefined ? String(override.lng) : '',
    tagsCsv: override?.tagsCsv ?? '',
    notes: override?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (): Promise<void> => {
    const patch: OverrideUpsertInput = {};
    // Only include fields that differ from current override (or from empty if no override)
    const currentOverride = override;
    const trimmedOrNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

    const newDisplayName = trimmedOrNull(form.displayName);
    if (newDisplayName !== (currentOverride?.displayName ?? null)) patch.displayName = newDisplayName;

    const newType = trimmedOrNull(form.type) as OverrideUpsertInput['type'];
    if (newType !== (currentOverride?.type ?? null)) patch.type = newType;

    const newOrg = trimmedOrNull(form.organization);
    if (newOrg !== (currentOverride?.organization ?? null)) patch.organization = newOrg;

    const newCountry = trimmedOrNull(form.country);
    if (newCountry !== (currentOverride?.country ?? null)) patch.country = newCountry;

    const newLat = form.lat.trim() === '' ? null : Number(form.lat);
    if (newLat !== (currentOverride?.lat ?? null)) patch.lat = newLat;

    const newLng = form.lng.trim() === '' ? null : Number(form.lng);
    if (newLng !== (currentOverride?.lng ?? null)) patch.lng = newLng;

    const newTags = trimmedOrNull(form.tagsCsv);
    if (newTags !== (currentOverride?.tagsCsv ?? null)) patch.tagsCsv = newTags;

    const newNotes = trimmedOrNull(form.notes);
    if (newNotes !== (currentOverride?.notes ?? null)) patch.notes = newNotes;

    setSaving(true);
    setError(null);
    try {
      await api.upsertOverride(row.eic, patch);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!window.confirm(`Retirer la surcharge pour ${row.eic} ?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.deleteOverride(row.eic);
      await onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6">
        <h3 className="mb-2 text-lg font-semibold">Surcharge pour {row.eic}</h3>
        <p className="mb-4 text-xs text-gray-500">
          Les placeholders grisés montrent la valeur actuelle (cascade). Remplir
          un champ crée/met à jour l'override niveau 1. Vider un champ = fallback cascade.
        </p>

        {error ? (
          <p className="mb-3 rounded bg-red-100 p-2 text-sm text-red-700" role="alert">{error}</p>
        ) : null}

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Nom affiché</span>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              placeholder={row.current.displayName}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Type</span>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">— (cascade : {row.current.type})</option>
              <option value="ENDPOINT">ENDPOINT</option>
              <option value="COMPONENT_DIRECTORY">COMPONENT_DIRECTORY</option>
              <option value="BROKER">BROKER</option>
              <option value="BA">BA</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Organisation</span>
            <input
              type="text"
              value={form.organization}
              onChange={(e) => setForm({ ...form, organization: e.target.value })}
              placeholder={row.current.organization ?? '—'}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Pays (ISO-2)</span>
            <input
              type="text"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value.toUpperCase() })}
              placeholder={row.current.country ?? '—'}
              maxLength={2}
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Latitude</span>
              <input
                type="number"
                step="any"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                placeholder={row.current.isDefaultPosition ? 'défaut' : String(row.current.lat)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Longitude</span>
              <input
                type="number"
                step="any"
                value={form.lng}
                onChange={(e) => setForm({ ...form, lng: e.target.value })}
                placeholder={row.current.isDefaultPosition ? 'défaut' : String(row.current.lng)}
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tags (CSV)</span>
            <input
              type="text"
              value={form.tagsCsv}
              onChange={(e) => setForm({ ...form, tagsCsv: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Notes</span>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-between">
          <div>
            {override !== null ? (
              <button
                type="button"
                onClick={() => { void handleDelete(); }}
                disabled={saving}
                className="rounded border border-red-600 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Retirer surcharge
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => { void handleSave(); }}
              disabled={saving}
              className="rounded bg-rte px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 8.4 — Run GREEN + commit**

```bash
pnpm --filter @carto-ecp/web test -- ComponentOverrideModal
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/web test
```

Expected: 4/4 ComponentOverrideModal PASS + full web PASS + typecheck PASS.

```bash
git add apps/web/src/components/Admin/ComponentOverrideModal.tsx apps/web/src/components/Admin/ComponentOverrideModal.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): ComponentOverrideModal — 8 champs + save + delete

Modale d'édition d'un ComponentOverride. Affiche les valeurs courantes
de la cascade en placeholders. Submit ne passe que les champs modifiés.
Delete avec confirm window.confirm.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 — CHANGELOG + PR

**Files :**
- Modify: `CHANGELOG.md`

- [ ] **Step 9.1 — CHANGELOG v2.0-alpha.5**

Insérer dans `CHANGELOG.md` au-dessus du bloc `v2.0-alpha.4` :

```markdown
### v2.0-alpha.5 — Slice 2c-2 Admin composants surcharge EIC (2026-04-20)

**Onglet Composants** activé dans `/admin`. Permet à l'admin de surcharger manuellement les métadonnées d'un EIC (nom, type, organisation, pays, coordonnées, tags, notes). Répond au besoin concret : corriger les positions des composants qui tombent à Bruxelles par défaut (MONITORING, TSOs non-RTE, etc.).

**Highlights :**

- **3 endpoints backend** : `GET /api/admin/components` (liste EICs des imports + cascade + override), `PUT /api/overrides/:eic` (upsert zod strict), `DELETE /api/overrides/:eic` (retire).
- **Upsert idempotent via PUT** (ADR-036) : l'admin envoie l'état souhaité pour un EIC. Champs nullable = fallback cascade niveau 2+.
- **`OverridesService.listAdminComponents`** : réutilise `mergeComponentsLatestWins` + `applyCascade` du graph module pour calculer le `current` après cascade. Retourne `AdminComponentRow[]`.
- **`ComponentsAdminTable`** : liste des EICs rencontrés (dédupée), recherche sur EIC/nom/organisation/pays, toggle "Seulement surchargés", click pour ouvrir la modale.
- **`ComponentOverrideModal`** : 8 inputs (text, select, number), placeholders affichent les valeurs cascade courantes, submit ne PUT que les champs modifiés, bouton "Retirer surcharge" avec confirm.
- **Types shared** : `AdminComponentRow`, `OverrideUpsertInput`.
- **ADR-036** : PUT upsert retenu vs POST+PATCH (idempotence + cohérence EIC PK).

**Tests :**
- Backend : 5 tests `OverridesService` (upsert create/update/null, delete happy+not-found) + 3 tests `listAdminComponents` (empty, with imports, with overrides) + 6 tests `OverridesController` (routes, reject invalid body).
- Frontend : 4 tests `ComponentsAdminTable` (render, search, filter, modal open) + 4 tests `ComponentOverrideModal` (title, save partial, retire visible/delete flow).

**Breaking changes :** aucun.
```

- [ ] **Step 9.2 — Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG v2.0-alpha.5 — slice 2c-2 admin composants

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 9.3 — Push + PR**

```bash
git push -u origin feat/v2-slice-2c-2-overrides

gh pr create --base feat/v2-slice-2c-admin --title "feat(v2): slice 2c-2 Admin composants surcharge EIC (v2.0-alpha.5)" --body "$(cat <<'EOF'
## Summary

Onglet Composants activé dans ``/admin``. Débloque la correction manuelle des EICs mal positionnés (MONITORING à Bruxelles, TSOs sans coord, etc.).

- 3 endpoints backend (GET admin/components, PUT/DELETE overrides/:eic)
- UI : ``ComponentsAdminTable`` (liste + recherche + filtre surchargés) + ``ComponentOverrideModal`` (8 champs, submit partial, retire)
- ADR-036 : PUT upsert idempotent

## Docs

- [Slice 2c-2 design](docs/superpowers/specs/2026-04-20-carto-ecp-v2-slice-2c-2-design.md)
- [Plan](docs/superpowers/plans/2026-04-20-carto-ecp-v2-slice-2c-2.md)
- ADR : [036](docs/adr/ADR-036-put-upsert-overrides.md)

## Base branche

Stackée sur ``feat/v2-slice-2c-admin`` (PR #9). Merge order : #6 → #7 → #8 → #9 → cette PR.

## Test plan

- [x] Tests backend (OverridesService + OverridesController) PASS
- [x] Tests frontend (ComponentsAdminTable + ComponentOverrideModal) PASS
- [x] ``pnpm typecheck`` api + web + shared PASS
- [ ] Smoke manuel (à faire par l'utilisateur) : ouvrir /admin → Composants, filtrer/rechercher, éditer un EIC, vérifier que les coords sont corrigées sur la carte après refresh

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage :** §1-J couverts par T1-T9. Pas de gap.

**Placeholder scan :** aucun TBD/TODO.

**Type consistency :**
- `AdminComponentRow`, `OverrideUpsertInput` définis Task 5, consommés Task 2/3/4/7/8 (avec types locaux temporaires Tasks 2-4 puis remplacés Task 5).
- `OverridesService.upsert/delete/listAdminComponents` signature cohérente entre Task 2/3 (impl) et Task 4 (controller) et Task 7/8 (client).

---

## Execution handoff

Plan complet. 9 tasks, 6 phases, scope moyen (~1.3× 2c-1).

Subagent-Driven execution recommandé (même pattern que 2c-1).
