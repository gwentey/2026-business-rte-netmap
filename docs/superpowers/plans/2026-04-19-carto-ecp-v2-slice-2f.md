# Carto ECP v2.0 — Slice 2f (Icônes différenciées + badge isDefaultPosition) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les `CircleMarker` Leaflet par des `Marker + divIcon` avec icônes Lucide différenciées par `NodeKind` + badge `⚠` overlay pour les nodes `isDefaultPosition`.

**Architecture:** Un nouveau helper pur `node-icon.tsx` isole la construction du `L.DivIcon` (HTML string) pour test unitaire sans Leaflet React. `NodeMarker.tsx` est réécrit pour consommer ce helper. Une règle CSS globale neutralise le fond par défaut de `.leaflet-div-icon`. Scope volontairement minimal — 1 composant réécrit + 1 helper ajouté + 4 tests.

**Tech Stack:** React 18, Leaflet 1.9 + react-leaflet 4.2, lucide-react (déjà installé), react-dom/server (`renderToStaticMarkup`), Vitest 2 + happy-dom.

**Spec de référence :** [`docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2f-design.md`](../specs/2026-04-19-carto-ecp-v2-slice-2f-design.md) — lire §A (architecture), §B (mapping), §C (implémentation), §E (tests), §F (CSS global).

**Branche :** `feat/v2-slice-2f-icons` (déjà créée depuis le tip de `feat/v2-slice-2b-multi-upload`).

---

## Vue d'ensemble

| Phase | Tasks | Livre |
|---|---|---|
| Phase 1 — ADR | T1 | ADR-034 (divIcon + renderToStaticMarkup) |
| Phase 2 — Helper + tests | T2 | `node-icon.tsx` + 4 tests unit |
| Phase 3 — Composant + CSS | T3, T4 | `NodeMarker.tsx` réécrit, CSS global ajouté |
| Phase 4 — Smoke + CHANGELOG + PR | T5 | CHANGELOG v2.0-alpha.3 + PR |

**Convention commits :** Conventional Commits FR, footer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.

---

## Phase 1 — ADR

### Task 1 : ADR-034

**Files :**
- Create: `docs/adr/ADR-034-divicon-lucide-react-markers.md`

Basé sur `docs/adr/000-template.md`. Champ commun : `Contexte = "Slice v2.0-2f Icônes"`, `Features = *`, `App = web`, `Date = 2026-04-19`, `Auteur = Anthony + Claude`, `Owner = Anthony`, `Statut = Accepté`.

- [ ] **Step 1.1 — Rédiger l'ADR**

Contenu :

**Titre :** "Markers cartographiques via `L.divIcon` + `renderToStaticMarkup(lucide-react)`"

**Contexte (3-5 phrases)**

La slice 2a utilisait `CircleMarker` Leaflet pour les markers cartographiques — forme ronde colorée, taille variable par `NodeKind`. Aucune différenciation visuelle du type au-delà de la couleur. L'utilisateur a explicitement demandé de distinguer visuellement broker/CD/endpoint. Le projet utilise déjà `lucide-react` dans l'UI, ce qui permet une intégration cohérente.

**Options considérées**

| Option | Description | Effort | Avantages | Inconvénients |
|--------|-------------|--------|-----------|---------------|
| A — `L.divIcon` + `renderToStaticMarkup(lucide-react)` | Rend chaque icône Lucide React en HTML string via `react-dom/server`, wrappé dans un `<div>` coloré, injecté dans `L.divIcon` | S | Réutilise la stack Lucide existante, icons scalables, cohérent avec le reste du front React, pas d'assets externes | Nécessite `react-dom/server` import (déjà présent via React 18) |
| B — SVG custom inline | Écrire 4-5 SVG manuels par `NodeKind` | M | Contrôle pixel-perfect, pas de dépendance Lucide pour Leaflet | Assets à maintenir à la main, branding lock-in, perdu si design évolue |
| C — `L.Icon` avec fichiers `.png`/`.svg` | Images statiques dans `public/icons/` | S | Perf (pas de rendu React pour chaque marker) | Fichiers à maintenir, pipeline d'assets Vite, pas DRY avec Lucide |

