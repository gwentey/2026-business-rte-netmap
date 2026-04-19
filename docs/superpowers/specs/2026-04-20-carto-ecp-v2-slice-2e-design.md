# Slice 2e — Zone danger + Annuaire ENTSO-E

> **Statut :** design validé autonome (2026-04-20).
> **Branche :** `feat/v2-slice-2e-danger-entsoe` (depuis tip de 2d).
> **Scope réduit :** la slice 2e originale couvre *ENTSO-E + registry admin + zone danger*. Ici on livre **zone danger + ENTSO-E upload** — le registry admin est reporté (YAGNI : édition JSON niche, fichier overlay déjà gérable par commit git).

---

## §1 — Objectif

Deux onglets admin fonctionnels en plus dans `/admin` :

- **⚠ Zone danger** : 3 boutons de purge (imports / overrides / reset total) avec **confirmations fortes** (typing-to-confirm).
- **Annuaire ENTSO-E** : upload d'un fichier CSV officiel ENTSO-E (format `X_eicCodes.csv`) → parse + bulk upsert de la table `EntsoeEntry` → alimente niveau 2 de la cascade.

---

## §2 — Scope

### 2e livre

- **3 endpoints purge** : `DELETE /api/admin/purge-imports`, `DELETE /api/admin/purge-overrides`, `DELETE /api/admin/purge-all`
- **2 endpoints ENTSO-E** : `POST /api/entsoe/upload` (multipart CSV, max 5 MB) + `GET /api/entsoe/status` (last refresh + count)
- **Services backend** : `DangerService` (purges) + `EntsoeService` (parse + upsert)
- **Frontend** : activation des tabs `entsoe` et `danger` dans `AdminTabs`, composants `EntsoeAdminTab` + `DangerZoneTab`
- Parse du format CSV ENTSO-E standard (colonnes `EicCode`, `EicLongName`, `MarketParticipantIsoCountryCode`, `EicTypeFunctionList`)
- API client web étendu

### 2e ne livre pas

