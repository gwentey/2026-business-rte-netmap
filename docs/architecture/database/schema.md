# Schéma BDD — Carto ECP v2.0

| Champ  | Valeur                          |
|--------|---------------------------------|
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | Prisma schema.prisma v2.0       |
| BDD    | SQLite (`apps/api/prisma/dev.db`) |

---

## Vue d'ensemble

La base de données v2.0 est organisée autour de 7 tables principales. Il n'y a plus de tables de graphe pré-calculé (`Snapshot`, `Component`, `MessagePath` de v1) — le graphe est calculé à la lecture (compute-on-read) depuis les données brutes importées.

```
Import (1)
  |-- (N) ImportedComponent (1)
  |           |-- (N) ImportedComponentUrl
  |-- (N) ImportedPath
  |-- (N) ImportedMessagingStat
  |-- (N) ImportedAppProperty

ComponentOverride  (indépendant, clé = eic)
EntsoeEntry        (indépendant, clé = eic)
```

---

## Tables

### `Import`

Table centrale : un import = un dump ECP persisté.

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | Identifiant unique |
| envName | String | Non | Environnement (OPF, PROD...) |
| label | String | Non | Label libre |
| fileName | String | Non | Nom original du fichier ZIP |
| fileHash | String | Non | SHA256 du ZIP brut (déduplication) |
| sourceComponentEic | String | Oui | EIC extrait du nom de fichier |
| sourceDumpTimestamp | DateTime | Oui | Timestamp extrait du nom de fichier |
| dumpType | String | Non | 'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER' |
| zipPath | String | Non | Chemin du ZIP repackagé sur disque |
| uploadedAt | DateTime | Non | Heure d'import (default: now()) |
| effectiveDate | DateTime | Non | Date effective du dump |
| warningsJson | String | Non | JSON des warnings (default: "[]") |

Index : `(envName, effectiveDate)`, `(fileHash)`.

### `ImportedComponent`

Un composant ECP brut (tel que parsé depuis le dump, sans enrichissement géographique).

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | |
| importId | String (FK Import) | Non | Cascade DELETE |
| eic | String | Non | Code EIC |
| type | String | Non | 'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER' \| 'BA' |
| organization | String | Oui | |
| personName | String | Oui | |
| email | String | Oui | |
| phone | String | Oui | |
| homeCdCode | String | Oui | |
| networksCsv | String | Oui | Réseaux séparés par virgule |
| displayName | String | Oui | Nom d'affichage parsé |
| country | String | Oui | Code pays ISO 2 |
| lat | Float | Oui | Latitude (null si non résolu) |
| lng | Float | Oui | Longitude (null si non résolu) |
| isDefaultPosition | Boolean | Non | true si lat/lng non fournis par le parser |
| sourceType | String | Non | 'XML_CD' \| 'LOCAL_CSV' |
| creationTs | DateTime | Oui | |
| modificationTs | DateTime | Oui | |

Contrainte UNIQUE : `(importId, eic)`.
Index : `(importId)`, `(eic)`.

### `ImportedComponentUrl`

URLs réseau d'un composant (AMQPS, HTTPS...).

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | |
| importedComponentId | String (FK ImportedComponent) | Non | Cascade DELETE |
| network | String | Non | Nom du réseau |
| url | String | Non | URL |

Index : `(importedComponentId)`.

### `ImportedPath`

Un chemin de message brut (paire sender/receiver + messageType).

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | |
| importId | String (FK Import) | Non | Cascade DELETE |
| receiverEic | String | Non | EIC du receveur (peut être '*') |
| senderEic | String | Non | EIC de l'émetteur (peut être '*') |
| messageType | String | Non | Type de message ECP |
| transportPattern | String | Non | 'DIRECT' \| 'INDIRECT' |
| intermediateBrokerEic | String | Oui | EIC du broker intermédiaire |
| validFrom | DateTime | Oui | |
| validTo | DateTime | Oui | |
| isExpired | Boolean | Non | true si validTo < effectiveDate (default: false) |

Index : `(importId)`, `(receiverEic, senderEic)`, `(receiverEic, senderEic, messageType, transportPattern, intermediateBrokerEic)`.

