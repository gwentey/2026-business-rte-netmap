# Slice 2c-1 — Admin panel : onglet Imports (gestion CRUD)

> **Statut :** design validé (2026-04-19), prêt pour `/superpowers:write-plan`.
> **Réfère :** [`2026-04-19-carto-ecp-v2-chapeau.md`](./2026-04-19-carto-ecp-v2-chapeau.md) §7 (feuille de route, 2c = admin panel complet).
> **Branche cible :** `feat/v2-slice-2c-admin` (déjà créée depuis la tête de `feat/v2-slice-2f-icons`).
> **Note scope :** la slice 2c initialement unique dans le chapeau a été **split en 2c-1 (imports) + 2c-2 (composants surcharge)**. Ce document couvre uniquement **2c-1**.

---

## §1 — Objectif

Fournir un panneau d'administration `/admin` avec un **onglet Imports** fonctionnel permettant de gérer la collection d'imports uploadés :

- **Lister** tous les imports avec leurs métadonnées (filename, sourceEic, label, dumpType, dates, stats, warnings)
- **Éditer inline** deux champs métadonnée : `label` et `effectiveDate`
- **Supprimer** un import (avec confirmation)
- **Filtrer** par `envName` + recherche texte côté client

La slice débloque la **gestion autonome des imports par l'admin** (sans curl/DevTools). Fixer un label mal saisi, réajuster une `effectiveDate` pour l'aligner sur la timeline, supprimer un import foireux.

Les 4 autres onglets (Composants, Annuaire ENTSO-E, Registry RTE, Zone danger) sont **visibles mais désactivés** dans la nav, avec tooltip explicite vers leur slice d'origine (2c-2, 2e, 2e, 2e).

---

## §2 — Scope

### 2c-1 livre

- Nouvelle route `/admin` avec layout tabulaire
- Composant `AdminTabs` avec 5 entrées dont seul « Imports » actif
- Composant `ImportsAdminTable` : table triable, filtrable, éditable inline
- Nouvel endpoint `PATCH /api/imports/:id` avec zod strict sur body `{ label?, effectiveDate? }`
- `ImportsService.updateImport(id, patch)` (service method)
- Extension de `api.updateImport` dans le client web
- Header : remplacement du lien `+ Importer` par `Admin` pointant sur `/admin`
- `/upload` conservé, accessible via bouton dédié dans le panneau admin

### 2c-1 ne livre PAS

