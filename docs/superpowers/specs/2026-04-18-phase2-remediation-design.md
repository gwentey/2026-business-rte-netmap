# Phase 2 Remédiation — Design

| Champ              | Valeur                                              |
|--------------------|-----------------------------------------------------|
| Date               | 2026-04-18                                          |
| Auteur             | Claude Opus 4.7 (1M context) + revue humaine        |
| Source             | `docs/retro/plan-remediation.md` — Phase 2          |
| Portée             | 8 actions tests & robustesse (P2-1 à P2-8)          |
| Branche cible      | `feat/phase2-remediation` depuis `feature/slice-1`  |
| Livraison          | 1 PR, 9 commits conventional                        |
| Prérequis          | Phase 1 mergée (commit `4f8ae25` sur `feature/slice-1`) |

---

## 1. Objectif et contexte

La Phase 2 du plan de remédiation se concentre sur la stabilisation des tests et la correction de comportements ciblés. Cinq features du périmètre slice #1 sont actuellement sans test unitaire (api/snapshots, web/upload, web/map, web/detail-panel, web/snapshot-selector), et deux comportements fins méritent correction (bascule au boot sur snapshot persisté invalide, warnings CSV parsing non exposés à l'utilisateur).

Ce spec couvre l'ensemble des 8 items de Phase 2 en un seul livrable cohérent :

- **P2-1** Tests `SnapshotsController` (supertest) + `SnapshotsService` (unit mock Prisma) — dette M4, m3
- **P2-2** Test unitaire `SnapshotPersisterService` avec mock Prisma + mock `fs/promises` — dette m1
- **P2-3** Test intégration `GET /api/snapshots/:id/graph` sur DB réelle — dette m2
- **P2-4** Tests React `UploadPage` — dette M4
- **P2-5** Tests React `NodeDetails` + `EdgeDetails` — dette M4
- **P2-6** Tests React `SnapshotSelector` — dette M4
- **P2-7** Fix bascule automatique sur `list[0]` quand `activeSnapshotId` persisté est invalide — dette m4
- **P2-8** Exposer un warning structuré `CSV_PARSE_ERROR` au lieu du seul `logger.warn` serveur — dette m7

---

## 2. Décisions clés validées en brainstorming

| Décision | Valeur retenue | Alternatives écartées |
|----------|----------------|-----------------------|
| Environnement de test React | `happy-dom` + `@testing-library/react` | jsdom (plus lent) ; Playwright component testing (dépassement de scope) |
| Stratégie de test `SnapshotPersisterService` | Mock total Prisma + mock `fs/promises` | Prisma réel + mock fs ; Prisma + fs réels |
| Stratégie de test `SnapshotsController` | supertest HTTP (exerce interceptor + DTO + service) | Unit pur (rate le FileInterceptor) ; hybride |
| Plumbing du warning `CSV_PARSE_ERROR` | Tag de résultat : `readRaw` retourne `{ rows, parseError }`, param `warnings: Warning[]` sur les méthodes publiques | Service stateful ; throw exception ; global state |

---

## 3. Architecture — empreinte des modifications

### 3.1. Fichiers créés

| Fichier | Rôle |
|---------|------|
| `apps/web/src/test-setup.ts` | Setup Vitest DOM : import `@testing-library/jest-dom/vitest` |
| `apps/api/src/snapshots/snapshots.controller.spec.ts` | Tests supertest HTTP du controller (5 cas) |
| `apps/api/src/snapshots/snapshots.service.spec.ts` | Tests unit mock Prisma du service (5 cas) |
| `apps/api/src/ingestion/snapshot-persister.service.spec.ts` | Tests unit mock Prisma + fs (3 cas) |
| `apps/api/test/graph-endpoint.spec.ts` | Test intégration supertest GET /graph (4 cas) |
| `apps/web/src/pages/UploadPage.test.tsx` | Tests composant React (5 cas) |
| `apps/web/src/components/DetailPanel/NodeDetails.test.tsx` | Tests composant présentationnel (4 cas) |
| `apps/web/src/components/DetailPanel/EdgeDetails.test.tsx` | Tests composant présentationnel (4 cas) |
| `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx` | Tests composant avec mock Zustand (3 cas) |

