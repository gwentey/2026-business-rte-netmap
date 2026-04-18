# Spec Fonctionnelle — api/snapshots [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/snapshots       |
| Version    | 0.1.0               |
| Date       | 2026-04-17          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [RETRO-007](../../../adr/RETRO-007-validation-upload-en-couches-mime-magic-bytes-zod.md) | Validation upload en trois couches : MIME allowlist, magic bytes, Zod | Documenté (rétro) |
| [RETRO-008](../../../adr/RETRO-008-zod-sans-class-validator-validation-manuelle-safeParse.md) | Zod sans class-validator : validation manuelle via safeParse dans le controller | Documenté (rétro) |

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `snapshots` est la façade REST du cycle de vie des snapshots ECP. Il permet à un utilisateur de déposer un backup ECP zippé accompagné de métadonnées (label, environnement), de consulter la liste des snapshots déjà ingérés, et d'obtenir le détail complet d'un snapshot identifié par son UUID.

Ce module est le point d'entrée de l'utilisateur pour déclencher la pipeline d'ingestion (déléguée à `IngestionService`) et pour interroger les résultats persistés (déléguée à `SnapshotsService` via Prisma).

---

## Règles métier (déduites du code)

1. **Limite de taille** : un zip uploadé ne peut pas dépasser 50 MB. Tout dépassement est rejeté avant l'ingestion avec une erreur `INVALID_UPLOAD`.

2. **Allowlist MIME** : le champ `Content-Type` du fichier doit appartenir à l'ensemble `{application/zip, application/x-zip-compressed, application/octet-stream}`. Tout autre MIME est rejeté immédiatement au niveau de Multer, avant même la lecture du buffer.

3. **Vérification magic bytes** : même si le MIME est autorisé, les 4 premiers octets du buffer doivent correspondre à la signature ZIP (`PK\x03\x04`, soit `0x50 0x4B 0x03 0x04`). Un fichier non-ZIP déguisé en ZIP est rejeté avec `INVALID_UPLOAD` et le message "Signature ZIP invalide (magic bytes)".

4. **Validation des champs texte** : `label` doit être une chaîne non vide (après trim) de 1 à 200 caractères. `envName` doit être une chaîne non vide (après trim) de 1 à 50 caractères. La validation est effectuée via le schéma Zod `createSnapshotSchema` ; l'échec produit une erreur `INVALID_UPLOAD` contenant les `issues` Zod.

5. **Délégation à l'ingestion** : une fois les validations passées, le controller délègue intégralement le traitement à `IngestionService.ingest()`. Le résultat retourné est le détail complet du snapshot créé (identique à `GET /api/snapshots/:id`).

6. **Filtrage par environnement** : `GET /api/snapshots` accepte un paramètre query optionnel `envName`. En présence de ce paramètre, seuls les snapshots dont le champ `envName` correspond exactement sont retournés. Sans paramètre, tous les snapshots sont retournés.

7. **Tri chronologique inverse** : la liste des snapshots est triée par `uploadedAt` décroissant (le plus récent en premier).

8. **Comptage des warnings en liste** : pour chaque snapshot de la liste, `warningCount` expose le nombre de warnings issus du champ `warningsJson` Prisma. Si ce champ JSON est corrompu ou absent, `warningCount` vaut `0` (fallback `safeParseWarnings`).

9. **Détail enrichi** : `GET /api/snapshots/:id` retourne, en plus des champs de la liste, les compteurs relationnels (`componentsCount`, `pathsCount`, `statsCount`) calculés via une requête `_count` Prisma, ainsi que le tableau complet `warnings` parsé depuis `warningsJson`. Un snapshot introuvable produit une erreur `SNAPSHOT_NOT_FOUND` (HTTP 404).

