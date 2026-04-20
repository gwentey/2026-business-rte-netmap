# Spec Fonctionnelle — web/upload

| Champ  | Valeur                          |
|--------|---------------------------------|
| Module | web/upload                      |
| Version| 2.0.0                           |
| Date   | 2026-04-20                      |
| Source | v2.0 post-implémentation        |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-031](../../../adr/ADR-031-dump-type-detector-v2-signatures-csv.md) | DumpTypeDetector v2 signatures CSV | Actif |
| [ADR-033](../../../adr/ADR-033-batch-upload-best-effort-transactionnel-par-fichier.md) | Batch upload best-effort par fichier | Actif |

---

## Contexte et objectif

La page Upload est le point d'entrée pour importer des dumps ECP dans l'application. En v2.0, elle supporte le multi-upload batch : l'utilisateur peut déposer plusieurs fichiers ZIP en une seule fois. Le type de dump est détecté automatiquement. Les doublons sont identifiés avant l'envoi.

---

## Règles métier

1. **Multi-upload jusqu'à 20 fichiers.** L'utilisateur peut déposer jusqu'à 20 ZIPs en une seule session.

2. **Inspection automatique avant import.** Dès que des fichiers sont déposés, ils sont inspectés (dry-run) pour déterminer leur type, détecter les doublons et générer le label automatique.

3. **Le label est pré-rempli automatiquement.** Format : `{EIC source} · {date}` si le nom de fichier est standard ECP, sinon le nom de fichier sans `.zip`.

4. **Les doublons sont signalés mais non bloquants.** L'utilisateur peut décider de remplacer un doublon (checkbox "Remplacer") ou de l'ignorer.

5. **L'import est best-effort par fichier.** Un échec sur un fichier n'annule pas les autres.

6. **Le type détecté est modifiable.** Si la confiance est FALLBACK, l'utilisateur peut forcer le type correct.

7. **L'environnement est saisi manuellement.** Pas de sélection depuis une liste — l'utilisateur tape le nom de l'env (OPF, PROD, PFRFI, etc.).

---

## Cas d'usage

### CU-001 — Importer un ou plusieurs dumps ECP

**Acteur** : utilisateur web

**Flux** :
1. L'utilisateur navigue vers `/upload` (ou `/upload?env=OPF`).
2. Il dépose N fichiers ZIP.
3. L'inspection se déclenche automatiquement.
4. Il ajuste le label et le type si nécessaire.
5. Il clique sur "Importer tout (N prêts)".
6. Chaque fichier est importé séquentiellement. La table montre la progression.
7. À la fin, un lien "Voir sur la carte" s'affiche.

### CU-002 — Gérer les doublons

**Acteur** : utilisateur web

**Flux** :
1. Un fichier est signalé comme doublon (import existant avec même EIC + timestamp).
2. L'utilisateur coche "Remplacer" pour remplacer l'ancien import.
3. Ou laisse décoché — le fichier sera ignoré lors de l'envoi (état "Ignoré").

---

## Dépendances

- **api/imports** — inspect batch + create import
- **web/upload-batch-table** — table de suivi du batch