### 3.2. Fichiers modifiés

| Fichier | Changement |
|---------|------------|
| `apps/web/package.json` | Ajout 4 devDeps : `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `happy-dom` |
| `apps/web/vitest.config.ts` | `test.environment: 'happy-dom'` + `test.setupFiles: ['./src/test-setup.ts']` |
| `apps/web/src/store/app-store.ts` | Fix P2-7 : `loadSnapshots` bascule sur `list[0]` si `activeSnapshotId` persisté absent de la liste |
| `apps/api/src/ingestion/csv-reader.service.ts` | P2-8 : `readRaw` retourne `{ rows, parseError }` ; 4 méthodes publiques acceptent `warnings: Warning[]` param |
| `apps/api/src/ingestion/csv-reader.service.spec.ts` | P2-8 : ajout 1 cas `pushes CSV_PARSE_ERROR warning when CSV is malformed`, mise à jour des signatures dans les tests existants |
| `apps/api/src/ingestion/ingestion.service.ts` | P2-8 : construit `extractionWarnings: Warning[]` local, passe aux 4 `csvReader.read*`, fusionne dans `networkSnapshot.warnings` |
| `packages/shared/src/types.ts` (éventuel) | P2-8 : ajout `'CSV_PARSE_ERROR'` à `WarningCode` si union stricte (à vérifier lors de l'implémentation) |

### 3.3. Principes transverses

- Aucun changement fonctionnel visible côté utilisateur final en dehors de P2-7 (bascule boot) et P2-8 (warning API exposé)
- Tous les tests respectent le pattern existant du projet (NestJS `Test.createTestingModule`, supertest, Vitest)
- Les tests React utilisent des **imports explicites** de `vitest` (pas `globals: true`), cohérent avec le pattern api
- `noUncheckedIndexedAccess: true` du `tsconfig.base.json` impose : utiliser `array[i]!` ou guards dans les tests

### 3.4. Hors scope explicite

- Pas de tests d'intégration supplémentaires au-delà de P2-3
- Pas de refonte du pipeline d'ingestion
- Pas de tests e2e Playwright ajoutés
- Pas de couverture code (c-v8 / istanbul)
- Pas de refacto `SnapshotPersister.STORAGE_DIR` en env var (hors scope P2-2)
- Pas de test unit dédié pour `app-store.ts` (P2-7 est implicitement couvert par e2e + tests composants)

---

## 4. Détails par item

### 4.1. Setup Vitest DOM (commit 1, prérequis P2-4/5/6)

**Dépendances ajoutées** (`apps/web` devDependencies) :

- `@testing-library/react@^16`
- `@testing-library/jest-dom@^6`
- `@testing-library/user-event@^14`
- `happy-dom@^15`

**Config `apps/web/vitest.config.ts`** (version finale) :

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    passWithNoTests: true,
  },
});
```

**Nouveau `apps/web/src/test-setup.ts`** :

```ts
import '@testing-library/jest-dom/vitest';
```

### 4.2. P2-1a — `SnapshotsController` via supertest

**Fichier** : `apps/api/src/snapshots/snapshots.controller.spec.ts`

Pattern : `Test.createTestingModule` avec `AppModule` complet, `app.init()`, `supertest(app.getHttpServer())`. Nettoyage `beforeAll` pour isoler des autres tests.

**Cas testés** (5) :

