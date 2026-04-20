# Spec Fonctionnelle — web/upload-batch-table

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/upload-batch-table          |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-033](../../../adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md) | Batch upload best-effort par fichier | Actif |

---

## Contexte et objectif

La table de batch offre une visibilité ligne par ligne sur l'état de chaque fichier dans le processus d'import. Elle affiche les résultats de l'inspection automatique (type détecté, EIC source, doublon éventuel) et permet à l'utilisateur d'ajuster le label et le type avant de confirmer l'envoi.

---

## Règles métier

1. **Chaque fichier est traité indépendamment.** L'utilisateur peut ajuster les paramètres de chaque fichier séparément.

2. **Le type détecté est modifiable.** Si la détection automatique est incertaine (indicateur `⚠`), l'utilisateur peut forcer le type correct.

3. **Les doublons sont signalés mais l'import reste optionnel.** Un fichier identifié comme doublon peut être importé quand même (checkbox "Remplacer") ou ignoré (comportement par défaut).

4. **Les fichiers en erreur peuvent être retirés du batch.** L'utilisateur retire un fichier avec le bouton poubelle.

5. **Un fichier importé avec succès ne peut pas être resoumis.** Les champs sont désactivés pour les items en état `done`.

---

## Cas d'usage

### CU-001 — Visualiser les résultats d'inspection

**Acteur** : utilisateur web (dans UploadPage)

**Flux** :
1. L'utilisateur dépose des fichiers ZIP sur la dropzone.
2. Chaque fichier apparaît immédiatement dans la table avec l'état "Inspection...".
3. Une fois l'inspection terminée, chaque ligne affiche le type détecté, l'EIC source, et un avertissement si doublon détecté.

### CU-002 — Corriger le type avant import

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur repère un fichier avec `⚠` (détection incertaine).
2. Il change le type via le sélecteur sur la ligne.
3. Ce type override sera envoyé au backend à la place de la détection automatique.

### CU-003 — Gérer un doublon

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur voit un fichier signalé "Doublon (import : xxx)".
2. Il coche "Remplacer" pour écraser l'import existant.
3. Ou il laisse la case décochée — le fichier sera ignoré lors de l'envoi.

---

## Dépendances

- **web/upload** — UploadBatchTable est intégré dans UploadPage
- **api/imports** — inspect batch et create import
