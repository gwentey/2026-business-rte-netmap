# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/) · Versioning : [SemVer](https://semver.org/lang/fr/).

---

## [Unreleased]

### v2.0-alpha.13 — Slice 2l Volumes sur les edges (épaisseur + stats popup) (2026-04-23)

L'épaisseur d'une arête est désormais **proportionnelle au volume de messages** échangés sur la paire (somme bi-directionnelle `A→B + B→A`). Le popup flux détaille le volume total, les compteurs UP/DOWN, et la dernière activité DOWN en plus de l'UP.

**Highlights :**

- **`GraphEdge.activity`** (shared) gagne 3 champs : `sumMessagesUp`, `sumMessagesDown`, `totalVolume`.
- **`GraphService.buildEdges`** : les `ImportedMessagingStat` sont désormais sommées **dans les deux sens** pour une paire `(A, B)` donnée. Le dump A porte `A→B`, le dump B porte `B→A` — on les additionne (et on garde le `connectionStatus` / `lastMessage*` de la stat la plus récente des deux).
- **`EdgePath.tsx`** : nouvelle fonction `weightFromVolume(totalVolume)` — échelle log₁₀ clampée `[1, 6]` (0 msg → 1 px, 10 → 2, 100 → 3, 1 000 → 4, 10 000 → 5, 100 000+ → 6). Sélection : `+2` au weight calculé pour rester visible quand une petite edge est cliquée.
- **`EdgeDetails.tsx`** : 3 nouvelles lignes :
  - "Volume total" avec badge slate + séparateur français.
  - "Envoyés (UP)" / "Reçus (DOWN)" avec valeurs formatées `toLocaleString('fr-FR')`.
  - "Dernière msg DOWN" (complément de "Dernière msg UP" qui existait déjà).
  - Badge de statut coloré : vert pour `CONNECTED`, rouge pour `NOT_CONNECTED`, gris sinon.

**Tests :**
- API : **243/243** inchangés (les nouveaux champs sont nourris à chaque calcul de graph, les assertions existantes restent vraies puisque les stats des fixtures sont bien présentes).
- Web : 92 → **94/94** (+2 EdgeDetails : volumes rendus avec formats français, label "Aucun" quand totalVolume=0).

**Breaking changes :** aucun — les champs ajoutés à `GraphEdge.activity` sont nourris par le backend ; les clients qui typent strict devront intégrer les 3 nouveaux champs (valeurs par défaut `0` tolérées).

### v2.0-alpha.12 — Slice 2k Contacts, homeCdCode cliquable, Config ECP dans le popup (2026-04-23)

Le popup nœud de la carte expose désormais toutes les métadonnées humaines déjà parsées depuis le XML MADES et les dumps ECP : **contact** (personne responsable, email avec `mailto:`, téléphone avec `tel:`), **home CD** cliquable qui recentre la sélection sur le Component Directory parent, **config ECP** (statut `ACTIVE`, thème UI) lue depuis les `application_property.csv` / `.properties` du composant source.

**Highlights :**

- **`GraphNode`** (shared) gagne 7 champs : `personName`, `email`, `phone`, `homeCdCode`, `status` (`ecp.internal.status`), `appTheme` (`ecp.appTheme`). Tous nullables pour rester tolérants aux dumps incomplets.
- **`GraphService.toNode`** : peuple ces champs depuis le `GlobalComponent` (contacts + homeCdCode déjà en base depuis le XML) et depuis un nouveau `runtimePropsBySourceEic` construit à partir des `ImportedAppProperty`. Stratégie latest-wins : pour chaque EIC qui est `sourceComponentEic` d'au moins un Import, on récupère les dernières valeurs de `ecp.internal.status` et `ecp.appTheme`.
- **`NodeDetails`** frontend :
  - Ligne "Home CD" dans le tableau principal : EIC cliquable si le CD est un nœud du graph courant (clic → `selectNode(homeCdCode)`, recentre la carte sur le CD), texte plat + tooltip "CD pas présent dans l'env" sinon.
  - Nouvelle section "Contact" visible si au moins un champ parmi `personName` / `email` / `phone` est renseigné. Liens `mailto:` et `tel:` automatiques.
  - Nouvelle section "Config ECP" visible si `status` ou `appTheme` sont connus. Badge vert pour `ACTIVE`, grisé pour les autres statuts.
- **Query Prisma** : `findMany` de `Import` inclut maintenant `importedProps` (nécessaire pour extraire status/appTheme à la volée).

**Tests :**
- API : **243/243** inchangés (le nouveau champ est nullable, les assertions existantes restent valides).
- Web : 88 → **92/92** (+4 NodeDetails : section Contact rendue avec mailto/tel, section Contact masquée si vide, section Config avec badge ACTIVE, homeCdCode rendu comme texte plat quand CD absent).

**Breaking changes :** aucun pour le contrat API — champs ajoutés non-obligatoires côté lecture (les clients qui typent `GraphNode` doivent intégrer les nouveaux champs, valeur `null` tolérée).

### v2.0-alpha.11 — Slice 2i Upload couplé zip + configuration.properties (2026-04-23)

L'admin peut désormais uploader **zip + `<EIC>-configuration.properties` ensemble** sur `/upload`. Le `.properties` externe (exporté via `Admin ECP > Settings > Runtime Configuration > Export Configuration`) fournit les vraies valeurs courantes de configuration (`ecp.projectName`, `ecp.envName`, `ecp.natEnabled`, `ecp.appTheme`, URLs home CD, etc.) — elles écrasent les clés homonymes du CSV interne au zip. Un badge rouge ✗ / vert ✓ dans `/admin > Imports` signale les imports sans `.properties`.

**Highlights :**

- **Prisma** : `Import.hasConfigurationProperties Boolean @default(false)` (migration `add_has_configuration_properties`). Exposé dans `ImportSummary` + `ImportDetail` (shared).
- **Nouveau service** `PropertiesParserService` (`apps/api/src/ingestion/properties-parser.service.ts`) qui parse le format Java `.properties` : clé=valeur, espaces tolérés autour du `=`, commentaires `#` / `!`, CRLF, BOM UTF-8, valeurs vides préservées. Filtre automatique des clés sensibles (regex élargi pour capturer `keyStorePass` en plus de `password`, `secret`, `privateKey`, `credentials`).
- **`ImportsController.create`** : remplace `FileInterceptor` par `FileFieldsInterceptor` sur `[file, configurationProperties]`. Validations supplémentaires : extension `.properties`, taille max 128 kB, erreurs typées `PROPERTIES_INVALID_EXT` / `PROPERTIES_TOO_LARGE`.
- **`ImportsService.createImport`** : reçoit `configurationProperties?: { originalname, buffer }`. Parse le buffer, fusionne avec `application_property.csv` (external gagne sur les clés en conflit), propage au flux ENDPOINT et COMPONENT_DIRECTORY. Si absent → warning non-bloquant `CONFIGURATION_PROPERTIES_MISSING`.
- **Frontend UploadPage** : dropzone accepte maintenant `.zip` ET `.properties`. Les `.properties` sont indexés par EIC (pattern `<EIC>-configuration.properties`) dans `propertiesFiles` du store. Au `submitBatch`, chaque zip est apparié à son `.properties` par `sourceComponentEic.toUpperCase()` et envoyé ensemble via le même POST `/api/imports`. Chip violette "N fichier(s) .properties en attente" pour feedback immédiat.
- **Frontend ImportsAdminTable** : nouvelle colonne "Props" avec badge `✓` (vert, tooltip "fichier fourni") ou `✗` (rouge, tooltip "valeurs issues uniquement du CSV interne").
- **`api.createImport`** accepte un 6ᵉ paramètre optionnel `configurationProperties?: File`.