- `POST /api/snapshots` sans fichier → 400 `INVALID_UPLOAD` message « Fichier zip manquant »
- `POST` fichier `image/png` (MIME invalide) → 400 `INVALID_UPLOAD` + `context.mimetype`
- `POST` fichier `application/zip` mais bytes `FF FF FF FF` → 400 `INVALID_UPLOAD` « Signature ZIP invalide »
- `POST` zip valide + body `label=""` → 400 `INVALID_UPLOAD` + `context.issues` Zod
- `POST` zip valide (mini-zip fabriqué avec `adm-zip` : `application_property.csv` + `component_directory.csv` minimaux) → 201 + `SnapshotDetail`

### 4.3. P2-1b — `SnapshotsService` unit pur

**Fichier** : `apps/api/src/snapshots/snapshots.service.spec.ts`

Mock `PrismaService` avec `vi.fn()` sur `snapshot.findMany` + `snapshot.findUnique`. Instanciation directe `new SnapshotsService(prismaMock as unknown as PrismaService)`.

**Cas testés** (5) :

- `list()` sans filtre → `findMany({ where: undefined, orderBy: { uploadedAt: 'desc' } })`
- `list('OPF')` → `findMany({ where: { envName: 'OPF' }, orderBy: { uploadedAt: 'desc' } })`
- `list()` mappe correctement `warningsJson` en `warningCount`
- `detail(id)` trouvé → retourne `SnapshotDetail` avec `stats.componentsCount` depuis `_count`
- `detail('bogus')` introuvable → throw `SnapshotNotFoundException`

### 4.4. P2-2 — `SnapshotPersisterService` unit mock

**Fichier** : `apps/api/src/ingestion/snapshot-persister.service.spec.ts`

Mock complet :

```ts
vi.mock('node:fs/promises');
// PrismaService mocké : $transaction accepte un callback, exécute avec un `tx` mocké lui-même
```

Helper `buildMinimalNetworkSnapshot()` en tête de fichier pour un `NetworkSnapshot` stub (1 composant, 0 path, 0 stat, 0 appProp).

**Cas testés** (3) :

- **Nominal** : `persist` réussit → `mkdir` + `writeFile` appelés avant la transaction, `$transaction` appelée, pas d'`unlink`, résultat contient `snapshotId`, `componentType`, `warnings`
- **Échec transaction** : `$transaction` rejette → `unlink(zipPath)` appelé (cleanup), erreur re-thrown telle quelle
- **Échec cleanup** : `$transaction` rejette + `unlink` rejette → `logger.warn` appelé avec `Failed to cleanup orphaned zip`, erreur de `$transaction` re-thrown (pas l'erreur d'unlink)

### 4.5. P2-3 — Test intégration `GET /api/snapshots/:id/graph`

**Fichier** : `apps/api/test/graph-endpoint.spec.ts` (**dans `test/`**, cohérent avec les full-pipeline tests)

Pattern : `Test.createTestingModule` avec `AppModule` complet + vraie DB (dev.db). `beforeAll` : ingestion d'une fixture Endpoint pour avoir un snapshot de référence. Nettoyage préalable des snapshots précédents avec `sourceComponentCode` matchant la fixture (isolation inter-fichiers).

**Cas testés** (4) :

- `GET /api/snapshots/:id/graph` sur snapshot réel → 200 + body conforme à `GraphResponse`
- Le body contient ≥ 1 node et ≥ 1 edge après ingestion du backup
- Les edges contiennent `fromEic`, `toEic`, `process`, `direction` typés
- `GET /api/snapshots/bogus-id/graph` → 404 `SNAPSHOT_NOT_FOUND`

### 4.6. P2-4 — Tests `UploadPage`

**Fichier** : `apps/web/src/pages/UploadPage.test.tsx`

**Mocks** :

- `../lib/api.js` : `uploadSnapshot` + `listSnapshots` via `vi.fn()`
- `react-router-dom` : mock partiel de `useNavigate` (retourne `vi.fn()`)
- `react-dropzone` : contourné en manipulant directement l'`<input type="file">` sous-jacent via `fireEvent.change` ou `user.upload()`

**Cas testés** (6) :

