# Phase 3 Remédiation — Design

| Champ              | Valeur                                                  |
|--------------------|---------------------------------------------------------|
| Date               | 2026-04-18                                              |
| Portée             | 6 actions "quick wins & config" (P3-1, P3-2, P3-3, P3-4, P3-5, P3-7) |
| Hors scope         | P3-6 (hot-reload, dépend auth), P3-8 (leaflet-curve, spec séparé) |
| Branche cible      | `feat/phase3-remediation` depuis `feature/slice-1`      |
| Livraison          | 1 PR, 6 commits conventional                            |
| Prérequis          | Phase 1 + Phase 2 mergées                               |

---

## 1. Objectif

Finaliser les améliorations de maintenabilité, sécurité et configuration du slice #1 avant de passer aux chantiers d'évolution fonctionnelle (filtres, export, diff) ou de remplacement de libs (leaflet-curve).

## 2. Décisions clés

| Item | Choix |
|------|-------|
| P3-1 zip sans sensibles | Re-packager le zip avant `writeFile` : retirer `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` |
| P3-2 isRecent configurable | Variable d'env `ISRECENT_THRESHOLD_MS` avec fallback `24 * 60 * 60 * 1000` |
| P3-3 rteEicSet pré-calculé | Calcul unique dans `RegistryService.onModuleInit`, exposé via `getRteEicSet(): Set<string>` |
| P3-4 PARIS externalisées | Ajout champ `mapConfig` dans `GraphResponse` (pas de nouvel endpoint, contrat enrichi) |
| P3-5 ADR validation | ADR-022 "adopter `nestjs-zod` pour futurs endpoints" — pas de refacto rétroactive |
| P3-7 whitelist cleanup | Retirer `message_type.csv` et `message_upload_route.csv` de `USABLE_CSV_FILES` |

---

## 3. Détail par item

### 3.1. P3-1 — Zip archivé sans fichiers sensibles

**Fichier modifié** : `apps/api/src/ingestion/snapshot-persister.service.ts`

Aujourd'hui : `writeFile(zipPath, zipBuffer)` persiste le zip **tel qu'uploadé**, ce qui inclut `local_key_store.csv`, `registration_store.csv`, `registration_requests.csv` (clés privées ECP). Bien que ces fichiers ne soient jamais **lus** en mémoire (`ZipExtractor` les exclut), leur présence sur disque expose des secrets à un accès physique.

**Implémentation** :
```ts
import AdmZip from 'adm-zip';

const SENSITIVE_FILES = new Set([
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
]);

private repackageWithoutSensitive(buffer: Buffer): Buffer {
  const src = new AdmZip(buffer);
  const dst = new AdmZip();
  for (const entry of src.getEntries()) {
    if (entry.isDirectory) continue;
    if (SENSITIVE_FILES.has(entry.entryName)) continue;
    dst.addFile(entry.entryName, entry.getData());
  }
  return dst.toBuffer();
}
```

Appel en début de `persist()` avant `writeFile` :
```ts
const safeBuffer = this.repackageWithoutSensitive(zipBuffer);
await writeFile(zipPath, safeBuffer);
```

**Test ajouté** : dans `snapshot-persister.service.spec.ts`, un nouveau cas vérifie que `writeFile` reçoit un buffer dont `AdmZip` ne retrouve AUCUN des 3 fichiers sensibles, même si le `zipBuffer` d'entrée en contient.

### 3.2. P3-2 — `ISRECENT_THRESHOLD_MS` env var

**Fichier modifié** : `apps/api/src/graph/graph.service.ts:103-106`

Aujourd'hui hardcodé : `24 * 60 * 60 * 1000`.

**Implémentation** : lecture d'`process.env.ISRECENT_THRESHOLD_MS` au boot (constructor ou module-level const), avec parsing `parseInt` et fallback 86400000. Utilisation dans `buildGraph`.