- ❌ **Registry admin** (édition ou upload de l'overlay JSON) — reporté, YAGNI
- ❌ Download/export de l'annuaire ENTSO-E courant
- ❌ Historique des purges / undo

---

## §A — Architecture

```
Backend
  apps/api/src/admin/
    danger.service.ts       (purges)
    danger.service.spec.ts
    entsoe.service.ts       (parse + upsert)
    entsoe.service.spec.ts
    admin.controller.ts     (regroupe toutes les routes admin)
    admin.controller.spec.ts
    admin.module.ts

  Routes (avec prefix global 'api') :
    DELETE /api/admin/purge-imports
    DELETE /api/admin/purge-overrides
    DELETE /api/admin/purge-all
    POST   /api/entsoe/upload   (multipart CSV)
    GET    /api/entsoe/status

Frontend
  apps/web/src/components/Admin/
    EntsoeAdminTab.tsx      (upload + status display)
    DangerZoneTab.tsx       (3 purge buttons avec typing-to-confirm)

  AdminTabs : entsoe.enabled=true, danger.enabled=true
  AdminPage : renders appropriate tab content
```

---

## §B — Purges backend

### `DangerService`

```typescript
// apps/api/src/admin/danger.service.ts
import { Injectable } from '@nestjs/common';
import { existsSync, unlinkSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class DangerService {
  constructor(private readonly prisma: PrismaService) {}

  async purgeImports(): Promise<{ deletedCount: number }> {
    const all = await this.prisma.import.findMany({ select: { id: true, zipPath: true } });
    for (const imp of all) {
      if (imp.zipPath && existsSync(imp.zipPath)) {
        try { unlinkSync(imp.zipPath); } catch { /* best effort */ }
      }
    }
    const result = await this.prisma.import.deleteMany();
    return { deletedCount: result.count };
  }

  async purgeOverrides(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.componentOverride.deleteMany();
    return { deletedCount: result.count };
  }

  async purgeAll(): Promise<{ imports: number; overrides: number; entsoe: number }> {
    const imports = await this.purgeImports();
    const overrides = await this.purgeOverrides();
    const entsoe = await this.prisma.entsoeEntry.deleteMany();
    return { imports: imports.deletedCount, overrides: overrides.deletedCount, entsoe: entsoe.count };
  }
}
```

---

## §C — Annuaire ENTSO-E

### Format CSV officiel observé

```
EicCode;EicDisplayName;EicLongName;EicParent;EicResponsibleParty;EicStatus;MarketParticipantPostalCode;MarketParticipantIsoCountryCode;MarketParticipantVatCode;EicTypeFunctionList;type
10X1001A1001A094;ELIA;Elia Transmission Belgium;;;Active;1000;BE;BE0731852231;System Operator;X
```

### `EntsoeService`

```typescript
// apps/api/src/admin/entsoe.service.ts
import { Injectable } from '@nestjs/common';
import { parse as csvParse } from 'csv-parse/sync';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class EntsoeService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(buffer: Buffer): Promise<{ count: number; refreshedAt: string }> {
    const content = buffer.toString('utf-8');
    const rows = csvParse(content, {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }) as Array<Record<string, string>>;

    const refreshedAt = new Date();
    // Purge existant avant upsert pour simplifier (l'admin upload une version complète)
    await this.prisma.entsoeEntry.deleteMany();

    const batch: Array<{
      eic: string; displayName: string | null; organization: string | null;
      country: string | null; function: string | null; refreshedAt: Date;
    }> = [];
    for (const row of rows) {
      const eic = (row['EicCode'] ?? '').trim();
      if (!eic) continue;
      batch.push({
        eic,
        displayName: nonEmpty(row['EicLongName']) ?? nonEmpty(row['EicDisplayName']),
        organization: nonEmpty(row['EicDisplayName']),
        country: nonEmpty(row['MarketParticipantIsoCountryCode']),
        function: nonEmpty(row['EicTypeFunctionList']),
        refreshedAt,
      });
    }
    if (batch.length > 0) {
      // SQLite supporte createMany
      await this.prisma.entsoeEntry.createMany({ data: batch });
    }
    return { count: batch.length, refreshedAt: refreshedAt.toISOString() };
  }

  async status(): Promise<{ count: number; refreshedAt: string | null }> {
    const count = await this.prisma.entsoeEntry.count();
    const first = await this.prisma.entsoeEntry.findFirst({ select: { refreshedAt: true } });
    return {
      count,
      refreshedAt: first?.refreshedAt.toISOString() ?? null,
    };
  }
}

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const s = v.trim();
  return s.length === 0 ? null : s;
}
```

---

## §D — AdminController (routes regroupées)

```typescript
// apps/api/src/admin/admin.controller.ts
import {
  BadRequestException, Controller, Delete, Get, HttpCode,
  Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DangerService } from './danger.service.js';
import { EntsoeService } from './entsoe.service.js';

const MAX_SIZE = 5 * 1024 * 1024;

@Controller()
export class AdminController {
  constructor(
    private readonly danger: DangerService,
    private readonly entsoe: EntsoeService,
  ) {}

  @Delete('admin/purge-imports')
  async purgeImports() {
    return this.danger.purgeImports();
  }

  @Delete('admin/purge-overrides')
  async purgeOverrides() {
    return this.danger.purgeOverrides();
  }

  @Delete('admin/purge-all')
  async purgeAll() {
    return this.danger.purgeAll();
  }

  @Post('entsoe/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_SIZE } }))
  async entsoeUpload(@UploadedFile() file: { originalname: string; buffer: Buffer; mimetype?: string }) {
    if (!file || !file.buffer) {
      throw new BadRequestException({ code: 'INVALID_UPLOAD', message: 'Fichier requis' });
    }
    return this.entsoe.upload(file.buffer);
  }

  @Get('entsoe/status')
  async entsoeStatus() {
    return this.entsoe.status();
  }
}
```

---

## §E — Frontend

### `EntsoeAdminTab`

- Affiche `count` et `refreshedAt` depuis `GET /api/entsoe/status`
- Dropzone (fichier unique, `.csv`, max 5 MB)
- Bouton "Uploader" qui envoie via `api.uploadEntsoe(file)` et refresh le status après succès

### `DangerZoneTab`

- 3 boutons rouges :
  - "Purger tous les imports"
  - "Purger toutes les surcharges"
  - "⚠ Reset total (imports + overrides + ENTSO-E)"
- Chaque bouton ouvre une modale qui **demande de taper un mot exact** (`PURGER` / `RESET`) pour confirmer
- Après confirmation, appel API, affichage du résultat (`N supprimés`)

### Types shared

```typescript
export type EntsoeStatus = { count: number; refreshedAt: string | null };
export type PurgeResult = { deletedCount: number };
export type ResetAllResult = { imports: number; overrides: number; entsoe: number };
```

---

## §F — AdminTabs

Dans `AdminTabs.tsx`, activer `entsoe` et `danger` :

```typescript
{ id: 'entsoe', label: 'Annuaire ENTSO-E', enabled: true, tooltip: '' },
{ id: 'registry', label: 'Registry RTE', enabled: false, tooltip: 'Reporté' },
{ id: 'danger', label: '⚠ Zone danger', enabled: true, tooltip: '' },
```

Registry reste disabled (reporté).

Dans `AdminPage.tsx`, ajouter les render conditionnels.

---

## §G — Tests

Backend (~10 tests) :
- `DangerService` : 3 tests (purge imports supprime rows+zips, purge overrides, purge all)
- `EntsoeService` : 3 tests (upload parse CSV, status empty, status after upload)
- `AdminController` : 4 tests (4 endpoints delegate)

Frontend (~6 tests) :
- `EntsoeAdminTab` : 2 tests (display status, upload flow)
- `DangerZoneTab` : 3 tests (open confirm, typing wrong word = disabled, typing correct = enabled + call API)
- `AdminTabs` : 1 test mis à jour (3 tabs enabled)

---

## §H — DoD

- [ ] 5 endpoints backend fonctionnels
- [ ] 2 services (Danger + Entsoe) avec tests
- [ ] Frontend : 2 tabs activés, 2 composants livrés
- [ ] Typing-to-confirm pour les 3 purges (PURGER ou RESET comme mot-clé)
- [ ] typecheck api + web + shared PASS
- [ ] CHANGELOG v2.0-alpha.7
