# Slice 2g — Registry admin UI (MVP)

> **Statut :** design validé autonome (2026-04-20).
> **Branche :** `feat/v2-slice-2g-registry-admin` (depuis tip de 2e / feat/phase1-remediation).
> **Scope réduit :** MVP qui débloque l'édition sans-git. On livre UNIQUEMENT les couleurs process et un accès pratique aux RTE endpoints. Le reste du registry (business apps, organization geocode, country geocode, classification patterns) reste file-only — YAGNI.

---

## §1 — Objectif

Activer l'onglet **Registry RTE** de `/admin` avec 2 sections fonctionnelles :

1. **Couleurs de process** : 8 color pickers (TP, UK-CC-IN, CORE, MARI, PICASSO, VP, MIXTE, UNKNOWN). Sauvegarde via API. Effet immédiat sur la carte au prochain graph fetch.
2. **Endpoints RTE** : tableau read-only des 6 endpoints overlay (EIC, code, displayName, coords actuelles). Chaque ligne a un bouton "Modifier" qui redirige vers l'onglet **Composants** pré-filtré sur l'EIC (réutilise le `ComponentOverrideModal` existant — pas de duplication).

---

## §2 — Scope

### 2g livre

- **Table Prisma** : `ProcessColorOverride` `{ process @id, color }`
- **3 endpoints backend** : `GET /api/registry/process-colors`, `PUT /api/registry/process-colors/:process`, `DELETE /api/registry/process-colors/:process`
- **1 endpoint backend** : `GET /api/registry/rte-endpoints` (read-only, retourne les 6 endpoints fichier, merge avec `ComponentOverride` si existant)
- **Service backend** : `RegistrySettingsService` (in `apps/api/src/registry-settings/`)
- **Contrôleur backend** : `RegistryAdminController` (4 routes regroupées)
- **Extension `GraphService`** : `buildGraph` inclut les couleurs effectives mergées dans `GraphResponse.mapConfig.processColors` (déjà présent via overlay, on swap pour la version mergée)
- **Frontend** : nouveau `RegistryAdminTab`, activation onglet dans `AdminTabs`
- **Frontend refactor mineur** : `colorFor()` lit depuis le store au lieu de la constante hardcoded
- **Shared types** : `MapConfig.processColors` (déjà présent) reste, on ajoute `RegistryColorRow` + `RegistryRteEndpointRow`

### 2g ne livre pas

- ❌ Édition des business apps (overlay.rteBusinessApplications)
- ❌ Édition des geocodes organisation / pays
- ❌ Édition des classification patterns (messageTypeClassification)
- ❌ Ajout/suppression d'un endpoint RTE (l'ensemble autoritatif reste file-based via overlay JSON)
- ❌ Ajout d'un process custom (la liste reste figée aux 8 clés)
- ❌ Upload/download de l'overlay JSON entier
- ❌ Hot reload serveur après `PUT` (les couleurs sont lues depuis la DB à chaque `GET /api/graph` — pas besoin de reload)

---

## §A — Architecture

```
Backend
  apps/api/prisma/schema.prisma
    + model ProcessColorOverride {
        process  String  @id
        color    String
        updatedAt DateTime @updatedAt
      }

  apps/api/src/registry-settings/
    registry-settings.service.ts       (in-memory merge file + DB)
    registry-settings.service.spec.ts
    registry-admin.controller.ts       (4 routes)
    registry-admin.controller.spec.ts
    registry-settings.module.ts

  apps/api/src/graph/graph.service.ts
    → buildGraph lit registrySettings.getEffectiveProcessColors() pour mapConfig

  Routes (global prefix 'api') :
    GET    /api/registry/process-colors
    PUT    /api/registry/process-colors/:process
    DELETE /api/registry/process-colors/:process
    GET    /api/registry/rte-endpoints

Frontend
  apps/web/src/components/Admin/RegistryAdminTab.tsx      (NOUVEAU)
  apps/web/src/components/Admin/ProcessColorsEditor.tsx   (NOUVEAU, section 1)
  apps/web/src/components/Admin/RteEndpointsTable.tsx     (NOUVEAU, section 2)
  apps/web/src/pages/AdminPage.tsx                        (render conditionnel nouveau tab)
  apps/web/src/components/Admin/AdminTabs.tsx             (registry.enabled=true)
  apps/web/src/lib/api.ts                                 (+ 4 méthodes)
  apps/web/src/lib/process-colors.ts                      (colorFor lit depuis arg au lieu de const)
  apps/web/src/components/Map/EdgePath.tsx                (accepte processColors en prop ou lit graph.mapConfig)
  packages/shared/src/graph.ts                            (+ RegistryColorRow, RegistryRteEndpointRow)
```