```ts
// En haut du fichier, après les imports
const DEFAULT_ISRECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

function parseThreshold(): number {
  const raw = process.env.ISRECENT_THRESHOLD_MS;
  if (!raw) return DEFAULT_ISRECENT_THRESHOLD_MS;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_ISRECENT_THRESHOLD_MS;
}

// Dans la classe
private readonly isRecentThreshold = parseThreshold();

// Dans buildGraph, ligne ~105
snapshotTime - stat.lastMessageUp.getTime() < this.isRecentThreshold
```

**Tests ajoutés** : 2 cas dans `graph.service.spec.ts` :
- Env var absente → seuil 24h utilisé
- Env var = `3600000` (1h) → une activité à 2h est `isRecent: false`

### 3.3. P3-3 — `rteEicSet` pré-calculé

**Fichiers modifiés** :
- `apps/api/src/registry/registry.service.ts` : ajout méthode publique `getRteEicSet(): Set<string>` avec champ privé pré-calculé dans `onModuleInit`
- `apps/api/src/ingestion/network-model-builder.service.ts:59-62` : remplacer la construction locale par `this.registry.getRteEicSet()`

**Code** (dans `RegistryService`) :
```ts
private rteEicSet!: Set<string>;

async onModuleInit(): Promise<void> {
  // ...existing loadEntsoeIndex + loadOverlay...
  this.rteEicSet = new Set<string>([
    ...this.overlay.rteEndpoints.map((e) => e.eic),
    this.overlay.rteComponentDirectory.eic,
  ]);
}

getRteEicSet(): Set<string> {
  return this.rteEicSet;
}
```

Dans `network-model-builder.service.ts`, remplacer :
```ts
const rteEicSet = new Set<string>([
  ...overlay.rteEndpoints.map((e) => e.eic),
  overlay.rteComponentDirectory.eic,
]);
```
par :
```ts
const rteEicSet = this.registry.getRteEicSet();
```

**Test ajouté** : dans `registry.service.spec.ts`, 1 cas `getRteEicSet returns set containing all rteEndpoints + rteComponentDirectory EICs`.

### 3.4. P3-4 — `mapConfig` dans `GraphResponse`

**Fichiers modifiés** :
- `packages/shared/src/graph.ts` : ajout type `MapConfig` + champ optionnel dans `GraphResponse`
- `packages/registry/eic-rte-overlay.json` : ajout section `mapConfig`
- `apps/api/src/registry/registry.service.ts` : getter `getMapConfig()`
- `apps/api/src/graph/graph.service.ts` : inclure `mapConfig` dans `GraphResponse`
- `apps/web/src/components/Map/useMapData.ts` : remplacer les constantes par lecture de `graph.mapConfig`

**Nouveau type** :
```ts
export type MapConfig = {
  rteClusterLat: number;  // ex: 48.8918
  rteClusterLng: number;  // ex: 2.2378
  rteClusterOffsetDeg: number;  // ex: 0.6
  rteClusterProximityDeg: number;  // ex: 0.01
};

export type GraphResponse = {
  bounds: GraphBounds;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mapConfig: MapConfig;
};
```

**Overlay JSON** (ajout) :
```json
"mapConfig": {
  "rteClusterLat": 48.8918,
  "rteClusterLng": 2.2378,
  "rteClusterOffsetDeg": 0.6,
  "rteClusterProximityDeg": 0.01
}
```

**Frontend** : `useMapData.ts` lit `graph.mapConfig.rteClusterLat` etc. au lieu des constantes locales.

