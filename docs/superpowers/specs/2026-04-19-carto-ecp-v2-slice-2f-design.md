# Slice 2f — Icônes différenciées + badge `isDefaultPosition`

> **Statut :** design validé (2026-04-19), prêt pour `/superpowers:write-plan`.
> **Réfère :** [`2026-04-19-carto-ecp-v2-chapeau.md`](./2026-04-19-carto-ecp-v2-chapeau.md) §7 (feuille de route slices 2a→2f).
> **Branche cible :** `feat/v2-slice-2f-icons` (créée depuis la tête de `feat/v2-slice-2b-multi-upload`).

---

## §1 — Objectif

Remplacer le rendu actuel des markers cartographiques (`CircleMarker` de tailles/couleurs variables par `kind`) par des **icônes Lucide** différenciées par type, dans un cercle de fond coloré homogène 24px. Ajouter un badge visuel **`⚠`** pour les nodes dont les coordonnées sont en fallback (`isDefaultPosition = true`, centre Europe Bruxelles).

Cette slice répond à la **demande initiale n°4 de l'utilisateur** : *« on arrive pas à différencier le type de l'élément sur la carte par exemple le "Broker" devrait ne pas être un rond mais il icon broker, pareil pour le CD, ou l'endpoint »*.

---

## §2 — Scope

### 2f livre

- Réécriture de `apps/web/src/components/Map/NodeMarker.tsx` : `CircleMarker` → `Marker + divIcon`.
- Nouveau helper pur `apps/web/src/components/Map/node-icon.tsx` : factory `buildNodeDivIcon(kind, isDefaultPosition, selected) → L.DivIcon`, isolée pour test unitaire sans Leaflet React.
- Mapping icônes Lucide ↔ `NodeKind` (5 types : `RTE_ENDPOINT` / `RTE_CD` / `BROKER` / `EXTERNAL_CD` / `EXTERNAL_ENDPOINT`) + BA (`BUSINESS_APPLICATION` si exposé par le shared, sinon ignoré en 2f).
- Badge `⚠` overlay coin bas-droit quand `node.isDefaultPosition === true`.
- Halo bleu de sélection (box-shadow) au lieu de l'agrandissement de rayon v2a.
- Tooltip enrichi d'une ligne explicite « position par défaut » si applicable (remplace la phrase actuelle par un texte plus clair).
- 5 tests : 3 unit sur le helper, 2 component sur le Marker.

### 2f NE livre PAS (reporté)

- ❌ Colorer les markers par TSO/pays — à prévoir dans un slice « branding partenaires » si demandé.
- ❌ Badge « provenance multi-imports » — nécessiterait d'exposer `provenance.importCount` côté API, hors scope 2f pur UI.
- ❌ Badge « signalé dans ENTSO-E » — nécessiterait slice 2e (table `EntsoeEntry` peuplée).
- ❌ Refonte `MapLegend` — garder la légende existante v2a intacte ou l'enrichir dans un slice dédié à la lisibilité de la carte.
- ❌ Animation / transitions — les divIcon standard sans overhead.

---

## §A — Architecture

```
┌─ apps/web/src/components/Map/ ────────────────────────────┐
│                                                           │
│  node-icon.tsx         (NOUVEAU, fonction pure)            │
│    └── buildNodeDivIcon(kind, isDefault, selected)        │
│          → L.DivIcon { html, iconSize, iconAnchor, ... } │
│                                                           │
│  NodeMarker.tsx       (RÉÉCRITURE)                        │
│    └── utilise Marker + divIcon                          │
│    └── Tooltip inchangé (enrichi du texte isDefault)     │
│    └── Click handler inchangé (onSelect(eic))            │
│                                                           │
│  NetworkMap.tsx       (inchangé)                          │
│  MapPage.tsx          (inchangé)                          │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

**Dépendances :**

- `lucide-react` — déjà installé (v2a). On utilise `renderToStaticMarkup` de `react-dom/server` pour sérialiser l'icône React en HTML string injecté dans le `divIcon`.
- `L.divIcon` de Leaflet — déjà disponible via `leaflet` (v2a).
- Tailwind — classes utilisées directement dans le HTML string du `divIcon` (même approche que les markers leaflet-curve refactorés en P3-8).

---

## §B — Mapping `NodeKind` → icône + couleur

```typescript
// apps/web/src/components/Map/node-icon.tsx (extrait)

