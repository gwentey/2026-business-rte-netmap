# ADR-031 — DumpTypeDetectorV2 via signatures CSV documentées

| Champ      | Valeur                                                      |
|------------|-------------------------------------------------------------|
| Numéro     | ADR-031                                                     |
| Statut     | Accepté                                                     |
| Date       | 2026-04-19                                                  |
| Auteur(s)  | Anthony + Claude                                            |
| Owner      | Anthony                                                     |
| Décideurs  | Anthony                                                     |
| Contexte   | Slice v2.0-2b Multi-upload                                  |
| Remplace   | ADR-030 (partiellement — heuristique 2a conservée en back-compat durant la migration) |
| Features   | *                                                           |
| App        | api                                                         |

## Contexte

La slice 2a utilisait une heuristique fragile : détecter la présence de `<?xml` dans le contenu du fichier `component_directory.csv` pour différencier ENDPOINT (avec blob XML imbriqué) et COMPONENT_DIRECTORY (sans blob XML). Cette heuristique est peu fiable et ne détecte pas les dumps BROKER. La documentation officielle ECP Administration Guide §4.20 liste précisément les tables incluses dans chaque type de backup, donnant des signatures exclusives par noms de fichier ZIP.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Signatures CSV exclusives | Inspecter les noms de fichiers dans le ZIP via `ZipExtractor.listEntries`, cascade du plus spécifique : `synchronized_directories.csv`/`component_statistics.csv`/`pending_*_directories.csv` → CD, `messaging_statistics.csv`/`message_upload_route.csv` → ENDPOINT, `broker.xml`/`bootstrap.xml` → BROKER, fallback CD | S | Détection HIGH confidence basée sur signatures officielles documentées, BROKER enfin détectable, pas besoin d'ouvrir les contenus | Aucun si les fichiers suivent la convention ECP standard |
| B — Inspection XML (v2a actuelle) | Lire `component_directory.csv`, chercher `<?xml` dans les cellules | S | Déjà implémenté | Fragile, BROKER non-détectable, peut faux-positive si un CSV inhabituel contient `<?xml` ailleurs |
| C — Demande manuelle systématique | Forcer l'utilisateur à choisir le type à l'upload | XS | Zéro fausse détection | Friction UX inutile pour le cas nominal (>99% des dumps suivent la convention) |

## Décision retenue

**Option choisie : A** — détection par signatures CSV exclusives. La méthode `detectDumpType(zipEntries, explicitOverride?)` retourne `{ dumpType, confidence: HIGH|FALLBACK, reason }`. Le champ `confidence` permet au frontend d'afficher un badge `⚠` invitant l'admin à override en cas de FALLBACK.

## Conséquences

### Positives
- Détection déterministe sur tous les dumps conformes à l'Admin Guide §4.20.
- BROKER détectable (via `broker.xml`/`bootstrap.xml`), ce qui permet au pipeline de le router correctement (metadata-only, pas de parse).
- Signature traçable : le `reason` retourné documente pourquoi la décision a été prise, utile pour debug.
- Aucune I/O sur le contenu des fichiers : pur examen des noms, rapide.

### Négatives
- Un backup ECP manuellement modifié (ex: admin qui supprime `messaging_statistics.csv` d'un dump ENDPOINT avant upload) peut basculer en FALLBACK. Acceptable : les signatures CD/ENDPOINT sont multiples, il faudrait en retirer plusieurs pour tromper la détection.
- Nécessite `ZipExtractor.listEntries` (nouvelle méthode, Task 2 du plan).

### Ce qu'on s'interdit désormais
- S'appuyer sur le contenu interne d'un fichier pour détecter le type, alors que la signature des noms suffit.
- Rejeter un upload à cause d'une détection ambiguë : le fallback retourne CD + `confidence=FALLBACK`, jamais une erreur.
- Supposer qu'un dump sans `<?xml` est garantis CD : utiliser la signature CSV.

## Ressources / Références

- `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` — liste officielle des tables de chaque backup
- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2b-design.md §B` — cascade détaillée
- `docs/adr/ADR-030-dump-type-detector-heuristique.md` — version v2a (remplacée partiellement)
