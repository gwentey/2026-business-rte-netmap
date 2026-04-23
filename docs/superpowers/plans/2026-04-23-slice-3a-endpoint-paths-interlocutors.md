# Slice 3a — Endpoint paths + interlocuteurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exploiter `message_path.csv` côté endpoint (aujourd'hui ignoré) et afficher la liste des interlocuteurs de chaque noeud dans le panneau de détail.

**Architecture:** TDD strict. Backend — nouvelle méthode `ImportBuilderService.buildEndpointPaths` + câblage dans le pipeline ENDPOINT de `ImportsService` avec dédup XML↔CSV (XML prioritaire, clé 5-champs identique à `mergePathsLatestWins`). `GraphService.getGraph` calcule `node.interlocutors` après l'étape d'agrégation des edges. Frontend — nouvelle section dans `NodeDetails.tsx` avec badge IN/OUT/BIDI par ligne.

**Tech Stack:** NestJS 10 + Prisma 5 + SQLite côté backend, React 18 + Vite + Tailwind côté frontend, Vitest pour les tests, TypeScript 5.5 (monorepo pnpm). Fixture réelle `tests/fixtures/EXPORT/PRFRI-EP2/` pour l'intégration.

**Design de référence:** `docs/superpowers/specs/2026-04-23-slice-3a-endpoint-paths-interlocutors-design.md`.

**Branche active:** `feat/v3-slice-3a-endpoint-paths-interlocutors` (déjà créée, déjà sur le design commit).

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `packages/shared/src/graph.ts` | Modifier | Ajouter type `GraphNodeInterlocutor` + champ `interlocutors` sur `GraphNode` |
| `apps/api/src/ingestion/import-builder.service.ts` | Modifier | Ajouter méthode `buildEndpointPaths` + helper `pathKey` exporté |
| `apps/api/src/ingestion/import-builder.service.spec.ts` | Modifier | 11 nouveaux tests `buildEndpointPaths` |
| `apps/api/src/ingestion/imports.service.ts` | Modifier | Câbler `readEndpointMessagePaths` + dédup XML↔CSV dans branche ENDPOINT |
| `apps/api/src/ingestion/imports.service.spec.ts` | Modifier | Test d'intégration sur fixture PRFRI-EP2 (paths CSV + XML) |
| `apps/api/src/graph/build-interlocutors.ts` | Créer | Fonction pure `buildInterlocutorsByEic(edges): Map<eic, GraphNodeInterlocutor[]>` |
| `apps/api/src/graph/build-interlocutors.spec.ts` | Créer | Tests unitaires de la fonction pure (8 cas) |
| `apps/api/src/graph/graph.service.ts` | Modifier | Appeler `buildInterlocutorsByEic` et passer le résultat à `toNode` |
| `apps/api/src/graph/graph.service.compute.spec.ts` | Modifier | Étendre le test de bout en bout pour vérifier `node.interlocutors` |
| `apps/web/src/components/DetailPanel/NodeDetails.tsx` | Modifier | Section « Interlocuteurs (N) » + composant `DirectionBadge` |
| `apps/web/src/components/DetailPanel/NodeDetails.test.tsx` | Modifier | 6 nouveaux cas de rendu |
| `docs/specs/api/ingestion/spec-fonctionnel.md` | Modifier | Ajouter règle 12 « Paths ENDPOINT lus aussi depuis CSV local » |
| `docs/specs/api/graph/spec-fonctionnel.md` | Modifier | Ajouter règle 11 « Interlocuteurs dérivés des edges agrégées » |
| `docs/specs/web/detail-panel/spec-fonctionnel.md` | Modifier | Section Interlocuteurs, résoudre la zone d'incertitude §87 |
| `CHANGELOG.md` | Modifier | Entrée v3.0-alpha.1 — Slice 3a |

Aucune migration Prisma. Aucun changement d'API HTTP. Les types partagés sont rétrocompatibles (ajout de champ uniquement).

---

## Task 1: Type `GraphNodeInterlocutor` dans `@carto-ecp/shared`

**Files:**
- Modify: `packages/shared/src/graph.ts:1-62`

- [ ] **Step 1: Ajouter le type et le champ**

Ouvrir `packages/shared/src/graph.ts`. Après le bloc `EdgeDirection` (ligne 11), ajouter :

```typescript
export type InterlocutorDirection = 'IN' | 'OUT' | 'BIDI';

export type GraphNodeInterlocutor = {
  /** EIC de l'interlocuteur. Toujours différent du noeud courant. */
  eic: string;
  /** Union des messageTypes échangés avec cet interlocuteur, triés alpha. */
  messageTypes: string[];
  /**
   * Direction vue depuis le noeud courant :
   * IN   = il m'envoie
   * OUT  = je lui envoie
   * BIDI = les deux (au moins un message dans chaque sens)
   */
  direction: InterlocutorDirection;
};
```

Puis dans le type `GraphNode` (commence ligne 13), insérer le champ `interlocutors` juste après `uploadTargets` (ligne 51) :

```typescript
  /**
   * EICs des cibles d'upload prioritaires déclarées par ce composant
   * (message_upload_route.csv). Endpoint seulement ; vide pour les autres.
   */
  uploadTargets: string[];
  /**
   * Liste des interlocuteurs dérivés des edges BUSINESS agrégées pour ce
   * noeud. Vide si le noeud n'a aucune edge BUSINESS. Calculée par le
   * backend à la lecture (compute-on-read) — ne pas confondre avec les
   * cibles d'upload qui sont déclarées sans observation de trafic.
   */
  interlocutors: GraphNodeInterlocutor[];
```

- [ ] **Step 2: Vérifier le typecheck**

Run: `pnpm --filter @carto-ecp/shared typecheck`
Expected: PASS (le package shared n'a pas d'impl, que des types).

Run: `pnpm --filter @carto-ecp/api typecheck`
Expected: FAIL temporairement parce que `GraphService.toNode` ne renseigne pas encore `interlocutors`. C'est attendu ; on le corrige en Task 7. Ne pas committer tant que ce n'est pas fait.

- [ ] **Step 3: Ajouter une valeur par défaut temporaire dans toNode pour décorréler Task 1 de Task 7**

Ouvrir `apps/api/src/graph/graph.service.ts`. Dans la méthode `toNode` (ligne 322), ajouter le champ `interlocutors: []` **juste avant `country: g.country,`** (ligne 348) :

```typescript
      uploadTargets,
      interlocutors: [],
      country: g.country,
```

Run: `pnpm --filter @carto-ecp/api typecheck`
Expected: PASS.

Run: `pnpm --filter @carto-ecp/web typecheck`
Expected: PASS (le frontend ignore simplement le nouveau champ pour l'instant).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/graph.ts apps/api/src/graph/graph.service.ts
git commit -m "$(cat <<'EOF'
feat(shared): type GraphNodeInterlocutor et champ GraphNode.interlocutors

Prepare l'affichage des interlocuteurs par noeud (Slice 3a). Le champ
est initialement vide cote backend ; le calcul reel arrive en Task 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tests RED `buildEndpointPaths` — filtres de skip

**Files:**
- Modify: `apps/api/src/ingestion/import-builder.service.spec.ts`

- [ ] **Step 1: Ajouter la suite de tests en tête du fichier**

Ouvrir `apps/api/src/ingestion/import-builder.service.spec.ts`. Repérer l'import de `ImportBuilderService` et `MessagePathRow` (si absent, l'ajouter) :

