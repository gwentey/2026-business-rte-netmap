# Spec Technique — api/imports

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/imports                     |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `imports` remplace les anciens `snapshots` en v2.0. Contrairement à v1, les imports ne persistent pas de modèle réseau enrichi : ils stockent des données brutes (composants et chemins tels que parsés depuis le ZIP). L'enrichissement géographique et la construction du graphe se font à la lecture via `GraphService.getGraph()` (compute-on-read).

Le code réside dans `apps/api/src/ingestion/` (pas de dossier `imports/` séparé). Le contrôleur et le service d'orchestration (`ImportsController`, `ImportsService`) sont co-localisés avec les parsers dans ce répertoire.

Voir [api/ingestion](../ingestion/spec-technique.md) pour le détail des parsers et du pipeline.

---

## Schéma BDD (tables écrites par ce module)

### Table `Import`

| Colonne | Type | Description |
|---------|------|-------------|
| id | UUID (PK) | Identifiant unique |
| envName | string | Nom de l'environnement (ex: OPF, PROD) |
| label | string | Label libre saisi par l'utilisateur |
| fileName | string | Nom original du fichier ZIP |
| fileHash | string | SHA256 du ZIP brut (détection doublons) |
| sourceComponentEic | string? | EIC extrait du nom de fichier si pattern reconnu |
| sourceDumpTimestamp | DateTime? | Timestamp extrait du nom de fichier |
| dumpType | string | 'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER' |
| zipPath | string | Chemin vers le ZIP repackagé sur disque (`storage/imports/{id}.zip`) |
| uploadedAt | DateTime | Heure d'import (default now()) |
| effectiveDate | DateTime | Date effective du dump (= sourceDumpTimestamp ?? uploadedAt) |
| warningsJson | string | JSON sérialisé des warnings produits à l'import |

Index : `(envName, effectiveDate)`, `(fileHash)`.

### Tables liées (cascade DELETE depuis Import)

| Table | Colonnes clés | Description |
|-------|--------------|-------------|
| `ImportedComponent` | importId, eic (unique par import), type, organization, country, lat, lng, isDefaultPosition, sourceType, displayName... | Composants bruts (lat/lng issus du parser, sans cascade) |
| `ImportedComponentUrl` | importedComponentId, network, url | URLs AMQPS/HTTPS associées à un composant |
| `ImportedPath` | importId, receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic, validFrom, validTo, isExpired | Chemins de messages bruts |
| `ImportedMessagingStat` | importId, sourceEndpointCode, remoteComponentCode, connectionStatus, lastMessageUp, lastMessageDown, sumMessagesUp, sumMessagesDown, deleted | Statistiques de connexion (depuis messaging_statistics.csv) |
| `ImportedAppProperty` | importId, key, value | Propriétés d'application (clés sensibles filtrées) |

Note : `ImportedComponent` a une contrainte UNIQUE sur `(importId, eic)`.

---

## Interfaces

Toutes les routes sont préfixées `/api` (configuré dans `main.ts`).

### POST /api/imports

Import d'un dump ECP. Décrit en détail dans [api/ingestion spec-technique](../ingestion/spec-technique.md).

Réponse 201 : `ImportDetail`.

### POST /api/imports/inspect

Inspection dry-run de N ZIPs (max 20). Retourne les métadonnées de chaque fichier sans persister.

Réponse 200 : `InspectResult[]`.

### GET /api/imports

Liste les imports, optionnellement filtrés par env (`?env=OPF`). Retourne les imports triés par `effectiveDate` décroissante avec compteurs (`componentsCount`, `pathsCount`, `messagingStatsCount`).

Réponse 200 : `ImportDetail[]`.

### DELETE /api/imports/:id

Supprime l'import en base (cascade : toutes les tables liées) et le ZIP sur disque.

Réponse 204.

### PATCH /api/imports/:id

Modifie le `label` et/ou l'`effectiveDate` d'un import existant.

Réponse 200 : `ImportDetail`.

### DTOs `@carto-ecp/shared`

```typescript
ImportSummary = {
  id: string; envName: string; label: string; fileName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  sourceComponentEic: string | null; sourceDumpTimestamp: string | null;
  uploadedAt: string; effectiveDate: string;
}

ImportDetail = ImportSummary & {
  warnings: Warning[];
  stats: { componentsCount: number; pathsCount: number; messagingStatsCount: number };
}

InspectResult = {
  fileName: string; fileSize: number; fileHash: string;
  sourceComponentEic: string | null; sourceDumpTimestamp: string | null;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence: 'HIGH' | 'FALLBACK'; reason: string;
  duplicateOf: { importId: string; label: string; uploadedAt: string } | null;
  warnings: Warning[];
}
```

---

## Dépendances

- `PrismaService` — lecture et écriture SQLite
- `ZipExtractorService`, `CsvReaderService`, `XmlMadesParserService`, `ImportBuilderService`, `RawPersisterService` — pipeline d'ingestion
- `@carto-ecp/shared` — types partagés
- `node:crypto` (createHash) — calcul SHA256 pour déduplication

---

## Invariants

1. La suppression d'un import supprime en cascade toutes ses données liées (Prisma `onDelete: Cascade`).
2. La suppression tente aussi de supprimer le ZIP sur disque (best effort, pas d'erreur si déjà absent).
3. `listImports` retourne toujours `ImportDetail[]` (pas `ImportSummary[]`), avec stats et warnings inclus.
4. `updateImport` est strict (`z.strict()`) : aucun champ inconnu n'est accepté.
5. Le `dumpType` d'un import est immuable après création (ADR-035) — le PATCH ne l'expose pas.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `imports.controller.spec.ts` | Cas nominaux et erreurs pour toutes les routes |
| `imports.service.spec.ts` | Orchestration, replace, inspect batch, listImports, updateImport, deleteImport |

Ref. croisées : [api/graph](../graph/spec-technique.md) — lit les données persistées par ce module pour construire le graphe compute-on-read. [api/envs](../envs/spec-technique.md) — liste les `envName` distincts depuis la table Import.
