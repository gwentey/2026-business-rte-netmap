# Spec Technique — api/common

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | api/common          |
| Version       | 0.1.0               |
| Date          | 2026-04-17          |
| Source        | Rétro-ingénierie    |

---

## Architecture du module

`common` n'est pas un module NestJS (`@Module`). C'est un répertoire de fonctions pures et de classes d'exception exportées, importées directement par les services qui en ont besoin. Trois fichiers composent le module :

```
apps/api/src/common/
├── null-value-normalizer.ts      # fonction pure + constante exportée
├── date-parser.ts                # fonction pure, regex statique
└── errors/
    └── ingestion-errors.ts       # hiérarchie de classes HttpException
```

Aucune injection de dépendances, aucun decorator NestJS dans les utilitaires. La seule dépendance externe est `@nestjs/common` pour `HttpException` et `HttpStatus`.

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/src/common/null-value-normalizer.ts` | Constante `NULL_VALUE_PLACEHOLDER` + fonction générique `normalizeNull<T>` | ~8 |
| `apps/api/src/common/date-parser.ts` | Regex `ISO_WITH_NANOS` (module-scope) + fonction `parseEcpDate` | ~17 |
| `apps/api/src/common/errors/ingestion-errors.ts` | Classe de base `IngestionError` + 5 sous-classes | ~65 |
| `apps/api/src/common/null-value-normalizer.spec.ts` | 5 tests unitaires Vitest pour `normalizeNull` | ~28 |
| `apps/api/src/common/date-parser.spec.ts` | 7 tests unitaires Vitest pour `parseEcpDate` | ~37 |

---

## Schéma BDD

Sans objet. Le module `common` ne lit ni n'écrit en base de données.

---

## API / Endpoints

Sans objet. Le module `common` n'expose aucun endpoint HTTP.

---

## Détail des composants

### `null-value-normalizer.ts`

**Constante exportée :**

```ts
export const NULL_VALUE_PLACEHOLDER = 'NULL_VALUE_PLACEHOLDER';
```

**Fonction exportée :**

```ts
export function normalizeNull<T>(value: T): T | null
```

- Signature générique : le type de retour est `T | null`, ce qui préserve l'inférence TypeScript côté consommateur.
- Condition unique : `typeof value === 'string' && value === NULL_VALUE_PLACEHOLDER`.
- Toute autre valeur (string non-placeholder, number, boolean) est retournée sans conversion.

---

### `date-parser.ts`

**Regex module-scope (compilée une seule fois) :**

```ts
const ISO_WITH_NANOS = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})?$/;
```

Groupes capturés :
- Groupe 1 : partie de base (`YYYY-MM-DDTHH:mm:ss`)
- Groupe 2 : partie fractionnaire optionnelle, 1 à 9 chiffres
- Groupe 3 : timezone optionnel (`Z` ou offset `±HH:MM`)

**Fonction exportée :**

```ts
export function parseEcpDate(input: string | null | undefined): Date | null
```

Algorithme :
1. Retourne `null` si `input` est `null`, `undefined`, `''` ou `'NULL_VALUE_PLACEHOLDER'`.
2. Applique `ISO_WITH_NANOS.exec(input)` ; retourne `null` si pas de match.
3. Tronque la partie fractionnaire à 3 chiffres avec `slice(0, 3).padEnd(3, '0')`.
4. Injecte `'Z'` comme timezone si le groupe 3 est absent.
5. Reconstruit la chaîne ISO ms : `` `${basePart}.${fractional}${tz}` ``.
6. Appelle `Date.parse(iso)` ; retourne `null` si `NaN`.
7. Retourne `new Date(time)`.

**Comportement sur les formats :**

| Entrée | Fractionnaire capturée | Chaîne reconstituée | Résultat |
|--------|------------------------|---------------------|----------|
| `2025-03-12T15:34:48.560980651` | `560980651` | `2025-03-12T15:34:48.560Z` | `Date` valide, ms=560 |
| `2025-03-18T15:00:00.000Z` | `000` | `2025-03-18T15:00:00.000Z` | `Date` valide |
| `2025-03-12T15:34:48.999999999` | `999999999` | `2025-03-12T15:34:48.999Z` | `Date` valide, ms=999 |
| `2025-03-12T15:34:48` | absent | `2025-03-12T15:34:48.000Z` | `Date` valide, ms=0 |
| `NULL_VALUE_PLACEHOLDER` | — | — | `null` |
| `not-a-date` | — | — | `null` (no regex match) |

---

### `errors/ingestion-errors.ts`

**Type interne :**

```ts
type ErrorContext = Record<string, unknown>;
```

**Classe de base :**

```ts
export class IngestionError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus,
    public readonly context?: ErrorContext,
  )