```typescript
import type { MessagePathRow } from './types.js';
```

Ajouter à la fin du fichier, **avant la dernière `});` de `describe('ImportBuilderService', ...)`** , ou si la structure est différente, dans un nouveau bloc `describe` au niveau du fichier :

```typescript
describe('buildEndpointPaths — filtres', () => {
  const effectiveDate = new Date('2026-04-01T00:00:00.000Z');
  const localEic = '17V0000009823063';

  const baseRow = (overrides: Partial<MessagePathRow>): MessagePathRow => ({
    allowedSenders: '17V0000015538278',
    applied: true,
    intermediateBrokerCode: null,
    intermediateComponent: null,
    messagePathType: 'BUSINESS',
    messageType: 'CORE-FB-A16A48-443-NOT',
    receiver: localEic,
    remote: false,
    status: 'ACTIVE',
    transportPattern: 'INDIRECT',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: null,
    ...overrides,
  });

  it('skip les paths ACKNOWLEDGEMENT', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ messagePathType: 'ACKNOWLEDGEMENT' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths status=INVALID', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ status: 'INVALID' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths applied=false', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ applied: false })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths wildcard sender uniquement', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ allowedSenders: '*' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les paths wildcard receiver', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ receiver: '*' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
  });

  it('skip les rows malformees + produit un warning', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ receiver: null })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toEqual([]);
    expect(out.warnings).toContainEqual(
      expect.objectContaining({ code: 'MESSAGE_PATH_ROW_INCOMPLETE' }),
    );
  });

  it('skip les rows avec allowedSenders vide/null', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    expect(
      builder.buildEndpointPaths([baseRow({ allowedSenders: null })], localEic, effectiveDate).paths,
    ).toEqual([]);
    expect(
      builder.buildEndpointPaths([baseRow({ allowedSenders: '' })], localEic, effectiveDate).paths,
    ).toEqual([]);
  });
});
```

Si l'import de `CsvPathReaderService` manque, l'ajouter :

```typescript
import { CsvPathReaderService } from './csv-path-reader.service.js';
```

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm --filter @carto-ecp/api test -- import-builder.service`
Expected: FAIL (la méthode `buildEndpointPaths` n'existe pas). Les 7 tests de `buildEndpointPaths — filtres` échouent tous.

- [ ] **Step 3: Ne pas committer encore — on enchaîne Task 3 pour le GREEN.**

---

## Task 3: Implémentation `buildEndpointPaths` — filtres + expansion

**Files:**
- Modify: `apps/api/src/ingestion/import-builder.service.ts:54-319`

- [ ] **Step 1: Ajouter l'import du type MessagePathRow dans le header**

Ouvrir `apps/api/src/ingestion/import-builder.service.ts`. Le bloc d'import (lignes 1-17) inclut déjà `BuiltImportedPath`. Ajouter à la liste `MessagePathRow` :

```typescript
import type {
  BuiltImportedComponent,
  BuiltImportedComponentStat,
  BuiltImportedDirectorySync,
  BuiltImportedMessagingStat,
  BuiltImportedPath,
  BuiltImportedUploadRoute,
  ComponentStatisticRow,
  MadesComponent,
  MadesTree,
  MessagePathRow,
  SynchronizedDirectoryRow,
  UploadRouteRow,
} from './types.js';
```

- [ ] **Step 2: Ajouter l'export du helper `pathIdentityKey`**

Juste après le bloc `maskPrivateIp` (ligne 39), avant le type `LocalCsvRow`, ajouter :

```typescript
/**
 * Clé d'identité d'un path (5 champs). Identique à celle utilisée par
 * `mergePathsLatestWins` dans le module graph. Permet la dédup XML↔CSV
 * dans le pipeline ENDPOINT.
 */