### `ImportedMessagingStat`

Statistiques de connexion (depuis `messaging_statistics.csv` des dumps Endpoint).

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | |
| importId | String (FK Import) | Non | Cascade DELETE |
| sourceEndpointCode | String | Non | EIC ou code de l'endpoint local |
| remoteComponentCode | String | Non | Code du composant distant |
| connectionStatus | String | Oui | |
| lastMessageUp | DateTime | Oui | |
| lastMessageDown | DateTime | Oui | |
| sumMessagesUp | Int | Non | (default: 0) |
| sumMessagesDown | Int | Non | (default: 0) |
| deleted | Boolean | Non | (default: false) |

Index : `(importId)`, `(importId, remoteComponentCode)`.

### `ImportedAppProperty`

Propriétés d'application (depuis `application_property.csv`). Les clés sensibles sont filtrées avant insertion.

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| id | String (UUID, PK) | Non | |
| importId | String (FK Import) | Non | Cascade DELETE |
| key | String | Non | Clé de propriété |
| value | String | Non | Valeur |

Index : `(importId)`.

### `ComponentOverride`

Surcharges manuelles des métadonnées d'un composant EIC. Niveau 1 de la cascade dans GraphService.

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| eic | String (PK) | Non | Code EIC (une seule surcharge par EIC) |
| displayName | String | Oui | |
| type | String | Oui | |
| organization | String | Oui | |
| country | String | Oui | Code ISO 2 |
| lat | Float | Oui | |
| lng | Float | Oui | |
| tagsCsv | String | Oui | |
| notes | String | Oui | |
| updatedAt | DateTime | Non | Mis à jour automatiquement (`@updatedAt`) |

### `EntsoeEntry`

Annuaire ENTSO-E uploadé via /api/entsoe/upload. Niveau 2 de la cascade dans GraphService.

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| eic | String (PK) | Non | Code EIC |
| displayName | String | Oui | Nom long ENTSO-E |
| organization | String | Oui | EicDisplayName |
| country | String | Oui | Code ISO 2 |
| function | String | Oui | EicTypeFunctionList |
| refreshedAt | DateTime | Non | Date du dernier upload |

---

## Diagramme de relations (ASCII)

```
Import
├── id (PK, UUID)
├── envName
├── dumpType
├── effectiveDate
├── uploadedAt
│
├──< ImportedComponent (importId FK, CASCADE)
│       ├── id (PK)
│       ├── eic
│       ├── type
│       ├── lat, lng, isDefaultPosition
│       └──< ImportedComponentUrl (importedComponentId FK, CASCADE)
│
├──< ImportedPath (importId FK, CASCADE)
│       ├── id (PK)
│       ├── receiverEic
│       ├── senderEic
│       ├── messageType
│       └── isExpired
│
├──< ImportedMessagingStat (importId FK, CASCADE)
│       ├── id (PK)
│       ├── sourceEndpointCode
│       ├── remoteComponentCode
│       └── lastMessageUp
│
└──< ImportedAppProperty (importId FK, CASCADE)
        ├── id (PK)
        └── key, value

ComponentOverride
└── eic (PK)   -- Niveau 1 cascade GraphService

EntsoeEntry
└── eic (PK)   -- Niveau 2 cascade GraphService
```

---

## Migrations

Migrations Prisma dans `apps/api/prisma/migrations/`. Commande : `pnpm --filter @carto-ecp/api prisma:migrate`.

---

## Tables supprimées en v2.0 (v1 -> v2)

| Table v1 | Remplacée par |
|----------|--------------|
| `Snapshot` | `Import` |
| `Component` | `ImportedComponent` (brut, sans géocodage) |
| `ComponentUrl` | `ImportedComponentUrl` |
| `MessagePath` | `ImportedPath` (brut, sans process calculé) |
| `MessagingStatistic` | `ImportedMessagingStat` |
| `AppProperty` | `ImportedAppProperty` |

Le graphe enrichi (avec coordonnées, process, direction) n'est plus persisté — il est calculé à la lecture par `GraphService.getGraph()`.
