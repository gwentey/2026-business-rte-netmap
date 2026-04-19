# RETRO-007 — Validation upload en trois couches : MIME allowlist, magic bytes, Zod

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-007                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | snapshots                      |
| App        | api                            |

## Contexte

L'endpoint `POST /api/snapshots` accepte un fichier binaire arbitraire uploadé par un utilisateur. Sans validation stricte, il est possible de soumettre un fichier malformé (non-ZIP), un fichier déguisé en ZIP par son extension ou son Content-Type, ou des champs texte invalides — ce qui provoquerait des erreurs d'ingestion opaques ou, au pire, du traitement de contenu non anticipé.

## Décision identifiée

Le controller applique trois couches de validation indépendantes et séquentielles avant de déléguer à `IngestionService` :

1. **MIME allowlist** (couche Multer, `fileFilter`) : seuls `application/zip`, `application/x-zip-compressed` et `application/octet-stream` sont acceptés. Le rejet intervient avant lecture du buffer. `application/octet-stream` est inclus car certains navigateurs ou systèmes d'exploitation l'utilisent comme MIME générique pour les fichiers `.zip`.

2. **Magic bytes** (couche controller, `file.buffer.subarray(0, 4)`) : les 4 premiers octets doivent correspondre à `0x50 0x4B 0x03 0x04` (signature locale ZIP). Cette vérification détecte les fichiers non-ZIP qui auraient passé le filtre MIME.

3. **Zod** (couche controller, `createSnapshotSchema.safeParse`) : `label` (1–200 caractères après trim) et `envName` (1–50 caractères après trim) sont validés. L'usage de `safeParse` plutôt que `parse` permet de récupérer les `issues` Zod et de les exposer dans le contexte de l'erreur `INVALID_UPLOAD`.

## Conséquences observées

### Positives
- Rejet précoce et explicite des entrées invalides avec des codes d'erreur métier (`INVALID_UPLOAD`) distincts selon la couche qui échoue.
- La vérification magic bytes protège contre les attaques de type "fichier déguisé" que le seul filtre MIME ne peut pas empêcher.
- Les messages d'erreur sont exploitables par le frontend pour afficher des retours utilisateur précis.

### Négatives / Dette
- Les trois validations sont dispersées entre le fileFilter Multer (déclaré inline dans le décorateur) et le corps de la méthode controller, rendant la logique moins lisible qu'un pipeline de guards NestJS explicites.
- Aucun test unitaire ne couvre les cas de rejet : MIME invalide, magic bytes erronés, label vide. Seuls les tests d'intégration couvrent le flux nominal.

## Recommandation

Garder — la stratégie défense en profondeur est appropriée pour un endpoint d'upload de fichier binaire. Envisager d'extraire la logique de validation dans un `UploadGuard` NestJS dédié pour améliorer la testabilité et la lisibilité.