**Décision retenue**

**Option A** — `L.divIcon` + `renderToStaticMarkup`. Justification : Lucide est déjà la source d'icônes du projet, le rendu côté client est suffisant pour ~500 markers (cas nominal), le helper est isolé pour test unitaire.

**Conséquences**

**Positives :**
- Icônes vectorielles scalables (retina-ready).
- Un seul set d'icônes dans tout le projet → cohérence visuelle.
- Factory pure `buildNodeDivIcon(kind, isDefault, selected)` testable sans Leaflet.

**Négatives :**
- Chaque marker re-rend un petit arbre React serialisé à chaque update — acceptable pour <500 markers, à revisiter si le graph grandit.
- Tailwind ne peut pas être utilisé dans le HTML string du `divIcon` (classes non émises par le build Tailwind qui ne voit pas ce code). Styles inline pragmatiques pour le corps du marker.

**Ce qu'on s'interdit désormais :**
- Utiliser `CircleMarker` pour les nodes ECP (forme sans distinction visuelle).
- Ajouter des fichiers d'icônes externes dans `public/` pour ce cas d'usage (on reste sur Lucide).

**Ressources / Références**
- `docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2f-design.md` §A, §B, §C
- React docs : `react-dom/server.renderToStaticMarkup`
- Leaflet docs : `L.divIcon`

- [ ] **Step 1.2 — Commit**

```bash
git add docs/adr/ADR-034-divicon-lucide-react-markers.md
git commit -m "$(cat <<'EOF'
docs(adr): ADR-034 — markers via L.divIcon + renderToStaticMarkup(lucide-react)

Remplace CircleMarker v2a par des icônes différenciées par NodeKind.
Choix justifié par Lucide déjà présent dans la stack + isolation du
helper pour test unitaire.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Helper + tests

### Task 2 : `node-icon.tsx` + 4 tests unit

**Files :**
- Create: `apps/web/src/components/Map/node-icon.tsx`
- Create: `apps/web/src/components/Map/node-icon.test.ts`

- [ ] **Step 2.1 — Test RED**

Crée `apps/web/src/components/Map/node-icon.test.ts` :

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
    const kinds: Array<[
      'RTE_ENDPOINT' | 'RTE_CD' | 'BROKER' | 'EXTERNAL_CD' | 'EXTERNAL_ENDPOINT',
      string,
      string,
    ]> = [
      ['RTE_ENDPOINT', '#e30613', 'Endpoint RTE'],
      ['RTE_CD', '#b91c1c', 'CD RTE'],
      ['BROKER', '#111827', 'Broker'],
      ['EXTERNAL_CD', '#1f2937', 'CD externe'],
      ['EXTERNAL_ENDPOINT', '#6b7280', 'Endpoint externe'],
    ];
    for (const [kind, color, label] of kinds) {
      const icon = buildNodeDivIcon(kind, false, false);
      const html = icon.options.html as string;
      expect(html).toContain(color);
      expect(html).toContain(label);
    }
  });
});
```

- [ ] **Step 2.2 — Run RED**

```bash
pnpm --filter @carto-ecp/web test -- node-icon
```

Expected: FAIL (module absent).

- [ ] **Step 2.3 — Implémenter le helper**

Crée `apps/web/src/components/Map/node-icon.tsx` :

