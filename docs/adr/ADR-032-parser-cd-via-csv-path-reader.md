# ADR-032 — Parser CD via CsvPathReader, indépendant du XML MADES

| Champ      | Valeur                                                      |
|------------|-------------------------------------------------------------|
| Numéro     | ADR-032                                                     |
| Statut     | Accepté                                                     |
| Date       | 2026-04-19                                                  |
| Auteur(s)  | Anthony + Claude                                            |
| Owner      | Anthony                                                     |
| Décideurs  | Anthony                                                     |
| Contexte   | Slice v2.0-2b Multi-upload                                  |
| Remplace   | —                                                           |
| Features   | *                                                           |
| App        | api                                                         |

## Contexte

La slice 2a parse les paths de communication exclusivement via le blob XML MADES imbriqué dans `component_directory.csv`. Ce blob n'existe **que** dans les dumps ENDPOINT : chaque endpoint reçoit du CD un snapshot XML des paths qui le concernent. Les dumps CD n'ont pas ce blob — ils exposent les paths dans un fichier CSV dédié `message_path.csv` (Admin Guide §4.20), avec un format tabulaire où `message_path_receiver` et `message_path_sender` sont inclus comme listes dans les colonnes `receivers` et `allowedSenders`.

## Options considérées

| Option | Description | Effort estimé | Avantages | Inconvénients |
|--------|-------------|---------------|-----------|---------------|
| A — Parser dédié CSV (CsvPathReader) | Nouveau service qui lit `message_path.csv`, explose `allowedSenders × receivers` en N×M `ImportedPath`. `ImportBuilder.buildFromCdCsv` utilise ce service. `ImportsService` route ENDPOINT/CD selon `DumpTypeDetectorV2`. | M | Respecte le format officiel, paths non-wildcard (chaque ligne CD liste explicitement senders+receivers), pas de dépendance au XML | Nouveau service à écrire + tests |
| B — Émuler le XML côté CD | Transformer `message_path.csv` en un pseudo-XML MADES pour réutiliser `XmlMadesParser` | L | Un seul parser à maintenir | Complexité gratuite, fragile (tout changement dans le parser XML casse les dumps CD), pas de gain |
| C — Refuser les dumps CD | Restreindre l'app aux seuls dumps ENDPOINT | XS | Simplicité | Régression fonctionnelle : la slice 2a accepte les dumps CD (même si les paths sont wildcardés) |

## Décision retenue

**Option choisie : A** — `CsvPathReaderService` + `ImportBuilder.buildFromCdCsv`. Le routing dans `ImportsService.createImport` devient : ENDPOINT → pipeline v2a (XML) ; CD → pipeline 2b (CSV direct) ; BROKER → metadata-only.

## Conséquences

### Positives
- Les dumps CD produisent des paths **non-wildcard** : chaque relation explicite `(senderA, receiverB, messageType)` est stockée précisément, contrairement au blob XML ENDPOINT qui a souvent des `senderComponent=null` (wildcard).
- Pipelines ENDPOINT et CD indépendants : un bug dans l'un n'affecte pas l'autre.
- Broker stubs créés automatiquement à partir de `intermediateBrokerCode` inconnus dans le CSV (cohérent avec la logique v2a XML).
- Format CSV plus facile à tester et moins fragile que le XML imbriqué.

### Négatives
- Le séparateur imbriqué dans `allowedSenders`/`receivers` n'est pas documenté formellement (liste `List<string>` dans Public Interface §1765, sérialisation CSV non précisée). La fixture CD disponible a un `message_path.csv` vide, donc aucun échantillon réel à observer. Stratégie : essayer `|`, fallback `,`, fallback `;`, warning si aucun ne convient. À reconfirmer quand un dump CD réel avec données arrive.
- Nécessite gestion d'un nouveau format CSV avec parsing des listes imbriquées.

### Ce qu'on s'interdit désormais
- Supposer qu'un `Import` vient toujours avec un XML MADES ; les brokers via dump n'apportent ni composants ni paths.
- Dupliquer la logique XML pour les CDs : le CSV est la source officielle.
- Essayer de normaliser les deux formats (XML et CSV) dans un seul parser : les maintenir séparé et explicite.

## Ressources / Références

- `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` — tables incluses dans chaque backup
- `docs/officiel/ECP Public Interface v4.16.0.pdf §1765` — `allowedSenders List<string>`
- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2b-design.md §C, §D` — format + pipeline routing