---

## §B — Backend — Couleurs

### `RegistrySettingsService`

```typescript
// apps/api/src/registry-settings/registry-settings.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import type { ProcessKey, ProcessColorMap } from '@carto-ecp/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegistryService } from '../registry/registry.service.js';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const KNOWN_PROCESSES: ProcessKey[] = ['TP', 'UK-CC-IN', 'CORE', 'MARI', 'PICASSO', 'VP', 'MIXTE', 'UNKNOWN'];

@Injectable()
export class RegistrySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: RegistryService,
  ) {}

  async getEffectiveProcessColors(): Promise<ProcessColorMap> {
    const overrides = await this.prisma.processColorOverride.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.process, o.color]));
    const result: Partial<ProcessColorMap> = {};
    for (const key of KNOWN_PROCESSES) {
      result[key] = overrideMap.get(key) ?? this.registry.processColor(key);
    }
    return result as ProcessColorMap;
  }

  async listProcessColors(): Promise<Array<{ process: ProcessKey; color: string; isOverride: boolean; default: string }>> {
    const overrides = await this.prisma.processColorOverride.findMany();
    const overrideMap = new Map(overrides.map((o) => [o.process, o.color]));
    return KNOWN_PROCESSES.map((process) => {
      const defaultColor = this.registry.processColor(process);
      const override = overrideMap.get(process);
      return {
        process,
        color: override ?? defaultColor,
        isOverride: override !== undefined,
        default: defaultColor,
      };
    });
  }

  async upsertProcessColor(process: string, color: string): Promise<void> {
    if (!KNOWN_PROCESSES.includes(process as ProcessKey)) {
      throw new BadRequestException({ code: 'INVALID_PROCESS', message: `Process ${process} inconnu` });
    }
    if (!HEX_COLOR.test(color)) {
      throw new BadRequestException({ code: 'INVALID_COLOR', message: 'Format attendu #RRGGBB' });
    }
    await this.prisma.processColorOverride.upsert({
      where: { process },
      create: { process, color },
      update: { color },
    });
  }

  async resetProcessColor(process: string): Promise<void> {
    if (!KNOWN_PROCESSES.includes(process as ProcessKey)) {
      throw new BadRequestException({ code: 'INVALID_PROCESS', message: `Process ${process} inconnu` });
    }
    await this.prisma.processColorOverride.deleteMany({ where: { process } });
  }
}
```

---

## §C — Backend — RTE endpoints

```typescript
async listRteEndpoints(): Promise<RegistryRteEndpointRow[]> {
  const overlay = this.registry.getOverlay();
  const overrides = await this.prisma.componentOverride.findMany({
    where: { eic: { in: overlay.rteEndpoints.map((e) => e.eic) } },
  });
  const overrideMap = new Map(overrides.map((o) => [o.eic, o]));
  return overlay.rteEndpoints.map((e) => {
    const override = overrideMap.get(e.eic);
    return {
      eic: e.eic,
      code: e.code,
      displayName: override?.displayName ?? e.displayName,
      city: e.city,
      lat: override?.lat ?? e.lat,
      lng: override?.lng ?? e.lng,
      hasOverride: override !== undefined,
    };
  });
}
```

---

## §D — `RegistryAdminController`

```typescript
@Controller()
export class RegistryAdminController {
  constructor(private readonly settings: RegistrySettingsService) {}

  @Get('registry/process-colors')
  async listColors() {
    return this.settings.listProcessColors();
  }

  @Put('registry/process-colors/:process')
  async upsertColor(@Param('process') process: string, @Body() body: { color?: string }) {
    const parsed = z.object({ color: z.string() }).safeParse(body);
    if (!parsed.success) throw new BadRequestException({ code: 'INVALID_BODY' });
    await this.settings.upsertProcessColor(process, parsed.data.color);
    return { ok: true };
  }

  @Delete('registry/process-colors/:process')
  @HttpCode(204)
  async deleteColor(@Param('process') process: string): Promise<void> {
    await this.settings.resetProcessColor(process);
  }

  @Get('registry/rte-endpoints')
  async listEndpoints() {
    return this.settings.listRteEndpoints();
  }
}
```

---

## §E — GraphService intégration

Dans `GraphService.buildGraph(env, refDate)`, remplacer `mapConfig: { ...this.registry.getMapConfig(), processColors: this.registry.getProcessColorMap() }` par `mapConfig: { ...this.registry.getMapConfig(), processColors: await this.registrySettings.getEffectiveProcessColors() }`.

