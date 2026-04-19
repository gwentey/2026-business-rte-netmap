# RETRO-018 — Persist partiel : seul activeSnapshotId sérialisé dans localStorage

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-04-17          |
| Source     | Rétro-ingénierie    |
| Features   | snapshot-selector |

## Contexte

Le middleware `persist` de Zustand sérialise par défaut l'intégralité du store. L'état global de l'application contient des champs volumineux (`graph: GraphResponse | null` — potentiellement plusieurs centaines de nœuds/edges en JSON) et des champs éphémères (`loading`, `error`, `selectedNodeEic`, `selectedEdgeId`) qui n'ont aucune valeur à conserver entre deux sessions.

Persister l'ensemble du store présenterait deux risques : saturation du localStorage (quota ~5 MB sous Chrome) et désynchronisation silencieuse (graphe périmé rechargé tel quel sans vérification de fraîcheur).

## Décision identifiée

L'option `partialize` est configurée pour ne sérialiser qu'un seul champ scalaire :

```ts
partialize: (s) => ({ activeSnapshotId: s.activeSnapshotId })
```

Tous les autres champs (`snapshots`, `graph`, `selectedNodeEic`, `selectedEdgeId`, `loading`, `error`) sont exclus de la persistance et repartent de leur valeur initiale à chaque montage. La liste des snapshots et le graphe sont rechargés via les appels API au montage du composant `SnapshotSelector`.

## Conséquences observées

### Positives
- Empreinte localStorage minimale : une seule clé UUID ou `null`.
- Absence de désynchronisation graphe/BDD : le graphe est toujours rechargé depuis l'API au montage.
- Comportement prédictible : l'état éphémère ne peut pas polluer une session future.

### Négatives / Dette
- Un `activeSnapshotId` persisté correspondant à un snapshot supprimé côté API produira une erreur au montage. La gestion de ce cas est partielle : `loadSnapshots` déclenche `setActiveSnapshot(list[0])` uniquement si `activeSnapshotId === null`, pas si l'id est invalide.
- L'utilisateur doit attendre le chargement réseau du graphe à chaque ouverture de l'application, même pour un snapshot déjà vu.

## Recommandation

Garder pour slice #1. Ajouter dans un slice ultérieur une vérification de cohérence : si `activeSnapshotId` persisté n'est pas présent dans la liste retournée par `loadSnapshots`, basculer automatiquement sur `list[0]` (ou afficher un message d'erreur explicite).