10. **Fallback warnings** : `safeParseWarnings` retourne toujours un tableau (jamais d'exception levée). Si `warningsJson` n'est pas un JSON valide ou n'est pas un tableau, le résultat est `[]`.

11. **Code de retour création** : `POST /api/snapshots` retourne HTTP 201 en cas de succès.

---

## Cas d'usage (déduits)

### CU-001 — Uploader un backup ECP

**Acteur** : utilisateur frontend (page upload)

**Préconditions** : l'utilisateur dispose d'un zip de backup ECP (Endpoint ou CD) et connaît son label et son environnement (ex. `OPF`, `PROD`).

**Flux principal** :
1. L'utilisateur envoie une requête `POST /api/snapshots` en multipart avec les champs `zip` (fichier), `label` (texte), `envName` (texte).
2. Multer intercepte et vérifie le MIME type.
3. Le controller vérifie la signature magic bytes.
4. Le controller valide `label` et `envName` via Zod.
5. `IngestionService.ingest()` est appelé avec le buffer zip, le label et l'envName.
6. L'API retourne HTTP 201 avec le `SnapshotDetail` complet (id, stats, warnings).

**Flux alternatifs** :
- MIME non autorisé → HTTP 400 `INVALID_UPLOAD`
- Signature ZIP invalide → HTTP 400 `INVALID_UPLOAD`
- `label` ou `envName` invalide → HTTP 400 `INVALID_UPLOAD` avec les issues Zod
- Zip > 50 MB → HTTP 413 `PAYLOAD_TOO_LARGE`
- Erreur d'ingestion bloquante (ex. CSV requis manquant, namespace XML inconnu) → erreur correspondante propagée

### CU-002 — Lister les snapshots disponibles

**Acteur** : utilisateur frontend (sélecteur de snapshot)

**Flux principal** :
1. `GET /api/snapshots` (sans filtre) retourne la liste complète des snapshots triée par date décroissante.
2. Chaque entrée expose : `id`, `label`, `envName`, `componentType`, `sourceComponentCode`, `cdCode`, `uploadedAt`, `warningCount`.

**Variante filtrée** : `GET /api/snapshots?envName=OPF` retourne uniquement les snapshots de l'environnement OPF.

### CU-003 — Consulter le détail d'un snapshot

**Acteur** : utilisateur frontend (après ingestion ou via sélecteur)

**Flux principal** :
1. `GET /api/snapshots/:id` avec un UUID valide retourne le `SnapshotDetail` complet.
2. Les champs supplémentaires par rapport à la liste : `organization`, `stats.componentsCount`, `stats.pathsCount`, `stats.statsCount`, `warnings[]`.

**Flux alternatif** : snapshot inexistant → HTTP 404 `SNAPSHOT_NOT_FOUND`.

---

## Dépendances

- `IngestionService` (via `IngestionModule`) — traitement complet du zip
- `SnapshotsService` — lecture Prisma des snapshots
- `PrismaService` — accès SQLite
- `@carto-ecp/shared` — types `SnapshotSummary`, `SnapshotDetail`, `Warning`
- `multer` / `@nestjs/platform-express` — gestion du multipart
- `zod` — validation des champs texte du formulaire

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- La raison pour laquelle `application/octet-stream` est inclus dans l'allowlist MIME n'est pas documentée. Certains navigateurs/OS envoient ce MIME générique pour les fichiers zip — c'est probablement la motivation, mais elle n'est pas explicitée dans le code.
- Il n'est pas déterminable par le code si `envName` est un champ à valeur libre ou si une liste de valeurs canoniques (ex. `OPF`, `PROD`, `PFRFI`) est attendue. Les fixtures de test utilisent `OPF` mais aucune validation d'enum n'est présente.
- L'organisation (`organization`) dans `SnapshotDetail` est nullable (`string | null`) : la condition qui la rend nulle n'est pas visible dans ce module (elle provient de la persistance amont).
- Aucun mécanisme de suppression de snapshot n'est implémenté dans ce module (pas de `DELETE /api/snapshots/:id`). Il n'est pas clair si c'est une décision explicite ou un manque prévu pour un slice ultérieur.
