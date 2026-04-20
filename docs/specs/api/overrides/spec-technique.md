# Spec Technique — api/overrides

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | api/overrides                   |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## Architecture

Le module `overrides` permet à l'administrateur de surcharger manuellement les métadonnées d'un composant EIC (displayName, type, organisation, pays, coordonnées, notes). Ces surcharges constituent le niveau 1 de la cascade 5 niveaux appliquée à la lecture dans `GraphService.getGraph`.

### Fichiers

| Fichier | Rôle |
|---------|------|
| `overrides.controller.ts` | Routes : GET /api/admin/components, PUT /api/overrides/:eic, DELETE /api/overrides/:eic |
| `overrides.service.ts` | Logique upsert/delete + construction de la vue admin (`AdminComponentRow`) |
| `overrides.module.ts` | Module NestJS |

---

## Interfaces

### Routes HTTP

| Méthode | Chemin | Description | Réponse |
|---------|--------|-------------|---------|
| GET | /api/admin/components | Liste tous les composants connus avec leur override éventuel | `AdminComponentRow[]` |
| PUT | /api/overrides/:eic | Crée ou met à jour une surcharge pour un EIC | Override upserted |
| DELETE | /api/overrides/:eic | Supprime la surcharge pour un EIC | 204 |

### Body PUT /api/overrides/:eic (JSON, strict)

Tous les champs sont optionnels et nullable :

| Champ | Type | Contrainte |
|-------|------|-----------|
| displayName | string \| null | max 256 |
| type | 'ENDPOINT' \| 'COMPONENT_DIRECTORY' \| 'BROKER' \| 'BA' \| null | - |
| organization | string \| null | max 256 |
| country | string \| null | exactement 2 caractères (ISO) |
| lat | number \| null | -90..90 |
| lng | number \| null | -180..180 |
| tagsCsv | string \| null | max 512 |
| notes | string \| null | max 2000 |

Validation via Zod avec `.strict()` : aucun champ inconnu accepté.

### Type `AdminComponentRow` (`@carto-ecp/shared`)

```typescript
AdminComponentRow = {
  eic: string;
  current: {
    displayName: string; type: string; organization: string | null;
    country: string | null; lat: number; lng: number; isDefaultPosition: boolean;
  };
  override: {
    displayName: string | null; type: string | null; organization: string | null;
    country: string | null; lat: number | null; lng: number | null;
    tagsCsv: string | null; notes: string | null; updatedAt: string;
  } | null;
  importsCount: number;
}
```

`current` reflète ce que le graphe afficherait après cascade (valeur effective). `override` est la surcharge brute en base (null si aucune).

### Table BDD `ComponentOverride`

| Colonne | Type | Description |
|---------|------|-------------|
| eic | string (PK) | Code EIC — unique, une seule surcharge par EIC |
| displayName | string? | Nom d'affichage surchargé |
| type | string? | Type surchargé |
| organization | string? | Organisation surchargée |
| country | string? | Pays (ISO 2) |
| lat | float? | Latitude |
| lng | float? | Longitude |
| tagsCsv | string? | Tags libres, CSV |
| notes | string? | Notes libres |
| updatedAt | DateTime | Mis à jour automatiquement (`@updatedAt`) |

---

## Dépendances

- `PrismaService` — lecture/écriture `ComponentOverride`, lecture `ImportedComponent` (pour `importsCount` et `current`)
- `RegistryService` — résolution de la valeur effective de `current` (via applyCascade implicite dans le service)
- `@carto-ecp/shared` — types `AdminComponentRow`, `OverrideUpsertInput`
- `zod` — validation stricte du body

---

## Invariants

1. Un seul `ComponentOverride` par EIC (clé primaire = eic). Le PUT fait un upsert (create or update).
2. La suppression d'un override ne supprime pas le composant — il continue d'apparaître dans le graphe en se basant sur les niveaux inférieurs de la cascade.
3. Les champs null dans un override signifient "pas de surcharge pour ce champ" (le niveau inférieur de la cascade s'applique).
4. `importsCount` dans `AdminComponentRow` représente le nombre d'imports distincts qui contiennent ce composant.
5. ADR-036 : PUT upsert plutôt que POST/PATCH séparés pour simplifier l'implémentation côté client.

---

## Tests

| Fichier spec | Couverture |
|-------------|-----------|
| `overrides.controller.spec.ts` | Validation Zod, upsert, delete, listAdminComponents |
| `overrides.service.spec.ts` | Upsert (create + update), delete, construction AdminComponentRow |

Ref. croisées : [api/graph](../graph/spec-technique.md) — consomme `ComponentOverride` comme niveau 1 de la cascade. [web/admin](../../web/admin/spec-technique.md) — interface utilisateur de gestion des overrides.