import { Zap, Network, Router } from 'lucide-react';

type IconMapping = {
  Icon: React.ComponentType<{ size: number; className?: string }>;
  bgColor: string;  // Tailwind class ou hex
  label: string;    // pour aria-label
};

const MAPPING: Record<NodeKind, IconMapping> = {
  RTE_ENDPOINT:      { Icon: Zap,     bgColor: '#e30613', label: 'Endpoint RTE' },
  RTE_CD:            { Icon: Network, bgColor: '#b91c1c', label: 'Component Directory RTE' },
  BROKER:            { Icon: Router,  bgColor: '#111827', label: 'Broker' },
  EXTERNAL_CD:       { Icon: Network, bgColor: '#1f2937', label: 'Component Directory externe' },
  EXTERNAL_ENDPOINT: { Icon: Zap,     bgColor: '#6b7280', label: 'Endpoint externe' },
};
```

**Rationale des icônes :**

- **`Zap`** pour les endpoints — métaphore "point d'énergie / trigger", cohérente avec un composant ECP qui émet/reçoit.
- **`Network`** pour les CD — métaphore "annuaire/graphe" direct.
- **`Router`** pour les brokers — métaphore "routeur de messages" directe.
- Icônes Lucide homogènes stylistiquement (tracés minces, cohérence visuelle).

**Dimensions :**

- Cercle extérieur : `24 × 24px` (vs 6-12px variables en v2a).
- Icône Lucide : `size={14}` (blanc `#ffffff`).
- Badge `isDefaultPosition` : `10 × 10px` overlay absolu, `bottom: -2px; right: -2px`.
- Halo de sélection : `box-shadow: 0 0 0 3px rgba(59,130,246,0.6)`.

---

## §C — Implémentation `buildNodeDivIcon`

