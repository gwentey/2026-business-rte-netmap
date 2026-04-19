# Slice 2c-2 — Admin panel : onglet Composants (surcharge EIC)

> **Statut :** design validé (2026-04-20), prêt pour writing-plans.
> **Branche :** `feat/v2-slice-2c-2-overrides` (depuis tip de 2c-1).

---

## §1 — Objectif

Activer l'onglet "Composants" du panneau admin. Permettre la **surcharge globale par EIC** pour corriger à la main displayName, type, organization, country, lat/lng, tags, notes. Les overrides s'appliquent cross-env (niveau 1 de la cascade 5 niveaux — déjà en place depuis 2a).

Usecase concret : **MONITORING** centré à Bruxelles par défaut → admin corrige ses coords → badge `isDefaultPosition` disparaît, marker positionné correctement.

---

## §2 — Scope

### 2c-2 livre

- `GET /api/admin/components` → liste enrichie des EICs présents dans les imports + état actuel (GlobalComponent computed) + override existant
- `PUT /api/overrides/:eic` → upsert override (zod strict sur 8 champs optionnels)
- `DELETE /api/overrides/:eic` → retire l'override (404 si absent)
- `ComponentsAdminTable` composant React : liste, recherche, filtre "surchargés", modale d'édition
- `ComponentOverrideModal` composant React : 8 inputs, submit upsert, bouton "Retirer la surcharge"
- `AdminTabs` : onglet "Composants" passe à `enabled: true`
- `api.listAdminComponents`, `api.upsertOverride`, `api.deleteOverride` dans le client web
- 1 ADR (ADR-036) : API `PUT /api/overrides/:eic` upsert vs POST+PATCH

### 2c-2 ne livre pas