- Render initial : formulaire vide, bouton « Envoyer » disabled
- Drop fichier + remplir label + envName → bouton actif, `uploadSnapshot` appelé au clic avec `{ file, label, envName }`
- État loading : promesse non résolue → bouton affiche « Envoi... », input disabled
- Succès : promesse résolue → affichage détail + bouton « Voir sur la carte »
- Erreur API : `uploadSnapshot.mockRejectedValue` → message d'erreur rendu avec le message de l'API
- Warnings : `result.warnings.length > 0` → section warnings rendue avec le count

### 4.7. P2-5 — Tests `NodeDetails` + `EdgeDetails`

Composants présentationnels purs (props in, JSX out), aucun mock store/api nécessaire.

**`NodeDetails.test.tsx`** (4 cas) :

- Render complet : EIC, displayName, country, organization, lat/lng, process, urls
- Champ null (ex. `email: null`) → ligne omise ou affichée « — »
- `isDefaultPosition: true` → badge « position par défaut » visible
- Tableau `urls` vide → section URLs non rendue ou vide

**`EdgeDetails.test.tsx`** (4 cas) :

- Render : fromEic, toEic, process, direction, messageType, `lastMessageUp` formatée
- `lastMessageUp: null` → « — » ou « jamais »
- Date formatée en `fr-FR` (à vérifier au moment de l'implémentation par lecture du composant)
- `isRecent: true` → indicateur visuel / classe distincte

### 4.8. P2-6 — Tests `SnapshotSelector`

**Fichier** : `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx`

**Mock Zustand** :

```ts
vi.mock('../../store/app-store.js', () => ({
  useAppStore: vi.fn(),
}));
```

Dans chaque test : `vi.mocked(useAppStore).mockReturnValue({ snapshots, activeSnapshotId, setActiveSnapshot })`.

**Cas testés** (3) :

- Liste vide : pas de `<select>`, affichage CTA / lien vers `/upload`
- Liste non vide : `<select>` avec N `<option>`, l'option `value === activeSnapshotId` marquée `selected`
- onChange : sélection d'une autre option → `setActiveSnapshot(newId)` appelé

### 4.9. P2-7 — Fix `activeSnapshotId` persisté invalide

**Fichier** : `apps/web/src/store/app-store.ts` lignes 32-44

**Avant** (bug actuel : si id persisté plus dans la liste, rien ne se passe, le graphe ne charge pas) :

```ts
loadSnapshots: async () => {
  set({ loading: true, error: null });
  try {
    const list = await api.listSnapshots();
    set({ snapshots: list, loading: false });
    const id = get().activeSnapshotId;
    if (!id && list.length > 0) {
      await get().setActiveSnapshot(list[0]!.id);
    }
  } catch (err) {
    set({ loading: false, error: (err as Error).message });
  }
},
```

**Après** :

```ts
loadSnapshots: async () => {
  set({ loading: true, error: null });
  try {
    const list = await api.listSnapshots();
    set({ snapshots: list, loading: false });
    const id = get().activeSnapshotId;
    const persistedStillValid = id !== null && list.some((s) => s.id === id);

    if (persistedStillValid) {
      await get().setActiveSnapshot(id);
    } else if (list.length > 0) {
      await get().setActiveSnapshot(list[0]!.id);
    }
  } catch (err) {
    set({ loading: false, error: (err as Error).message });
  }
},
```

**Effets** :

- `id` persisté + toujours dans la liste → on charge son graphe (fix bonus : avant, le graphe n'était chargé que si id absent)
- `id` persisté + plus dans la liste → bascule sur `list[0]` (le fix principal du plan)
- `id` null + liste non vide → bascule sur `list[0]` (comportement existant conservé)
- Liste vide → aucun changement (pas de graphe, conservé)

### 4.10. P2-8 — Warning `CSV_PARSE_ERROR` structuré

**Fichier** : `apps/api/src/ingestion/csv-reader.service.ts`

**Changement de `readRaw`** :

```ts
private readRaw(
  buffer: Buffer,
  fileName: string,
): { rows: RawRow[]; parseError: string | null } {
  try {
    const rows = parseCsv(buffer.toString('utf-8'), {
      columns: true,
      delimiter: ';',
      skip_empty_lines: true,
      trim: true,
      quote: '"',
      relax_quotes: true,
      relax_column_count: false,
    }) as RawRow[];
    return { rows, parseError: null };
  } catch (err) {
    const message = (err as Error).message;
    this.logger.warn(`CSV parse error (${fileName}): ${message}`);
    return { rows: [], parseError: message };
  }
}
```

**Changement des 4 méthodes publiques** (pattern identique) :

```ts
readMessagePaths(buffer: Buffer, warnings: Warning[]): MessagePathRow[] {
  const { rows, parseError } = this.readRaw(buffer, 'message_path.csv');
  if (parseError !== null) {
    warnings.push({
      code: 'CSV_PARSE_ERROR',
      message: `message_path.csv : ${parseError}`,
      context: { fileName: 'message_path.csv' },
    });
  }
  return rows.map(...);
}
```

Appliqué identiquement à `readApplicationProperties`, `readComponentDirectory`, `readMessagingStatistics` avec le fileName approprié.

**Changement de `IngestionService.ingest`** :

```ts
const extractionWarnings: Warning[] = [];

const appProperties = this.csvReader.readApplicationProperties(
  extracted.files.get('application_property.csv')!,
  extractionWarnings,
);
const componentDirectoryRows = this.csvReader.readComponentDirectory(
  extracted.files.get('component_directory.csv')!,
  extractionWarnings,
);
// ... idem pour messagePaths et messagingStats (optionnels)

const networkSnapshot = this.builder.build({ ... });
networkSnapshot.warnings.push(...extractionWarnings);
```

**Vérification à l'implémentation** : si `WarningCode` dans `packages/shared/src/types.ts` est une union stricte, ajouter `'CSV_PARSE_ERROR'` à cette union.

**Nouveau test dans `csv-reader.service.spec.ts`** :

```ts
it('pushes CSV_PARSE_ERROR warning when CSV is malformed', () => {
  const malformed = Buffer.from('header1;header2\nonly-one-col\n');
  const warnings: Warning[] = [];
  const rows = service.readMessagePaths(malformed, warnings);
  expect(rows).toEqual([]);
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({
    code: 'CSV_PARSE_ERROR',
    context: { fileName: 'message_path.csv' },
  });
});
```

**Mise à jour des specs existants** : les appels `service.readMessagePaths(buf)` dans `csv-reader.service.spec.ts` doivent recevoir un `warnings: Warning[] = []` en second argument.

---

## 5. Critères de succès globaux

Tous doivent être vrais avant merge :

1. `pnpm install` passe sans warning de peer deps
2. `pnpm lint` à la racine retourne exit 0 (scope couvre les 9 nouveaux fichiers de test)
3. `pnpm typecheck` à la racine retourne exit 0
4. `pnpm test` à la racine retourne exit 0, incluant :
   - 61 tests api existants (inchangés)
   - +17 nouveaux cas api (P2-1 = 10, P2-2 = 3, P2-3 = 4)
   - +1 nouveau cas dans csv-reader.service.spec.ts (P2-8)
   - +17 nouveaux cas web (P2-4 = 6, P2-5 = 8, P2-6 = 3)
   - 2 tests web existants inchangés (process-colors.sync)
   - Total ~98 tests verts
5. `pnpm test:e2e` continue à passer (3 smokes Playwright inchangés)
6. Vérification manuelle P2-7 : 
   - Upload snapshot A, supprimer la DB (`rm apps/api/prisma/dev.db && pnpm prisma:migrate`), recharger l'UI → bascule silencieuse sur snapshot absent → doit charger `list[0]` ou rien si liste vide, sans erreur silencieuse
7. Vérification manuelle P2-8 : uploader un zip avec `message_path.csv` tronqué (1 colonne au lieu de 9) → réponse API contient `warnings: [{ code: 'CSV_PARSE_ERROR', ... }]`

---

## 6. Stratégie de commits

9 commits conventional dans un seul PR, ordre imposé :

```
feat(tooling): setup Vitest DOM environnement happy-dom + testing-library
test(api/snapshots): controller rejet upload + service list/detail (P2-1)
test(api/ingestion): persister nominal + échec transaction + échec cleanup (P2-2)
test(api/graph): intégration GET /snapshots/:id/graph sur fixtures (P2-3)
test(web/upload): UploadPage submission + loading + erreur + warnings (P2-4)
test(web/detail-panel): NodeDetails + EdgeDetails rendu null + dates + badge (P2-5)
test(web/snapshot-selector): liste vide / non vide / onChange (P2-6)
fix(web/store): bascule activeSnapshotId invalide vers list[0] au boot (P2-7)
feat(api/ingestion): warning structuré CSV_PARSE_ERROR exposé dans snapshot.warnings (P2-8)
```

Le commit **setup** est posé en premier car les commits 5, 6, 7 dépendent de la config Vitest DOM. L'ordre backend-avant-frontend n'est pas strict au-delà du setup.

Chaque commit termine par :

```
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```

---

## 7. Décisions écartées (avec raisons)

| Décision écartée | Raison |
|------------------|--------|
| jsdom à la place de happy-dom | Plus lent (3-5×), pas de besoin canvas / CSS avancé |
| Playwright component testing | Dépassement de scope, duplicate tooling avec e2e |
| Prisma réel pour `SnapshotPersister` | Difficile d'injecter échec de transaction, redondant avec full-pipeline tests |
| `SnapshotsController` en unit pur | N'exerce pas le `FileInterceptor` — le test MIME serait factice |
| `CsvReaderService` stateful | Footgun en singleton Nest si concurrence, non idiomatique |
| Throw `CsvParseException` pour P2-8 | Conflit sémantique : warning = continue, exception = interrompre |
| Couverture code (c8 / istanbul) | Hors scope Phase 2 |
| Tests Playwright supplémentaires | Plan explicite : 8 items unitaires, zéro e2e ajouté |
| Test unit dédié pour `app-store.ts` | Couvert implicitement par e2e + tests composants |
| Refacto `STORAGE_DIR` en env var | Hors scope P2-2, mock fs contourne le besoin |

---

## 8. ADR proposé

Conformément à la règle 5 de `.claude/rules/00-global.md`, un ADR sera rédigé **en fin d'implémentation** (via hook Stop → `update-writer-after-implement`), pas en amont :

- **ADR-021 — React testing stack : @testing-library/react + happy-dom**
  - Statut : acceptée
  - Contexte : aucun test unit React dans slice #1 ; Phase 2 en introduit plusieurs ; besoin d'un environnement DOM rapide
  - Décision : `@testing-library/react` + `happy-dom`, pas de globals Vitest (imports explicites), setup file minimal
  - Conséquences : toute future spec React suit ce pattern ; migration vers jsdom différée jusqu'à ce qu'on teste Leaflet / canvas
  - Alternatives écartées : jsdom (plus lent), Playwright CT (dépassement de scope), globals Vitest (friction ESLint)

Les 7 autres items ne portent aucune décision architecturale nouvelle (application de patterns existants).

---

## 9. Prochaines étapes

1. Validation de ce spec par le dev responsable
2. Invocation du skill `superpowers:writing-plans` pour produire le plan d'implémentation détaillé
3. Exécution du plan sur branche `feat/phase2-remediation`
4. Revue humaine de la PR
5. Merge vers `feature/slice-1` (puis plus tard `feature/slice-1` → `main` en une fois)
6. Lancement éventuel du spec Phase 3 (améliorations continues — 7 actions P3-1 à P3-8 sauf P3-6 déféré)
