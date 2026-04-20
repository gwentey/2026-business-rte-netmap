# Spec Fonctionnelle — api/common [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | api/common          |
| Version    | 2.0.0               |
| Date       | 2026-04-20          |
| Source     | v2.0 post-implémentation |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

*Aucun ADR lié.*

> *Table auto-générée par adr-linker. Ne pas éditer manuellement.*

---

## Contexte et objectif

Le module `common` regroupe les utilitaires transverses partagés par les services du pipeline d'ingestion backend (`api`). Il ne contient aucune logique métier propre, mais fournit les briques de bas niveau sans lesquelles les CSVs et le XML ECP ne peuvent pas être interprétés correctement. Trois responsabilités distinctes coexistent dans ce module :

1. **Normalisation des valeurs nulles CSV** : le format de backup ECP représente les cellules vides par la chaîne littérale `NULL_VALUE_PLACEHOLDER`. Cette convention ECP-propriétaire doit être convertie en `null` natif JavaScript avant tout traitement.
2. **Parsing des dates ECP** : deux formats de dates coexistent dans les données ECP — un dans les CSVs (nanosecondes, sans suffixe timezone), un dans le XML MADES (millisecondes avec `Z`). Une fonction unifiée gère les deux formats.
3. **Typage des erreurs d'ingestion** : une hiérarchie de classes d'exception typées permet aux services du pipeline de signaler les erreurs bloquantes avec un code machine et un statut HTTP précis.

---

## Règles métier (déduites du code)

### Normalisation des nulls

1. La chaîne exacte `NULL_VALUE_PLACEHOLDER` (casse stricte) est la seule valeur convertie en `null`. Toutes les autres chaînes — y compris `NULL`, `null`, chaîne vide `""`, et wildcard `*` — sont préservées telles quelles.
2. La fonction `normalizeNull` est générique (`<T>`). Elle accepte n'importe quel type de valeur ; les valeurs non-chaîne (nombres, booléens) ne sont jamais converties et sont retournées inchangées.
3. La constante `NULL_VALUE_PLACEHOLDER` est exportée afin que les consommateurs puissent effectuer des comparaisons directes sans hard-coder la chaîne magique.

### Parsing des dates ECP

4. La fonction `parseEcpDate` accepte deux formats ISO en entrée :
   - **Format CSV** : ISO 8601 avec nanosecondes, sans indicateur de timezone (ex. `2025-03-12T15:34:48.560980651`). Interprété en UTC par défaut (suffixe `Z` injecté).
   - **Format XML** : ISO 8601 avec millisecondes et suffixe `Z` (ex. `2025-03-18T15:00:00.000Z`). Passé tel quel à `Date.parse`.
5. Les nanosecondes sont tronquées (non arrondies) à la milliseconde : seuls les 3 premiers chiffres de la partie fractionnaire sont conservés ; les chiffres manquants sont complétés par des zéros à droite.
6. Les entrées suivantes retournent `null` sans exception : `null`, `undefined`, chaîne vide `""`, chaîne `NULL_VALUE_PLACEHOLDER`, toute chaîne ne correspondant pas au pattern regex ISO.
7. Un résultat `NaN` de `Date.parse` — par exemple une date calendrier invalide comme `2025-02-30` — retourne également `null` sans exception.
8. Les fuseaux horaires explicites (ex. `+02:00`) sont préservés dans la chaîne reconstituée avant parsing.

### Erreurs d'ingestion

