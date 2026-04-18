# Spec Technique — api/registry

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | registry            |
| App           | api                 |
| Version       | 0.1.1               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 1 remédiation |

## Architecture du module

Le module `registry` est un singleton NestJS marqué `@Global()`, injecté automatiquement dans tous les modules de l'application sans import explicite. Il implémente `OnModuleInit` pour déclencher le chargement des fichiers de données au boot de l'application, avant que le premier handler HTTP soit disponible.

Le chargement est parallèle (`Promise.all`) : le CSV ENTSO-E et le JSON overlay sont lus simultanément. Le module ne fournit aucun endpoint REST — c'est un service purement interne.

```
RegistryModule (@Global)
  └── RegistryService (singleton)
        ├── eicIndex : Map<string, EntsoeEntry>     ← chargé depuis eic-entsoe.csv
        ├── overlay  : RteOverlay                   ← chargé depuis eic-rte-overlay.json
        └── patternRegexes : { regex, process }[]   ← compilé depuis overlay.messageTypeClassification.patterns
```

### Résolution du chemin des fichiers

Depuis **Phase 1 (P1-2)**, la résolution du chemin est déplacée dans `onModuleInit()` — elle n'est plus calculée au niveau module :

```typescript
// onModuleInit()
this.registryRoot = process.env['REGISTRY_PATH']
  ?? resolve(process.cwd(), '../../packages/registry');
this.logger.log(`Registry root: ${this.registryRoot}`);
```

La constante module-level `REGISTRY_PACKAGE_ROOT` est supprimée. La variable d'environnement `REGISTRY_PATH` permet de surcharger le chemin sans modifier le code — ce qui débloque le déploiement Docker. Le fallback relatif `../../packages/registry` conserve le comportement dev-local existant.

Un log `Registry root: <path>` est émis au boot pour faciliter le diagnostic en environnement distant.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/api/src/registry/registry.service.ts` | Service principal — chargement, indexation, méthodes publiques | ~147 |
| `apps/api/src/registry/registry.module.ts` | Déclaration NestJS `@Global()` + export du service | ~9 |
| `apps/api/src/registry/types.ts` | Types TypeScript du module : `EntsoeEntry`, `RteOverlay`, `RteEndpointOverlay`, `ResolvedLocation` | ~43 |
| `apps/api/src/registry/registry.service.spec.ts` | Tests unitaires Vitest — 10 cas couvrant les 4 méthodes publiques | ~92 |
| `packages/registry/eic-entsoe.csv` | Registre ENTSO-E officiel — ~14 929 codes EIC (CSV `;`, BOM UTF-8) | ~14 930 |
| `packages/registry/eic-rte-overlay.json` | Overlay RTE — endpoints, geocodes, classification, couleurs (JSON versionné) | ~89 |

## Schéma BDD

Le `RegistryService` ne possède **aucune table Prisma**. Il est entièrement en mémoire. Les données qu'il produit (`ResolvedLocation`, `ProcessKey`) sont écrites dans les tables `Component` et `MessagePath` par `NetworkModelBuilderService`.

## API / Endpoints

Le module ne fournit **aucun endpoint REST public**. Les méthodes sont consommées uniquement en interne.

| Méthode publique | Signature | Description |
|-----------------|-----------|-------------|
| `onModuleInit()` | `async (): Promise<void>` | Déclenché par NestJS au boot — charge CSV + JSON en parallèle, compile les regexes |
| `resolveComponent(eic, organization)` | `(string, string): ResolvedLocation` | Cascade 4 niveaux de géocodage |
| `classifyMessageType(messageType)` | `(string): ProcessKey` | Cascade exact → regex → UNKNOWN |
| `processColor(process)` | `(ProcessKey): string` | Retourne la couleur hex du processus |
| `getOverlay()` | `(): RteOverlay` | Retourne l'overlay complet (utilisé par NetworkModelBuilder pour l'ensemble EIC RTE) |
| `lookupEntsoe(eic)` | `(string): EntsoeEntry \| null` | Accès direct à l'index ENTSO-E (utilisé dans les tests) |
| `entsoeSize()` | `(): number` | Taille de l'index (utilisé dans les tests) |

## Patterns identifiés

- **Singleton NestJS `@Global()`** : un seul provider pour toute l'application, injecté sans import explicite dans les modules consommateurs.
- **OnModuleInit hook** : chargement asynchrone des fichiers au boot, avant la disponibilité des handlers HTTP. Garantit que les données sont prêtes avant le premier appel à `resolveComponent` ou `classifyMessageType`.
- **In-memory index (Map)** : le CSV ENTSO-E (~14 929 entrées) est entièrement chargé dans un `Map<string, EntsoeEntry>` pour des lookups O(1) par EIC.
- **Cascade de résolution avec early return** : `resolveComponent` utilise des `if` guards avec return immédiat pour chaque niveau, sans else imbriqués. Lisibilité maximale de la cascade.
- **Compilation des regex au boot** : les patterns de classification sont compilés en `RegExp` objets dans `onModuleInit`, évitant la recompilation à chaque appel de `classifyMessageType`.
- **Data-only package** : `packages/registry` ne contient que des fichiers de données (CSV + JSON), sans code. Le chargement est entièrement à la charge du `RegistryService` côté API.

## Structure des types

```typescript
// types.ts
EntsoeEntry = {
  eic: string;
  displayName: string;   // EicDisplayName ou eic si absent
  longName: string;      // EicLongName
  country: string | null; // MarketParticipantIsoCountryCode (trimmed)
  vatCode: string | null;
  functionList: string | null;
}