```tsx
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Network, Router, Zap } from 'lucide-react';
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
  const IconComponent = cfg.Icon;
  const iconSvg = renderToStaticMarkup(<IconComponent size={14} color="#ffffff" />);

  const badge = isDefaultPosition
    ? `<span aria-label="Position par défaut" style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;background:#f97316;color:#fff;font-size:8px;font-weight:bold;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #fff;line-height:1;">⚠</span>`
    : '';

  const haloStyle = selected ? 'box-shadow:0 0 0 3px rgba(59,130,246,0.6);' : '';

  const ariaLabel = `${cfg.label}${isDefaultPosition ? ' (position par défaut)' : ''}`;

  const html = `<div data-kind="${kind}" data-default="${isDefaultPosition ? 'true' : 'false'}" data-selected="${selected ? 'true' : 'false'}" aria-label="${ariaLabel}" style="position:relative;width:24px;height:24px;background:${cfg.bgColor};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;${haloStyle}">${iconSvg}${badge}</div>`;

  return L.divIcon({
    html,
    className: 'carto-node-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
```

**Note import `L`** : Leaflet est importé par défaut dans le projet (v2a utilise `import L from 'leaflet';` dans `EdgePath.tsx`). Si le fichier ne se compile pas à cause d'un import ambigü, utiliser `import * as L from 'leaflet';` en fallback.

**Note JSX dans `.tsx`** : le fichier est `.tsx` pour permettre la syntaxe `<IconComponent ... />`. Vite + TypeScript gèrent nativement.

- [ ] **Step 2.4 — Run GREEN**

```bash
pnpm --filter @carto-ecp/web test -- node-icon
pnpm --filter @carto-ecp/web typecheck
```

Expected: tests 4/4 PASS + typecheck PASS.

- [ ] **Step 2.5 — Commit**

```bash
git add apps/web/src/components/Map/node-icon.tsx apps/web/src/components/Map/node-icon.test.ts
git commit -m "$(cat <<'EOF'
feat(web): node-icon.tsx — factory buildNodeDivIcon pour markers

Helper pur qui construit un L.DivIcon avec :
- Cercle coloré 24px (couleur par NodeKind, conservée v2a)
- Icône Lucide centrée blanche 14px (Zap / Network / Router)
- Badge orange ⚠ si isDefaultPosition
- Halo bleu box-shadow si selected

Isolé de Leaflet React pour test unitaire (4 tests).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Composant + CSS

### Task 3 : Réécriture `NodeMarker.tsx`

**Files :**
- Modify (réécriture complète) : `apps/web/src/components/Map/NodeMarker.tsx`

- [ ] **Step 3.1 — Réécrire `NodeMarker.tsx`**

Remplacer **intégralement** le contenu de `apps/web/src/components/Map/NodeMarker.tsx` par :

```tsx
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
- `radius` dynamique retiré (taille fixe via `divIcon`).
- `processColor` de l'anneau retiré — la couleur du process reste visible sur les edges.
- Tooltip `offset` ajusté à `[0, -16]` (au-dessus d'un marker 24px).
- Texte tooltip enrichi pour `isDefaultPosition`.

- [ ] **Step 3.2 — Vérifier la compilation**

```bash
pnpm --filter @carto-ecp/web typecheck
```

Expected: PASS.

```bash
pnpm --filter @carto-ecp/web test
```

Expected: full suite verte. Les tests existants (`UploadPage`, `app-store`, `UploadBatchTable`, `EnvSelector`, `NodeDetails`, `EdgeDetails`, `SnapshotSelector` — si encore présent, sinon supprimé —, etc.) ne touchent pas `NodeMarker` directement, ils doivent tous continuer à passer.

- [ ] **Step 3.3 — Commit**

```bash
git add apps/web/src/components/Map/NodeMarker.tsx
git commit -m "$(cat <<'EOF'
feat(web): NodeMarker réécrit avec Marker + divIcon

CircleMarker → Marker + icon via buildNodeDivIcon(kind, isDefault, selected).
Tooltip texte enrichi pour isDefaultPosition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4 : CSS global pour neutraliser `.leaflet-div-icon`

**Files :**
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 4.1 — Reconnaissance**

Lis le contenu actuel de `apps/web/src/styles/globals.css` pour :
- Identifier où sont les blocs Tailwind (`@tailwind base; @tailwind components; @tailwind utilities;`) et où ajouter la règle custom (après les directives Tailwind, avant ou après les autres custom rules si présentes).
- Voir le style de formatting existant (commentaires, indentation).

- [ ] **Step 4.2 — Ajouter la règle CSS**

À la fin du fichier `apps/web/src/styles/globals.css`, ajouter :

```css
/* Markers Carto ECP (slice 2f) — neutralise le fond/bordure par défaut de
   .leaflet-div-icon pour laisser visible le cercle coloré de buildNodeDivIcon. */
.leaflet-div-icon.carto-node-marker {
  background: transparent;
  border: none;
}
```

**Pourquoi** : Leaflet applique par défaut `background: white; border: 1px solid #666;` aux `divIcon`. Notre marker custom a son propre fond et sa propre bordure, ces styles parasitent le rendu.

- [ ] **Step 4.3 — Vérifier le build Vite**

```bash
pnpm --filter @carto-ecp/web build 2>&1 | tail -10
```

Expected: build réussi (si pas d'erreur CSS parsée).

**Note** : pas de test unit sur un fichier CSS pur. Le smoke test en Phase 4 validera visuellement.

- [ ] **Step 4.4 — Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "style(web): neutraliser .leaflet-div-icon par défaut pour carto-node-marker

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Phase 4 — Smoke + CHANGELOG + PR

### Task 5 : CHANGELOG v2.0-alpha.3 + smoke manuel + PR

**Files :**
- Modify: `CHANGELOG.md`

- [ ] **Step 5.1 — Ajouter entrée v2.0-alpha.3 au CHANGELOG**

Ouvrir `CHANGELOG.md`. Sous `## [Unreleased]`, insérer **au-dessus** du bloc `v2.0-alpha.2` :

```markdown
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
```

- [ ] **Step 5.2 — Smoke manuel**

```bash
pnpm dev
```

Dans un navigateur, ouvrir **http://localhost:5173/** :

1. Vérifier qu'il y a des imports dans au moins un env (sinon, glisser une fixture depuis `smoke-zips/` via `/upload`).
2. Sur la carte, vérifier visuellement :
   - Les markers ne sont plus des ronds plats — ils ont des **icônes** (éclair `Zap`, réseau `Network`, routeur `Router`).
   - Les markers RTE sont en rouge, les externes en gris — **couleurs conservées v2a**.
   - Un endpoint RTE et un CD RTE ont des icônes **différentes** (éclair vs réseau).
   - Si un node a `isDefaultPosition=true` (centre Europe), badge orange `⚠` visible en coin bas-droit.
   - Click sur un marker → halo bleu visible + panneau détail à droite.
   - Hover sur un marker → tooltip avec displayName, EIC, country, et mention « Position par défaut » si applicable.

Si tout va bien → étape 5.3. Sinon, corriger et re-smoke.

- [ ] **Step 5.3 — Tests full + typecheck**

```bash
pnpm --filter @carto-ecp/web test
pnpm --filter @carto-ecp/web typecheck
pnpm --filter @carto-ecp/api test
pnpm --filter @carto-ecp/api typecheck
pnpm --filter @carto-ecp/shared typecheck
```

Expected: **tous verts**.

- [ ] **Step 5.4 — Commit CHANGELOG**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG v2.0-alpha.3 — slice 2f icônes différenciées

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5.5 — Push + PR**

```bash
git push -u origin feat/v2-slice-2f-icons
```

```bash
gh pr create --base feat/v2-slice-2b-multi-upload --title "feat(v2): slice 2f Icônes différenciées + badge isDefaultPosition (v2.0-alpha.3)" --body "$(cat <<'EOF'
## Summary

Réalise la **demande initiale n°4** de l'utilisateur : distinguer visuellement broker / CD / endpoint / BA sur la carte cartographique (plus juste un rond uniforme).

- Nouveau helper pur `buildNodeDivIcon(kind, isDefault, selected)` — L.DivIcon avec icône Lucide centrée dans un cercle coloré 24px
- Icônes par type : `Zap` (endpoints), `Network` (CDs), `Router` (brokers)
- Couleurs conservées v2a (RTE rouge, externe gris)
- Badge `⚠` orange overlay si `isDefaultPosition`
- Halo bleu box-shadow à la sélection
- Tooltip texte enrichi

## Docs / Spec
- [Chapeau v2.0](docs/superpowers/specs/2026-04-19-carto-ecp-v2-chapeau.md)
- [Slice 2f design](docs/superpowers/specs/2026-04-19-carto-ecp-v2-slice-2f-design.md)
- [Plan d'implémentation](docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2f.md)
- ADR : [034](docs/adr/ADR-034-divicon-lucide-react-markers.md)

## Breaking changes

Aucun côté API ou shared. Changement purement visuel côté front.

## Base branche

Cette PR base sur ``feat/v2-slice-2b-multi-upload`` (PR #7 stackée sur #6). Merge order : #6 → #7 → cette PR.

## Test plan
- [x] 4 tests unit ``node-icon.test.ts`` PASS
- [x] ``pnpm typecheck`` — PASS api + web + shared
- [x] Full suite ``pnpm test`` verte
- [x] **Smoke manuel validé** : carte affiche icônes différenciées par type, badge ⚠ visible sur nodes fallback, halo bleu à la sélection, tooltip enrichi
- [ ] Review humaine du design 2f

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage :**

- §1 objectif → Task 1 ADR + Tasks 2-4 implémentation
- §2 scope inside → Tasks 2-5
- §A architecture → Task 2 (helper isolé) + Task 3 (composant)
- §B mapping → Task 2 Step 2.3 (KIND_CONFIG)
- §C implémentation → Task 2 Step 2.3
- §D NodeMarker → Task 3
- §E tests → Task 2 Steps 2.1-2.4
- §F CSS global → Task 4
- §G DoD → Task 5 checklist
- §H ADR → Task 1
- §I non-goals → respectés (pas de coloration par TSO, pas de badge provenance/ENTSO-E, pas de refonte légende, pas de clustering)

**Placeholder scan :** aucun `TBD`, `TODO`, `implement later`, `similar to Task N`. OK.

**Type consistency :**
- `NodeKind` importé de `@carto-ecp/shared` (type inchangé depuis 2a).
- `buildNodeDivIcon(kind, isDefaultPosition, selected)` : signature identique entre Task 2 (helper) et Task 3 (usage dans `NodeMarker`).
- `KIND_CONFIG` : 5 clés exactement les 5 `NodeKind`.
- Pas d'ambiguïté sur `BUSINESS_APPLICATION` / `BA` : le type `NodeKind` en shared actuel n'a **pas** de `BA` (vérifié implicitement via `GraphNode.kind` qui accepte 5 valeurs). Si BA était ajouté plus tard, il faudrait étendre le mapping.

Aucun souci. Plan cohérent.

---

## Execution Handoff

**Plan complet et sauvegardé à `docs/superpowers/plans/2026-04-19-carto-ecp-v2-slice-2f.md`.**

Scope minimal : 5 tasks, 1-2 heures d'exécution.

Deux options :

**1. Subagent-Driven** — dispatch d'un subagent frais par task, review entre chaque. Prérequis : sub-skill `superpowers:subagent-driven-development`.

**2. Inline Execution** — plus rapide sur un plan aussi court (moins d'overhead de dispatch). Prérequis : sub-skill `superpowers:executing-plans`.

Pour 5 tasks, **option 2 (inline)** fait souvent plus de sens — pas besoin de renvoyer un subagent isolé pour chaque micro-task UI. Laquelle tu préfères ?