```

Corps de la réponse HTTP construit par NestJS :

```json
{
  "code": "<code>",
  "message": "<message>",
  "context": { ... },
  "timestamp": "<ISO>"
}
```

**Sous-classes :**

| Classe | Code | HTTP | Contexte injecté |
|--------|------|------|-----------------|
| `InvalidUploadException` | `INVALID_UPLOAD` | 400 | `message` libre, `context?` optionnel |
| `MissingRequiredCsvException` | `MISSING_REQUIRED_CSV` | 400 | `{ fileName: string }` |
| `UnknownMadesNamespaceException` | `UNKNOWN_MADES_NAMESPACE` | 400 | `{ namespace: string \| null }` |
| `PayloadTooLargeException` | `PAYLOAD_TOO_LARGE` | 413 | `{ sizeBytes: number }` |
| `SnapshotNotFoundException` | `SNAPSHOT_NOT_FOUND` | 404 | `{ snapshotId: string }` |

---

## Patterns identifiés

- **Pure functions** : `normalizeNull` et `parseEcpDate` sont des fonctions pures (sans effets de bord, sans état mutable). Elles sont testables en isolation sans setup NestJS.
- **Module-scope constant** : la regex `ISO_WITH_NANOS` est compilée une seule fois au chargement du module, pas à chaque appel. Optimisation correcte pour une fonction appelée sur chaque cellule date de chaque ligne CSV.
- **Hiérarchie d'exceptions typées** : pattern standard NestJS pour mapper les erreurs domaine vers des statuts HTTP sans logique dans les filtres d'exception globaux.
- **Type générique préservateur** : `normalizeNull<T>` utilise `T | null` comme retour pour éviter de perdre l'information de type à la compilation (pattern TypeScript idiomatique).
- **Guard null/undefined coalescé** : `if (input == null)` (double égal) capture `null` ET `undefined` en une condition, pattern délibéré pour une fonction à entrée permissive.

---

## Consommateurs identifiés

| Consommateur | Utilise |
|---|---|
| `apps/api/src/ingestion/csv-reader.service.ts` | `normalizeNull`, `parseEcpDate` |
| `apps/api/src/ingestion/xml-mades-parser.service.ts` | `parseEcpDate` |
| `apps/api/src/ingestion/zip-extractor.service.ts` | `MissingRequiredCsvException`, `InvalidUploadException`, `PayloadTooLargeException` |
| `apps/api/src/ingestion/xml-mades-parser.service.ts` | `UnknownMadesNamespaceException` |
| `apps/api/src/snapshots/snapshots.service.ts` | `SnapshotNotFoundException` |

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/api/src/common/null-value-normalizer.spec.ts` | `normalizeNull` : placeholder → null, non-placeholder préservé, wildcard `*`, types non-string, constante exportée | Existant — 5 tests |
| `apps/api/src/common/date-parser.spec.ts` | `parseEcpDate` : format CSV nanos, format XML Z, null, chaîne vide, placeholder, chaîne invalide, troncature nanos | Existant — 7 tests |
| Tests pour `ingestion-errors.ts` | Comportement des classes d'exception | Absent |

**Observations :**
- Les deux fonctions pures sont bien couvertes par des tests unitaires ciblés.
- Les classes d'exception ne sont pas testées directement ; elles sont exercées indirectement via les tests d'intégration du pipeline (`full-ingestion.spec.ts`).
- Le cas `parseEcpDate('2025-03-12T15:34:48')` (date sans partie fractionnaire) n'est pas couvert explicitement mais le code le gère (`padEnd(3, '0')`).