**Test ajouté** : 1 cas dans `graph.service.spec.ts` (mapConfig présent dans la réponse), 1 cas dans `registry.service.spec.ts` (getMapConfig retourne les valeurs de l'overlay).

### 3.5. P3-5 — ADR-022 stratégie validation

**Fichier créé** : `docs/adr/ADR-022-validation-nestjs-zod-pour-futurs-endpoints.md`

Pas de refacto rétroactive du code existant. L'ADR documente simplement la décision :

- Statut : Acceptée
- Contexte : `SnapshotsController` utilise Zod via `safeParse` manuel ; les `:id` et `?envName` ne passent par aucun pipe NestJS
- Décision : adopter `nestjs-zod` pour tout nouvel endpoint NestJS ajouté au-delà du slice #1 (futurs : filtres, export, admin...). Préserver les endpoints existants en Zod manuel (risque zéro de régression)
- Conséquences : uniformité des futurs endpoints (pipes NestJS + DTO Zod), pas de dette supplémentaire
- Alternatives écartées : `class-validator` (dépend de décorateurs, friction avec TS moderne + swc) ; migration rétroactive (risque disproportionné pour un gain de cohérence)

### 3.6. P3-7 — Whitelist CSV cleanup

**Fichier modifié** : `apps/api/src/ingestion/types.ts:8-14`

Retirer les 2 entrées sans reader associé :
```ts
// Avant
export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
  'message_type.csv',           // ← retiré
  'message_upload_route.csv',   // ← retiré
] as const;

// Après
export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
] as const;
```

**Fichier à adapter** : `apps/api/test/fixtures-loader.ts` (qui a une liste `INGESTED_FILES` similaire mais plus large). **Pas de changement** de ce fichier car il gère les fixtures réelles qui peuvent contenir plus que la whitelist — seul `USABLE_CSV_FILES` filtre à l'extraction.

**Test ajouté** : 1 cas dans `zip-extractor.service.spec.ts` vérifiant que si un zip contient `message_type.csv`, ce fichier n'est pas dans `extracted.files`.

---

## 4. Stratégie de commits

6 commits conventional dans un seul PR :

```
feat(api/registry): pré-calculer rteEicSet dans onModuleInit (P3-3)
chore(api/ingestion): retirer message_type.csv et message_upload_route.csv de la whitelist (P3-7)
feat(api/graph): ISRECENT_THRESHOLD_MS configurable via env var (P3-2)
feat(api/ingestion): re-packager le zip persisté sans fichiers sensibles (P3-1)
feat(api+web): externaliser rteCluster coords via mapConfig dans GraphResponse (P3-4)
docs(adr): ADR-022 validation nestjs-zod pour futurs endpoints (P3-5)
```

Ordre : XS d'abord (débloquant, peu de risque), puis S, puis M, puis ADR. P3-1 et P3-4 sont les plus invasifs (tests persister modifiés, signature GraphResponse élargie).

## 5. Critères de succès

1. `pnpm install` exit 0
2. `pnpm lint` exit 0
3. `pnpm typecheck` exit 0 (le champ `mapConfig` ajouté est obligatoire → compile tous les usages)
4. `pnpm test` : **~106 tests** verts (79 api + 23 web + 4 nouveaux : 2 isRecent, 1 rteEicSet, 1 getMapConfig, +1 zip-extractor cleanup, +1 repackage sensitive)
5. `pnpm test:e2e` : 3 smokes Playwright inchangés
6. Vérification manuelle P3-1 : uploader un zip contenant les 3 fichiers sensibles, vérifier via `unzip -l storage/snapshots/<uuid>.zip` qu'ils sont absents
7. Vérification manuelle P3-2 : boot avec `ISRECENT_THRESHOLD_MS=3600000`, vérifier que les edges dont `lastMessageUp > 1h` ont `isRecent: false`
8. Vérification manuelle P3-4 : inspecter GET /graph, confirmer présence du champ `mapConfig`

## 6. ADRs

- **ADR-022** (nouveau) : stratégie validation nestjs-zod
- Pas d'autre ADR (P3-1 à P3-4 et P3-7 sont des corrections/améliorations, pas des décisions architecturales)

## 7. Hors scope

- P3-6 (hot-reload registry) : dépend auth, différé au-delà du slice #1
- P3-8 (remplacement leaflet-curve) : spec séparé (phase 4) pour isoler ce refactor L
- Pas de test Playwright nouveau
- Pas de CI/Docker (hors remédiation)
