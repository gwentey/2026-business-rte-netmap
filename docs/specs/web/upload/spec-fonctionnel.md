# Spec Fonctionnelle — web/upload [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | web/upload          |
| Version    | 0.1.0               |
| Date       | 2026-04-17          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

Aucun ADR RETRO créé pour cette feature (UI orchestration simple — pas de décision architecturale propre à ce module identifiée).

---

## Contexte et objectif

La page `/upload` est le point d'entrée unique de l'application pour charger un backup ECP dans la base de données. L'opérateur RTE dispose d'un zip de backup (Endpoint ou Component Directory) qu'il dépose sur la page ; l'application le transmet à l'API, ingère les données, et propose d'accéder immédiatement à la carte réseau correspondante.

Cette page ne contient pas de logique métier propre : elle orchestre l'interaction entre l'utilisateur, la zone de dépôt de fichier, le formulaire de métadonnées, et l'API backend.

---

## Règles métier (déduites du code)

1. **Type de fichier accepté :** seul un fichier `.zip` avec MIME type `application/zip` peut être déposé. Tout autre fichier est rejeté côté client par `react-dropzone`, avec affichage du message d'erreur retourné par la librairie.

2. **Taille maximale :** un fichier supérieur à 50 MB (52 428 800 octets) est refusé par `react-dropzone` avant tout envoi réseau.

3. **Sélection unique :** un seul fichier peut être déposé à la fois (`multiple: false`). Déposer un nouveau fichier remplace le précédent.

4. **Champs requis :** les trois paramètres `file`, `label` et `envName` doivent être renseignés (non vides après `.trim()`) pour que le bouton "Envoyer" déclenche l'appel API. Un message d'erreur générique s'affiche sinon.

5. **Valeur par défaut de l'environnement :** le champ `envName` est pré-rempli à `OPF`. L'opérateur peut le modifier librement ; il n'y a pas de whitelist des valeurs acceptées côté client (texte libre).

6. **Soumission non bloquante :** pendant l'envoi, le bouton "Envoyer" est désactivé (`disabled`) et son libellé passe à "Envoi en cours…". La page reste accessible (pas de plein-écran de chargement).

7. **Affichage des warnings post-ingestion :** si le snapshot créé contient des warnings, un accordéon HTML natif (`<details>`/`<summary>`) les liste, plafonné à 20 entrées. Chaque warning affiche son code technique et son message.

8. **Navigation vers la carte :** après un upload réussi, le bouton "Voir sur la carte →" déclenche deux actions en séquence : (a) `setActiveSnapshot(result.id)` qui charge le graphe du snapshot via l'API et met à jour le store Zustand, puis (b) une navigation React Router vers `/map`.

9. **Gestion des erreurs réseau :** toute exception levée lors de l'appel `api.createSnapshot` est capturée et affichée dans une bannière rouge sous le bouton. L'état de la page n'est pas réinitialisé, permettant une nouvelle tentative.

10. **Persistance du snapshot actif :** l'`activeSnapshotId` est persisté dans le `localStorage` via Zustand persist (clé `carto-ecp-store`). Un rechargement de page sur `/map` restaure donc automatiquement le dernier snapshot actif.

---

## Cas d'usage (déduits)

### CU-001 — Upload réussi d'un backup Endpoint

**Acteur :** opérateur MCO RTE

**Préconditions :** l'opérateur dispose d'un zip de backup ECP valide (< 50 MB).

**Flux principal :**
1. L'opérateur ouvre `/upload`.
2. Il dépose le fichier `.zip` dans la zone de dépôt (drag & drop ou clic pour sélectionner).
3. Le nom et la taille du fichier s'affichent dans la zone de dépôt.
4. Il saisit un label descriptif (ex. : "Snapshot hebdo PROD 17/04") et vérifie ou modifie l'environnement (`OPF`).
5. Il clique sur "Envoyer" — le bouton se désactive pendant la requête.
6. L'API répond avec le `SnapshotDetail` créé : type (`ENDPOINT`), nombre de composants et de paths.
7. Si des warnings ont été produits lors de l'ingestion, l'accordéon les liste.
8. L'opérateur clique "Voir sur la carte →".
9. Le graphe du snapshot est chargé en mémoire et l'application navigue vers `/map`.

### CU-002 — Fichier rejeté côté client

**Flux :**
1. L'opérateur dépose un fichier non-zip ou un zip supérieur à 50 MB.
2. `react-dropzone` rejette le fichier (`onDropRejected`).
3. Le message d'erreur de la librairie s'affiche en bannière rouge.
4. Aucun appel réseau n'est effectué.

### CU-003 — Erreur API lors de l'ingestion

**Flux :**
1. L'opérateur soumet un fichier valide.
2. L'API retourne une erreur (zip corrompu, fichiers obligatoires manquants, etc.).
3. La bannière rouge affiche `err.message` retourné par l'API (ou `HTTP <status>` si pas de corps JSON).
4. Le formulaire reste en état éditable pour une nouvelle tentative.

---

## Dépendances

- **`react-dropzone`** — gestion du drag & drop et de la validation côté client (type MIME, taille).
- **`@carto-ecp/shared`** — types `SnapshotDetail` et `Warning` (DTOs partagés api/web).
- **`apps/web/src/lib/api.ts`** — fonction `api.createSnapshot` qui encapsule le `POST /api/snapshots` en `multipart/form-data`.
- **`apps/web/src/store/app-store.ts`** — `setActiveSnapshot` (charge le graphe + met à jour le store Zustand avec persist localStorage).
- **React Router DOM 6** — `useNavigate` pour la redirection vers `/map`.
- **`POST /api/snapshots`** (backend NestJS) — endpoint qui reçoit le zip et déclenche le pipeline d'ingestion complet.

---

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Plafond à 20 warnings affiché :** le code sélectionne `result.warnings.slice(0, 20)`. Il n'est pas clair si c'est un choix fonctionnel définitif ou une limite provisoire. À valider : faut-il afficher tous les warnings, ou ce plafond est-il volontaire ?
- **Valeur par défaut `OPF` :** le champ `envName` est initialisé à `"OPF"`. Est-ce la valeur d'environnement la plus fréquente en production, ou simplement une valeur d'exemple ? La portée fonctionnelle de l'`envName` (filtrage dans le sélecteur de snapshot) mériterait d'être documentée séparément.
- **Comportement si `setActiveSnapshot` échoue après upload :** si le chargement du graphe via `setActive` échoue (réseau coupé entre l'upload et le clic "Voir sur la carte"), la navigation vers `/map` est quand même déclenchée (le `await` ne bloque pas sur l'erreur dans le store). L'expérience utilisateur dans ce cas n'est pas explicitement gérée dans `UploadPage`.
- **Absence de réinitialisation du formulaire après upload réussi :** une fois le résultat affiché, le formulaire reste en état rempli. Il n'est pas clair si l'intention est de permettre un second upload sans effacer les champs, ou si c'est un oubli.
