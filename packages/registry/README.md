# @carto-ecp/registry

Données de référence chargées en mémoire au boot du backend.

## Fichiers

- `eic-entsoe.csv` — liste officielle ENTSO-E des codes EIC (~15k lignes, source publique).
- `eic-rte-overlay.json` — overlay RTE-custom : les 6 Endpoints RTE, le CD RTE, les BA, les coordonnées GPS par organisation et par pays, la classification `messageType → process`, la palette de couleurs.

## Maintenance

Le rechargement à chaud est reporté à un slice ultérieur. Pour l'instant : modifier les fichiers, commit, redémarrer l'API.

Pour ajouter une organisation partenaire : éditer `organizationGeocode` dans le JSON.
Pour ajouter une règle de classification : éditer `messageTypeClassification.exact` (prioritaire) ou `patterns`.
