# RETRO-006 — Transaction Prisma atomique avec nettoyage zip compensatoire en cas d'échec

| Champ      | Valeur                         |
|------------|--------------------------------|
| Numéro     | RETRO-006                      |
| Statut     | Documenté (rétro)              |
| Date       | 2026-04-17                     |
| Source     | Rétro-ingénierie               |
| Features   | ingestion                      |
| App        | api                            |

## Contexte

L'ingestion implique deux types d'effets de bord : une écriture sur le système de fichiers (zip archivé) et des écritures en base (transaction Prisma multi-tables). Ces deux opérations ne peuvent pas être encapsulées dans une transaction unique (le FS n'est pas transactionnel). Un échec de la transaction Prisma après l'écriture du zip laisserait un zip orphelin sur disque.

## Décision identifiée

Le zip est écrit en premier sur disque (`storage/snapshots/{uuid}.zip`). La transaction Prisma est ensuite exécutée. Si la transaction échoue, un bloc `catch` tente de supprimer le zip via `unlink()`. Si `unlink()` échoue à son tour, un warning est loggé sans lever d'exception (pour ne pas masquer l'erreur Prisma originale).

L'ID du snapshot est un UUID v4 généré par `uuid` côté applicatif (non délégué à Prisma/SQLite), ce qui permet d'utiliser l'UUID comme nom de fichier avant la création de la ligne en base.

## Conséquences observées

### Positives
- Pas de zip orphelin en cas d'échec de transaction (dans le cas nominal du cleanup).
- L'UUID généré côté applicatif garantit l'unicité du nom de fichier sans aller-retour base.
- La transaction Prisma couvre atomiquement 6 tables — pas de snapshot partiellement créé.

### Négatives / Dette
- La fenêtre de temps entre l'écriture du zip et la fin de la transaction n'est pas couverte par la transaction. Un crash serveur dans cette fenêtre laisserait un zip orphelin — aucun mécanisme de reconciliation n'est implémenté.
- Si `unlink()` échoue (permissions, fichier déjà supprimé), le warning est uniquement loggé. L'opérateur doit surveiller les logs pour détecter des zips orphelins.
- Pas de test unitaire sur `SnapshotPersisterService` — les cas d'échec de transaction et de nettoyage ne sont couverts que par les tests d'intégration end-to-end (indirectement).

## Recommandation

Garder pour slice #1. Pour un déploiement en production, envisager : (1) un job de reconciliation périodique qui supprime les zips sans Snapshot correspondant en base, (2) écrire le zip après la transaction (nécessite de stocker le buffer en mémoire plus longtemps), (3) ajouter un test unitaire sur le scénario d'échec.