Si `getProcessColorMap()` n'existait pas encore sur RegistryService, l'ajouter :
```typescript
getProcessColorMap(): ProcessColorMap {
  return { ...this.overlay.processColors };
}
```

---

## §F — Frontend

### `ProcessColorsEditor`

```tsx
export function ProcessColorsEditor(): JSX.Element {
  const [rows, setRows] = useState<RegistryColorRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const loadColors = useAppStore((s) => s.loadGraph);  // to refresh map after save
  const activeEnv = useAppStore((s) => s.activeEnv);

  useEffect(() => {
    void api.getProcessColors().then(setRows);
  }, []);

  const save = async (process: ProcessKey, color: string) => {
    setSaving(process);
    try {
      await api.setProcessColor(process, color);
      const fresh = await api.getProcessColors();
      setRows(fresh);
      if (activeEnv) await loadColors(activeEnv);
    } finally {
      setSaving(null);
    }
  };

  const reset = async (process: ProcessKey) => {
    setSaving(process);
    try {
      await api.resetProcessColor(process);
      const fresh = await api.getProcessColors();
      setRows(fresh);
      if (activeEnv) await loadColors(activeEnv);
    } finally {
      setSaving(null);
    }
  };

  // Render: table with process name | current color swatch | color picker | reset button (if isOverride)
}
```

### `RteEndpointsTable`

```tsx
export function RteEndpointsTable({ onEdit }: { onEdit: (eic: string) => void }): JSX.Element {
  const [rows, setRows] = useState<RegistryRteEndpointRow[]>([]);
  useEffect(() => { void api.getRteEndpoints().then(setRows); }, []);
  // Render: table EIC | code | displayName | lat/lng | badge "surchargé" si hasOverride | bouton "Modifier" → onEdit(eic)
}
```

### `RegistryAdminTab`

```tsx
export function RegistryAdminTab({ onEditComponent }: { onEditComponent: (eic: string) => void }): JSX.Element {
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-medium">Couleurs des process</h3>
        <ProcessColorsEditor />
      </section>
      <section>
        <h3 className="mb-4 text-lg font-medium">Endpoints RTE</h3>
        <p className="mb-3 text-sm text-gray-600">Lecture seule. Modifier un endpoint ouvre la surcharge dans l'onglet Composants.</p>
        <RteEndpointsTable onEdit={onEditComponent} />
      </section>
    </div>
  );
}
```

### `AdminPage`

- Étendre la gestion des tabs pour que le click "Modifier" dans `RegistryAdminTab` switche vers le tab `components` et ouvre le modal pré-rempli avec l'EIC passé.
- Ajouter un `useState<string | null>` `pendingComponentEic` pour gérer ce handoff.

### `AdminTabs`

```typescript
{ id: 'registry', label: 'Registry RTE', enabled: true, tooltip: '' },
```

Le tooltip "Reporté" disparaît.

---

## §G — Shared types

```typescript
// packages/shared/src/graph.ts
export type RegistryColorRow = {
  process: ProcessKey;
  color: string;
  isOverride: boolean;
  default: string;
};

export type RegistryRteEndpointRow = {
  eic: string;
  code: string;
  displayName: string;
  city: string;
  lat: number;
  lng: number;
  hasOverride: boolean;
};
```

---

## §H — Tests

**Backend (~12 tests) :**
- `RegistrySettingsService` : 5 tests (listProcessColors default, listProcessColors with overrides, upsert creates, upsert updates, reset deletes, upsert invalid process/color rejects)
- `RegistryAdminController` : 4 tests (GET list, PUT upsert, DELETE reset, GET rte-endpoints merges ComponentOverride)
- Integration : 1 test e2e (PUT color → GET graph returns new color in mapConfig)

**Frontend (~6 tests) :**
- `ProcessColorsEditor` : 3 tests (loads rows, save triggers api + reload, reset hides override badge)
- `RteEndpointsTable` : 2 tests (renders 6 endpoints, "surchargé" badge when hasOverride)
- `RegistryAdminTab` : 1 test (onEdit callback called with EIC when clicking modify button)

---

## §I — DoD

- [ ] Migration Prisma appliquée + table créée
- [ ] 4 endpoints backend fonctionnels
- [ ] `GraphResponse.mapConfig.processColors` reflète les overrides DB
- [ ] Onglet Registry activé, 2 sections opérationnelles
- [ ] Click "Modifier" dans RteEndpointsTable switche vers onglet Composants + ouvre modal
- [ ] typecheck api + web + shared PASS
- [ ] Tests API + web PASS
- [ ] CHANGELOG v2.0-alpha.8