```typescript
// apps/web/src/components/Map/node-icon.tsx
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Zap, Network, Router } from 'lucide-react';
import type { NodeKind } from '@carto-ecp/shared';

type IconConfig = {
  Icon: React.ComponentType<{ size: number; color?: string }>;
  bgColor: string;
  label: string;
};

const KIND_CONFIG: Record<NodeKind, IconConfig> = {
  RTE_ENDPOINT:      { Icon: Zap,     bgColor: '#e30613', label: 'Endpoint RTE' },
  RTE_CD:            { Icon: Network, bgColor: '#b91c1c', label: 'CD RTE' },
  BROKER:            { Icon: Router,  bgColor: '#111827', label: 'Broker' },
  EXTERNAL_CD:       { Icon: Network, bgColor: '#1f2937', label: 'CD externe' },
  EXTERNAL_ENDPOINT: { Icon: Zap,     bgColor: '#6b7280', label: 'Endpoint externe' },
};

export function buildNodeDivIcon(
  kind: NodeKind,
  isDefaultPosition: boolean,
  selected: boolean,
): L.DivIcon {
  const cfg = KIND_CONFIG[kind];
  const iconSvg = renderToStaticMarkup(
    <cfg.Icon size={14} color="#ffffff" />,
  );
  const haloClass = selected ? 'ring-4 ring-blue-500/60' : '';
  const badge = isDefaultPosition
    ? `<span aria-label="Position par défaut" style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;background:#f97316;color:#fff;font-size:8px;font-weight:bold;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #fff;">⚠</span>`
    : '';

  const html = `
    <div
      data-kind="${kind}"
      data-default="${isDefaultPosition ? 'true' : 'false'}"
      data-selected="${selected ? 'true' : 'false'}"
      aria-label="${cfg.label}${isDefaultPosition ? ' (position par défaut)' : ''}"
      style="position:relative;width:24px;height:24px;background:${cfg.bgColor};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;${selected ? 'box-shadow:0 0 0 3px rgba(59,130,246,0.6);' : ''}"
      class="${haloClass}"
    >
      ${iconSvg}
      ${badge}
    </div>
  `.trim();

  return L.divIcon({
    html,
    className: 'carto-node-marker',  // classe vide, nécessaire pour désactiver le style par défaut leaflet
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
```

**Notes :**

- Les classes Tailwind mixées avec style inline — pragmatique car `divIcon` est du HTML brut sans le build Tailwind. Les valeurs hex sont utilisées directement pour les couleurs de fond (pas de classe Tailwind dynamique).
- `className: 'carto-node-marker'` : classe neutre pour overrider le `leaflet-div-icon` background par défaut via un `global.css` minimal :

```css
/* apps/web/src/index.css ou src/App.css (une seule ligne à ajouter) */
.leaflet-div-icon.carto-node-marker {
  background: transparent;
  border: none;
}
```

---

## §D — Réécriture `NodeMarker.tsx`

```tsx
// apps/web/src/components/Map/NodeMarker.tsx
import { Marker, Tooltip } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { buildNodeDivIcon } from './node-icon.js';

type Props = {
  node: GraphNode;
  selected: boolean;
  onSelect: (eic: string) => void;
};

export function NodeMarker({ node, selected, onSelect }: Props): JSX.Element {
  const icon = buildNodeDivIcon(node.kind, node.isDefaultPosition, selected);
  return (
    <Marker
      position={[node.lat, node.lng]}
      icon={icon}
      eventHandlers={{ click: () => onSelect(node.eic) }}
    >
      <Tooltip direction="top" offset={[0, -16]} opacity={0.95}>
        <div className="text-xs">
          <strong>{node.displayName}</strong>
          <br />
          {node.eic} {node.country ? `— ${node.country}` : ''}
          {node.isDefaultPosition ? (
            <>
              <br />
              <em>⚠ Position par défaut (centre Europe) — coordonnées non renseignées</em>
            </>
          ) : null}
        </div>
      </Tooltip>
    </Marker>
  );
}
```

**Changements vs v2a :**

- `CircleMarker` → `Marker` (supporte `icon` custom).
- `pathOptions` retiré (pas applicable aux `Marker`).
- `radius` dynamique retiré (taille fixe 24px via `divIcon`).
- `processColor` sur l'anneau retiré — la couleur du process reste visible sur les **edges** (via `EdgePath`), plus redondant sur les nodes.
- Tooltip : `offset` ajusté à `[0, -16]` (au-dessus du marker 24px), texte enrichi pour `isDefaultPosition`.

---

## §E — Tests

### `apps/web/src/components/Map/node-icon.test.ts` (NOUVEAU)

```typescript
import { describe, expect, it } from 'vitest';
import { buildNodeDivIcon } from './node-icon.js';

describe('buildNodeDivIcon', () => {
  it('embeds the correct kind, icon, and bg color for RTE_ENDPOINT', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', false, false);
    const html = (icon.options.html ?? '') as string;
    expect(html).toContain('data-kind="RTE_ENDPOINT"');
    expect(html).toContain('#e30613');           // RTE red
    expect(html).toContain('<svg');              // Lucide SVG present
    expect(html).not.toContain('⚠');             // No warning badge
    expect(html).not.toContain('box-shadow');    // No halo
  });

  it('renders the warning badge when isDefaultPosition is true', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', true, false);
    const html = icon.options.html as string;
    expect(html).toContain('⚠');
    expect(html).toContain('#f97316');  // Badge orange
    expect(html).toContain('data-default="true"');
  });

  it('renders the selection halo when selected is true', () => {
    const icon = buildNodeDivIcon('RTE_ENDPOINT', false, true);
    const html = icon.options.html as string;
    expect(html).toContain('box-shadow');
    expect(html).toContain('data-selected="true"');
  });

  it('uses correct config per kind', () => {
    const kinds: Array<[string, string, string]> = [
      ['RTE_ENDPOINT', '#e30613', 'Endpoint RTE'],
      ['RTE_CD', '#b91c1c', 'CD RTE'],
      ['BROKER', '#111827', 'Broker'],
      ['EXTERNAL_CD', '#1f2937', 'CD externe'],
      ['EXTERNAL_ENDPOINT', '#6b7280', 'Endpoint externe'],
    ];
    for (const [kind, color, label] of kinds) {
      const icon = buildNodeDivIcon(kind as any, false, false);
      const html = icon.options.html as string;
      expect(html).toContain(color);
      expect(html).toContain(label);
    }
  });
});
```

### `apps/web/src/components/Map/NodeMarker.test.tsx` — skipped

La couverture E2E existante (`upload-then-map.spec.ts` vérifie `.leaflet-interactive` visible) + les 4 tests unitaires ci-dessus sur `buildNodeDivIcon` couvrent :
- Rendu différencié par kind (test 4)
- Badge isDefaultPosition (test 2)
- Halo de sélection (test 3)
- Structure HTML (test 1)

**Pas de test component React-Testing-Library sur `NodeMarker`** : Leaflet/react-leaflet exige un contexte `MapContainer` mock très lourd pour rendre des `Marker` — ROI test faible vs les 4 tests unitaires isolés. C'est conforme à l'approche v2a (le composant `EdgePath` n'a pas de test React-Testing-Library non plus, juste un test de logique).

---

## §F — Mise à jour CSS globale

**Fichier :** `apps/web/src/styles/globals.css` (vérifié présent).

Ajouter :

```css
.leaflet-div-icon.carto-node-marker {
  background: transparent;
  border: none;
}
```

**Rationale :** Leaflet ajoute par défaut une classe `.leaflet-div-icon` qui applique un fond blanc + bordure grise aux `divIcon`. On le neutralise pour laisser voir notre cercle coloré sans décoration parasite.

---

## §G — DoD slice 2f

- [ ] `node-icon.tsx` créé avec `buildNodeDivIcon` exporté
- [ ] `NodeMarker.tsx` réécrit avec `Marker + divIcon`
- [ ] Mapping 5 kinds → icône Lucide + couleur cohérent
- [ ] Badge `⚠` visible pour les nodes `isDefaultPosition`
- [ ] Halo bleu à la sélection
- [ ] Tooltip texte enrichi pour `isDefaultPosition`
- [ ] CSS global ajouté pour neutraliser `.leaflet-div-icon` par défaut
- [ ] 4 tests unit `node-icon.test.ts` PASS
- [ ] `typecheck web` PASS
- [ ] Smoke manuel : ouvrir la carte → différents markers ont des icônes distinctes → un node avec coord fallback affiche le badge orange
- [ ] CHANGELOG mis à jour (v2.0-alpha.3)

---

## §H — ADR déclenché

**ADR-034 — `L.divIcon` + `renderToStaticMarkup(lucide-react)` pour les markers cartographiques**

Contexte : v2a utilisait `CircleMarker` (forme native Leaflet, pas d'icône). v2f a besoin d'icônes différenciées par type de composant ECP.

Options :
- A = divIcon HTML + renderToStaticMarkup(lucide-react) (retenue)
- B = SVG custom inline
- C = `L.Icon` avec fichiers .png/.svg externes

Décision : A. Justification : Lucide déjà installé, icons scalables et cohérents avec le reste du front React, pas de fichiers assets à maintenir.

---

## §I — Non-goals explicites

- Pas de couleurs par TSO/pays (rester monochrome RTE/externe en 2f)
- Pas de badge provenance / ENTSO-E (reportés en 2e/2c)
- Pas de refonte de la légende cartographique (slice ultérieur)
- Pas de clustering de markers zoomés-out (fonctionnalité indépendante, potentiel slice futur)
