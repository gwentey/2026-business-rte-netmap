# ADR-034 — Markers cartographiques via `L.divIcon` + `renderToStaticMarkup(lucide-react)`

| Champ      | Valeur                                |
|------------|---------------------------------------|
| Numéro     | ADR-034                               |
| Statut     | Accepté                               |
| Date       | 2026-04-19                            |
| Auteur(s)  | Anthony + Claude                      |
| Owner      | Anthony                               |
| Décideurs  | Anthony                               |
| Contexte   | Slice v2.0-2f Icônes                  |
| Remplace   | —                                     |
| Features   | *                                     |
| App        | web                                   |

## Contexte

La slice 2a utilisait `CircleMarker` Leaflet — une forme ronde colorée avec taille variable selon le `NodeKind`. Cette approche ne permettait aucune différenciation visuelle du type de node au-delà de la couleur. L'utilisateur a explicitement demandé de distinguer visuellement broker/CD/endpoint pour une meilleure lisibilité de la cartographie. Le projet utilise déjà `lucide-react` dans l'UI React, ce qui offre une opportunité naturelle de réutiliser ce set d'icônes cohérent et scalable au niveau de la cartographie Leaflet.

## Options considérées

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| A — `L.divIcon` + `renderToStaticMarkup(lucide-react)` | Rend chaque icône Lucide React en HTML string via `react-dom/server`, l'enveloppe dans un `<div>` coloré, injecte le tout dans `L.divIcon` | S | Réutilise la stack Lucide existante ; icônes vectorielles scalables et retina-ready ; cohérent avec le reste du front React ; factory isolée testable sans Leaflet | Nécessite import `react-dom/server` (déjà présent via React 18) ; re-rendu React pour chaque marker à chaque update |
| B — SVG custom inline | Écrire 4-5 SVG manuels par `NodeKind` directement en JSX ou HTML string | M | Contrôle pixel-perfect ; pas de dépendance Lucide pour Leaflet | Assets SVG à maintenir manuellement ; branding lock-in ; risque d'obsolescence si le design Lucide évolue |
| C — `L.Icon` avec fichiers `.png`/`.svg` | Images statiques dans `public/icons/`, chargées comme assets | S | Perf optimale (pas de rendu React pour chaque marker) | Fichiers d'assets à maintenir séparément ; pipeline Vite supplémentaire ; violation du DRY — icônes dupliquées (Lucide en UI + assets custom) |

## Décision retenue

**Option choisie : A** — L'option A réutilise la source d'icônes unique (Lucide React) déjà intégrée au projet, garantissant cohérence visuelle et maintenabilité. Le rendu côté client via `renderToStaticMarkup` est acceptable pour le cas nominal (~500 markers), et la factory est isolée pour test unitaire sans dépendance Leaflet.

## Conséquences

### Positives
- Icônes vectorielles scalables, retina-ready par défaut (pas d'artefacts de zoom).
- Un seul set d'icônes source dans tout le projet (`lucide-react`) → maintenabilité et cohérence visuelle garanties.
- Factory pure `buildNodeDivIcon(kind, isDefault, selected)` testable en isolation sans instancier Leaflet.
- Les icônes Lucide sont déjà licenciées et incluses ; pas d'assets additionnels à gérer.

### Négatives
- Chaque marker exécute un rendu React sérialisé à chaque mise à jour dynamique (selection, hover, etc.) — acceptable pour <500 markers ; à revisiter si le graph grandit significativement (seuil suggéré : >1000 nodes).
- Tailwind CSS ne peut pas être utilisé dans l'HTML string du `divIcon` (les classes générées ne sont pas vues par le scanner Tailwind lors du build). Les styles du corps du marker doivent utiliser l'approche pragmatique : styles inline ou classes utilitaires pré-générées.

### Ce qu'on s'interdit désormais
- Utiliser `CircleMarker` pour les nodes ECP ; ce pattern ne distingue pas les types de nodes (BROKER, COMPONENT_DIRECTORY, ENDPOINT).
- Ajouter des fichiers d'icônes externes dans `public/` ou `assets/` pour ce cas d'usage ; on reste exclusivement sur Lucide React.
- Dupliquer les icônes entre plusieurs sources (Lucide en UI, SVGs custom pour la carte, etc.) — un seul point de vérité.

## Ressources / Références

- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2f.md` §A, §B, §C (plan slice 2f)
- React docs : [`react-dom/server.renderToStaticMarkup`](https://react.dev/reference/react-dom/server/renderToStaticMarkup)
- Leaflet docs : [`L.divIcon`](https://leafletjs.com/reference.html#divicon)
- Lucide React : https://lucide.dev/