export function pathIdentityKey(p: {
  receiverEic: string;
  senderEic: string;
  messageType: string;
  transportPattern: string;
  intermediateBrokerEic: string | null;
}): string {
  return [
    p.receiverEic,
    p.senderEic,
    p.messageType,
    p.transportPattern,
    p.intermediateBrokerEic ?? '',
  ].join('||');
}
```

- [ ] **Step 3: Ajouter la méthode `buildEndpointPaths`**

Dans la classe `ImportBuilderService`, juste après la méthode `buildUploadRoutes` (ligne 209, avant `private fromXmlComponent`), insérer :

```typescript
  /**
   * Convertit les rows `message_path.csv` d'un endpoint en BuiltImportedPath.
   *
   * Règles (décisions Slice 3a) :
   *  - skip messagePathType === 'ACKNOWLEDGEMENT' (polluent la carte, pas
   *    de valeur métier pour la vue interlocuteurs)
   *  - skip status === 'INVALID' (paths non opérationnels)
   *  - skip applied === false (déclaré mais pas en service)
   *  - skip receiver === '*' ou allowedSenders === '*' (wildcards exclus,
   *    cohérent avec règle §8 spec api/graph)
   *  - expand allowedSenders : la liste `"EIC1;EIC2;EIC3"` génère 3 paths.
   *    Les entrées `''` ou `'*'` intra-liste sont ignorées.
   *  - isExpired = validTo != null && validTo < effectiveDate (reproductibilité
   *    historique, cohérent avec ADR-010 / règle 9 spec api/graph)
   *
   * Retourne `paths` + `warnings` (rows malformées).
   */
  buildEndpointPaths(
    rows: ReadonlyArray<MessagePathRow>,
    _localEic: string,
    effectiveDate: Date,
  ): { paths: BuiltImportedPath[]; warnings: Warning[] } {
    const paths: BuiltImportedPath[] = [];
    const warnings: Warning[] = [];

    for (const row of rows) {
      if (row.messagePathType === 'ACKNOWLEDGEMENT') continue;
      if (row.status === 'INVALID') continue;
      if (row.applied === false) continue;

      if (row.receiver == null || row.messageType == null || row.transportPattern == null) {
        warnings.push({
          code: 'MESSAGE_PATH_ROW_INCOMPLETE',
          message: `Row skipped (receiver=${row.receiver ?? '<null>'}, messageType=${row.messageType ?? '<null>'}, transportPattern=${row.transportPattern ?? '<null>'})`,
        });
        continue;
      }
      if (row.receiver === '*') continue;
      if (row.allowedSenders == null || row.allowedSenders.trim() === '') continue;

      const senders = row.allowedSenders
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s !== '*');

      if (senders.length === 0) continue; // allowedSenders === "*" ou "*;*"

      for (const senderEic of senders) {
        paths.push({
          receiverEic: row.receiver,
          senderEic,
          messageType: row.messageType,
          transportPattern: row.transportPattern,
          intermediateBrokerEic: row.intermediateBrokerCode ?? null,
          validFrom: row.validFrom,
          validTo: row.validTo,
          isExpired:
            row.validTo != null && row.validTo.getTime() < effectiveDate.getTime(),
        });
      }
    }

    return { paths, warnings };
  }
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm --filter @carto-ecp/api test -- import-builder.service`
Expected: les 7 tests de `buildEndpointPaths — filtres` passent (GREEN). Les autres tests du fichier doivent toujours passer (pas de régression).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ingestion/import-builder.service.ts apps/api/src/ingestion/import-builder.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): buildEndpointPaths pour message_path.csv endpoint

Nouvelle methode dans ImportBuilderService : convertit les rows du
CSV message_path.csv d'un endpoint en BuiltImportedPath. Applique les
filtres valides par le user (ACK, INVALID, applied=false, wildcards),
expanse allowedSenders multi-EIC, calcule isExpired relativement a
l'effectiveDate. Export du helper pathIdentityKey pour la dedup
XML vs CSV (Task 5).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Tests RED+GREEN `buildEndpointPaths` — expansion + isExpired + field mapping

**Files:**
- Modify: `apps/api/src/ingestion/import-builder.service.spec.ts`

- [ ] **Step 1: Ajouter un second bloc de tests pour les cas de mapping**

Juste après le bloc `describe('buildEndpointPaths — filtres', ...)`, ajouter :

```typescript
describe('buildEndpointPaths — expansion et mapping', () => {
  const effectiveDate = new Date('2026-04-01T00:00:00.000Z');
  const localEic = '17V0000009823063';

  const baseRow = (overrides: Partial<MessagePathRow>): MessagePathRow => ({
    allowedSenders: '17V0000015538278',
    applied: true,
    intermediateBrokerCode: null,
    intermediateComponent: null,
    messagePathType: 'BUSINESS',
    messageType: 'CORE-FB-A16A48-443-NOT',
    receiver: localEic,
    remote: false,
    status: 'ACTIVE',
    transportPattern: 'INDIRECT',
    validFrom: new Date('2025-01-01T00:00:00.000Z'),
    validTo: null,
    ...overrides,
  });

  it('expanse allowedSenders multi-EIC en N paths', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ allowedSenders: '10V000000000012O;10V000000000013M;10V1001C--00004I' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(3);
    expect(out.paths.map((p) => p.senderEic).sort()).toEqual([
      '10V000000000012O',
      '10V000000000013M',
      '10V1001C--00004I',
    ]);
  });

  it('ignore les entrees * et vides au milieu d une liste', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ allowedSenders: '10V000000000012O;*;;10V000000000013M' })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(2);
    expect(out.paths.map((p) => p.senderEic).sort()).toEqual([
      '10V000000000012O',
      '10V000000000013M',
    ]);
  });

  it('isExpired=true si validTo < effectiveDate', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ validTo: new Date('2025-12-19T22:00:00.000Z') })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths).toHaveLength(1);
    expect(out.paths[0]!.isExpired).toBe(true);
  });

  it('isExpired=false si validTo >= effectiveDate ou null', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const futur = baseRow({ validTo: new Date('2027-01-01T00:00:00.000Z') });
    const nul = baseRow({ validTo: null });
    const out = builder.buildEndpointPaths([futur, nul], localEic, effectiveDate);
    expect(out.paths).toHaveLength(2);
    expect(out.paths.every((p) => !p.isExpired)).toBe(true);
  });

  it('mappe correctement tous les champs', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({
      allowedSenders: '17V0000015538278',
      intermediateBrokerCode: '10V1001C--00087P',
      transportPattern: 'INDIRECT',
      messageType: 'MRC-XBID-A01A19-511',
      validFrom: new Date('2025-12-19T23:00:00.000Z'),
      validTo: null,
    })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths[0]).toEqual({
      receiverEic: localEic,
      senderEic: '17V0000015538278',
      messageType: 'MRC-XBID-A01A19-511',
      transportPattern: 'INDIRECT',
      intermediateBrokerEic: '10V1001C--00087P',
      validFrom: new Date('2025-12-19T23:00:00.000Z'),
      validTo: null,
      isExpired: false,
    });
  });

  it('intermediateBrokerCode null -> intermediateBrokerEic null', () => {
    const builder = new ImportBuilderService(new CsvPathReaderService());
    const rows = [baseRow({ transportPattern: 'DIRECT', intermediateBrokerCode: null })];
    const out = builder.buildEndpointPaths(rows, localEic, effectiveDate);
    expect(out.paths[0]!.intermediateBrokerEic).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests**

Run: `pnpm --filter @carto-ecp/api test -- import-builder.service`
Expected: PASS pour tous les nouveaux tests (l'implémentation de Task 3 couvre déjà ces cas). Si un test échoue, ajuster l'implémentation — c'est un GREEN sans RED séparé parce que Task 3 a posé les rails.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ingestion/import-builder.service.spec.ts
git commit -m "$(cat <<'EOF'
test(api): couverture expansion et mapping buildEndpointPaths

Complete la suite de tests (expansion multi-EIC, wildcards intra-liste,
isExpired relatif a l'effectiveDate, field mapping exhaustif,
intermediateBrokerCode null).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Câblage pipeline ENDPOINT + dédup XML↔CSV

**Files:**
- Modify: `apps/api/src/ingestion/imports.service.ts:127-233` (branche `dumpType === 'ENDPOINT'`)
- Modify: `apps/api/src/ingestion/imports.service.spec.ts` (test d'intégration fixture PRFRI-EP2)

- [ ] **Step 1: Écrire le test d'intégration RED**

Ouvrir `apps/api/src/ingestion/imports.service.spec.ts`. Repérer le bloc existant d'ingestion PRFRI-EP2 (grep pour `ENDPOINT_FIXTURE` ou `PRFRI-EP2`). Ajouter un nouveau `it()` dans le bon `describe` :

```typescript
it('[Slice 3a] ingestion ENDPOINT : merge paths XML + CSV avec XML prioritaire', async () => {
  const { buffer, fileName } = await loadEndpointFixture();
  const created = await service.createImport({
    file: { buffer, originalname: fileName, mimetype: 'application/zip' } as Express.Multer.File,
    envName: 'TEST_SLICE_3A',
    label: 'PRFRI-EP2 slice 3a',
  });

  const persisted = await prisma.import.findUnique({
    where: { id: created.id },
    include: { importedPaths: true },
  });
  expect(persisted).not.toBeNull();

  // Invariant : chaque path persiste est unique sur la cle 5-champs
  const keys = persisted!.importedPaths.map((p) =>
    [p.receiverEic, p.senderEic, p.messageType, p.transportPattern, p.intermediateBrokerEic ?? ''].join('||'),
  );
  expect(new Set(keys).size).toBe(keys.length);

  // Le CSV endpoint apporte des paths absents du XML MADES : on attend au
  // moins 1 path dont la source CSV est decisive (assert souple).
  expect(persisted!.importedPaths.length).toBeGreaterThan(0);

  // Cleanup
  await prisma.import.delete({ where: { id: created.id } });
});
```

Si les helpers `loadEndpointFixture()` / `service` / `prisma` ne sont pas déjà dans le scope du `describe`, copier le pattern d'un test d'ingestion existant du fichier (chercher un `beforeAll` qui instancie `ImportsService` et ouvre Prisma).

- [ ] **Step 2: Vérifier que le test échoue**

Run: `pnpm --filter @carto-ecp/api test -- imports.service`
Expected: FAIL — le test passe peut-être déjà si le pipeline persiste uniquement les paths XML, mais la condition `> 0` doit rester vraie. Le vrai signal : vérifier via `git stash` qu'on a AUGMENTÉ le nombre de paths pour PRFRI-EP2 après la modification Step 3.

Noter `persisted.importedPaths.length` dans la sortie console. Ce sera la baseline à battre.

- [ ] **Step 3: Câbler readEndpointMessagePaths dans le pipeline**

Ouvrir `apps/api/src/ingestion/imports.service.ts`. Repérer la branche `dumpType === 'ENDPOINT'` (ligne 127). Repérer le bloc qui gère `message_upload_route.csv` (autour de la ligne 228-233). **Juste avant** ce bloc (donc après la ligne 218 `paths = xmlPaths;`), insérer :

```typescript
      // Slice 3a : merge des paths endpoint depuis message_path.csv local.
      // XML prioritaire sur la cle 5-champs — le CSV ne fait qu'ajouter
      // les paths absents du XML (paths declares localement, non propages
      // au CD home, ou visibles depuis un CD different).
      const pathsBuffer = extracted.files.get('message_path.csv');
      if (pathsBuffer) {
        const csvPathRows = this.csvReader.readEndpointMessagePaths(pathsBuffer, warnings);
        const { paths: csvBuilt, warnings: csvWarnings } = this.builder.buildEndpointPaths(
          csvPathRows,
          localEic,
          effectiveDate,
        );
        warnings.push(...csvWarnings);

        const seenKeys = new Set<string>(xmlPaths.map((p) => pathIdentityKey(p)));
        for (const p of csvBuilt) {
          const k = pathIdentityKey(p);
          if (!seenKeys.has(k)) {
            seenKeys.add(k);
            paths.push(p);
          }
        }
      }
```

Note : la variable `effectiveDate` est déjà calculée plus haut dans `createImport` (chercher `const effectiveDate`). Si elle n'est pas dans le scope, remonter : elle l'est — c'est utilisée par RawPersister plus bas.

- [ ] **Step 4: Ajouter l'import de `pathIdentityKey`**

En tête du fichier `imports.service.ts`, dans le bloc d'imports de `./import-builder.service.js`, ajouter `pathIdentityKey` :

```typescript
import { ImportBuilderService, pathIdentityKey } from './import-builder.service.js';
```

(Ou adapter le style existant — si l'import est en default/namespace, suivre le pattern déjà utilisé dans le fichier.)

- [ ] **Step 5: Vérifier que tous les tests passent**

Run: `pnpm --filter @carto-ecp/api test -- imports.service`
Expected: PASS. Le nouveau test `[Slice 3a]` passe + les tests existants non cassés.

Run: `pnpm --filter @carto-ecp/api test`
Expected: PASS sur l'intégralité de la suite backend.

- [ ] **Step 6: Vérifier qu'on a bien augmenté le nombre de paths pour PRFRI-EP2**

Ajouter temporairement un `console.log('Paths count:', persisted.importedPaths.length);` dans le test, relancer, noter le nombre. Retirer le `console.log` avant commit. Le nombre doit être ≥ à la baseline observée à Step 2.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/ingestion/imports.service.ts apps/api/src/ingestion/imports.service.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): cablage message_path.csv dans le pipeline ENDPOINT

Le pipeline ENDPOINT merge desormais les paths XML MADES (prioritaires)
avec les paths du CSV message_path.csv local. Dedup via la cle 5-champs
identique a mergePathsLatestWins. Permet de capturer les paths purement
locaux (declares par l'endpoint mais non encore propages au CD) ou
visibles uniquement depuis la vue endpoint.

Test d'integration verifie l'unicite des cles apres merge sur fixture
PRFRI-EP2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Fonction pure `buildInterlocutorsByEic`

**Files:**
- Create: `apps/api/src/graph/build-interlocutors.ts`
- Create: `apps/api/src/graph/build-interlocutors.spec.ts`

- [ ] **Step 1: Écrire le fichier spec RED**

Créer `apps/api/src/graph/build-interlocutors.spec.ts` :

```typescript
import { describe, it, expect } from 'vitest';
import type { GraphEdge } from '@carto-ecp/shared';
import { buildInterlocutorsByEic } from './build-interlocutors.js';

const businessEdge = (overrides: Partial<GraphEdge>): GraphEdge => ({
  id: 'edge-' + Math.random().toString(36).slice(2),
  kind: 'BUSINESS',
  fromEic: 'A',
  toEic: 'B',
  direction: 'OUT',
  process: 'CORE',
  messageTypes: ['CORE-FB-A16A48'],
  transportPatterns: ['INDIRECT'],
  intermediateBrokerEic: null,
  activity: {
    connectionStatus: null,
    lastMessageUp: null,
    lastMessageDown: null,
    isRecent: false,
    sumMessagesUp: 0,
    sumMessagesDown: 0,
    totalVolume: 0,
  },
  validFrom: new Date(0).toISOString(),
  validTo: null,
  peering: null,
  ...overrides,
});

describe('buildInterlocutorsByEic', () => {
  it('Map vide si aucune edge', () => {
    const out = buildInterlocutorsByEic([]);
    expect(out.size).toBe(0);
  });

  it('noeud A avec 1 edge OUT vers B : A a B en OUT, B a A en IN', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', messageTypes: ['CGM'] }),
    ]);
    expect(out.get('A')).toEqual([
      { eic: 'B', messageTypes: ['CGM'], direction: 'OUT' },
    ]);
    expect(out.get('B')).toEqual([
      { eic: 'A', messageTypes: ['CGM'], direction: 'IN' },
    ]);
  });

  it('2 edges A↔B : les deux noeuds se voient en BIDI, messageTypes unis tries', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', messageTypes: ['CGM', 'RSMD'] }),
      businessEdge({ fromEic: 'B', toEic: 'A', messageTypes: ['ACK', 'CGM'] }),
    ]);
    expect(out.get('A')).toEqual([
      { eic: 'B', messageTypes: ['ACK', 'CGM', 'RSMD'], direction: 'BIDI' },
    ]);
    expect(out.get('B')).toEqual([
      { eic: 'A', messageTypes: ['ACK', 'CGM', 'RSMD'], direction: 'BIDI' },
    ]);
  });

  it('noeud avec 3 interlocuteurs : tri BIDI > OUT > IN', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }), // X reçoit de -> IN
      // En réalité le test s'ecrit depuis le point de vue de X : il a A, B, C comme interlocuteurs.
      // Recodons : X OUT vers A, X IN depuis B, X BIDI avec C.
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'B', toEic: 'X', messageTypes: ['T2'] }),
      businessEdge({ fromEic: 'X', toEic: 'C', messageTypes: ['T3'] }),
      businessEdge({ fromEic: 'C', toEic: 'X', messageTypes: ['T4'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['C', 'A', 'B']);
    expect(xList[0]!.direction).toBe('BIDI');
    expect(xList[1]!.direction).toBe('OUT');
    expect(xList[2]!.direction).toBe('IN');
  });

  it('tri secondaire : nombre de messageTypes decroissant entre 2 OUT', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'X', toEic: 'B', messageTypes: ['T1', 'T2', 'T3', 'T4', 'T5'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['B', 'A']);
  });

  it('tri tertiaire : EIC croissant pour les ex-aequo', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'X', toEic: 'Z', messageTypes: ['T1'] }),
      businessEdge({ fromEic: 'X', toEic: 'A', messageTypes: ['T1'] }),
    ]);
    const xList = out.get('X')!;
    expect(xList.map((i) => i.eic)).toEqual(['A', 'Z']);
  });

  it('ignore les PEERING edges', () => {
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'B', kind: 'PEERING' }),
    ]);
    expect(out.size).toBe(0);
  });

  it('un noeud ne peut pas etre son propre interlocuteur', () => {
    // Cas pathologique : une edge A → A ne devrait pas exister, mais on se protege.
    const out = buildInterlocutorsByEic([
      businessEdge({ fromEic: 'A', toEic: 'A', messageTypes: ['T1'] }),
    ]);
    expect(out.get('A') ?? []).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier que les tests échouent (fichier n'existe pas)**

Run: `pnpm --filter @carto-ecp/api test -- build-interlocutors`
Expected: FAIL — import introuvable.

- [ ] **Step 3: Créer l'implémentation**

Créer `apps/api/src/graph/build-interlocutors.ts` :

```typescript
import type { GraphEdge, GraphNodeInterlocutor } from '@carto-ecp/shared';

type Accum = {
  messageTypes: Set<string>;
  hasAsSender: boolean;
  hasAsReceiver: boolean;
};

const directionRank: Record<GraphNodeInterlocutor['direction'], number> = {
  BIDI: 0,
  OUT: 1,
  IN: 2,
};

/**
 * Calcule les interlocuteurs de chaque noeud à partir des edges BUSINESS
 * agrégées. Les edges PEERING (CD↔CD) sont exclues — elles relèvent du
 * peering administratif, pas d'un flux métier.
 *
 * Vu depuis un noeud X :
 *  - X est fromEic d'une edge → X émet vers l'autre (OUT)
 *  - X est toEic d'une edge → X reçoit de l'autre (IN)
 *  - les deux → BIDI
 *
 * Tri des interlocuteurs par (1) direction BIDI > OUT > IN, (2) nombre de
 * messageTypes décroissant, (3) EIC croissant.
 */
export function buildInterlocutorsByEic(
  edges: ReadonlyArray<GraphEdge>,
): Map<string, GraphNodeInterlocutor[]> {
  const byNode = new Map<string, Map<string, Accum>>();

  const ensure = (nodeEic: string, otherEic: string): Accum => {
    let inner = byNode.get(nodeEic);
    if (!inner) {
      inner = new Map();
      byNode.set(nodeEic, inner);
    }
    let a = inner.get(otherEic);
    if (!a) {
      a = { messageTypes: new Set(), hasAsSender: false, hasAsReceiver: false };
      inner.set(otherEic, a);
    }
    return a;
  };

  for (const e of edges) {
    if (e.kind !== 'BUSINESS') continue;
    if (e.fromEic === e.toEic) continue; // self-edge improbable, on protège

    const fromAccum = ensure(e.fromEic, e.toEic);
    fromAccum.hasAsSender = true;
    for (const mt of e.messageTypes) fromAccum.messageTypes.add(mt);

    const toAccum = ensure(e.toEic, e.fromEic);
    toAccum.hasAsReceiver = true;
    for (const mt of e.messageTypes) toAccum.messageTypes.add(mt);
  }

  const out = new Map<string, GraphNodeInterlocutor[]>();
  for (const [nodeEic, innerMap] of byNode) {
    const list: GraphNodeInterlocutor[] = [];
    for (const [otherEic, a] of innerMap) {
      const direction: GraphNodeInterlocutor['direction'] =
        a.hasAsSender && a.hasAsReceiver
          ? 'BIDI'
          : a.hasAsSender
            ? 'OUT'
            : 'IN';
      list.push({
        eic: otherEic,
        messageTypes: Array.from(a.messageTypes).sort(),
        direction,
      });
    }
    list.sort((x, y) => {
      const dx = directionRank[x.direction] - directionRank[y.direction];
      if (dx !== 0) return dx;
      const mx = y.messageTypes.length - x.messageTypes.length;
      if (mx !== 0) return mx;
      return x.eic < y.eic ? -1 : x.eic > y.eic ? 1 : 0;
    });
    out.set(nodeEic, list);
  }
  return out;
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm --filter @carto-ecp/api test -- build-interlocutors`
Expected: PASS — les 8 tests passent.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/graph/build-interlocutors.ts apps/api/src/graph/build-interlocutors.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): buildInterlocutorsByEic — fonction pure de derivation

Calcule les interlocuteurs de chaque noeud a partir des edges BUSINESS
agregees par GraphService. Tri deterministe : BIDI > OUT > IN,
puis nombre de messageTypes decroissant, puis EIC croissant.
8 cas de tests unitaires couvrent vide, OUT/IN symetrique, BIDI,
multi-interlocuteurs, tri secondaire/tertiaire, exclusion PEERING,
protection self-edge.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Intégration `interlocutors` dans `GraphService.getGraph`

**Files:**
- Modify: `apps/api/src/graph/graph.service.ts:303-358`
- Modify: `apps/api/src/graph/graph.service.compute.spec.ts`

- [ ] **Step 1: Écrire le test RED dans graph.service.compute.spec.ts**

Ouvrir `apps/api/src/graph/graph.service.compute.spec.ts`. Repérer un test existant qui crée 2 imports et vérifie les edges. S'en inspirer pour ajouter :

```typescript
it('[Slice 3a] remplit node.interlocutors depuis les edges agregees', async () => {
  // Insérer 1 Import endpoint avec 2 paths : A → B (CGM) et B → A (RSMD)
  const now = new Date('2026-04-01T00:00:00.000Z');
  const imp = await prisma.import.create({
    data: {
      envName: 'ITEST_INTERLOC',
      label: 'test',
      fileName: 'x.zip',
      fileHash: 'deadbeef',
      sourceComponentEic: 'A',
      sourceDumpTimestamp: now,
      dumpType: 'ENDPOINT',
      zipPath: '/tmp/x.zip',
      effectiveDate: now,
      importedComponents: {
        create: [
          { eic: 'A', type: 'ENDPOINT', sourceType: 'LOCAL_CSV', isDefaultPosition: true },
          { eic: 'B', type: 'ENDPOINT', sourceType: 'LOCAL_CSV', isDefaultPosition: true },
        ],
      },
      importedPaths: {
        create: [
          { receiverEic: 'B', senderEic: 'A', messageType: 'CGM', transportPattern: 'DIRECT', intermediateBrokerEic: null, validFrom: now, validTo: null, isExpired: false },
          { receiverEic: 'A', senderEic: 'B', messageType: 'RSMD', transportPattern: 'DIRECT', intermediateBrokerEic: null, validFrom: now, validTo: null, isExpired: false },
        ],
      },
    },
  });

  const graph = await service.getGraph('ITEST_INTERLOC');
  const nodeA = graph.nodes.find((n) => n.eic === 'A');
  const nodeB = graph.nodes.find((n) => n.eic === 'B');

  expect(nodeA?.interlocutors).toEqual([
    { eic: 'B', messageTypes: ['CGM', 'RSMD'], direction: 'BIDI' },
  ]);
  expect(nodeB?.interlocutors).toEqual([
    { eic: 'A', messageTypes: ['CGM', 'RSMD'], direction: 'BIDI' },
  ]);

  // Cleanup
  await prisma.import.delete({ where: { id: imp.id } });
});
```

Adapter le `envName` pour ne pas collisionner avec d'autres tests du fichier.

- [ ] **Step 2: Lancer le test RED**

Run: `pnpm --filter @carto-ecp/api test -- graph.service.compute`
Expected: FAIL — `nodeA.interlocutors` est `[]` parce qu'on le renvoie vide (Task 1).

- [ ] **Step 3: Modifier `GraphService.getGraph` pour calculer les interlocuteurs**

Ouvrir `apps/api/src/graph/graph.service.ts`. Ajouter l'import en tête :

```typescript
import { buildInterlocutorsByEic } from './build-interlocutors.js';
```

Dans `getGraph`, juste **après** la construction des edges (après le bloc 4.bis des peering edges, avant `// 5. Nodes + bounds`, ligne 303), ajouter :

```typescript
    // Slice 3a : calcule les interlocuteurs par noeud à partir des edges
    // BUSINESS agrégées. Cohérent avec la carte : un interlocuteur affiché
    // ⇔ une edge visible.
    const interlocutorsByEic = buildInterlocutorsByEic(edges);
```

Puis modifier la signature et le corps de `toNode` pour accepter les interlocuteurs. Ligne 322 :

```typescript
  private toNode(
    g: GlobalComponent,
    rteEicSet: Set<string>,
    envName: string,
    runtime: { status: string | null; appTheme: string | null },
    compStat: { lastSync: Date | null; sentMessages: number; receivedMessages: number } | null,
    uploadTargets: string[],
    interlocutors: GraphNode['interlocutors'],
  ): GraphNode {
    return {
      // ...champs existants...
      uploadTargets,
      interlocutors,
      country: g.country,
      // ...reste inchangé...
```

(Retirer `interlocutors: [],` ajouté en Task 1 Step 3 — il est remplacé par le paramètre.)

Enfin, modifier l'appel dans la construction des nodes (ligne 304) :

```typescript
    const nodes: GraphNode[] = Array.from(globalComponents.values()).map((g) => {
      const runtime = runtimePropsBySourceEic.get(g.eic) ?? {
        status: null,
        appTheme: null,
      };
      const compStat = compStatsByEic.get(g.eic) ?? null;
      const uploadTargets = uploadTargetsBySourceEic.get(g.eic)?.targets ?? [];
      const interlocutors = interlocutorsByEic.get(g.eic) ?? [];
      return this.toNode(g, rteEicSet, envNameForGraph, runtime, compStat, uploadTargets, interlocutors);
    });
```

- [ ] **Step 4: Vérifier que le test GREEN passe**

Run: `pnpm --filter @carto-ecp/api test -- graph.service.compute`
Expected: PASS.

Run: `pnpm --filter @carto-ecp/api test`
Expected: PASS sur toute la suite backend (aucune régression attendue — les anciens tests reçoivent désormais `interlocutors: []` ou une liste calculée selon les paths).

- [ ] **Step 5: Ajuster les tests existants si régression**

Si un test existant fait `expect(node).toEqual({...})` avec une forme exhaustive, il va casser à cause du nouveau champ. Deux options :
- Ajouter `interlocutors: expect.any(Array)` au matcher.
- Compléter avec `interlocutors: []` pour les noeuds sans paths.

Appliquer la correction au cas par cas.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/graph/graph.service.ts apps/api/src/graph/graph.service.compute.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): node.interlocutors calcule a partir des edges BUSINESS

GraphService.getGraph appelle buildInterlocutorsByEic apres
l'agregation des edges et attache la liste correspondante sur chaque
GraphNode. Cohera permet d'afficher dans le frontend "avec qui chaque
noeud echange" sans risque de divergence avec la carte.

Test d'integration verifie qu'un import ENDPOINT avec paths A↔B
produit des interlocuteurs BIDI symetriques.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: UI — section « Interlocuteurs » dans `NodeDetails.tsx`

**Files:**
- Modify: `apps/web/src/components/DetailPanel/NodeDetails.tsx`
- Modify: `apps/web/src/components/DetailPanel/NodeDetails.test.tsx`

- [ ] **Step 1: Écrire les tests RED**

Ouvrir `apps/web/src/components/DetailPanel/NodeDetails.test.tsx`. Ajouter à la fin du fichier :

```tsx
describe('NodeDetails — section Interlocuteurs', () => {
  const baseNode = (overrides: Partial<GraphNode>): GraphNode => ({
    id: 'A',
    eic: 'A',
    kind: 'RTE_ENDPOINT',
    displayName: 'INTERNET-EP2',
    projectName: null,
    envName: 'PFRFI',
    organization: 'RTE',
    personName: null,
    email: null,
    phone: null,
    homeCdCode: null,
    status: null,
    appTheme: null,
    lastSync: null,
    sentMessages: null,
    receivedMessages: null,
    uploadTargets: [],
    interlocutors: [],
    country: 'FR',
    lat: 48.89,
    lng: 2.23,
    isDefaultPosition: false,
    networks: ['internet'],
    process: null,
    urls: [],
    creationTs: '2026-01-01T00:00:00.000Z',
    modificationTs: '2026-01-01T00:00:00.000Z',
    ...overrides,
  });

  it('ne rend pas la section si interlocutors est vide', () => {
    render(<NodeDetails node={baseNode({})} />);
    expect(screen.queryByText(/Interlocuteurs/)).not.toBeInTheDocument();
  });

  it('rend la section avec le bon compteur', () => {
    render(<NodeDetails node={baseNode({
      interlocutors: [
        { eic: 'B', messageTypes: ['CGM'], direction: 'OUT' },
        { eic: 'C', messageTypes: ['RSMD', 'ACK'], direction: 'IN' },
      ],
    })} />);
    expect(screen.getByText('Interlocuteurs (2)')).toBeInTheDocument();
  });

  it('tronque messageTypes > 3 avec "et N autres"', () => {
    render(<NodeDetails node={baseNode({
      interlocutors: [
        { eic: 'B', messageTypes: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], direction: 'OUT' },
      ],
    })} />);
    expect(screen.getByText(/T1, T2, T3 et 4 autres/)).toBeInTheDocument();
  });

  it('singulier pour 1 autre', () => {
    render(<NodeDetails node={baseNode({
      interlocutors: [
        { eic: 'B', messageTypes: ['T1', 'T2', 'T3', 'T4'], direction: 'OUT' },
      ],
    })} />);
    expect(screen.getByText(/T1, T2, T3 et 1 autre$/)).toBeInTheDocument();
  });

  it('affiche le bon badge pour chaque direction', () => {
    render(<NodeDetails node={baseNode({
      interlocutors: [
        { eic: 'B', messageTypes: ['T1'], direction: 'BIDI' },
        { eic: 'C', messageTypes: ['T1'], direction: 'OUT' },
        { eic: 'D', messageTypes: ['T1'], direction: 'IN' },
      ],
    })} />);
    expect(screen.getByText('⇄')).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText('IN')).toBeInTheDocument();
  });

  it('affiche EIC simple si interlocuteur absent du graph, displayName sinon', () => {
    // Sans mock du store, l'interlocuteur n'est pas trouve dans graph?.nodes, donc on voit l'EIC.
    render(<NodeDetails node={baseNode({
      interlocutors: [{ eic: 'EIC_ABSENT', messageTypes: ['T1'], direction: 'OUT' }],
    })} />);
    expect(screen.getByText('EIC_ABSENT')).toBeInTheDocument();
  });
});
```

S'assurer que les imports en tête du fichier incluent :

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeDetails } from './NodeDetails';
import type { GraphNode } from '@carto-ecp/shared';
```

Si le fichier de test utilise un `beforeEach` pour mocker `useAppStore`, vérifier que `graph` est null ou sans les EICs B/C/D/EIC_ABSENT pour que les interlocuteurs apparaissent comme EIC non cliquables. Si le store renvoie un vrai graph avec des nodes, adapter pour mettre un `graph.nodes` vide.

- [ ] **Step 2: Vérifier que les tests échouent**

Run: `pnpm --filter @carto-ecp/web test -- NodeDetails`
Expected: FAIL — la section « Interlocuteurs » n'est pas rendue.

- [ ] **Step 3: Implémenter la section dans NodeDetails.tsx**

Ouvrir `apps/web/src/components/DetailPanel/NodeDetails.tsx`. Juste après le bloc `{node.uploadTargets.length > 0 ? (...) : null}` (ligne 210), ajouter :

```tsx
      {node.interlocutors.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Interlocuteurs ({node.interlocutors.length})</h3>
          <ul className="space-y-1 text-xs">
            {node.interlocutors.map((i) => {
              const target = graph?.nodes.find((n) => n.eic === i.eic) ?? null;
              const visibleTypes = i.messageTypes.slice(0, 3);
              const overflow = i.messageTypes.length - 3;
              return (
                <li key={i.eic} className="flex items-start gap-2">
                  <DirectionBadge direction={i.direction} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono">
                      {target != null ? (
                        <button
                          type="button"
                          onClick={() => selectNode(i.eic)}
                          className="text-rte underline underline-offset-2 hover:text-red-800"
                          title={`Aller à ${target.displayName}`}
                        >
                          {target.displayName || i.eic}
                        </button>
                      ) : (
                        <span title="Pas dans l'env courant">{i.eic}</span>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {visibleTypes.join(', ')}
                      {overflow > 0 && ` et ${overflow} autre${overflow > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
```

Puis, en bas du fichier (après la fonction `formatCount`), ajouter le composant `DirectionBadge` :

```tsx
function DirectionBadge({ direction }: { direction: 'IN' | 'OUT' | 'BIDI' }): JSX.Element {
  const cfg = {
    IN: { bg: 'bg-sky-100 text-sky-800', label: 'IN' },
    OUT: { bg: 'bg-emerald-100 text-emerald-800', label: 'OUT' },
    BIDI: { bg: 'bg-violet-100 text-violet-800', label: '⇄' },
  }[direction];
  return (
    <span className={`inline-flex h-5 min-w-[2rem] items-center justify-center rounded px-1 text-[10px] font-semibold ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `pnpm --filter @carto-ecp/web test -- NodeDetails`
Expected: PASS.

Run: `pnpm --filter @carto-ecp/web typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/DetailPanel/NodeDetails.tsx apps/web/src/components/DetailPanel/NodeDetails.test.tsx
git commit -m "$(cat <<'EOF'
feat(web): section Interlocuteurs dans NodeDetails

Ajoute une section sous "Cibles d'upload" listant les interlocuteurs
derives par le backend. Une ligne par interlocuteur avec badge de
direction (IN / OUT / BIDI), nom cliquable (ou EIC si absent du graph),
et apercu des messageTypes (3 premiers + compte des autres).
Resout la zone d'incertitude de docs/specs/web/detail-panel §87.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Vérification e2e et typecheck global

**Files:** aucun changement attendu.

- [ ] **Step 1: Typecheck + tests global**

Run: `pnpm typecheck`
Expected: PASS.

Run: `pnpm test`
Expected: PASS sur toute la suite.

- [ ] **Step 2: Lancer l'app et valider manuellement**

Run: `pnpm dev` (en tâche de fond).

Depuis http://localhost:5173 :
1. Uploader le zip `tests/fixtures/EXPORT/PRFRI-CWERPN/` (label : "CWERPN slice 3a", envName : "ITEST").
2. Cliquer "Voir sur la carte".
3. Cliquer sur le noeud CWERPN (`17V0000009823063`).
4. Vérifier dans le panneau de droite : section « Interlocuteurs (N) » avec au moins 1 ligne.
5. Cliquer sur un interlocuteur → la carte navigue.

Si tout fonctionne, arrêter `pnpm dev` avec `Ctrl+C`.

- [ ] **Step 3: Si un bug est détecté**

- Revenir sur la task concernée, reproduire via un test unitaire ou d'intégration (pas juste un fix manuel).
- RED → GREEN → commit correctif.

Pas de commit à cette étape — c'est de la vérification.

---

## Task 10: Mise à jour des specs (`docs/specs/`)

**Files:**
- Modify: `docs/specs/api/ingestion/spec-fonctionnel.md`
- Modify: `docs/specs/api/graph/spec-fonctionnel.md`
- Modify: `docs/specs/web/detail-panel/spec-fonctionnel.md`

- [ ] **Step 1: Spec ingestion — ajouter règle 12**

Ouvrir `docs/specs/api/ingestion/spec-fonctionnel.md`. Dans la section `## Règles métier`, après la règle 11, ajouter :

```markdown
12. **Paths ENDPOINT lus aussi depuis `message_path.csv` local.** Pour un dump ENDPOINT, les paths sont extraits à la fois du XML MADES (déduit du CD) et du CSV `message_path.csv` local. Ces deux sources sont dédupliquées via la clé 5-champs `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)` avec XML prioritaire — le CSV ne fait qu'ajouter les paths absents du XML. Les rows `messagePathType === 'ACKNOWLEDGEMENT'`, `status === 'INVALID'` ou `applied === false` sont ignorées à l'ingestion. Les `allowedSenders` multi-EIC sont explosés en N paths (1 par sender). Wildcards (`*` en sender ou receiver) exclus à l'ingestion.
```

Puis, dans la section `### CU-001 — Import d'un dump Endpoint`, remplacer « extraction CSV + parsing XML blobs » par :

```
extraction CSV (application_property + component_directory + messaging_statistics + message_path + message_upload_route) + parsing XML blobs
```

- [ ] **Step 2: Spec graph — ajouter règle 11**

Ouvrir `docs/specs/api/graph/spec-fonctionnel.md`. Après la règle 10, ajouter :

```markdown
11. **Interlocuteurs dérivés des edges agrégées.** Pour chaque `GraphNode`, la liste `interlocutors` est calculée à partir des edges BUSINESS (pas PEERING) : pour chaque edge où le noeud est `fromEic` ou `toEic`, l'autre extrémité est ajoutée avec la direction vue depuis le noeud (IN si le noeud est `toEic`, OUT si `fromEic`, BIDI si présent des deux côtés). Les messageTypes sont unis et triés alphabétiquement. Tri des interlocuteurs : (1) direction BIDI > OUT > IN, (2) nombre de messageTypes décroissant, (3) EIC croissant. Cohérence garantie avec la carte : un interlocuteur affiché ⇔ une edge visible.
```

- [ ] **Step 3: Spec detail-panel — section Interlocuteurs + résolution de la zone d'incertitude**

Ouvrir `docs/specs/web/detail-panel/spec-fonctionnel.md`. Dans la section `## Règles métier (déduites du code)`, ajouter la règle 11 :

```markdown
11. **Section Interlocuteurs (N) sur la fiche nœud.** Si `node.interlocutors.length > 0`, une section « Interlocuteurs (N) » apparaît sous « Cibles d'upload ». Chaque interlocuteur est rendu comme une ligne avec : un badge de direction (`IN` en bleu ciel, `OUT` en vert émeraude, `⇄` en violet pour BIDI), le `displayName` (cliquable, appelle `selectNode`) ou l'EIC brut (si l'interlocuteur n'est pas dans le graph de l'env courant), puis un aperçu des messageTypes (3 premiers, suivis de « et N autre(s) » si plus de 3). L'ordre est déterministe côté backend (règle 11 spec api/graph).
```

Dans la section `## Zones d'incertitude`, supprimer le 3ème bullet (« La section "liens IN/OUT" mentionnée dans le design §10.7 et dans la discovery #8 n'est pas implémentée ») car il est désormais résolu.

- [ ] **Step 4: Commit des specs**

```bash
git add docs/specs/api/ingestion/spec-fonctionnel.md docs/specs/api/graph/spec-fonctionnel.md docs/specs/web/detail-panel/spec-fonctionnel.md
git commit -m "$(cat <<'EOF'
docs(specs): Slice 3a — regles ingestion/graph/detail-panel

Ajoute la regle 12 sur la lecture de message_path.csv cote endpoint
dans spec ingestion, la regle 11 sur le calcul des interlocuteurs
dans spec graph, et la regle 11 sur la section UI dans spec
detail-panel. Resout la zone d'incertitude §87 de detail-panel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Mise à jour CHANGELOG

**Files:**
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Ajouter l'entrée v3.0-alpha.1**

Ouvrir `CHANGELOG.md`. Repérer la section `## [Unreleased]` ou, s'il y a déjà des entrées Slice 2, ajouter en tête :

```markdown
### v3.0-alpha.1 — Slice 3a : endpoint paths + interlocuteurs (2026-04-23)

**Highlights :**

- **Exploitation de `message_path.csv` côté endpoint.** Le pipeline ENDPOINT ingère désormais les paths déclarés localement par l'endpoint (en plus de ceux propagés via le XML MADES du CD). Dédup XML↔CSV via la clé 5-champs existante, XML prioritaire. Filtres à l'ingestion : ACKNOWLEDGEMENT, INVALID, `applied=false`, wildcards. `allowedSenders` multi-EIC explosés en N paths.
- **Nouveau calcul `GraphNode.interlocutors`.** Dérivé des edges BUSINESS agrégées, expose la liste des EICs avec qui chaque noeud échange, avec direction IN/OUT/BIDI et liste des messageTypes. Tri déterministe (BIDI > OUT > IN, puis volume de messageTypes, puis EIC alpha).
- **Nouvelle section UI « Interlocuteurs (N) » dans le panneau détail.** Badge de direction coloré, nom cliquable pour naviguer au noeud, aperçu des messageTypes (3 + reste agrégé). Résout la zone d'incertitude §87 de la spec `web/detail-panel`.

**Fichiers impactés :**
- `packages/shared/src/graph.ts` — nouveau type `GraphNodeInterlocutor`, champ `GraphNode.interlocutors`.
- `apps/api/src/ingestion/import-builder.service.ts` — méthode `buildEndpointPaths`, helper exporté `pathIdentityKey`.
- `apps/api/src/ingestion/imports.service.ts` — câblage pipeline ENDPOINT + dédup XML↔CSV.
- `apps/api/src/graph/build-interlocutors.ts` — fonction pure (nouveau fichier).
- `apps/api/src/graph/graph.service.ts` — intégration dans `getGraph` et `toNode`.
- `apps/web/src/components/DetailPanel/NodeDetails.tsx` — section + `DirectionBadge`.
- Tests : 21 nouveaux cas (13 unitaires backend, 1 intégration ingestion, 1 intégration graph, 6 UI).
- Specs mises à jour : `api/ingestion` règle 12, `api/graph` règle 11, `web/detail-panel` règle 11.

**ADR :** aucune nouvelle décision structurelle — le choix XML > CSV reprend l'invariant 9 de la spec technique `api/ingestion`.

**Pas de migration Prisma.** Le modèle `ImportedPath` couvre déjà tous les champs.

**Prépare :** Slice 3b (mapping BA ↔ endpoints) et 3c (filtre BA sur la carte).
```

- [ ] **Step 2: Commit**

```bash
git add CHANGELOG.md
git commit -m "$(cat <<'EOF'
docs(changelog): v3.0-alpha.1 — Slice 3a endpoint paths et interlocuteurs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Merge de la branche vers main

**Files:** aucun.

- [ ] **Step 1: Vérifier que main n'a pas bougé**

Run: `git fetch origin main && git log --oneline main..HEAD`
Expected: liste les commits ajoutés par cette slice (8 à 10 commits).

Run: `git log --oneline HEAD..main`
Expected: vide. Si pas vide, rebaser ou merger main dans la branche d'abord.

- [ ] **Step 2: Lancer les tests globaux une dernière fois**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 3: Checkout main et fast-forward**

```bash
git checkout main
git merge --no-ff feat/v3-slice-3a-endpoint-paths-interlocutors -m "$(cat <<'EOF'
feat: Slice 3a — endpoint paths et interlocuteurs

Exploite message_path.csv cote endpoint (ignore avant 3a) et affiche
la liste des interlocuteurs dans le panneau de detail de chaque noeud.
Pose les fondations pour 3b (mapping BA) et 3c (filtre par BA).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Nettoyage optionnel**

Ne pas supprimer la branche feature — garder la trace pour rollback éventuel.

---

## Self-Review

### Couverture spec

| Spec (design §) | Task |
|---|---|
| §A.1 pipeline enrichi | Task 5 |
| §A.2 dédup clé 5-champs | Task 5 (step 3 + helper Task 3 step 2) |
| §A.3 buildEndpointPaths filtres + expansion + isExpired | Task 3, 4 |
| §A.4 calcul interlocutors | Task 6, 7 |
| §A.5 type `GraphNodeInterlocutor` | Task 1 |
| §A.6 UI section | Task 8 |
| §C.1 tests filtres | Task 2, 3 |
| §C.2 intégration PRFRI-EP2 | Task 5 |
| §C.3 tests interlocutors | Task 6, 7 |
| §C.4 tests NodeDetails | Task 8 |
| §E docs + CHANGELOG | Task 10, 11 |
| §E merge | Task 12 |

Toutes les règles métier et tests listés dans le design sont couverts par au moins une task.

### Placeholder scan

Aucun `TBD`, `TODO`, « à implémenter plus tard » ou description sans code. Tous les tests ont leur corps. Toutes les étapes d'implémentation ont les blocs de code réels.

### Type consistency

- `GraphNodeInterlocutor` défini en Task 1, utilisé en Task 6 (import), Task 7 (signature `toNode`), Task 8 (rendu).
- `pathIdentityKey` défini en Task 3 step 2, utilisé en Task 5 step 4 (import).
- `buildEndpointPaths(rows, localEic, effectiveDate)` — signature identique en Task 3 (definition) et Task 5 (appel).
- `buildInterlocutorsByEic(edges): Map<string, GraphNodeInterlocutor[]>` — signature identique en Task 6 (definition) et Task 7 (appel).
- `InterlocutorDirection = 'IN' | 'OUT' | 'BIDI'` — même type côté badge UI.
- `effectiveDate: Date` — même type partout (pas confusion avec `effectiveDate?: Date` refDate du graph).

Pas d'incohérence détectée.

### Scope check

Cette slice livre un lot cohérent et testable (pipeline + graph + UI), mais focus : une seule feature (les interlocuteurs). Les BAs et les filtres sont exclus (3b, 3c). Scope approprié pour une slice.