- ❌ Picker sur carte pour lat/lng (YAGNI, inputs texte suffisent)
- ❌ Pagination (filtre client suffit <1000 rows)
- ❌ Bulk override (YAGNI)
- ❌ Historique des overrides (`updatedAt` suffit pour MVP)
- ❌ Import/export CSV d'overrides en masse (slice ultérieure si besoin)
- ❌ Preview live sur carte des changements (l'admin refresh `/` après)

---

## §A — Architecture

```
Backend
  GET  /api/admin/components  → union des EICs des imports + cascade computed + override existant
  PUT  /api/overrides/:eic    → upsert (zod strict, 8 champs)
  DELETE /api/overrides/:eic  → remove (404 si absent)

  Nouveau service : OverridesService (CRUD + listAdminComponents)
  Nouveau controller : OverridesController
  Réutilise : PrismaService, GraphService.applyCascade pour calculer le GlobalComponent courant

Frontend
  /admin → onglet Composants activé
  ComponentsAdminTable : table EICs + recherche + filtre "surchargés" + click-to-edit
  ComponentOverrideModal : 8 inputs, upsert/delete
  Store : pas d'extension nécessaire (fetch local au tab)
```

---

## §B — Endpoint `GET /api/admin/components`

Retourne `AdminComponentRow[]` :

```typescript
// packages/shared/src/graph.ts (nouveau)
export type AdminComponentRow = {
  eic: string;
  // État courant après cascade 5 niveaux (ce qui est affiché sur la carte)
  current: {
    displayName: string;
    type: string;
    organization: string | null;
    country: string | null;
    lat: number;
    lng: number;
    isDefaultPosition: boolean;
  };
  // Override existant ou null
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
  // Nombre d'imports qui référencent cet EIC (pour affichage "présent dans N imports")
  importsCount: number;
};
```

**Implémentation service** :
1. Fetch tous les `ImportedComponent` avec leur `import.effectiveDate`
2. Fetch tous les `ComponentOverride`
3. Fetch tous les `EntsoeEntry` (cascade niveau 2)
4. Pour chaque EIC unique :
   - Applique `mergeComponentsLatestWins` (per-EIC, tous envs confondus)
   - Applique `applyCascade` avec les 4 sources (override, entsoe, registry, merged-import) + default fallback
   - Construit le `AdminComponentRow` avec `current` (résultat cascade), `override` (ligne brute ComponentOverride si existe), `importsCount` (count distinct importId par EIC)
5. Trie par EIC alphabétique

**Pas de pagination** : on renvoie tout, filtre client.

**Tri par défaut** : EIC alphabétique. Client peut re-trier par colonne ultérieurement.

---

## §C — Endpoint `PUT /api/overrides/:eic`

```typescript
const OverrideUpsertSchema = z.object({
  displayName: z.string().min(1).max(256).nullable().optional(),
  type: z.enum(['ENDPOINT', 'COMPONENT_DIRECTORY', 'BROKER', 'BA']).nullable().optional(),
  organization: z.string().max(256).nullable().optional(),
  country: z.string().length(2).nullable().optional(),  // ISO 3166-1 alpha-2
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  tagsCsv: z.string().max(512).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
}).strict();
```

**Sémantique** :
- Tous les champs sont optionnels ET nullable.
- `null` explicite = efface la surcharge pour ce champ (fallback cascade).
- Absent du body = inchangé.
- Si tous les champs sont `null` après upsert → l'override row devient inutile, on pourrait la supprimer automatiquement. **Simplification** : on la garde telle quelle (row vide) pour éviter la double sémantique. L'admin peut explicitement `DELETE` s'il veut le retirer complètement.

**Service** :
```typescript
async upsertOverride(eic: string, patch: OverrideUpsertInput): Promise<ComponentOverride> {
  return this.prisma.componentOverride.upsert({
    where: { eic },
    create: { eic, ...patch },
    update: { ...patch },
  });
}
```

**Réponse** : `ComponentOverride` mis à jour (shape Prisma avec updatedAt fraîchi).

---

## §D — Endpoint `DELETE /api/overrides/:eic`

Supprime simplement la ligne :

```typescript
async deleteOverride(eic: string): Promise<void> {
  const existing = await this.prisma.componentOverride.findUnique({ where: { eic } });
  if (!existing) {
    throw new NotFoundException({ code: 'OVERRIDE_NOT_FOUND', message: `Override for EIC ${eic} not found` });
  }
  await this.prisma.componentOverride.delete({ where: { eic } });
}
```

Le graph recalcule sans l'override au prochain fetch (compute-on-read).

---

## §E — `ComponentsAdminTable` (frontend)

### Colonnes

| Colonne | Source | Description |
|---|---|---|
| **EIC** | `eic` | monospace |
| **Nom** | `current.displayName` | affichage après cascade |
| **Type** | `current.type` | badge coloré (ENDPOINT/CD/BROKER/BA) |
| **Organisation** | `current.organization` | — |
| **Pays** | `current.country` | — |
| **Coord** | `current.lat`/`lng` | `48.85, 2.35` ou `⚠ défaut` si isDefaultPosition |
| **Imports** | `importsCount` | badge "présent dans N imports" |
| **Surchargé** | `override !== null` | 🏷 si override existe |
| **Action** | — | bouton 🖊 Éditer |

### Filtres

- Input texte : search sur `eic`, `current.displayName`, `current.organization`, `current.country`
- Checkbox : "Seulement surchargés" → filtre `override !== null`

### Sélection

Click sur une ligne OU bouton 🖊 → ouvre `ComponentOverrideModal` avec l'EIC + row courante.

---

## §F — `ComponentOverrideModal`

Props : `{ row: AdminComponentRow, onClose: () => void, onSaved: () => void }`

### Layout

```
╔════════════════════════════════════════════╗
║ Surcharge pour 10XAT-APG------Z           ║
║                                            ║
║ Valeurs actuelles affichées en placeholder ║
║ (grisées). Remplir un champ crée/met à     ║
║ jour l'override niveau 1.                  ║
║                                            ║
║ ┌──────────────────────────────────────┐   ║
║ │ Nom affiché                          │   ║
║ │ [input]   placeholder: "APG" (reg.)  │   ║
║ │                                      │   ║
║ │ Type                                 │   ║
║ │ [select: — / ENDPOINT / CD / BROKER] │   ║
║ │                                      │   ║
║ │ Organisation                         │   ║
║ │ [input]   placeholder: "APG AT" (reg.)│  ║
║ │                                      │   ║
║ │ Pays (ISO-2)                         │   ║
║ │ [input 2 chars]   placeholder: "AT"  │   ║
║ │                                      │   ║
║ │ Latitude                             │   ║
║ │ [input number] placeholder: "48.2"   │   ║
║ │                                      │   ║
║ │ Longitude                            │   ║
║ │ [input number] placeholder: "16.4"   │   ║
║ │                                      │   ║
║ │ Tags (CSV)                           │   ║
║ │ [input]                              │   ║
║ │                                      │   ║
║ │ Notes                                │   ║
║ │ [textarea 3 rows]                    │   ║
║ └──────────────────────────────────────┘   ║
║                                            ║
║ [Retirer surcharge]  [Annuler] [Enregistrer]║
╚════════════════════════════════════════════╝
```

### Sémantique du formulaire

- **Placeholders** : affichent la valeur courante de la cascade (ce qui s'afficherait sans override).
- **Input rempli** + submit → override de ce champ.
- **Input vidé** + submit → null explicite pour ce champ dans l'override (fallback cascade pour ce champ seul).
- **Pre-fill** : si un override existe, les inputs sont pré-remplis avec les valeurs de l'override (pas du cascade). Un champ override null = input vide avec placeholder du cascade.

### Actions

- **Annuler** : ferme sans sauvegarder
- **Enregistrer** : PUT /api/overrides/:eic avec seulement les champs modifiés (pas les champs inchangés). Ferme la modale. Déclenche un reload de la table.
- **Retirer surcharge** : DELETE /api/overrides/:eic. Visible uniquement si override existe. Confirmation inline via `window.confirm`. Déclenche un reload.

---

## §G — Types shared

Ajout dans `packages/shared/src/graph.ts` :

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

---

## §H — Tests

### Backend (unit + intégration, ~12 tests)

- `overrides.service.spec.ts` : 4 cas upsert (create, update, null-explicit clears field, partial), 2 cas delete (happy + not found), 3 cas `listAdminComponents` (empty DB, with imports, with overrides merged in cascade)
- `overrides.controller.spec.ts` : 3 cas (upsert happy, reject invalid country length, reject unknown extra field)

### Frontend (unit, ~8 tests)

- `ComponentsAdminTable.test.tsx` : render rows, filter search, filter "seulement surchargés", click row → modal opens (4 tests)
- `ComponentOverrideModal.test.tsx` : render placeholders, submit only modified fields, delete override flow (3 tests)
- `api.test.ts` ou directement via les tests components (1 smoke test for upsert call)

---

## §I — DoD

- [ ] 3 endpoints backend fonctionnels (GET/PUT/DELETE)
- [ ] OverridesService avec méthodes upsert, delete, listAdminComponents
- [ ] Type `AdminComponentRow` + `OverrideUpsertInput` dans shared
- [ ] API client web étendu (3 méthodes)
- [ ] `AdminTabs` : onglet Composants passe à `enabled: true`
- [ ] `ComponentsAdminTable` + `ComponentOverrideModal` livrés
- [ ] ~20 tests backend+frontend PASS
- [ ] typecheck api + web + shared PASS
- [ ] Smoke manuel OU automatisé via curl : PUT + GET + DELETE retournent les statuts attendus
- [ ] CHANGELOG v2.0-alpha.5 rédigé
- [ ] ADR-036 rédigé (PUT upsert vs POST+PATCH)

---

## §J — ADR-036

**Titre** : "Endpoint upsert `PUT /api/overrides/:eic` (vs POST+PATCH)"

**Contexte** : les `ComponentOverride` sont keyés par `eic` (pas d'id uuid auto-généré). Deux styles API possibles.

**Options** :
- A — `PUT /api/overrides/:eic` upsert (retenue) : simplicité 1 endpoint, cohérent avec le fait que l'EIC est la PK stable
- B — `POST /api/overrides` create + `PATCH /api/overrides/:eic` update : plus "RESTful canonical" mais double endpoint + erreur 409 à gérer côté client
- C — `POST /api/overrides/:eic/upsert` : hybride, moins clean que A

**Décision** : A. `PUT` est sémantiquement approprié (idempotent, ressource identifiée par l'URL). Le client envoie l'état souhaité pour un EIC donné.