RteOverlay = {
  version: string;                    // ex: "2026-04-18"
  rteEndpoints: RteEndpointOverlay[];
  rteComponentDirectory: { eic, displayName, lat, lng };
  rteBusinessApplications: { code, criticality }[];
  organizationGeocode: Record<string, { lat, lng, country }>;
  countryGeocode: Record<string, { lat, lng, label? }>;
  messageTypeClassification: {
    exact: Record<string, ProcessKey>;
    patterns: { match: string; process: ProcessKey }[];
  };
  processColors: Record<ProcessKey, string>;
}

ResolvedLocation = {
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;  // true = fallback Bruxelles
}
```

## Parsing du CSV ENTSO-E

```typescript
parseCsv(content, {
  columns: true,       // première ligne = headers
  delimiter: ';',      // séparateur point-virgule
  skip_empty_lines: true,
  trim: true,
  bom: true,           // gestion du BOM UTF-8 (fichier officiel ENTSO-E)
})
```

Colonnes consommées : `EicCode` (clé), `EicDisplayName`, `EicLongName`, `MarketParticipantIsoCountryCode`, `MarketParticipantVatCode`, `EicTypeFunctionList`. Les lignes sans `EicCode` sont ignorées silencieusement.

## Consommateurs identifiés dans le code

| Service consommateur | Méthodes utilisées |
|---------------------|-------------------|
| `NetworkModelBuilderService` | `resolveComponent`, `classifyMessageType`, `getOverlay` |
| `registry.service.spec.ts` (tests) | `entsoeSize`, `lookupEntsoe`, `resolveComponent`, `classifyMessageType`, `processColor` |

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/api/src/registry/registry.service.spec.ts` | Chargement ENTSO-E (taille + lookup par EIC) ; cascade `resolveComponent` (5 cas : overlay endpoint, overlay CD, org geocode, country geocode, défaut) ; `classifyMessageType` (exact, regex, UNKNOWN, wildcard) ; `processColor` (VP, MIXTE) | Existant |

Les tests chargent les vrais fichiers de données (pas de mock) via `onModuleInit()` — ce sont des tests d'intégration du service avec ses fichiers de données.

## Notes de déploiement

La résolution du chemin des fichiers registry est effectuée dans `onModuleInit()` :

```typescript
this.registryRoot = process.env['REGISTRY_PATH']
  ?? resolve(process.cwd(), '../../packages/registry');
```

En développement local (`pnpm dev:api` depuis `apps/api/`), `process.cwd()` vaut `apps/api/` et le chemin résolu est correct. Pour un déploiement Docker, définir `REGISTRY_PATH=/app/packages/registry` dans les variables d'environnement du conteneur.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|----------------|--------|
| `apps/api/src/registry/registry.service.spec.ts` | Chargement ENTSO-E (taille + lookup par EIC) ; cascade `resolveComponent` (5 cas) ; `classifyMessageType` (exact, regex, UNKNOWN, wildcard) ; `processColor` ; **REGISTRY_PATH env var positif** ; **ENOENT si chemin invalide** | Existant + 2 cas ajoutés (Phase 1) |
