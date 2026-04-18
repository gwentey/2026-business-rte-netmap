# Spec Technique — web/upload

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | web/upload          |
| Version       | 0.2.0               |
| Date          | 2026-04-18          |
| Source        | Rétro-ingénierie + Phase 2 remédiation |

---

## Architecture du module

Le module est constitué d'un unique composant React (`UploadPage`) qui orchestre trois couches distinctes :

1. **Zone de dépôt** — `react-dropzone` fournit les props `getRootProps` / `getInputProps` / `isDragActive` permettant de transformer un `<div>` en cible drag & drop. La validation (type MIME + taille) est effectuée par la librairie avant tout appel réseau.

2. **Formulaire de métadonnées** — Deux champs texte non contrôlés via `useState` local : `label` (chaîne vide par défaut, requis) et `envName` (initialisé à `"OPF"`, requis). Pas de validation côté client au-delà de `.trim()` non vide.

3. **Couche réseau** — `api.createSnapshot` dans `apps/web/src/lib/api.ts` construit un `FormData` avec trois entrées (`zip`, `label`, `envName`) et effectue un `POST /api/snapshots` sans en-tête `Content-Type` explicite (le navigateur le pose automatiquement avec boundary multipart). La réponse est désérialisée via `parseJson<SnapshotDetail>` qui lève une `Error` sur tout statut HTTP non-2xx.

4. **Store global** — `useAppStore` (Zustand + persist) expose `setActiveSnapshot(id)` qui déclenche `GET /api/snapshots/:id/graph` et stocke le `GraphResponse` en mémoire. L'`activeSnapshotId` est persisté dans `localStorage` (clé `carto-ecp-store`, via `partialize`).

**Flux de données :**

```
[Drop zone]  →  useState(file)
[Form]       →  useState(label, envName)
[Submit]     →  api.createSnapshot(file, label, envName)
                  → POST /api/snapshots (multipart/form-data)
                  ← SnapshotDetail
             →  useState(result)
[Voir carte] →  store.setActiveSnapshot(result.id)
                  → GET /api/snapshots/:id/graph
                  ← GraphResponse → store.graph
             →  navigate('/map')
```

---

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `apps/web/src/pages/UploadPage.tsx` | Composant React principal — drop zone, formulaire, affichage résultat et warnings | ~146 |
| `apps/web/src/lib/api.ts` | Client HTTP typé — encapsule tous les appels `fetch` vers `/api/*` | ~30 |
| `apps/web/src/store/app-store.ts` | Store Zustand — `setActiveSnapshot` charge le graphe et persiste l'`activeSnapshotId` | ~64 |
| `packages/shared/src/snapshot.ts` | DTOs `SnapshotDetail`, `SnapshotSummary`, `Warning`, `ComponentType` | ~29 |

---

## Schéma BDD (si applicable)

Ce module ne lit pas directement la base de données. Il consomme le résultat de `POST /api/snapshots` qui écrit en base via le pipeline d'ingestion backend (`SnapshotPersister`).

La table `Snapshot` est indirectement produite par ce module. Sa structure complète est documentée dans la spec technique de `api/snapshots`.

---

## API / Endpoints (si applicable)