- ❌ Onglet Composants fonctionnel (reporté à **2c-2**)
- ❌ Réassigner `dumpType` d'un import post-ingest (nécessite re-parse atomique du zip stocké, hors scope — cf. ADR-035)
- ❌ Bulk select + bulk delete (YAGNI tant qu'on a < 100 imports par env)
- ❌ Panneau détail modal d'un import (stats + warnings affichés inline dans la table suffit)
- ❌ Pagination / infinite scroll (YAGNI)
- ❌ Export CSV / JSON de la liste (YAGNI)
- ❌ Annuaire ENTSO-E refresh + Registry admin + Zone danger → **slice 2e**
- ❌ Formulaire `ComponentOverride` → **slice 2c-2**
- ❌ Auth / rôles (aucun admin check en dev-local, cohérent avec le reste)

---

## §A — Architecture

```
┌─ Backend (apps/api) ──────────────────────────────────────┐
│                                                            │
│  PATCH /api/imports/:id  (NOUVEAU)                         │
│    → ImportsController.update(id, body)                    │
│       → zod UpdateImportSchema (strict, 2 champs)          │
│       → ImportsService.updateImport(id, patch)             │
│          → prisma.import.update({ where, data })           │
│          → return toDetail(id)  (reuse v2a helper)         │
│                                                            │
└────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ Frontend (apps/web) ─────────────────────────────────────┐
│                                                            │
│  /admin                                                    │
│    └── AdminPage.tsx                                       │
│         ├── AdminTabs (5 tabs, 4 disabled)                 │
│         └── ImportsAdminTab (≡ ImportsAdminTable)          │
│              └── charge liste via api.listImports()        │
│              └── filtre env client-side                    │
│              └── recherche client-side                     │
│              └── cellules éditables (label, effectiveDate) │
│              └── action delete avec confirm modale         │
│                                                            │
│  Header                                                    │
│    └── lien "Admin" → /admin (remplace "+ Importer")       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## §B — Endpoint `PATCH /api/imports/:id`

### Schéma zod strict

```typescript
// apps/api/src/ingestion/imports.controller.ts

const UpdateImportSchema = z.object({
  label: z.string().min(1).max(256).optional(),
  effectiveDate: z.string().datetime().optional(),  // ISO 8601 strict (avec 'Z' ou offset)
}).strict();
```

Le `.strict()` **refuse tout champ non listé** (ex: `dumpType`, `envName`, `fileHash`). `zod.safeParse` retourne une erreur 400 avec le code `INVALID_BODY` et la liste des champs rejetés.

### Controller method

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

Refus explicite d'un PATCH vide → code `INVALID_BODY`.

### Service method

```typescript
// apps/api/src/ingestion/imports.service.ts

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

**Atomicité** : un seul `prisma.update` par appel. Pas de rollback nécessaire (pas de filesystem touché, pas de cascade).

**Effet secondaire notable** : changer `effectiveDate` modifie **ce que `GraphService.getGraph` retourne** (car la cascade compute-on-read filtre sur `effectiveDate ≤ refDate`). Le frontend doit re-fetch le graph actif après un PATCH de `effectiveDate`. C'est géré par l'appelant côté UI (rafraîchir la liste après patch suffit, le next navigate vers `/` re-fetch).

---

## §C — Route `/admin` + `AdminTabs`

### Routing

`apps/web/src/App.tsx` :

```tsx
<Route path="/" element={<MapPage />} />
<Route path="/map" element={<Navigate to="/" replace />} />
<Route path="/upload" element={<UploadPage />} />
<Route path="/admin" element={<AdminPage />} />     // NOUVEAU
<Route path="*" element={<Navigate to="/" replace />} />
```

Le header change : `<Link to="/upload">+ Importer</Link>` devient `<Link to="/admin">Admin</Link>`. Le lien upload reste accessible depuis `/admin/imports` via un bouton dédié.

### `AdminPage.tsx`

```tsx
// apps/web/src/pages/AdminPage.tsx
import { useState } from 'react';
import { AdminTabs } from '../components/Admin/AdminTabs.js';
import { ImportsAdminTable } from '../components/Admin/ImportsAdminTable.js';

type TabId = 'imports' | 'components' | 'entsoe' | 'registry' | 'danger';

export function AdminPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<TabId>('imports');

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

### `AdminTabs.tsx`

```tsx
// apps/web/src/components/Admin/AdminTabs.tsx
type TabId = 'imports' | 'components' | 'entsoe' | 'registry' | 'danger';

type TabDef = { id: TabId; label: string; enabled: boolean; tooltip: string };

const TABS: TabDef[] = [
  { id: 'imports', label: 'Imports', enabled: true, tooltip: '' },
  { id: 'components', label: 'Composants', enabled: false, tooltip: 'Disponible en slice 2c-2' },
  { id: 'entsoe', label: 'Annuaire ENTSO-E', enabled: false, tooltip: 'Disponible en slice 2e' },
  { id: 'registry', label: 'Registry RTE', enabled: false, tooltip: 'Disponible en slice 2e' },
  { id: 'danger', label: '⚠ Zone danger', enabled: false, tooltip: 'Disponible en slice 2e' },
];

type Props = {
  active: TabId;
  onChange: (id: TabId) => void;
};

export function AdminTabs({ active, onChange }: Props): JSX.Element {
  return (
    <nav className="flex gap-1 border-b border-gray-200">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => tab.enabled && onChange(tab.id)}
          disabled={!tab.enabled}
          title={tab.tooltip}
          className={`px-4 py-2 text-sm font-medium border-b-2 ${
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

Les 4 tabs désactivés sont **visibles** (permet à l'utilisateur de savoir ce qui arrive) mais **non cliquables** avec tooltip.

---

## §D — `ImportsAdminTable`

### Data loading

```tsx
// apps/web/src/components/Admin/ImportsAdminTable.tsx
export function ImportsAdminTable(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const loadEnvs = useAppStore((s) => s.loadEnvs);

  const [envFilter, setEnvFilter] = useState<string>(activeEnv ?? '');
  const [search, setSearch] = useState('');
  const [imports, setImports] = useState<ImportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge les envs au mount + les imports du filter env au changement de filter
  useEffect(() => { void loadEnvs(); }, [loadEnvs]);
  useEffect(() => {
    setLoading(true);
    api.listImports(envFilter || undefined)
      .then((rows) => { setImports(rows); setLoading(false); })
      .catch((e) => { setError((e as Error).message); setLoading(false); });
  }, [envFilter]);

  // Filtrage client-side sur la recherche
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return imports;
    return imports.filter((i) =>
      i.label.toLowerCase().includes(q) ||
      i.fileName.toLowerCase().includes(q) ||
      (i.sourceComponentEic ?? '').toLowerCase().includes(q),
    );
  }, [imports, search]);

  // ... render table
}
```

### Colonnes de la table

| Colonne | Source | Éditable | Comportement |
|---|---|---|---|
| **Fichier** | `fileName` (taille en dessous) | read-only, monospace | `fileName` tronqué si >30 chars avec `title` complet en tooltip |
| **Source EIC** | `sourceComponentEic ?? '—'` | read-only, monospace | — |
| **Label** | `label` | `<input>` inline | debounced 500ms → `api.updateImport(id, { label })` → reload ligne |
| **Type** | `dumpType` (badge coloré) | read-only | Badge ENDPOINT/CD/BROKER avec les 3 couleurs cohérentes (cercle mini) |
| **Effective date** | `effectiveDate` | `<input type="datetime-local">` | onBlur → `api.updateImport(id, { effectiveDate })` → reload ligne |
| **Uploaded at** | `uploadedAt` | read-only | format `dd/MM HH:mm` |
| **Stats** | `stats.componentsCount` / `pathsCount` / `messagingStatsCount` | read-only | format `N comp · M paths · K stats` |
| **Warnings** | `warnings.length` | read-only | badge orange si > 0 avec tooltip (liste les codes) |
| **Actions** | — | bouton | 🗑 → confirmation modale → `api.deleteImport(id)` → reload liste |

**Note sur stats/warnings** : `ImportSummary` actuellement ne contient PAS `stats` ni `warnings`. Il faut **soit** étendre `ImportSummary` côté API, **soit** charger les `ImportDetail` complets pour l'admin. Choix : **étendre `GET /api/imports` pour renvoyer `ImportDetail[]` côté admin** (ou ajouter un nouveau endpoint `/api/imports?detail=true`). Le plus simple : le type `ImportSummary` est déjà minimal et `ImportDetail = ImportSummary & { warnings, stats }`. On change `listImports` pour renvoyer `ImportDetail[]` directement — léger impact type, composants existants continuent de marcher (typage élargi).

**Solution retenue** : modifier la route `GET /api/imports` pour retourner `ImportDetail[]` au lieu de `ImportSummary[]`. Cascade minimale sur le frontend (store + UploadPage utilisaient `ImportSummary`, `ImportDetail` est un superset compatible).

### Filtres en haut de table

```tsx
<div className="mb-3 flex items-center gap-3">
  <label className="text-sm">
    Env :
    <select
      value={envFilter}
      onChange={(e) => setEnvFilter(e.target.value)}
      className="ml-2 rounded border border-gray-300 px-2 py-1 text-sm"
    >
      <option value="">Tous</option>
      {envs.map((e) => (<option key={e} value={e}>{e}</option>))}
    </select>
  </label>

  <label className="text-sm flex-1 max-w-md">
    Recherche :
    <input
      type="text"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      placeholder="label, filename, EIC..."
      className="ml-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
    />
  </label>

  <Link
    to={`/upload${envFilter ? `?env=${encodeURIComponent(envFilter)}` : ''}`}
    className="rounded bg-rte px-3 py-1.5 text-sm text-white"
  >
    + Importer des dumps
  </Link>
</div>
```

### Confirm delete modale

Modal simple avec un overlay, zero dep tierce (pas de shadcn) :

```tsx
{confirmDeleteId !== null ? (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h3 className="text-lg font-semibold mb-2">Supprimer l'import ?</h3>
      <p className="text-sm text-gray-600 mb-4">
        L'import « {confirmDeleteLabel} » sera définitivement supprimé. Les composants
        et paths qu'il apportait seront retirés du graph (sauf s'ils sont apportés
        aussi par un autre import).
      </p>
      <div className="flex justify-end gap-2">
        <button onClick={() => setConfirmDeleteId(null)} className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded">
          Annuler
        </button>
        <button onClick={handleConfirmDelete} className="px-4 py-1.5 text-sm bg-red-600 text-white rounded">
          Supprimer
        </button>
      </div>
    </div>
  </div>
) : null}
```

---

## §E — Debouncing de l'édition inline

Pour `label` (input texte), debounce 500ms pour éviter un PATCH par frappe :

```tsx
function LabelCell({ item }: { item: ImportDetail }): JSX.Element {
  const [value, setValue] = useState(item.label);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setValue(item.label); }, [item.label]);  // sync si reload externe

  const debouncedSave = useMemo(
    () => debounce(async (newValue: string) => {
      if (newValue === item.label || newValue.trim().length === 0) return;
      setSaving(true);
      try {
        await api.updateImport(item.id, { label: newValue.trim() });
      } finally {
        setSaving(false);
      }
    }, 500),
    [item.id, item.label],
  );

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => { setValue(e.target.value); debouncedSave(e.target.value); }}
      className="w-40 rounded border border-gray-300 px-1 py-0.5 text-xs"
    />
  );
}
```

Le `debounce` utilitaire est importé de `apps/web/src/lib/debounce.ts` (nouveau si absent, sinon réutilisé). Micro-helper 10 lignes.

Pour `effectiveDate` (datetime picker), PATCH **onBlur** uniquement (pas de debounce, l'action de picker est déjà discrète).

---

## §F — Tests

### Backend (2 fichiers à étendre)

**`apps/api/src/ingestion/imports.service.spec.ts`** — ajouter `describe('updateImport')` avec 4 cas :

1. `updates label only` — patch = `{ label: 'new' }` → DB a `label = 'new'`, `effectiveDate` inchangé
2. `updates effectiveDate only` — patch = `{ effectiveDate: iso }` → DB a effectiveDate mis à jour, `label` inchangé
3. `updates both fields` — patch = `{ label, effectiveDate }` → les deux mis à jour
4. `throws IMPORT_NOT_FOUND on unknown id` → `rejects.toThrow()`

**`apps/api/src/ingestion/imports.controller.spec.ts`** — ajouter `describe('update')` avec 4 cas :

1. `forwards valid body to service` (mock service) → service appelé avec bonne shape
2. `rejects extra fields via zod strict` (body `{ dumpType: 'CD' }`) → BadRequestException `INVALID_BODY`
3. `rejects invalid effectiveDate format` (body `{ effectiveDate: 'not-a-date' }`) → BadRequestException
4. `rejects empty body` → BadRequestException

### Frontend (2 fichiers nouveaux, 1 étendu)

**`apps/web/src/components/Admin/ImportsAdminTable.test.tsx`** — 5 cas :

1. `renders table rows for each import`
2. `filters by env via select`
3. `filters by search input (label, fileName, eic)`
4. `calls api.updateImport on label debounced save`
5. `opens confirm modal on delete click, calls api.deleteImport on confirm`

**`apps/web/src/components/Admin/AdminTabs.test.tsx`** — 2 cas :

1. `renders 5 tabs with imports active`
2. `does not call onChange for disabled tabs`

**`apps/web/src/pages/AdminPage.test.tsx`** — 1 cas smoke : `renders AdminPage with title + tabs + ImportsAdminTable visible`

---

## §G — Migration de type `ImportSummary` → `ImportDetail` sur `GET /api/imports`

**Décision** : `GET /api/imports` retourne désormais `ImportDetail[]` (superset de `ImportSummary`, ajoute `warnings` + `stats`). Cette décision :

- **Simplifie** la vie côté admin (pas besoin d'un 2e endpoint `detail=true` ou d'un Nx1 fetch)
- Fait un léger surpoids réseau mais marginal (stats = 3 nombres, warnings = array court)
- Les callers existants (store Zustand, UploadPage) continuent de fonctionner car `ImportDetail extends ImportSummary`

**Changement côté backend** : `ImportsService.listImports()` devient :

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

**Changement côté shared** : `api.listImports(env?): Promise<ImportDetail[]>`. Les types sont rétrocompatibles (superset).

**Impact sur le store Zustand** : la propriété `imports: ImportSummary[]` devient `imports: ImportDetail[]`. Aucun changement de code dans le store nécessaire, juste le type.

---

## §H — DoD slice 2c-1

- [ ] Route `/admin` accessible, lien « Admin » dans le header
- [ ] `AdminTabs` affiche 5 onglets, seul « Imports » actif
- [ ] `ImportsAdminTable` charge les imports via `api.listImports(env?)`
- [ ] Filtre `env` (select) fonctionne
- [ ] Recherche texte client-side fonctionne sur label/fileName/sourceEic
- [ ] Édition inline `label` (debounced 500ms) → PATCH + reload ligne
- [ ] Édition inline `effectiveDate` (onBlur) → PATCH + reload ligne
- [ ] Action delete avec confirm modale → DELETE + reload liste
- [ ] `GET /api/imports` retourne `ImportDetail[]` avec stats et warnings
- [ ] `PATCH /api/imports/:id` zod strict, 2 champs, refuse dumpType/envName/etc.
- [ ] 6 tests backend PASS (service + controller)
- [ ] 8 tests frontend PASS (AdminTabs, ImportsAdminTable, AdminPage smoke)
- [ ] typecheck api + web + shared PASS
- [ ] Smoke manuel : supprimer un import, renommer un import, modifier effectiveDate → observé en DB + carte se rafraîchit
- [ ] CHANGELOG v2.0-alpha.4 rédigé
- [ ] ADR-035 rédigé (`dumpType` immutable post-ingest)

---

## §I — ADR déclenché

**ADR-035 — `dumpType` immutable post-ingest**

Contexte : la slice 2c-1 introduit l'édition admin des imports. Question : doit-on permettre de réassigner le `dumpType` d'un import existant ?

Options :
- A = `dumpType` immutable après ingestion (retenue)
- B = `dumpType` éditable avec re-parse atomique du zip stocké
- C = `dumpType` éditable en metadata only sans re-parse (NON recommandé, crée de l'incohérence)

Décision : A. Justification : les `components` et `paths` persistés ont été extraits selon la pipeline du type d'origine. Modifier juste la metadata crée une incohérence entre le `dumpType` affiché et ce qui est réellement en DB. Pour corriger un type mal détecté, l'admin supprime + ré-upload avec override manuel (supporté via `dumpType` dans le body de `POST /api/imports` depuis 2b).

Conséquences :
- Positives : simplicité, cohérence DB garantie
- Négatives : un dump mal classé nécessite delete + re-upload manuel
- Interdit désormais : permettre un PATCH de `dumpType` en metadata only
