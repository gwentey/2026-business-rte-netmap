# RETRO-008 — Zod sans class-validator : validation manuelle via safeParse dans le controller

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-008                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | snapshots                      |
| App        | api                            |

## Contexte

NestJS propose un mécanisme de validation des DTOs via le `ValidationPipe` global couplé à `class-validator` et `class-transformer`. Ce pattern est le standard documenté dans la documentation NestJS officielle. Cependant, l'endpoint `POST /api/snapshots` utilise Zod à la place, appelé manuellement dans le controller avec `safeParse`.

## Décision identifiée

Le DTO `createSnapshotSchema` est un schéma Zod pur (`z.object({...})`), sans classe décorée ni `class-validator`. La validation est invoquée manuellement dans la méthode `create()` du controller :

```typescript
const parsed = createSnapshotSchema.safeParse(body);
if (!parsed.success) {
  throw new InvalidUploadException('Champs label/envName invalides', {
    issues: parsed.error.issues,
  });
}
```

Ce choix implique que le `ValidationPipe` NestJS n'est pas utilisé pour ce endpoint. Le body est reçu comme `Record<string, string>` brut.

## Conséquences observées

### Positives
- Zod offre une inférence TypeScript native (`z.infer<typeof schema>`) sans génération de code ou decorateurs, ce qui est cohérent avec la philosophie TypeScript-first du projet.
- `safeParse` permet de récupérer les `issues` structurées et de les propager dans le contexte de l'erreur HTTP, facilitant le débogage frontend.
- Pas de dépendance à `class-transformer` (qui peut créer des frictions avec le module NestJS et l'émission de métadonnées decorateurs).

### Négatives / Dette
- L'approche est incohérente avec le pattern NestJS standard `ValidationPipe` + `class-validator`. Si d'autres endpoints sont ajoutés avec `ValidationPipe`, les deux styles coexistent dans la même API.
- La validation manuelle dans le controller alourdit la méthode et déplace la responsabilité hors de la couche DTO/pipe.
- Aucun `ParseIntPipe`, `ParseUUIDPipe` ou pipe similaire n'est utilisé sur les paramètres `:id` ou `?envName`, laissant ces valeurs non typées côté runtime.

## Recommandation

Garder pour ce module — Zod est adapté et la cohérence interne du module est maintenue. Si l'API s'étend avec de nouveaux modules, décider d'une stratégie unifiée : soit adopter Zod partout (avec un `ZodValidationPipe` custom ou la librairie `nestjs-zod`), soit revenir à `class-validator` pour les nouveaux endpoints et conserver Zod uniquement pour les cas multipart.