| Méthode | Route | Description | Auth |
|---------|-------|-------------|------|
| POST | `/api/snapshots` | Upload du zip + label + envName. Corps : `multipart/form-data` avec champs `zip` (File), `label` (string), `envName` (string). Retourne `SnapshotDetail`. | Aucune (hors scope slice #1) |
| GET | `/api/snapshots/:id/graph` | Chargé immédiatement après upload via `setActiveSnapshot`. Retourne `GraphResponse`. | Aucune |

---

## Patterns identifiés

- **Local state React (`useState`)** pour la gestion du cycle de vie du formulaire (file, label, envName, loading, error, result). Pas de formulaire géré (`react-hook-form` ou équivalent) — gestion manuelle minimaliste.
- **Controlled dropzone** via `react-dropzone` en mode non-React-controlled (les props sont posées sur un `<div>` arbitraire, pas sur un composant Form).
- **Fetch sans librairie** (`axios`, `react-query`, etc. non utilisés) — appels `fetch` natifs encapsulés dans un objet `api` simple avec gestion d'erreur centralisée dans `parseJson`.
- **Zustand + persist** pour partager l'`activeSnapshotId` entre UploadPage et MapPage via localStorage, sans prop drilling ni Context React.
- **Tailwind CSS** pour tout le style. La couleur accent `bg-rte` correspond à `#e30613` (rouge RTE, défini dans la config Tailwind). La zone de drop change de style selon `isDragActive` (`border-rte bg-red-50` vs `border-gray-300 bg-gray-50`).
- **HTML natif `<details>`/`<summary>`** pour l'accordéon de warnings — pas de composant UI tiers (Radix/shadcn non utilisé ici).

---

## État local du composant

| État | Type | Valeur initiale | Rôle |
|------|------|-----------------|------|
| `file` | `File \| null` | `null` | Fichier sélectionné via la drop zone |
| `label` | `string` | `''` | Label saisi par l'opérateur |
| `envName` | `string` | `'OPF'` | Environnement saisi par l'opérateur |
| `loading` | `boolean` | `false` | Indique si la requête POST est en cours |
| `error` | `string \| null` | `null` | Message d'erreur à afficher |
| `result` | `SnapshotDetail \| null` | `null` | Réponse API après upload réussi |

---

## Constante notable

```ts
const MAX_UPLOAD = 50 * 1024 * 1024; // 52 428 800 octets
```

Cette constante est définie au niveau module dans `UploadPage.tsx`. Elle est passée à `react-dropzone` via `maxSize`. La même limite est appliquée côté serveur via `multer` (voir design §11.1).

---

## Comportement de `api.createSnapshot`

```ts
createSnapshot: async (file: File, label: string, envName: string): Promise<SnapshotDetail> => {
  const form = new FormData();
  form.append('zip', file);       // champ attendu par multer côté API
  form.append('label', label);
  form.append('envName', envName);
  const res = await fetch('/api/snapshots', { method: 'POST', body: form });
  return parseJson<SnapshotDetail>(res);
}
```

`parseJson` lève `new Error(err.message ?? 'HTTP <status>')` si le statut n'est pas 2xx, remontant ainsi le message NestJS (`UploadValidationException`, etc.) directement dans la bannière d'erreur de `UploadPage`.

---

## Comportement de `setActiveSnapshot`

`setActiveSnapshot(id)` dans le store Zustand :
1. Remet à zéro `selectedNodeEic` et `selectedEdgeId` (efface la sélection carte courante).
2. Appelle `GET /api/snapshots/:id/graph`.
3. Met à jour `activeSnapshotId` et `graph` dans le store.
4. En cas d'erreur : positionne `store.error` mais ne lève pas d'exception — `UploadPage` ne capte pas cet état d'erreur.

---

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `apps/web/e2e/upload-to-map.spec.ts` | Flux E2E complet : dépôt du zip fixture Endpoint via `setInputFiles`, saisie du label, clic "Envoyer", attente du bouton "Voir sur la carte", navigation vers `/map`, vérification que la carte Leaflet est visible | Existant (Playwright) |
| `apps/web/e2e/snapshot-switch.spec.ts` | Bascule entre deux snapshots (implique deux uploads préalables via l'UI) | Existant (Playwright) |

| `apps/web/src/pages/UploadPage.test.tsx` | **[P2-4]** Soumission OK (mock `api.createSnapshot` résout), état loading pendant la requête, affichage bannière erreur API, affichage section warnings si `warnings.length > 0`, bouton Envoyer désactivé sans fichier sélectionné, affichage bouton "Voir sur la carte" après succès | Ajouté Phase 2 |
