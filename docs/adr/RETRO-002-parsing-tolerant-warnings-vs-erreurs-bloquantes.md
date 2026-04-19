# RETRO-002 — Parsing tolérant : warnings non bloquants vs erreurs bloquantes

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-002                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

Les backups ECP réels peuvent contenir des données partiellement invalides ou des composants non répertoriés dans le registry de référence. Bloquer l'ingestion entière sur une anomalie partielle rendrait l'outil inutilisable sur des backups réels qui sont, par construction, issus d'un environnement de production ECP potentiellement hétérogène.

## Décision identifiée

Deux niveaux d'erreur coexistent :

**Erreurs bloquantes** (lèvent une `IngestionError`, HTTP 4xx) :
- Zip corrompu ou non lisible (`INVALID_UPLOAD`)
- Fichier requis manquant dans le zip (`MISSING_REQUIRED_CSV`)
- Namespace XML MADES absent ou inconnu (`UNKNOWN_MADES_NAMESPACE`)
- Clé `ecp.componentCode` absente (`INVALID_UPLOAD`)
- Entrée zip individuelle > 50 MB (`PAYLOAD_TOO_LARGE`)

**Warnings non bloquants** (accumulés dans `Warning[]`, stockés en base dans `warningsJson`) :
- EIC non trouvé dans le registry → position Bruxelles par défaut (`EIC_UNKNOWN_IN_REGISTRY`)
- MessageType non classifiable → processus `UNKNOWN` (`MESSAGE_TYPE_UNCLASSIFIED`)
- CSV optionnel mal formé → tableau vide + log serveur (sans code de warning exposé à l'API)

## Conséquences observées

### Positives
- L'ingestion aboutit même avec des backups incomplets ou ayant des EIC non répertoriés (cas fréquent avec de nouveaux partenaires TSO).
- L'utilisateur voit les warnings dans l'interface et peut prendre conscience des lacunes de données sans que le snapshot soit inutilisable.
- Les warnings sont persistés sur le Snapshot pour audit ultérieur.

### Négatives / Dette
- La frontière entre "bloquant" et "non bloquant" est codée en dur dans la logique métier de chaque service. Un changement de politique nécessite de modifier plusieurs endroits.
- Les erreurs de parsing CSV optionnel (ex. `message_path.csv` mal encodé) ne remontent pas de warning structuré à l'API — uniquement un `logger.warn` serveur. L'utilisateur ne sait pas que ses chemins de messages ont été perdus.
- `component_directory.csv` à zéro ligne lève une `Error` native (non `IngestionError`) dans `IngestionService`, ce qui donne un code HTTP 500 au lieu d'un 400 explicite.

## Recommandation

Garder la philosophie tolérante — elle est adaptée au cas d'usage. Corriger les points de dette : (1) lever une `InvalidUploadException` typée pour le cas `component_directory.csv` vide, (2) exposer un warning structuré `CSV_PARSE_ERROR` quand un CSV optionnel ne peut pas être parsé.
