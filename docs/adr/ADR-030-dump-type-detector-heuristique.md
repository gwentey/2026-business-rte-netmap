# ADR-030 — Heuristique `DumpTypeDetector` en 2a, raffinée en 2b

| Champ      | Valeur                                                                      |
|------------|-----------------------------------------------------------------------------|
| Numéro     | ADR-030                                                                     |
| Statut     | Accepté                                                                     |
| Date       | 2026-04-19                                                                  |
| Auteur(s)  | Anthony + Claude                                                            |
| Owner      | Anthony                                                                     |
| Décideurs  | Anthony                                                                     |
| Contexte   | Slice v2.0-2a Fondations                                                    |
| Remplace   | —                                                                           |
| Features   | *                                                                           |
| App        | api, web                                                                    |

## Contexte

Les dumps ECP peuvent provenir de trois types de composants : ENDPOINT, COMPONENT_DIRECTORY (CD) et BROKER. Le type du dump influence la façon dont les données sont parsées et interprétées par le pipeline d'ingestion. En v1.2, la détection était rudimentaire (présence de `ecp.componentCode` pour différencier ENDPOINT vs CD).

En v2.0, `dumpType` est un champ explicite dans `Import` et doit être déterminé à l'upload. Cependant, en slice 2a, seules des fixtures ENDPOINT sont disponibles. Le format exact des dumps CD et BROKER n'est pas encore connu — imposer une heuristique multi-critères complexe serait spéculatif et fragile. Un override manuel via le body de la requête doit toujours être disponible pour corriger une détection incorrecte.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Heuristique simple 2a + override manuel | Règle : présence d'un blob XML MADES dans `component_directory.csv` → `ENDPOINT` ; sinon → `COMPONENT_DIRECTORY`. BROKER non détectable en 2a (fallback CD). Override possible via `dumpType` dans le body du `POST /api/imports` | XS | Couvre 100 % des cas des fixtures disponibles, pas de spéculation sur le format BROKER/CD, extensible en 2b | BROKER et certains CD peuvent être mal classés si l'admin n'override pas |
| B — Heuristique multi-critères complète | Analyse de plusieurs indicateurs structurels dans les CSVs pour détecter ENDPOINT, CD et BROKER avec haute confiance | L | Détection automatique précise | Spéculatif sans sample de dump CD/Broker ; fort risque de régression à l'arrivée des vrais fichiers ; complexité injustifiée en 2a |
| C — Demande manuelle systématique | Pas d'heuristique : l'utilisateur doit toujours fournir `dumpType` dans l'upload | XS | Trivial, pas d'erreur de détection | Friction UX inutile pour les cas courants (ENDPOINT = cas nominal) ; hors-scope UX slice 2a |

## Décision retenue

**Option choisie : A** pour la slice 2a. La règle est : si `component_directory.csv` contient un blob XML MADES (namespace `http://mades.entsoe.eu/componentDirectory`), le dump est de type `ENDPOINT` ; sinon, le type est `COMPONENT_DIRECTORY`. Le type `BROKER` n'est pas détectable automatiquement en 2a et tombera dans le fallback `COMPONENT_DIRECTORY`. Le champ `dumpType` dans le body de `POST /api/imports` permet un override manuel à priorité absolue. Cette heuristique sera raffinée en 2b quand des samples de dumps CD/Broker seront disponibles.

## Conséquences

### Positives
- Le `DumpTypeDetector` est un service simple, facilement testable, qui couvre les fixtures disponibles avec une fiabilité de 100 %.
- L'override manuel garantit que même un dump mal détecté peut être correctement traité sans bloquer le workflow.
- La logique d'heuristique est isolée dans un service dédié, facile à remplacer en 2b.

### Négatives
- Un dump BROKER uploadé sans override sera classé `COMPONENT_DIRECTORY` et parsé avec le parser CD. Attendu : le parser échoue proprement (lignes sans `ecp.componentCode` reconnaissable → warnings dans `Import.warningsJson`, `components` et `paths` vides pour ce dump). L'admin peut alors réassigner le `dumpType` (slice 2c) ou re-uploader avec override manuel.
- L'admin doit connaître le type de son dump si l'heuristique 2a est insuffisante.

### Ce qu'on s'interdit désormais
- Bloquer ou rejeter un upload à cause d'une détection ambiguë du `dumpType` — le système accepte toujours le fichier avec le type déduit automatiquement ou fourni manuellement.
- Écrire une logique de détection BROKER basée sur des hypothèses non vérifiées par un sample réel en 2a.

## Ressources / Références

- Slice 2a §B — `DumpTypeDetector` dans le pipeline, heuristique et override manuel.
- Slice 2a §F — `dump-type-detector.spec.ts` : heuristique ENDPOINT pour les 2 fixtures, fallback CD, override manuel.
- Chapeau v2.0 §7 — Feuille de route : format CD/Broker bloqué jusqu'à obtention d'un backup sample (slice 2b).
- Chapeau v2.0 §8 — Non-goals : « Format exact des dumps CD et Broker : parseurs à écrire quand un backup sample sera disponible ».