**Tests :**
- API : 241 → **243/243** (+2 tests d'intégration : ingestion avec `.properties` → `hasConfigurationProperties=true` + clés externes persistées ; sans `.properties` → warning `CONFIGURATION_PROPERTIES_MISSING`).
- **11 nouveaux tests unitaires** `PropertiesParserService` : parse simple, tolérance espaces/CRLF/BOM, commentaires, filtrage secrets, cas réel ECP.
- **3 nouveaux tests controller** : upload avec `.properties` valide, rejet extension invalide, rejet taille excessive.
- Web : **88/88** inchangés (les tests d'intégration dropzone ajoutent le champ `hasConfigurationProperties: false` dans les mocks `ImportDetail`).

**Breaking changes :** aucun pour le contrat public. `FileInterceptor` → `FileFieldsInterceptor` côté controller : les tests directs qui construisaient `ctrl.create(body, file)` doivent passer par `{ file: [file] }`.

### v2.0-alpha.10 — Slice 2j projectName / envName sur la carte (2026-04-23)

La carte affiche désormais le **nom humain ECP officiel** (ex. `INTERNET-EP1`, `ECP-CWERPN`, `PCN-EP1`) pour chaque composant, lu directement depuis la propriété `ecp.projectName` du dump — conformément à la convention admin ECP (Admin Guide §4.4 : `Endpoint | <projectName> | <envName>`). L'env name est exposé dans le popup.

**Highlights :**

- **Prisma** : nouvelle colonne `ImportedComponent.projectName String?` (migration `20260423071514_add_project_name_to_imported_component`). Renseignée uniquement pour le composant dont le dump est issu (`eic === sourceComponentEic`).
- **`ImportsService`** : extraction de `ecp.projectName` depuis `application_property.csv` au moment de l'ingestion, côté ENDPOINT et COMPONENT_DIRECTORY.
  - ENDPOINT : injecté sur le composant local (eic = `ecp.componentCode`).
  - COMPONENT_DIRECTORY : correctif supplémentaire — le CD utilise désormais son **vrai EIC** (`ecp.componentCode`) au lieu de l'id interne séquentiel `"1"` du CSV. Les dumps CD antérieurs n'étaient donc pas correctement chaînés avec les autres dumps de l'env.
- **Cascade `displayName`** (`apply-cascade.ts`) réordonnée : `Override → merged.projectName → ENTSOE → Registry → merged.displayName → EIC`. La source officielle ECP prend maintenant le pas sur les référentiels d'overlay (sauf override admin explicite). Les EICs partenaires sans projectName (TERNA, APG, etc.) continuent de passer par ENTSOE/Registry.
- **`GraphNode`** (shared) gagne 2 champs : `projectName: string | null` et `envName: string | null`.
- **`NodeDetails`** frontend affiche :
  - un chip violet "Projet ECP : INTERNET-EP1" sous le titre si `projectName` diffère du `displayName` (cas override / registry présent) ;
  - une ligne "Environnement" avec la valeur courante (`PFRFI`, `ACCEPTANCE`, etc.).
- **`GraphService.toNode`** reçoit l'`envName` courant et le propage sur chaque node.
- **`merge-components`** : `projectName` rejoint la liste des `OVERWRITABLE_FIELDS` (latest-wins comme les autres attributs non-coordonnées).

**Tests :**
- API : 225 + 2 (apply-cascade : projectName prime sur ENTSOE/Registry, override bat projectName) + 0 (les fixtures existantes couvrent le reste) = **227/227**.
- Web : 85 + 3 (NodeDetails : chip affiché quand distinct, chip caché quand identique, ligne envName rendue) = **88/88**.
- Nouveau check d'intégration dans `full-ingestion-v2.spec.ts` : les nodes RTE EP2 et CD1 ressortent avec `projectName` = `INTERNET-EP2` / `INTERNET-CD` et `envName = INTEG_OPF_V2`.

**Breaking changes :**
- `GraphNode` gagne 2 champs non-nullables dans le wire-format (mais tolérance `null`). Les clients qui typent `GraphNode` doivent mettre à jour.
- Les anciens dumps CD persistés avant cette version ont un composant synthetic avec `eic = "1"` ; l'ingestion d'un nouveau dump CD dans le même env ne viendra PAS écraser cette ligne (EIC différent). Recommandation : purger les imports CD legacy via `/admin > Danger Zone` avant de ré-ingérer.

### v2.0-alpha.9 — Slice 2h Migration fixtures vers EXPORT/ (2026-04-23)

Rétire les 2 anciens dossiers fixtures `17V...2026-04-17T21_27_17Z/` et `17V...2026-04-17T22_11_50Z/` (dont le contexte métier — nom du composant, environnement — avait été perdu) et bascule toute la suite de tests sur la nouvelle arborescence `tests/fixtures/EXPORT/PRFRI-*/`. Première pierre du plan d'enrichissement de la carte : les dumps sont désormais accompagnés de leur fichier `<EIC>-configuration.properties` (source future pour `ecp.projectName` / `ecp.envName`).

**Highlights :**

- **Nouvelle arborescence fixtures** : 7 dumps PRFRI (1 CD + 6 endpoints) dans `tests/fixtures/EXPORT/PRFRI-{CD1,CWERPN,EP1,EP2,PCN-EP1,PCN-EP2,PCN-EP3}/`. Chaque dossier contient le zip brut ECP **et** son `<EIC>-configuration.properties` (tracked, non-sensible).
- **`.gitignore` durci** : ajout de `tests/fixtures/EXPORT/**/*.zip` pour empêcher tout commit accidentel de zip — les zips contiennent les CSVs sensibles (`local_key_store.csv`, etc.) qu'un pattern CSV ne peut pas filtrer une fois empaquettés.
- **`apps/api/test/fixtures-loader.ts` refactorisé** : lecture du zip via `AdmZip` en mémoire (au lieu de `readdirSync` sur dossier décompressé), filtrage des CSVs sensibles, résolution `fixtureName → sous-dossier EXPORT/PRFRI-*/` via table statique. Constantes `ENDPOINT_FIXTURE` et `CD_FIXTURE` mises à jour avec les nouveaux noms de zip (mêmes EICs, nouveaux timestamps 2026-04-21/22).
- **Nouvelle fonction `readFixtureProperties()`** : lit le `<EIC>-configuration.properties` associé à une fixture, prête à être consommée par les futurs tests du slice 2i (upload couplé zip + properties).
- **Helper e2e partagé** `apps/web/e2e/helpers/fixtures.ts` : remplace la duplication de `buildFixtureZip` / `EXCLUDED` dans 5 fichiers e2e (`upload-to-map`, `upload-then-map`, `select-node`, `snapshot-switch`, `multi-upload`, `env-switch`).
- **`apps/api/src/ingestion/imports.service.spec.ts`** : assertions `sourceDumpTimestamp` alignées sur le nouveau timestamp (`'2026-04-21T14:33:05.000Z'` pour l'endpoint) et noms de zip hardcodés remplacés par `${ENDPOINT_FIXTURE}.zip` / `${CD_FIXTURE}.zip` pour suivre la constante.
- **Nettoyage artefacts** : suppression de `apps/api/test/fixtures-loader.{d.ts,js,js.map}` (compilation manuelle obsolète — vitest+swc résout `./fixtures-loader.js` → `.ts` à l'exécution). Ajout au `.gitignore` : `apps/api/test/*.{js,d.ts,js.map}`.
- **Docs synchronisées** : `CLAUDE.md` section *Test fixtures* documente les 7 dumps avec projectName + envName + rôle. `.claude/rules/02-stack.md` ajoute une section *Fixtures de test* qui renvoie vers CLAUDE.md.

**Tests :**
- 222/222 API et 85/85 Web inchangés après migration (aucune régression).
- Typecheck PASS sur les 4 workspaces.
- E2E Playwright non relancés dans ce slice (les 5 specs compilent ; validation complète attendue lors du slice 2i).

**Breaking changes :** aucun pour le contrat API. Impact dev : les 2 anciens dossiers fixtures sont supprimés — toute branche en cours qui les référence doit rebase sur cette version.

### v2.0-alpha.8 — Slice 2g Registry admin UI (2026-04-20)

Onglet **Registry RTE** activé dans `/admin` avec 2 sections opérationnelles :
édition persistée des couleurs de process et vue read-only des endpoints RTE
avec handoff vers l'onglet Composants.

**Highlights :**

- **Nouvelle table Prisma** `ProcessColorOverride { process @id, color, updatedAt }`
  (migration `20260420185349_add_process_color_override`). L'overlay JSON reste
  source par défaut ; une ligne DB prend le dessus via merge côté service.
- **4 endpoints backend** sous `/api/registry/*` :
  - `GET /api/registry/process-colors` : 8 process + flag isOverride
  - `PUT /api/registry/process-colors/:process` : body `{ color }` (zod strict,
    regex `^#[0-9a-fA-F]{6}$`, erreurs typées INVALID_PROCESS / INVALID_COLOR)
  - `DELETE /api/registry/process-colors/:process` : 204, idempotent
  - `GET /api/registry/rte-endpoints` : read-only, merge overlay.rteEndpoints
    avec ComponentOverride (displayName / lat / lng prennent l'override si
    présent, flag hasOverride exposé)
- **`RegistrySettingsService`** (nouveau module `apps/api/src/registry-settings/`) :
  5 méthodes (listProcessColors, getEffectiveProcessColors, upsertProcessColor,
  resetProcessColor, listRteEndpoints).
- **`GraphService` étendu** : inject `RegistrySettingsService`, `GraphResponse.mapConfig.processColors`
  reflète désormais les surcharges DB. Aucun changement wire-format pour le
  frontend (champ `processColors` ajouté à `MapConfig` côté shared).
- **3 nouveaux composants frontend** : `RegistryAdminTab` (compose les 2
  sections), `ProcessColorsEditor` (tableau + color picker html5 + boutons
  Enregistrer / Réinitialiser, reload graph après save), `RteEndpointsTable`
  (tableau read-only + bouton Modifier par ligne).
- **Handoff UX** : click "Modifier" dans le tab Registry switche automatiquement
  vers le tab Composants et ouvre le modal `ComponentOverrideModal` pré-rempli
  avec l'EIC cible (rien de dupliqué — même modal que la slice 2c-2).
- **`AdminTabs`** : `registry.enabled: true`, tooltip "Reporté" retiré.
- **Refactor mineur `colorFor`** : accepte un param optionnel `colors: ProcessColorMap`,
  EdgePath + MapPage légende lisent depuis `graph.mapConfig.processColors` avec
  fallback sur la constante hardcoded pour le premier paint.
- **Shared types** : `RegistryColorRow`, `RegistryRteEndpointRow`, `MapConfig.processColors`.

**Tests :**
- Backend : 12 `RegistrySettingsService` + 6 `RegistryAdminController` +
  1 test intégration GraphService override colors = **19 nouveaux** (222/222 total)
- Frontend : 3 `ProcessColorsEditor` + 2 `RteEndpointsTable` + 1 `RegistryAdminTab`
  + 1 `AdminPage` (handoff registry → components) = **7 nouveaux** (85/85 total)

**Breaking changes :** aucun. `MapConfig` gagne un champ `processColors` mais il
est toujours rempli par le backend ; les anciens clients continuent à ignorer
le champ.

### Maintenance — Cleanup dette tech v2.0 (2026-04-20, PR #14)

Trois incohérences détectées lors de la sync doc post-implémentation sont corrigées.

- **`ImportsController.list()`** : type de retour public corrigé (`Promise<ImportSummary[]>` -> `Promise<ImportDetail[]>`). Aucun changement wire-format — le service renvoyait déjà `ImportDetail[]` et le frontend le typait correctement.
- **`RegistryService.resolveComponent()`** supprimé : méthode morte (aucun appelant runtime depuis slice 2a, seuls les tests la consommaient). Type `ResolvedLocation` et 5 tests associés supprimés.
- **Specs `api/common/`** alignées : `SnapshotNotFoundException` / `SNAPSHOT_NOT_FOUND` -> `ImportNotFoundException` / `IMPORT_NOT_FOUND` (le code avait été renommé dès 2a, seule la doc restait désynchronisée).

**Impact tests :** 208 -> 203 API (5 tests `resolveComponent` supprimés), 78/78 web inchangés, typecheck PASS.
**Breaking changes :** aucun. Contrat API externe inchangé.

### Docs — Sync post-implémentation v2.0 (2026-04-20, PR #13)

Réécriture complète de `docs/specs/` pour refléter le code v2.0 mergé via PRs #6-#12.

- **16 specs créées** : `api/imports`, `api/overrides`, `api/admin`, `api/envs`, `web/admin`, `web/timeline-slider`, `web/env-selector`, `web/upload-batch-table` (spec-technique + spec-fonctionnel chacune).
- **12 specs réécrites** (v1 -> v2) : `api/ingestion` (pipeline v2 + DumpTypeDetector + routing 3 types), `api/graph` (compute-on-read + cascade 5 niveaux), `api/registry` (resolveEic, rteEicSet, mapConfig), `web/map` (divIcons Lucide + Polyline Bézier + timeline), `web/upload` (multi-file + inspect + batch), `shared/types`.
- **4 specs mises à jour mineur** : `api/common`, `web/detail-panel` (version 2.0.0 + références BDD v2).
- **4 specs supprimés** (obsolètes) : `api/snapshots/`, `web/snapshot-selector/`.
- **2 nouveaux documents d'architecture** : `docs/architecture/database/schema.md` (7 tables Prisma v2 + diagramme ASCII), `VERSIONNING.md` (historique versions v1.0 -> v2.0-alpha.7).

### v2.0-alpha.7 — Slice 2e Zone danger + Annuaire ENTSO-E (2026-04-20)

Deux onglets admin activés : **⚠ Zone danger** (3 purges avec typing-to-confirm) et **Annuaire ENTSO-E** (upload CSV officiel).

**Highlights :**

- **3 endpoints purge** : `DELETE /api/admin/purge-imports` (deletedCount + unlink zips disque), `DELETE /api/admin/purge-overrides`, `DELETE /api/admin/purge-all` (imports + overrides + entsoe).
- **2 endpoints ENTSO-E** : `POST /api/entsoe/upload` (multipart CSV, max 5 MB, parse format standard `EicCode;EicDisplayName;EicLongName;…;MarketParticipantIsoCountryCode;EicTypeFunctionList`) + `GET /api/entsoe/status` (count + refreshedAt).
- **`DangerService`** et **`EntsoeService`** backend dans `apps/api/src/admin/`.
- **`DangerZoneTab`** frontend avec typing-to-confirm : mot-clé `PURGER` pour les 2 purges ciblées, `RESET` pour le reset total. Modal bloquante + bouton confirmer disabled tant que le mot n'est pas exact.
- **`EntsoeAdminTab`** frontend : status display (count + dernier refresh) + upload `<input type=file>` + bouton.
- **AdminTabs** : `entsoe` et `danger` passent à `enabled: true` ; `registry` reste disabled (reporté, YAGNI — l'overlay JSON reste éditable via commit git).

**Tests :**
- Backend : 3 `DangerService` + 4 `EntsoeService` + 6 `AdminController` = 13 nouveaux (208/208 total)
- Frontend : 3 `EntsoeAdminTab` + 4 `DangerZoneTab` = 7 nouveaux

**Breaking changes :** aucun. Registry admin tab reste disabled avec tooltip "Reporté".

### v2.0-alpha.6 — Slice 2d Timeline slider UI (2026-04-20)

**Curseur temporel** au-dessus de la carte permet de rejouer l'état du réseau à une date passée. Chaque cran du slider = une `effectiveDate` distincte parmi les imports de l'env actif.

**Highlights :**

- **`TimelineSlider`** : composant React avec `<input type="range">` affichant N crans (1 par `effectiveDate` distincte), label "maintenant" à droite par défaut.
- **Store Zustand étendu** : `refDate: Date | null` (non persisté, session-only) + `setRefDate(date | null)` qui déclenche `loadGraph(env, date)`.
- **Bouton "⟲ Retour au présent"** visible quand `refDate !== null`.
- **Intégration `MapPage`** : slider inséré au-dessus de la zone `NetworkMap + DetailPanel`.
- **Backend** : zéro changement — `GET /api/graph?env&refDate` supporte déjà `refDate` depuis 2a.

**Tests :**
- 3 tests store (default null, setRefDate triggers loadGraph, setRefDate(null) clears)
- 4 tests `TimelineSlider` (hidden if <2 dates, "maintenant" label, formatted date label, retour présent button)

**Breaking changes :** aucun.

### v2.0-alpha.5 — Slice 2c-2 Admin composants surcharge EIC (2026-04-20)

**Onglet Composants** activé dans `/admin`. Permet à l'admin de surcharger manuellement les métadonnées d'un EIC (nom, type, organisation, pays, coordonnées, tags, notes). Répond au besoin concret : corriger les positions des composants qui tombent à Bruxelles par défaut (MONITORING, TSOs non-RTE, etc.).

**Highlights :**

- **3 endpoints backend** : `GET /api/admin/components` (liste EICs des imports + cascade + override), `PUT /api/overrides/:eic` (upsert zod strict 8 champs nullable), `DELETE /api/overrides/:eic` (retire).
- **Upsert idempotent via PUT** (ADR-036) : l'admin envoie l'état souhaité pour un EIC. Champs nullable = fallback cascade niveau 2+.
- **`OverridesService.listAdminComponents`** : réutilise `mergeComponentsLatestWins` + `applyCascade` du graph module pour calculer le `current` après cascade. Retourne `AdminComponentRow[]` triés par EIC.
- **`ComponentsAdminTable`** : liste des EICs rencontrés (dédupée), recherche sur EIC/nom/organisation/pays, toggle "Seulement surchargés", click pour ouvrir la modale.
- **`ComponentOverrideModal`** : 8 inputs (text, select, number, textarea), placeholders affichent les valeurs cascade courantes, submit ne PUT que les champs modifiés (diff-only patch), bouton "Retirer surcharge" avec confirm.
- **Types shared** : `AdminComponentRow`, `OverrideUpsertInput`.
- **ADR-036** : PUT upsert retenu vs POST+PATCH (idempotence + cohérence EIC PK).

**Tests :**
- Backend : 5 tests `OverridesService.upsert/delete` (create/update/null/404) + 3 tests `listAdminComponents` (empty, with imports, with overrides merged) + 6 tests `OverridesController` (routes + reject invalid body) = 14 nouveaux tests API (26 suites, 195/195 tests PASS)
- Frontend : 4 tests `ComponentsAdminTable` (render, search, filter surchargés, modal open) + 4 tests `ComponentOverrideModal` (title, save partial, retire visible, delete flow) = 8 nouveaux tests web (64/64 total)

**Breaking changes :** aucun.

### v2.0-alpha.4 — Slice 2c-1 Admin panel onglet Imports (2026-04-19)

**Panneau d'administration** accessible via le lien `Admin` du header. Répond à la demande du gros spec fonctionnel : *« Un panneau d'administration centralise upload, surcharge des données, gestion du registry, purge »*.

Cette slice livre uniquement **l'onglet Imports** (les 4 autres onglets sont visibles mais désactivés avec tooltip vers leur slice d'origine). Split original de la slice 2c en **2c-1 (imports)** et **2c-2 (composants surcharge — à venir)**.

**Highlights :**

- **Route `/admin`** avec `AdminTabs` à 5 onglets (Imports actif + 4 stubs désactivés).
- **`ImportsAdminTable`** : liste complète des imports avec filtre par `envName`, recherche texte client-side (label / fileName / sourceEic), édition inline du `label` (debounced 500ms) et de `effectiveDate` (onBlur), delete avec modale de confirmation custom.
- **Nouveau endpoint `PATCH /api/imports/:id`** : zod strict à 2 champs (`label`, `effectiveDate`), refuse tout extra (`dumpType`, `envName`, etc.) et body vide. Code `INVALID_BODY` sur erreur.
- **`GET /api/imports` étendu** : retourne désormais `ImportDetail[]` (superset de `ImportSummary`, ajoute `stats` et `warnings`) — évite un 2e fetch côté admin. Rétrocompatible côté callers existants.
- **Header** : lien `+ Importer` remplacé par `Admin`. L'upload reste accessible via le bouton « + Importer des dumps » dans `/admin`.
- **ADR-035** : `dumpType` immutable post-ingest (corriger un type mal détecté = delete + re-upload).

**Tests :**
- Backend : 2 tests `listImports` (stats + ordering) + 4 tests `updateImport` (label, date, combined, not found) + 6 tests `controller.update` (happy path × 2, reject extras × 2, reject invalid date, reject empty body) = 12 nouveaux tests API
- Frontend : 3 tests `AdminTabs`, 1 test `AdminPage` smoke, 5 tests `ImportsAdminTable`, 3 tests `debounce` = 12 nouveaux tests web

**Breaking changes :** aucun. L'élargissement de `listImports` vers `ImportDetail[]` est rétrocompatible.

### v2.0-alpha.3 — Slice 2f Icônes différenciées + badge isDefaultPosition (2026-04-19)

**Icônes cartographiques différenciées par type de composant ECP.** Répond à la demande initiale n°4 de l'utilisateur : distinguer visuellement broker / CD / endpoint sur la carte (plus juste un rond uniforme).

**Highlights :**

- **`buildNodeDivIcon(kind, isDefault, selected)`** : factory pure qui construit un `L.DivIcon` avec icône Lucide centrée (14px blanc) dans un cercle coloré (24px) selon le `NodeKind` :
  - `RTE_ENDPOINT` → `Zap` rouge `#e30613`
  - `RTE_CD` → `Network` rouge foncé `#b91c1c`
  - `BROKER` → `Router` noir `#111827`
  - `EXTERNAL_CD` → `Network` gris très foncé `#1f2937`
  - `EXTERNAL_ENDPOINT` → `Zap` gris `#6b7280`
- **Badge `⚠` orange `#f97316`** overlay coin bas-droit du marker quand `isDefaultPosition = true` (fallback Bruxelles). Tooltip enrichi d'une ligne explicite.
- **Halo bleu** `box-shadow` à la sélection, à la place de l'agrandissement de rayon v2a.
- **`NodeMarker`** réécrit : `CircleMarker` → `Marker + divIcon`. Couleurs conservées, pas de couleur par process sur les nodes (couleur process reste uniquement sur les edges).
- **Règle CSS globale** pour neutraliser le fond/bordure par défaut de `.leaflet-div-icon`.
- **4 tests unit** isolés sur `node-icon.tsx` (factory pure), pas de test React-Testing-Library sur `NodeMarker` (ROI faible, Leaflet context trop lourd à mocker).
- **1 ADR** : ADR-034 (divIcon + renderToStaticMarkup).

**Breaking changes :** aucun côté API ou shared. Le changement est purement visuel côté front.

**Performance :** `renderToStaticMarkup` est appelé une fois par marker à chaque update de props ; acceptable pour <500 markers. Si le graph grandit au-delà, envisager un cache par `(kind, isDefault, selected)`.

### v2.0-alpha.2 — Slice 2b Multi-upload + Detection fiable + Parser CD (2026-04-19)

**Multi-upload avec preview et confirmation** + **détection fiable** du type de dump basée sur la signature documentée ECP Admin Guide §4.20 + **parser CD complet** (`CsvPathReader`) qui lit directement `message_path.csv` (pas de XML côté CD).

**Highlights :**

- **DumpTypeDetectorV2** : inspection des noms de fichiers dans le ZIP (`synchronized_directories.csv` → CD, `messaging_statistics.csv` → ENDPOINT, `broker.xml` → BROKER, fallback CD). Retourne `{ dumpType, confidence: HIGH|FALLBACK, reason }` pour traçabilité frontend. Remplace la v1 naïve de 2a qui inspectait le contenu XML.
- **`ZipExtractor.listEntries`** : nouvelle méthode qui énumère les fichiers du ZIP sans charger les contenus en mémoire (utilisée par le détecteur + inspection).
- **CsvPathReaderService** : parser dédié `message_path.csv`, explose `allowedSenders × receivers` en N×M paths logiques. Supporte séparateurs `|`, `,`, `;` en fallback. Warnings pour `transportPattern` inconnu ou receivers vide.
- **`CsvReader.readMessagePaths`** : nouvelle méthode pour lire les paths CD au format CSV tabulaire.
- **ImportBuilder.buildFromCdCsv** : méthode dédiée dumps CD (composants depuis CSV pur, paths via `CsvPathReader`, stubs BROKER pour `intermediateBrokerCode` inconnus). Le type composant est inféré (`componentCode == id` → COMPONENT_DIRECTORY, sinon ENDPOINT).
- **Routing dans `ImportsService.createImport`** : branche ENDPOINT (pipeline v2a XML inchangé) / CD (pipeline 2b CSV) / BROKER (metadata-only avec warning `BROKER_DUMP_METADATA_ONLY`).
- **POST /api/imports/inspect** : preview multi-fichiers sans persistance (max 20 × 50MB par requête, check dédup scoped par env, retourne `InspectResult[]`).
- **POST /api/imports** étendu : `replaceImportId?` pour supprimer l'ancien puis créer le nouveau, avec validation `REPLACE_IMPORT_MISMATCH` si env diffère et `IMPORT_NOT_FOUND` si id inconnu.
- **UploadPage refondue** : dropzone `multiple: true` (max 20 fichiers), composant `UploadBatchTable` pour preview/édition (override dumpType, edit label, toggle Remplacer), bouton « Importer tout (N prêts) », résumé final avec lien vers la carte.
- **Store Zustand slice `uploadBatch`** : states `pending-inspect | inspected | uploading | done | skipped | error`, submit best-effort transactionnel par fichier. Non persisté entre sessions.
- **Tests** : 169 tests API (24 suites) + 40 tests web + 1 E2E Playwright (`multi-upload.spec.ts`). Typecheck api + web + shared PASS.
- **3 ADRs** : ADR-031 (détecteur via signatures CSV), ADR-032 (parser CD indépendant XML), ADR-033 (batch best-effort).

**Breaking changes :**
- Signature `detectDumpType` change : `(zipEntries, override?)` au lieu de `(csvRows, override)`. Callers internes mis à jour.
- Type `InspectResult` ajouté dans `@carto-ecp/shared`.
- `CsvReader.readMessagePaths` (buffer) renommée en `readEndpointMessagePaths` pour lever le conflit avec la nouvelle `readMessagePaths(extracted, warnings)` qui lit `message_path.csv` des CDs.

**Docs référencées :**
- `docs/officiel/ECP Administration Guide v4.16.0.pdf §4.20` — signature des tables backup par type de composant.
- `docs/officiel/ECP System Design v4.16.0.pdf §9.2.2` — Broker ne persiste pas en base SQL (file-system backup).

### v2.0-alpha.1 — Slice 2a Fondations (2026-04-19)

**Refonte architecturale majeure du modèle de données et du pipeline ECP.** L'hypothèse v1.2 « 1 snapshot = 1 vue complète du réseau » est remplacée par une logique cumulative : la carte agrège désormais `N imports` successifs par environnement, avec résolution à la lecture (compute-on-read) et cascade de priorité à 5 niveaux.

**Highlights :**

- **Nouveau modèle Prisma** : tables `Import`, `ImportedComponent(+Url)`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty` (contributions brutes conservées) + `ComponentOverride` (surcharge admin globale par EIC, cross-env) + `EntsoeEntry` (annuaire ENTSO-E embarqué, vide en 2a). `lat/lng` nullable — fallback Bruxelles appliqué au rendu.
- **Pipeline d'ingestion refondu** : `ZipExtractor → CsvReader → XmlMadesParser → DumpTypeDetector (nouveau) → ImportBuilder (nouveau) → RawPersister (nouveau)`. La résolution registry est **déplacée au read** pour garantir la rétroactivité des changements de registry.
- **GraphService compute-on-read** : 3 fonctions pures isolées et testables (`mergeComponentsLatestWins`, `applyCascade` 5 niveaux, `mergePathsLatestWins`) composées à chaque requête. Timeline prête côté backend via `refDate` (slider front en slice 2d).
- **Cascade de priorité 5 niveaux par champ** : `ComponentOverride` > `EntsoeEntry` > registry RTE > latest-import > default Bruxelles.
- **Frontière `envName` first-class** : imports scopés par env, rendu carte scopé par env, overrides/ENTSO-E/registry globaux. Aucune fusion cross-env.
- **Nouveaux endpoints API** : `POST /api/imports`, `GET /api/imports[?env]`, `DELETE /api/imports/:id`, `GET /api/graph?env&refDate`, `GET /api/envs`. Endpoints legacy `/api/snapshots*` supprimés (reset DB total, dev-local).
- **Front refondu** : route `/` = carte (empty state différencié), `/map` redirige vers `/`, `/upload` conservé comme entrée secondaire. Nouveau `EnvSelector` component remplace `SnapshotSelector`. Store Zustand refondu (`activeEnv` persisté, suppression `activeSnapshotId`).
- **Tests** : 121 tests api (16+ suites dont 3 intégration) + 33 tests web + 3 E2E Playwright (empty-state, upload-then-map, env-switch). `typecheck` api + web + shared PASS.
- **ADRs fondateurs** : 7 ADRs rédigés en amont (ADR-023 à ADR-028, ADR-030).
- **Migrations Prisma** : `20260419135633_v2_fondations_raw_tables` + `20260419150916_drop_redundant_envname_index`.

**Breaking changes (dev-local uniquement) :**

- Schéma Prisma remplacé intégralement. Reset total de `dev.db`. Les anciens zips sous `storage/snapshots/` sont orphelins (dossier supprimable manuellement, le nouveau chemin est `storage/imports/`).
- Endpoints `/api/snapshots*` supprimés sans couche de compat.
- Types shared `SnapshotSummary` / `SnapshotDetail` supprimés au profit de `ImportSummary` / `ImportDetail`.

**Non-inclus (reporté aux slices suivantes, voir chapeau v2.0 §7) :**

- Upload multi-fichiers + détection auto avancée (slice 2b)
- Panneau admin (Imports + Composants + surcharge EIC) (slice 2c)
- Timeline slider UI (slice 2d)
- Refresh ENTSO-E + registry admin + purges (slice 2e)
- Icônes différenciées par type (slice 2f)

### Added

- **v2-2a T1 — 7 ADRs fondateurs slice 2a** : `docs/adr/ADR-023` (raw + compute on read), `ADR-024` (cascade 5 niveaux par champ), `ADR-025` (clé path 5 champs sans tri canonique), `ADR-026` (`effectiveDate` pilotante), `ADR-027` (`envName` first-class), `ADR-028` (suppression endpoints legacy `/api/snapshots*`), `ADR-030` (heuristique `DumpTypeDetector`). Commits `d948e2e`, `49f4148`, `08d068c`.
- **v2-2a T2 — Schéma Prisma v2.0 raw tables + reset DB** : réécriture intégrale de `apps/api/prisma/schema.prisma` avec 8 modèles nouveaux (`Import`, `ImportedComponent`, `ImportedComponentUrl`, `ImportedPath`, `ImportedMessagingStat`, `ImportedAppProperty`, `ComponentOverride`, `EntsoeEntry`). Migration `20260419135633_v2_fondations_raw_tables` appliquée. Types shared `ImportSummary`/`ImportDetail` ajoutés dans `packages/shared/src/graph.ts`. `SnapshotSummary`/`SnapshotDetail` supprimés. `lat`/`lng` rendus nullable sur `ImportedComponent` — le fallback Bruxelles sera appliqué au rendu via la cascade, plus à l'ingestion. Commit `59ed9de`.
- **v2-2a T3 — `filename-parser`** : fonction pure `parseDumpFilename()` extrait `{ sourceComponentEic, sourceDumpTimestamp }` des noms de fichier canoniques `{EIC}_{timestamp}.zip`. 5/5 tests. Commit `e6cf20f`.
- **v2-2a T4 — `DumpTypeDetector`** : heuristique 2a — présence `<?xml` dans un champ CSV → `ENDPOINT`, sinon `COMPONENT_DIRECTORY`. `BROKER` seulement via override explicite. 4/4 tests. Commit `818ec83`.
- **v2-2a T5-T7 — `ImportBuilderService`** : service sans DI, 4 méthodes pures. `buildFromLocalCsv` (contribution brute depuis CSV, sans cascade registry), `buildFromXml` (extraction composants + paths + stubs BROKER depuis le blob XML MADES, adapté à la structure réelle `MadesTree`), `buildMessagingStats` (parsing dates/numbers/booléens), `buildAppProperties` (filtrage regex clés sensibles case-insensitive). 9/9 tests. Commits `5335608`, `1e4c4c4`, `8becefa`.
- **v2-2a T8 — `RawPersisterService`** : écriture transactionnelle Prisma des `Import` + `ImportedComponent[]` + `ImportedComponentUrl[]` + `ImportedPath[]` + `ImportedMessagingStat[]` + `ImportedAppProperty[]`. Repackaging zip sans fichiers sensibles (P3-1 conservé). Cleanup zip disque sur rollback (P3-6 conservé). Zips archivés sous `storage/imports/{uuid}.zip`. 2/2 tests. Commit `4a078ba`.
- **v2-2a T9 — `ImportsService`** : orchestrateur pipeline (zip → csv → xml → detector → builder → persister). `createImport(input)` avec SHA256 du file buffer, dédup composants CSV↔XML (XML prioritaire), `effectiveDate = sourceDumpTimestamp ?? new Date()`. `listImports(env?)` + `deleteImport(id)` cascade + unlink zip. 3/3 tests. Commit `bdf2017`.
- **v2-2a T10 — `ImportsController`** : `POST /api/imports` (multipart) + `GET /api/imports?env=X` + `DELETE /api/imports/:id` (204). Validation zod `{envName, label, dumpType?}` + MIME check + magic bytes ZIP + limite 50 MB. 9/9 tests. Commit `a2f3d99`.

### Removed

- **v2-2a T11 — Suppression SnapshotsModule + legacy ingestion** : `apps/api/src/snapshots/` (module, controller, service, DTOs), `NetworkModelBuilderService`, `SnapshotPersisterService`, `IngestionService` (legacy orchestrateur), `SnapshotNotFoundException` renommée en `ImportNotFoundException`. Tests d'intégration v1.2 (`full-ingestion-cd`, `full-ingestion-endpoint`, `full-graph-endpoint`, `snapshots-controller`) supprimés — seront remplacés en T18-T19. `IngestionModule` recâblé avec les 6 nouveaux providers + `ImportsController`. 13 suites / 89 tests verts. Commit `18a090e`.

### Added — Phase 3+4 GraphService compute-on-read

- **v2-2a T12 — `mergeComponentsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-components.ts` qui agrège les `ImportedComponent` par EIC, champ par champ, en privilégiant le latest `effectiveDate`. Les champs null ne remplacent jamais un non-null. `isDefaultPosition` passe à `false` dès qu'un import fournit des coord explicites (one-way latch). URLs : latest-wins sur l'ensemble. 6/6 tests. Commit `f2e4112`.
- **v2-2a T13 — `applyCascade`** : fonction pure dans `apps/api/src/graph/apply-cascade.ts` implémentant la cascade 5 niveaux par champ (override admin > ENTSO-E > registry RTE > merged-import > default Bruxelles). Helper `pickField(...values)` retourne la première valeur non-null. `isDefaultPosition = true` ssi lat/lng viennent du fallback. 7/7 tests. Commit `374205c`.
- **v2-2a T14 — `mergePathsLatestWins`** : fonction pure dans `apps/api/src/graph/merge-paths.ts` qui dédup les `ImportedPath` par clé 5 champs `(receiver, sender, messageType, transportPattern, intermediateBroker)` sans tri canonique. Latest `effectiveDate` gagne sur `validFrom/validTo/isExpired`. `process` laissé non-classifié (délégué au `GraphService`). 7/7 tests. Commit `26ab602`.
- **v2-2a T15 — `GraphService.getGraph(env, refDate?)` compute-on-read** : réécriture intégrale. Assemble `mergeComponentsLatestWins` → `applyCascade` → `mergePathsLatestWins` → `buildEdges` à chaque requête. `classifyMessageType` appliqué au read (garantit rétroactivité registry). `isRecent` calculé relativement au `effectiveDate` du latest import (reproductible historique). `RegistryService.resolveEic(eic)` ajoutée pour la cascade niveau 3. `mapConfig.defaultLat/defaultLng` (Bruxelles 50.8503, 4.3517) ajoutés dans `eic-rte-overlay.json` + type `MapConfig`. 6/6 tests intégration + 108/108 total. Commit `0b71665`.
- **v2-2a T16 — `GraphController GET /api/graph?env&refDate`** : nouvelle route avec validation query params (env requis, refDate ISO optionnel, 400 sur invalid). 5/5 tests + typecheck api PASS. Commit `2a7d30c`.
- **v2-2a T17 — `EnvsController GET /api/envs`** : endpoint liste distincte des `envName` présents dans la table `Import`, trié alphabétiquement. Nouveau module `EnvsModule` registered dans `AppModule`. 2/2 tests. Commit `c260f2d`.
- **v2-2a T18-T19 — Tests d'intégration v2** : `full-ingestion-v2.spec.ts` (upload 2 fixtures ENDPOINT+CD, agrégation sans doublons EIC, bounds cohérents, liste imports), `env-isolation.spec.ts` (2 envs indépendants, suppression OPF n'affecte pas PROD), `import-deletion.spec.ts` (cascade delete + zip unlink + NotFoundException sur id inconnu). 8 tests intégration verts / 121 tests total. Commits `28a0cb2`, `2d6bca5`.

### Added — Phase 5 Frontend

- **v2-2a T20 — Client API web v2** : `apps/web/src/lib/api.ts` réécrit pour `listEnvs`, `listImports(env?)`, `createImport(file, envName, label, dumpType?)`, `deleteImport(id)`, `getGraph(env, refDate?)`. URLSearchParams pour les query strings. Suppression des méthodes legacy `createSnapshot`/`listSnapshots`/`getGraph(id)`. Commit `7bcd34c`.
- **v2-2a T21 — Store Zustand refonte** : state `activeEnv` (persisté) + `envs` + `imports` + `graph`. Suppression de `activeSnapshotId`/`snapshots`/`setActiveSnapshot`. `loadEnvs()` avec fallback intelligent (persisted → premier env → null). `setActiveEnv()` parallèle `loadImports + loadGraph`. 5/5 tests. Commit `7e41a15`.
- **v2-2a T22 — `EnvSelector` component** : composant `<select>` synchronisé avec le store, fallback « Aucun env » si liste vide. Remplace `SnapshotSelector`. 4/4 tests. Commit `0ecfcc1`.
- **v2-2a T23 — `MapPage` empty state + consommation activeEnv** : route `/` entrée principale. Empty state différencié (pas d'env vs pas de composants). CTA « Importer un dump » vers `/upload?env=X`. `loadEnvs()` au mount. Commit `fbfae71`.
- **v2-2a T24 — `UploadPage` adaptations v2** : appelle `api.createImport`, lit `envName` depuis `?env=X` (default `OPF`), déclenche `loadEnvs()` post-succès, redirige vers `/`. Affiche `dumpType` et warnings. 10/10 tests. Commit `9661ff2`.
- **v2-2a T25 — `App.tsx` routes refondues** : `/` = MapPage, `/map` → redirect `/`, `/upload` = UploadPage, `*` → `/`. Header : titre + `EnvSelector` + lien `+ Importer`. **Suppression complète du dossier `SnapshotSelector/`**. 33/33 tests web + typecheck web PASS. Commit `0f136e3`.
- **v2-2a T26-T28 — 3 E2E Playwright** : `empty-state.spec.ts` (purge via API + vérif empty state + CTA), `upload-then-map.spec.ts` (upload fixture ENDPOINT → redirect `/` → marker leaflet visible), `env-switch.spec.ts` (2 uploads dans 2 envs → switch via selector, skip dynamique si <2 envs). Localisation confirmée à `apps/web/e2e/`. Commit `28fcc13`.

### Changed

- **v2-2a dette — Suppression index redondant `Import.envName`** : l'index simple `@@index([envName])` est couvert par le composite `@@index([envName, effectiveDate])` via leftmost-prefix scan B-tree. Migration `20260419150916_drop_redundant_envname_index` appliquée. Détecté par code-review quality de T2. Commit `14a6866`.

- **P3-1 — Re-packaging zip sans fichiers sensibles** : `SnapshotPersisterService.repackageWithoutSensitive(buffer)` retire `local_key_store.csv`, `registration_store.csv` et `registration_requests.csv` du zip avant écriture sur disque. Le zip archivé dans `storage/snapshots/` ne contient plus de données sensibles ECP.
- **P3-2 — Seuil `isRecent` configurable via env var** : `GraphService` lit `ISRECENT_THRESHOLD_MS` (défaut : `86400000` = 24h) via `parseThreshold()` dans le constructeur. Configurable sans modification du code pour les processus basse fréquence (UK-CC-IN, TP).
- **P3-3 — Pré-calcul `rteEicSet` dans `RegistryService`** : le `Set<string>` des EICs RTE est construit une seule fois dans `onModuleInit()` et exposé via `getRteEicSet()`. `NetworkModelBuilderService` consomme `this.registry.getRteEicSet()` au lieu de reconstruire le set à chaque appel de `build()`.
- **P3-4 — `mapConfig` externalisé dans `GraphResponse`** : `RegistryService` expose `getMapConfig()` depuis `eic-rte-overlay.json#mapConfig`. `GraphService` inclut `mapConfig` dans le `GraphResponse`. `useMapData.ts` consomme `graph.mapConfig` (plus de constantes `PARIS_LAT/PARIS_LNG/OFFSET_DEG` hardcodées). Nouveau type `MapConfig` dans `packages/shared/src/graph.ts`.
- **P3-5 — ADR-022 nestjs-zod (documentation)** : `docs/adr/ADR-022-nestjs-zod-validation-strategy.md` documente la décision de standardiser `nestjs-zod` pour les futurs endpoints (commit b6024f6).
- **P3-7 — Nettoyage whitelist `USABLE_CSV_FILES`** : `message_type.csv` et `message_upload_route.csv` retirés de `USABLE_CSV_FILES` dans `apps/api/src/ingestion/types.ts`. La whitelist reflète désormais exactement les CSV lus et parsés par le pipeline.

- **P1-1 — ESLint 9 flat config** : configs `eslint.config.mjs` créées pour `apps/api` et `apps/web` (suppression du legacy `.eslintrc.cjs`). Ruleset `recommended` + 5 règles type-aware (`consistent-type-imports`, `no-floating-promises`, `no-misused-promises`, `await-thenable`, `no-unused-vars`). Overrides permissifs pour les fichiers `spec/test`. 12 devDependencies ESLint ajoutées.
- **P1-3 — Garde-fou anti-désynchro palette** : `apps/web/src/lib/process-colors.sync.test.ts` — 2 tests Vitest qui lisent `packages/registry/eic-rte-overlay.json` et comparent les clés + valeurs hex avec `PROCESS_COLORS` du TS.
- **P2-1 — Tests unitaires api/snapshots** : 10 nouveaux cas Vitest dans `apps/api/src/snapshots/snapshots.controller.spec.ts` et `apps/api/src/snapshots/snapshots.service.spec.ts` couvrant : rejet MIME invalide, magic bytes erronés, label vide, 404 sur snapshot inexistant, list avec filtre envName, detail nominal. Suite api passe de 61 à 71 tests.
- **P2-2 — Tests unitaires SnapshotPersister** : 3 nouveaux cas dans `apps/api/src/ingestion/snapshot-persister.service.spec.ts` — cas nominal, échec transaction Prisma (zip nettoyé), échec cleanup (log warning). Suite api : 71 → 74 tests.
- **P2-3 — Test d'intégration GET /graph** : `apps/api/test/full-graph-endpoint.spec.ts` — 4 cas contre les fixtures réelles (Endpoint + CD) : HTTP 200, présence nodes/edges, cohérence bounds, 404 snapshot inconnu. Suite api : 74 → 79 tests.
- **P2-4 — Tests unitaires UploadPage** : 6 cas `@testing-library/react` dans `apps/web/src/pages/UploadPage.test.tsx` : soumission OK, état loading, affichage erreur API, affichage warnings, désactivation bouton sans fichier. Suite web passe de 2 à 8 tests.
- **P2-5 — Tests unitaires DetailPanel** : 10 cas dans `apps/web/src/components/DetailPanel/NodeDetails.test.tsx` (5) et `EdgeDetails.test.tsx` (5) — rendu champs null, badges, formatage dates, badge isDefaultPosition. Suite web : 8 → 18 tests.
- **P2-6 — Tests unitaires SnapshotSelector** : 3 cas dans `apps/web/src/components/SnapshotSelector/SnapshotSelector.test.tsx` — liste vide → lien upload, liste non vide → select avec valeur active, onChange déclenche setActiveSnapshot. Suite web : 18 → 23 tests (dont 2 de app-store).
- **P2-8 — Warning structuré CSV_PARSE_ERROR** : `CsvReaderService.readRaw` retourne `{ rows, parseError }` avec `fileName` param. 4 méthodes publiques acceptent un paramètre `warnings: Warning[]`. Helper privé `pushCsvWarning`. `IngestionService` collecte les `extractionWarnings` et les fusionne dans `networkSnapshot.warnings`.
- **Stack de test React** : `apps/web/vitest.config.ts` passe à `environment: 'happy-dom'` + `setupFiles: ['./src/test-setup.ts']`. Nouveau fichier `apps/web/src/test-setup.ts` (import `@testing-library/jest-dom` + `afterEach(cleanup)`). Dépendances ajoutées : `@testing-library/react@^16`, `@testing-library/jest-dom@^6`, `@testing-library/user-event@^14`, `happy-dom@^15`.

### Changed

- **P3-4 — `useMapData` consomme `graph.mapConfig`** : les constantes `PARIS_LAT`, `PARIS_LNG`, `OFFSET_DEG` et le seuil de proximité ne sont plus hardcodés dans `useMapData.ts` — ils proviennent désormais de `graph.mapConfig` retourné par `GET /api/snapshots/:id/graph`. Suppression de la dépendance sur `eic-rte-overlay.json` dans `packages/registry`.

- **P1-2 — REGISTRY_PATH env var** : `RegistryService` déplace la résolution du chemin dans `onModuleInit()`. Lit `process.env.REGISTRY_PATH` avec fallback sur `../../packages/registry`. Suppression de la constante module-level `REGISTRY_PACKAGE_ROOT`. Log `Registry root: <path>` au boot.
- **P2-1 — ESLint web** : override étendu aux `**/*.test.{ts,tsx}` et `**/*.spec.{ts,tsx}` dans `apps/web/eslint.config.mjs` pour autoriser les patterns de test.

### Fixed

- **P1-1 — Violations JSX/TS** : 10 violations `react/jsx-no-leaked-render` corrigées (pattern `{x && <C/>}` → `{x ? <C/> : null}`) dans 6 fichiers TSX. 2 violations `no-misused-promises` corrigées dans `UploadPage.tsx` (async `onClick` wrappé avec `void`).
- **P1-4 — HTTP 500 → HTTP 400 sur CSV vide** : `IngestionService` lève désormais `InvalidUploadException` (HTTP 400, code `INVALID_UPLOAD`) au lieu d'une `Error` native quand `component_directory.csv` est vide ou absent de l'archive.
- **P2-7 — Bascule activeSnapshotId invalide** : `loadSnapshots` dans `app-store.ts` vérifie si l'`activeSnapshotId` persisté dans localStorage est encore présent dans la liste retournée (`persistedStillValid`). Si non valide et `list.length > 0`, bascule automatiquement sur `list[0]`. Si valide et graphe non chargé, déclenche `setActiveSnapshot` au boot.

### Changed

- **Phase 4 — `EdgePath` réécrit avec `<Polyline>` sampled bezier** : `EdgePath.tsx` abandonne l'approche impérative `useEffect`/`useRef`/`L.curve` au profit d'un rendu déclaratif `<Polyline positions={sampleBezier(...)} pathOptions={...} eventHandlers={...} />`. Le helper `sampleBezier` génère N+1 points intermédiaires le long de la courbe quadratique. Deux tests Vitest (`EdgePath.test.tsx`) vérifient le nombre de points et le midpoint.

### Removed

- **Phase 4 — Suppression de `leaflet-curve`** : la dépendance `leaflet-curve` est retirée de `apps/web/package.json` et `pnpm-lock.yaml`. Le stub `declare module 'leaflet-curve'` est supprimé de `apps/web/src/env.d.ts`. Dette m10 résolue.

### BDD
