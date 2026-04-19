# RETRO-003 — Sécurité : exclusion des fichiers et clés sensibles par whitelist

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-003                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

Les backups ECP contiennent des données hautement sensibles : clés privées, registres de certificats, inventaires internes (`local_key_store.csv`, `registration_store.csv`, `registration_requests.csv`). Les clés de configuration (`application_property.csv`) incluent également des mots de passe et secrets. Ces données ne doivent jamais être persistées en base ni exposées via l'API.

## Décision identifiée

Deux mécanismes d'exclusion indépendants sont implémentés :

**Niveau extraction (ZipExtractorService)** : les 3 fichiers CSV sensibles sont dans `SENSITIVE_CSV_FILES` et exclus de la `Map<filename, Buffer>` avant tout parsing. Ils peuvent rester dans le zip archivé sur disque mais ne transitent jamais en mémoire applicative.

**Niveau persistance (SnapshotPersisterService)** : les `AppProperty` dont la clé correspond à la regex `/password|secret|keystore\.password|privateKey|credentials/i` sont filtrées via `filterSensitive()` avant le `createMany` Prisma. Les clés sensibles présentes dans le zip archivé sont donc absentes de la base.

Les constantes `SENSITIVE_CSV_FILES` sont exportées depuis `types.ts` et constituaient la source de vérité unique utilisée par `ZipExtractorService`.

## Conséquences observées

### Positives
- Double protection : même si un futur bug permettait de charger un fichier sensible, le filtre AppProperty serait une deuxième barrière.
- Les fichiers sensibles gitignorés (`tests/fixtures/**/local_key_store.csv` etc.) ne peuvent pas être committés accidentellement — double protection via `.gitignore` ET exclusion de parsing.
- La liste des fichiers exclus est visible et explicite dans le code source (`SENSITIVE_CSV_FILES`).

### Négatives / Dette
- Le zip original est archivé sur disque dans `storage/snapshots/{uuid}.zip` et **contient** les fichiers sensibles. L'accès physique au serveur (ou à `storage/`) expose ces données. Il n'y a pas de re-packaging du zip pour retirer les fichiers sensibles avant archivage.
- La regex de filtrage AppProperty est codée en dur dans `filterSensitive()`. Toute nouvelle clé sensible doit être ajoutée manuellement.
- Aucun test vérifie l'exclusion des fichiers sensibles au niveau `ZipExtractorService` de façon séparée des tests unitaires déjà présents.

## Recommandation

Garder les deux mécanismes. Envisager pour un slice futur : (1) re-packager le zip archivé en retirant les fichiers sensibles avant écriture sur disque, (2) externaliser la liste des patterns de clés sensibles dans la configuration ou le registry.
