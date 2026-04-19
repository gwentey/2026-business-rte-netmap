# RETRO-011 — Identifiant d'edge SHA-1 déterministe sur (fromEic, toEic, process)

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-011                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | graph                          |
| App        | api                            |

## Contexte

Le frontend Leaflet doit maintenir un état `selectedEdgeId` dans le store Zustand
pour savoir quel edge est sélectionné. Le DetailPanel s'ouvre sur la fiche de l'edge
sélectionné. Ce mécanisme nécessite que chaque edge ait un identifiant stable et
unique — il ne doit pas changer entre deux appels successifs à `GET /graph` sur le
même snapshot.

Les edges ne sont pas persistés en base : ils sont calculés à la volée par
`buildGraph`. Un UUID généré au moment du calcul serait différent à chaque requête,
cassant la sélection entre deux refreshs.

## Décision identifiée

L'identifiant de chaque edge est un hash SHA-1 calculé sur la chaîne
`"fromEic|toEic|process"`, tronqué aux 16 premiers caractères hexadécimaux :

```ts
const hash = createHash('sha1')
  .update(`${g.fromEic}|${g.toEic}|${process}`)
  .digest('hex')
  .slice(0, 16);
```

Le hash est calculé **après** la détermination du `process` final (MIXTE ou valeur
unique), pas avant. Deux appels successifs sur le même snapshot produisent donc le
même identifiant pour le même edge.

## Conséquences observées

### Positives
- **Stabilité** : l'identifiant est identique entre deux requêtes successives sur le
  même snapshot, permettant au store Zustand de maintenir la sélection.
- **Unicité pratique** : la collision de SHA-1 tronqué à 64 bits est négligeable
  pour le volume d'edges attendu (< 1000 par snapshot).
- **Pas de colonne dédiée en base** : les edges n'ont pas besoin d'être persistés ni
  d'avoir un champ `id` en base — leur identité est entièrement dérivée des données.

### Négatives / Dette
- **Dépendance au process** : si le process d'un edge change (ex. après une
  re-classification du registry), son identifiant change aussi. Le state
  `selectedEdgeId` côté frontend deviendrait invalide après un tel changement.
  Ce cas est hors scope slice #1 (re-classification hors scope).
- **SHA-1 déprecié cryptographiquement** : SHA-1 n'est plus recommandé pour des
  usages cryptographiques. Ici il sert uniquement à générer un identifiant court
  et stable — pas un usage de sécurité. Le risque est purement cosmétique (lint
  avertissements potentiels).
- **Pas de garantie d'unicité absolue** : si deux paires distinctes produisaient
  une collision SHA-1 sur 16 chars, leurs edges auraient le même id. Négligeable
  en pratique mais non impossible théoriquement.

## Recommandation

Garder. La stabilité de l'identifiant est la contrainte principale, et SHA-1 tronqué
à 16 chars la satisfait amplement pour ce volume. Si SHA-1 pose des problèmes de
lint à l'avenir, remplacer par SHA-256 tronqué sans impact fonctionnel.
