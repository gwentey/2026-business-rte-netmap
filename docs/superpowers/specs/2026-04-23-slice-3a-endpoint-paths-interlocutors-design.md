# Slice 3a — Exploiter message_path.csv côté endpoint + afficher les interlocuteurs par noeud

> **Statut :** design validé (2026-04-23).
> **Branche :** `feat/v3-slice-3a-endpoint-paths-interlocutors` (depuis `main`).
> **Contexte :** suite logique du plan `nous-n-exploitons-pas-encore-sprightly-truffle.md` approuvé par le user. 3a prépare 3b (BA) et 3c (filtres).

---

## §1 — Objectif

Le user a constaté qu'on n'exploite pas `message_path.csv` **côté endpoint** (la méthode `readEndpointMessagePaths` existe dans `CsvReaderService` mais n'est jamais câblée dans le pipeline `dumpType === 'ENDPOINT'`). Résultat : on perd des paths déclarés localement par l'endpoint qui ne sont pas encore synchronisés au CD, et le panneau de détail d'un noeud **ne montre pas ses interlocuteurs**.

Livrables de la slice :

1. **Backend ingestion** — câbler `readEndpointMessagePaths`, construire des `BuiltImportedPath` depuis le CSV endpoint, dédupliquer XML↔CSV (XML prioritaire), filtrer les ACK/INVALID/applied=false/wildcards.
2. **Backend graph** — calculer une nouvelle propriété `GraphNode.interlocutors` dérivée des edges agrégés.
3. **Types partagés** — étendre `GraphNode` dans `packages/shared`.
4. **Frontend** — nouvelle section « Interlocuteurs (N) » dans `NodeDetails.tsx`, liste avec badge direction par ligne.
5. **Tests** — TDD (unitaire + intégration) sur fixture PRFRI-EP2 réelle.

---

## §2 — Scope

### 3a livre

- **Méthode** `ImportBuilderService.buildEndpointPaths(rows, localEic, effectiveDate)` — convertit `MessagePathRow[]` → `BuiltImportedPath[]`, applique règles métier (filtres, expansion senders, dédup).
- **Modification** `imports.service.ts` branche `ENDPOINT` — lit `message_path.csv`, merge les paths XML+CSV avec XML prioritaire via clé 5-champs.
- **Calcul** `GraphService.getGraph` — après étape 5 (construction edges), itère sur les edges pour remplir `node.interlocutors`.
- **Nouveau type** `GraphNodeInterlocutor = { eic: string; messageTypes: string[]; direction: 'IN' | 'OUT' | 'BIDI' }` dans `@carto-ecp/shared`.
- **Nouveau champ** `GraphNode.interlocutors: GraphNodeInterlocutor[]`.
- **UI** — section « Interlocuteurs (N) » dans `NodeDetails.tsx`, sous « Cibles d'upload » (cohérent avec l'ordre logique : CD home → targets → interlocuteurs).
- **Tests** — `import-builder.service.spec.ts` (nouveaux cas `buildEndpointPaths`), `imports.service.spec.ts` (intégration PRFRI-EP2), `graph.service.compute.spec.ts` (cas interlocutors), `NodeDetails.test.tsx` (rendu section).
- **Mise à jour docs** — `docs/specs/api/ingestion/spec-fonctionnel.md` (règle dédup endpoint), `docs/specs/api/graph/spec-fonctionnel.md` (règle interlocutors), `docs/specs/web/detail-panel/spec-fonctionnel.md` (section interlocuteurs — résout la zone d'incertitude §87 de la spec actuelle), `CHANGELOG.md`.

### 3a ne livre pas

- ❌ Mapping BA ↔ Endpoints (c'est la Slice 3b).
- ❌ Filtre « par BA » sur la carte (Slice 3c).
- ❌ Toggle UI « Afficher paths obsolètes / ACK » (Slice 3d optionnelle, seulement si demandé).
- ❌ Dénormalisation de `component_statistics.remoteComponentStatistics` (JSON imbriqué — gain marginal, non prioritaire).
- ❌ Migration Prisma (tous les champs existent déjà).
- ❌ ADR RETRO (la décision dédup XML > CSV pour les paths endpoint reprend l'invariant 9 de `spec-technique.md api/ingestion` — pas de nouvelle décision structurelle).

---

## §A — Architecture

### A.1 Pipeline d'ingestion enrichi

```
apps/api/src/ingestion/imports.service.ts
  branche dumpType === 'ENDPOINT'
    ├─ lit component_directory.csv (CSV + XML blobs MADES)   [existant]
    ├─ buildFromLocalCsv(csvRows)                             [existant]
    ├─ buildFromXml(xmlMades) → xmlComponents, xmlPaths       [existant]
    ├─ readApplicationProperties(appPropBuffer)               [existant]
    ├─ readMessagingStatistics(statsBuf)                      [existant]
    ├─ readEndpointMessagePaths(pathsBuf)  ← NOUVEAU CÂBLAGE
    ├─ buildEndpointPaths(csvPathRows, localEic, effectiveDate) ← NOUVEAU
    ├─ MERGE paths : dédup via clé 5-champs, XML prioritaire   ← NOUVEAU
    └─ readUploadRoutes(uploadBuf)                            [existant]
```

### A.2 Dédup XML↔CSV des paths

Clé de dédup : `{receiverEic}::{senderEic}::{messageType}::{transportPattern}::{intermediateBrokerEic ?? ''}`.

Algorithme :

```
const seen = new Set<string>();
const mergedPaths: BuiltImportedPath[] = [];

// 1. XML d'abord (prioritaire)
for (const p of xmlPaths) {
  seen.add(pathKey(p));
  mergedPaths.push(p);
}

// 2. CSV ensuite, uniquement si la clé n'est pas déjà prise
for (const p of csvPaths) {
  const k = pathKey(p);
  if (!seen.has(k)) {
    seen.add(k);
    mergedPaths.push(p);
  }
}
```

### A.3 `buildEndpointPaths` — algorithme

Entrée : `rows: MessagePathRow[]`, `localEic: string`, `effectiveDate: Date`.

Filtres (dans l'ordre) :

1. `row.messagePathType === 'ACKNOWLEDGEMENT'` → **skip**.
2. `row.status === 'INVALID'` → **skip**.
3. `row.applied === false` → **skip**.
4. `row.receiver == null || row.messageType == null || row.transportPattern == null` → skip (ligne malformée, warning `MESSAGE_PATH_ROW_INCOMPLETE`).
5. `row.receiver === '*'` → skip (wildcard receiver, rare mais possible).
6. `row.allowedSenders == null || row.allowedSenders.trim() === ''` → skip (pas de sender).

Expansion des senders :

- Split `row.allowedSenders` par `;` → liste de trim.
- Si liste contient uniquement `'*'` → skip (wildcard sender, décision brainstorming Q2).
- Sinon filtrer les entrées `''` et `'*'` (on peut avoir `"EIC1;*;EIC2"` — on garde EIC1 et EIC2 uniquement).
- Pour chaque `senderEic` restant, générer 1 `BuiltImportedPath` :

```typescript
{
  receiverEic: row.receiver,
  senderEic,
  messageType: row.messageType,
  transportPattern: row.transportPattern,
  intermediateBrokerEic: row.intermediateBrokerCode ?? null,
  validFrom: row.validFrom,
  validTo: row.validTo,
  isExpired: row.validTo != null && row.validTo < effectiveDate,
}
```

### A.4 Calcul `node.interlocutors` dans GraphService

Après étape 5 de `getGraph` (les edges sont agrégés par `{fromEic}::{toEic}`), on itère sur les edges pour remplir un index `Map<nodeEic, Map<otherEic, { messageTypes: Set<string>; hasAsSender: boolean; hasAsReceiver: boolean }>>`.

Pour chaque edge `e` (non wildcard, déjà garanti par étape 5) :

- Pour le noeud `e.fromEic` → il est **sender** vers `e.toEic`. Entry dans l'index : `messageTypes ∪= e.messageTypes`, `hasAsSender = true`.
- Pour le noeud `e.toEic` → il est **receiver** depuis `e.fromEic`. Entry : `messageTypes ∪= e.messageTypes`, `hasAsReceiver = true`.

Puis pour chaque noeud `n`, pour chaque `(otherEic, rolesInfo)` :

- `direction = 'BIDI'` si `hasAsSender && hasAsReceiver`, sinon `'OUT'` si `hasAsSender`, sinon `'IN'`.
- **Attention** : vu depuis le noeud `n` — quand `n` est `fromEic`, il est expéditeur (donc vu de lui c'est `OUT`). Quand `n` est `toEic`, il est récepteur (donc `IN`).
- Donc : si `hasAsSender && hasAsReceiver` → BIDI, si `hasAsSender` seul → OUT (vu de n), si `hasAsReceiver` seul → IN (vu de n).

`messageTypes` triés alphabétiquement pour stabilité.

Tri de la liste `interlocutors` par : (1) direction BIDI > OUT > IN (prioriser les échanges bidirectionnels), (2) nombre de messageTypes décroissant, (3) EIC croissant.

### A.5 Type `GraphNodeInterlocutor`

```typescript
// packages/shared/src/graph.ts

export type GraphNodeInterlocutor = {
  /** EIC de l'interlocuteur. Toujours différent de node.eic. */
  eic: string;
  /** Union des messageTypes échangés avec cet interlocuteur, triés alpha. */
  messageTypes: string[];
  /** Direction vue depuis node : IN (il m'envoie), OUT (je lui envoie), BIDI (les deux). */
  direction: 'IN' | 'OUT' | 'BIDI';
};

export type GraphNode = {
  // ...champs existants...
  /** Liste des interlocuteurs dérivés des edges agrégés pour ce noeud.
   *  Vide si le noeud n'a aucune edge BUSINESS. */
  interlocutors: GraphNodeInterlocutor[];
};
```

### A.6 UI — section « Interlocuteurs (N) »

Dans `NodeDetails.tsx`, après la section « Cibles d'upload » existante, si `node.interlocutors.length > 0` :

```tsx
<div>
  <h3 className="mb-1 text-sm font-medium">
    Interlocuteurs ({node.interlocutors.length})
  </h3>
  <ul className="space-y-1 text-xs">
    {node.interlocutors.map((i) => {
      const target = graph?.nodes.find((n) => n.eic === i.eic) ?? null;
      const visibleTypes = i.messageTypes.slice(0, 3);
      const overflow = i.messageTypes.length - 3;
      return (
        <li key={i.eic} className="flex items-start gap-2">
          <DirectionBadge direction={i.direction} />
          <div className="flex-1 min-w-0">
            <div className="font-mono">
              {target ? (
                <button onClick={() => selectNode(i.eic)} className="text-rte underline underline-offset-2 hover:text-red-800" title={`Aller à ${target.displayName}`}>
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
```

Badge direction :

| direction | libellé | bg | fg |
|---|---|---|---|
| IN | `IN` | bg-sky-100 | text-sky-800 |
| OUT | `OUT` | bg-emerald-100 | text-emerald-800 |
| BIDI | `⇄` | bg-violet-100 | text-violet-800 |

---

## §B — Data flow

```
Fichier ZIP endpoint (PRFRI-EP2)
  ↓ ZipExtractor
  ↓ CsvReader.readEndpointMessagePaths → MessagePathRow[]
  ↓ ImportBuilder.buildEndpointPaths(rows, localEic, effectiveDate)
  ↓  - filtre ACK / INVALID / applied=false / wildcards
  ↓  - expand allowedSenders → N BuiltImportedPath
  ↓
Parallèlement :
  ZipExtractor → CsvReader.readComponentDirectory → CSV rows → XmlMadesParser → xmlPaths (BuiltImportedPath[])
  ↓
Merge paths (XML prioritaire) → paths: BuiltImportedPath[]
  ↓ RawPersister.persist → BDD (ImportedPath)
  ↓
Plus tard, à la lecture :
  GraphService.getGraph
  ↓ étape 4 merge paths par clé 5-champs (latest-wins entre imports)
  ↓ étape 5 construction edges agrégées par paire
  ↓ étape 5bis (NOUVEAU) compute interlocutors par node
  ↓ GraphResponse avec GraphNode.interlocutors remplis
  ↓
Frontend :
  DetailPanel → NodeDetails → section Interlocuteurs (N)
```

---

## §C — Tests (TDD)

### C.1 `import-builder.service.spec.ts` — `buildEndpointPaths`

1. **Skip ACKNOWLEDGEMENT** — row avec `messagePathType='ACKNOWLEDGEMENT'` → array vide.
2. **Skip INVALID** — row avec `status='INVALID'` → array vide.
3. **Skip applied=false** — row avec `applied=false` → array vide.
4. **Skip wildcard sender uniquement** — row avec `allowedSenders='*'` → array vide.
5. **Skip wildcard receiver** — row avec `receiver='*'` → array vide.
6. **Skip row malformée** — row avec `receiver=null` → array vide + warning.
7. **Expansion allowedSenders** — row avec `allowedSenders='EIC1;EIC2;EIC3'` → 3 paths générés.
8. **Filtre wildcard dans liste** — `allowedSenders='EIC1;*;EIC2'` → 2 paths (pas 3, le `*` est ignoré).
9. **isExpired calculé** — `validTo < effectiveDate` → `isExpired=true`. `validTo >= effectiveDate` ou `null` → `isExpired=false`.
10. **Tous les champs mappés** — `receiverEic`, `senderEic`, `messageType`, `transportPattern`, `intermediateBrokerEic`, `validFrom`, `validTo`.
11. **intermediateBrokerCode null** — path avec `transportPattern='DIRECT'`, `intermediateBrokerCode=null` → `intermediateBrokerEic=null`.

### C.2 `imports.service.spec.ts` — intégration ENDPOINT enrichie

12. **Ingestion PRFRI-EP2** : après ingestion, les paths persistés incluent à la fois des paths vus du XML (déjà en place) **ET** des paths uniques au CSV endpoint. Vérifier `paths.length` > nombre de paths XML seuls.
13. **Dédup XML↔CSV** : un path qui existe dans les 2 sources ne crée qu'une seule entrée `ImportedPath`.
14. **Pas de régression CD** : ingestion d'un dump CD (PRFRI-CD1) continue de passer avec les anciens tests (pipeline CD inchangé).

### C.3 `graph.service.compute.spec.ts` — `node.interlocutors`

15. **Noeud sans edge** : `interlocutors = []`.
16. **Noeud avec edge OUT** : interlocuteur unique, `direction='OUT'`, messageTypes triés.
17. **Noeud avec edge IN** : interlocuteur unique, `direction='IN'`.
18. **Noeud avec edges IN+OUT vers même other** : 1 seul interlocuteur, `direction='BIDI'`, messageTypes union.
19. **Noeud avec 3 interlocuteurs différents** : 3 entrées, tri BIDI > OUT > IN.
20. **Tri secondaire par nombre de messageTypes** : entre 2 OUT, celui avec 5 msgTypes avant celui avec 1.
21. **Pas d'interlocuteur self** : le noeud n'est pas son propre interlocuteur.
22. **Pas d'interlocuteur wildcard** : aucun `eic='*'` dans la liste (les edges wildcards sont déjà filtrées en étape 5).

### C.4 `NodeDetails.test.tsx`

23. **Rendu section absente si vide** : `node.interlocutors = []` → pas de `<h3>Interlocuteurs</h3>` dans le DOM.
24. **Rendu section avec 2 entrées** : titre "Interlocuteurs (2)", 2 `<li>` rendus.
25. **Troncature messageTypes > 3** : un interlocuteur avec 7 messageTypes → affiche "X, Y, Z et 4 autres".
26. **Troncature messageTypes = 4** : affiche "X, Y, Z et 1 autre" (singulier).
27. **Badge direction** : BIDI → `⇄`, IN → `IN`, OUT → `OUT`.
28. **Lien cliquable** : interlocuteur présent dans `graph.nodes` → bouton cliquable avec `displayName`. Absent → span simple avec EIC.

---

## §D — Risques & mitigation

| Risque | Mitigation |
|---|---|
| `readEndpointMessagePaths` peut renvoyer des rows mal typées (types.ts MessagePathRow accepte `string \| null` partout) | Le builder skip les rows malformées avec warning. Tests 4+6 couvrent. |
| Dédup XML↔CSV : un path XML sans `intermediateBrokerEic` vs un path CSV avec `intermediateBrokerEic=null` — la clé doit être identique | Normaliser `null \| undefined \| ''` vers `''` dans `pathKey()`. Test explicite sur le cas (Test 13). |
| Perf sur un endpoint avec 200 paths × 15 senders = 3000 paths persistés | SQLite avec index `[receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic]` déjà présent. Transaction Prisma accepte 3000 rows en batch. Pas d'optim prématurée. |
| `GraphNode.interlocutors` change la signature de tous les tests existants de GraphService | Rétrocompat : ajouter un champ avec `[]` par défaut. Les anciens tests qui font `expect(node).toEqual(...)` peuvent casser — les mettre à jour pour vérifier uniquement les champs pertinents, ou ajouter `interlocutors: expect.any(Array)`. |
| Le user a des dumps `message_path.csv` **vides** (header-only) dans les fixtures CD | La logique traite déjà ce cas (`readRaw` retourne `[]`). Pas de régression. |
| Node.js Buffer pas dispo côté frontend | Aucune manipulation Buffer côté front. Types `GraphNode` sont JSON-safe. |
| Tests existants qui reposent sur un nombre de paths déterminé pour PRFRI-EP2 | Si `imports.service.spec.ts` fait `expect(paths.length).toBe(7)` → devenir `expect(paths.length).toBeGreaterThanOrEqual(7)`. Identifier et ajuster au moment du GREEN. |

---

## §E — Ordre d'exécution TDD

Chaque étape = 1 commit (conventional commits français).

1. **test(api): cas buildEndpointPaths** — RED. Nouveaux specs C.1 #1-#11.
2. **feat(api): buildEndpointPaths et câblage pipeline endpoint** — GREEN. Implémentation méthode + ligne dans `imports.service.ts`. Dédup XML↔CSV. Les tests C.1 passent.
3. **test(api): intégration PRFRI-EP2 avec paths CSV** — RED pour C.2 #12, #13. Ajustement tests existants si nécessaire.
4. **feat(api): interlocutors dans GraphService** — écrire tests C.3 #15-#22 (RED) puis implémentation GREEN.
5. **feat(shared): type GraphNodeInterlocutor et GraphNode.interlocutors** — ajouter le type dans `packages/shared`.
6. **feat(web): section Interlocuteurs dans NodeDetails** — tests C.4 RED puis implémentation.
7. **docs: mise à jour specs ingestion/graph/detail-panel + CHANGELOG** — synchronisation par `update-writer-after-implement` (hook Stop) ou manuelle.
8. **chore: squash + merge feat/v3-slice-3a → main** — PR.

---

## §F — Validation end-to-end manuelle

Après merge :

1. `pnpm --filter @carto-ecp/api prisma:migrate` (pas de nouvelle migration attendue).
2. `pnpm dev`.
3. Upload `tests/fixtures/EXPORT/PRFRI-CWERPN/<EIC>_<timestamp>.zip` via http://localhost:5173.
4. Cliquer sur le noeud CWERPN (EIC `17V0000009823063`) sur la carte.
5. **Attendu** : panneau de détail affiche :
   - Section « Cibles d'upload (1) » : `10V1001C--00087P` (broker CORE).
   - Section « Interlocuteurs (N) » : avec au moins CORE broker en BIDI (le broker relaie `CORE-FB-*` dans les 2 sens), les senders externes `10V000000000012O`, `10V000000000013M`, etc. en OUT (CWERPN envoie `MRC-XBID-*` vers eux via INDIRECT).
6. Cliquer sur un interlocuteur → la carte navigue vers ce noeud.
7. Vérifier que les tests E2E Playwright (si présents) passent encore.

---

## §G — Préparation des slices 3b / 3c

Cette slice pose les fondations pour :

- **3b** : quand on ajoutera `node.businessApplications`, la structure sera similaire à `interlocutors` (liste d'objets typés sur `GraphNode`). La section UI pourra réutiliser le même pattern de rendu.
- **3c** : le filtre « par BA » masquera les nodes dont `businessApplications` ne matche pas. Le filtre aura aussi besoin de masquer les `interlocutors` qui deviennent isolés côté detail — à décider en 3c (option : griser simplement, pas de filtrage du détail).
