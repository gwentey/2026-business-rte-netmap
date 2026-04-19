# ADR-033 — Batch upload best-effort, transactionnel par fichier

| Champ      | Valeur                                                      |
|------------|-------------------------------------------------------------|
| Numéro     | ADR-033                                                     |
| Statut     | Accepté                                                     |
| Date       | 2026-04-19                                                  |
| Auteur(s)  | Anthony + Claude                                            |
| Owner      | Anthony                                                     |
| Décideurs  | Anthony                                                     |
| Contexte   | Slice v2.0-2b Multi-upload                                  |
| Remplace   | —                                                           |
| Features   | *                                                           |
| App        | api, web                                                    |

## Contexte

La slice 2a supporte un seul upload atomique à la fois. La slice 2b introduit le multi-upload (drag N fichiers → batch). Question clé : quand un fichier dans le batch échoue (corrompu, MIME invalide, CSV malformé…), quel comportement global ? All-or-nothing (rollback complet), best-effort (les autres continuent) ou fail-fast (arrêt au premier échec) ? Le modèle de données v2 (chaque `Import` indépendant, supprimable/gardable à la carte) supporte naturellement un état partiel.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Best-effort par fichier | Chaque `POST /api/imports` reste atomique, le frontend boucle séquentiellement avec catch par fichier. Résumé final "N créés / M ignorés / K échecs". | XS | Cohérent avec la conception v2 (imports indépendants). 1 mauvais fichier sur 10 n'annule pas les 9 bons. UX clair avec feedback fichier par fichier. | État partiel possible si interruption réseau — l'admin doit comprendre que le batch n'est pas atomique |
| B — All-or-nothing batch | Si un fichier échoue, rollback de tous les imports déjà créés dans ce batch. | L | État cohérent (ce que l'utilisateur pensait uploader = ce qui est en DB). | Casse la conception v2 (couple des imports indépendants). Frustrant à 10 fichiers : 1 mauvais annule 9 bons. Nécessite un "batch ID" ou équivalent. |
| C — Fail-fast | Arrêter dès le premier échec ; les fichiers déjà importés restent, les suivants sont skippés. | S | Hybride entre A et B. | UX peu claire : l'utilisateur voit un état partiel imprévisible. |

## Décision retenue

**Option choisie : A** — best-effort transactionnel par fichier. Le frontend boucle séquentiellement (`for...of` avec `await`) sur `submitBatch`. Chaque fichier est un appel indépendant `POST /api/imports`. Les états par fichier (`pending-inspect`/`inspected`/`uploading`/`done`/`skipped`/`error`) sont visibles en temps réel dans la table de preview. Résumé final affiche les 3 compteurs.

## Conséquences

### Positives
- Cohérent avec la conception v2 où chaque `Import` est indépendant (suppression ciblée, timeline, etc.).
- UX transparent : l'utilisateur voit exactement ce qui s'est passé fichier par fichier.
- Recovery facile : retirer les fichiers en erreur du batch et relancer, pas besoin de tout refaire.
- Pas de sur-complexité : les appels API restent simples, pas de notion de "batch ID" ou transaction cross-fichier.

### Négatives
- Si l'utilisateur ferme la page au milieu du batch, certains fichiers sont créés, d'autres non — acceptable car le résumé final est affiché avant la fermeture.
- Atomicité stricte sur le `replaceImportId` (delete + create) n'est pas garantie au niveau transaction Prisma — si le create échoue après le delete, l'ancien est perdu. Acceptable en dev-local ; pour production, une vraie transaction sera nécessaire dans une slice ultérieure.
- Les clients réseau instables verront des uploads partiels ; à mitiger côté frontend avec une sauvegarde locale et un dialog de confirmation avant de relancer.

### Ce qu'on s'interdit désormais
- Introduire un "batch ID" ou toute notion qui couple les imports d'un même drop (ex: `Import.batchId` en base, ou rollback croisé).
- Bloquer le submit du batch entier à cause d'un fichier problématique.
- Réimplémenter une logique de transaction batch au niveau API ou service : accepter la sémantique per-fichier.

## Ressources / Références

- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2b-design.md §H` — error handling détaillé
- `docs/adr/ADR-023-raw-plus-compute-on-read.md` — conception v2 imports indépendants
- Slice 2b §H — workflow UX avec résumé final et compteurs