9. Toutes les exceptions du pipeline héritent de `IngestionError`, qui étend `HttpException` de NestJS. La réponse HTTP inclut systématiquement : `code` (chaîne machine), `message` (phrase lisible), `context` (objet de détail optionnel), `timestamp` (ISO de l'instant de levée).
10. Chaque sous-classe fixe son `code` machine et son statut HTTP de manière non modifiable :

| Classe | Code | Statut HTTP |
|--------|------|-------------|
| `InvalidUploadException` | `INVALID_UPLOAD` | 400 Bad Request |
| `MissingRequiredCsvException` | `MISSING_REQUIRED_CSV` | 400 Bad Request |
| `UnknownMadesNamespaceException` | `UNKNOWN_MADES_NAMESPACE` | 400 Bad Request |
| `PayloadTooLargeException` | `PAYLOAD_TOO_LARGE` | 413 Payload Too Large |
| `ImportNotFoundException` | `IMPORT_NOT_FOUND` | 404 Not Found |

11. `MissingRequiredCsvException` injecte le nom du fichier manquant dans le contexte.
12. `UnknownMadesNamespaceException` accepte `null` comme valeur de namespace (cas où l'attribut XML est absent).
13. `PayloadTooLargeException` injecte la taille en octets du fichier refusé.
14. `ImportNotFoundException` injecte l'identifiant de l'import introuvable.

---

## Cas d'usage (déduits)

### CU-001 — Normalisation d'une cellule CSV nulle

**Acteur :** `CsvReader` lors du post-processing des lignes CSV.

**Flux principal :**
1. `CsvReader` lit une cellule CSV dont la valeur brute est `NULL_VALUE_PLACEHOLDER`.
2. Il appelle `normalizeNull(cellValue)`.
3. La fonction retourne `null`.
4. La ligne typée contient `null` à la place de la chaîne magique.

**Variante — valeur non nulle :**
La chaîne `*` (wildcard endpoint) passe dans `normalizeNull`, ressort inchangée, et est traitée séparément par la logique métier downstream.

---

### CU-002 — Parsing d'une date issue d'un CSV ECP

**Acteur :** `CsvReader` lors du typage des colonnes date.

**Flux principal :**
1. `CsvReader` reçoit une valeur de colonne date au format `2025-03-12T15:34:48.560980651`.
2. Il appelle `parseEcpDate('2025-03-12T15:34:48.560980651')`.
3. La regex capture la partie de base (`2025-03-12T15:34:48`), la partie fractionnaire (`560980651`) et l'absence de timezone.
4. La partie fractionnaire est tronquée à `560`, complétée à `560` (3 chiffres exacts).
5. Le suffixe `Z` est injecté : `2025-03-12T15:34:48.560Z`.
6. `Date.parse` retourne un timestamp valide.
7. Un objet `Date` est retourné avec milliseconde = 560.

---

### CU-003 — Parsing d'une date issue du XML MADES

**Acteur :** `XmlMadesParser` lors du typage des attributs date des `<path>`.

**Flux principal :**
1. Le parser reçoit la valeur `2025-03-18T15:00:00.000Z`.
2. Il appelle `parseEcpDate('2025-03-18T15:00:00.000Z')`.
3. La regex capture la base, la fractionnaire (`000`), et le timezone `Z`.
4. La chaîne ISO est reconstituée telle quelle : `2025-03-18T15:00:00.000Z`.
5. Un `Date` valide est retourné.

---

### CU-004 — Signalement d'un CSV obligatoire absent

**Acteur :** `ZipExtractor` lors de la vérification des fichiers requis.

**Flux principal :**
1. `ZipExtractor` constate l'absence de `component_directory.csv` dans le zip.
2. Il lève `new MissingRequiredCsvException('component_directory.csv')`.
3. NestJS intercepte l'exception et retourne une réponse 400 avec le corps :
   ```json
   { "code": "MISSING_REQUIRED_CSV", "message": "Le fichier component_directory.csv est absent du zip", "context": { "fileName": "component_directory.csv" }, "timestamp": "..." }
   ```
4. L'ingestion est interrompue ; aucune donnée n'est persistée.

---

### CU-005 — Signalement d'un namespace XML MADES inconnu

**Acteur :** `XmlMadesParser`.

**Flux principal :**
1. Le parser extrait l'attribut namespace du XML.
2. La valeur ne correspond pas à `http://mades.entsoe.eu/componentDirectory`.
3. Il lève `new UnknownMadesNamespaceException(namespace)`.
4. Réponse 400 avec code `UNKNOWN_MADES_NAMESPACE` et le namespace fautif dans le contexte.

---

## Dépendances

- `@nestjs/common` — `HttpException`, `HttpStatus` (pour `IngestionError`)
- Aucune dépendance sur un service NestJS interne : les deux utilitaires sont des fonctions pures exportées, non injectables.
- Aucun module NestJS déclaré pour `common` : les utilitaires sont importés directement par les services consommateurs.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- Le comportement souhaité lorsqu'une date CSV a une partie fractionnaire de 0 chiffres (ex. `2025-03-12T15:34:48`) : le code gère ce cas (`fractionalRaw` absent → `000`), mais il n'est pas couvert par les tests — est-ce intentionnel ?
- `parseEcpDate` gère en interne le cas `NULL_VALUE_PLACEHOLDER` (retourne `null`). `normalizeNull` fait de même. La duplication de cette règle entre les deux fonctions semble intentionnelle pour que `parseEcpDate` soit utilisable directement sur des colonnes date sans pré-normalisation, mais cela n'a pas été confirmé.
- Il n'existe pas de classe `CommonModule` NestJS : les utilitaires sont des fonctions statiques importées directement. Ce choix d'architecture (pas d'injection) est pragmatique pour des fonctions pures, mais n'a pas été formalisé dans la documentation de conception.
- La limite de 50 MB vérifiée dans `PayloadTooLargeException` est documentée dans le design (§6.2), mais la valeur exacte (50 MB = 52 428 800 octets ?) n'est pas visible dans `ingestion-errors.ts` — elle est gérée par le consommateur (`ZipExtractor`).
