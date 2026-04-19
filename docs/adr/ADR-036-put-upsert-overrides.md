# ADR-036 — Endpoint upsert `PUT /api/overrides/:eic` (vs POST+PATCH)

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | ADR-036                        |
| Statut     | Accepté                        |
| Date       | 2026-04-20                     |
| Auteur(s)  | Anthony + Claude               |
| Owner      | Anthony                        |
| Décideurs  | Anthony                        |
| Contexte   | Slice v2.0-2c-2 Admin composants |
| Remplace   | —                              |
| Features   | *                              |
| App        | api                            |

## Contexte

Les `ComponentOverride` sont keyés par `eic` (primary key stable, sans uuid auto-généré). La slice 2c-2 introduit des endpoints CRUD admin pour gérer ces overrides (displayName, type, organization, country, lat/lng, tags, notes). Question architecturale : quel style d'API REST utiliser pour créer ou modifier un override ? Deux approches canoniques se dessinent : (A) `PUT /api/overrides/:eic` idempotent (upsert), ou (B) `POST /api/overrides` + `PATCH /api/overrides/:eic` (style POST create, PATCH update classique).

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — `PUT /api/overrides/:eic` upsert | 1 seul endpoint ; create ou update selon existence de l'EIC ; sémantique idempotente (RFC 7231) | XS | Simplicité, sémantique idempotente, cohérent avec `eic` PK stable, retry-safe, un seul endpoint à maintenir | Moins "REST canonique" qu'un POST/PATCH séparé (mais acceptable) |
| B — `POST /api/overrides` + `PATCH /api/overrides/:eic` | 2 endpoints distincts ; POST crée (409 si existe déjà), PATCH met à jour | S | Conventions REST classiques (POST = creation, PATCH = modification) | 2 endpoints à maintenir, client doit gérer 409 Conflict sur duplicate, logique côté client plus complexe |
| C — `POST /api/overrides/:eic/upsert` | Hybride explicite ; route non-standard mais lisible | XS | Explicite pour le client | Route non-standard, moins clean que PUT, viole la sémantique REST pure |

## Décision retenue

**Option A : `PUT /api/overrides/:eic` idempotent.**

L'EIC est la PK stable de la ressource `ComponentOverride`. PUT est sémantiquement approprié : la requête envoie l'état souhaité pour une ressource identifiée par l'URL (l'EIC). La sémantique idempotente (RFC 7231 §4.3.4) signifie que rejouer la même requête produit le même résultat, ce qui est exactement ce que l'on souhaite pour un upsert. Le client n'a pas à distinguer "créer" et "modifier" — il envoie la ressource dans l'état souhaité et le serveur s'arrange. Un seul endpoint simplifie la maintenance.

## Conséquences

### Positives
- **Un seul endpoint à maintenir.** Pas de duplication entre POST create et PATCH update.
- **Sémantique idempotente.** La requête peut être rejouée en toute sécurité (retry-safe, utile en cas d'erreur réseau).
- **Cohérent avec la PK stable.** Puisque `eic` est la clé primaire sans uuid auto-généré, l'identifier dans l'URL est naturel.
- **Moins de gestion d'erreur côté client.** Pas de 409 Conflict à attraper et réagir (switch vers PATCH).

### Négatives
- **Moins "REST canonique."** Le style POST/PATCH séparé est plus conventionnel dans les APIs REST. Cependant, PUT upsert est reconnu et accepté par la communauté REST (notamment dans le contexte de ressources identifiées par l'URL).
- **Pas de distinction explicite entre création et modification.** Le serveur trace la distinction en interne, mais le client n'a pas de feedback explicite. Acceptable car le frontend reçoit la ressource mise à jour/créée en réponse.

### Ce qu'on s'interdit désormais
- Ajouter un endpoint `POST /api/overrides` créant un override (duplication avec PUT).
- Utiliser `PATCH /api/overrides/:eic` sans passer par PUT (inconsistance).
- Changer de sémantique plus tard (ex : "faire de PUT une true update et ajouter POST pour creation") — cette décision est verrouillée.

## Ressources / Références

- `docs/superpowers/specs/2026-04-20-carto-ecp-v2-slice-2c-2-design.md` — spécification fonctionnelle de la slice 2c-2.
- **RFC 7231 §4.3.4 — PUT method.** "An origin server SHOULD NOT send a 2xx (Successful) response status code if the request method was PUT and the server has a different understanding of the resource state before processing the request. In particular, the server MUST NOT use a response status code of 200 (OK) or 204 (No Content) if the PUT method did not actually create the representation."
- **Prisma `upsert`** : implémentation côté service utilisera `prisma.componentOverride.upsert({ where: { eic }, create: {...}, update: {...} })`.
- **Related ADRs** : ADR-005 (direction IN/OUT RTE authoritative), ADR-012 (Registry singleton), ADR-013 (Registry path resolution).
