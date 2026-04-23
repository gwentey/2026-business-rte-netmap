# Spec Fonctionnelle — web/ui-empty-state

| Champ  | Valeur                                    |
|--------|-------------------------------------------|
| Module | web/ui-empty-state                        |
| Version| 1.0.0                                     |
| Date   | 2026-04-23                                |
| Source | Slice 5e — Finitions UX                   |

---

## ADRs

| ADR | Titre | Statut |
|-----|-------|--------|
| [ADR-038](../../../adr/ADR-038-components-ui-layer-wrappers-ds.md) | Couche `components/ui/` | Actif |
| [ADR-039](../../../adr/ADR-039-charte-web-marketing-surcharge-ds.md) | Charte visuelle web/marketing : surcharge palette DS RTE | Actif |

---

## Contexte et objectif

`EmptyState` est un composant UI maison qui affiche un écran vide avec un message explicatif et, optionnellement, une action. Il est utilisé lorsqu'une liste, un tableau ou une vue ne contient aucune donnée à afficher.

Le DS RTE ne fournit pas de composant EmptyState. Ce composant est créé dans la couche `components/ui/` conformément à l'ADR-038.

---

## Règles métier

1. **Tokens exclusifs** — toutes les couleurs et formes sont lues depuis les tokens `--c-*` / `--r-*` de `brand.scss`. Aucun hex hardcodé dans `EmptyState.module.scss`.

2. **Titre obligatoire** — la prop `title` est requise. Elle peut être un `ReactNode` pour permettre l'emphase inline (ex : `<strong>`).

3. **Slots optionnels** — `icon`, `description` et `action` sont tous optionnels. Le composant s'adapte sans aucune de ces props (seul le titre est rendu).

4. **3 tailles** — `sm` pour les espaces restreints (modales, panneaux latéraux), `md` pour le cas par défaut, `lg` pour les pages entières vides.

5. **Icône décorative** — l'icône est rendue avec `aria-hidden="true"` — elle ne porte pas de sens sémantique pour les lecteurs d'écran. Le texte (`title` + `description`) doit être suffisant seul.

---

## Cas d'usage

### CU-001 — Liste Admin vide

**Acteur** : utilisateur Admin

**Contexte** : la table des composants est vide (aucun composant importé).

**Flux** : le composant Admin rend :
```tsx
<EmptyState
  icon={<Icon name="database" />}
  title="Aucun composant importé"
  description="Importez un snapshot ECP pour voir les composants."
  action={<Button onClick={handleImport}>Importer un snapshot</Button>}
/>
```

**Résultat** : écran centré avec icône, titre, description et bouton d'action.

### CU-002 — Résultat de recherche vide

**Acteur** : utilisateur

**Contexte** : le filtre BA ne retourne aucun résultat.

**Flux** : le composant rend `<EmptyState size="sm" title="Aucun résultat" />`.

**Résultat** : message compact centré, sans icône ni description.

### CU-003 — Carte sans snapshot sélectionné

**Acteur** : utilisateur

**Contexte** : la vue Map est chargée mais aucun snapshot n'est sélectionné.

**Flux** : `<EmptyState size="lg" icon={...} title="Sélectionnez un snapshot" description="..." />`.

**Résultat** : écran large avec grand padding, centré dans la page.

---

## Variantes de taille

| Taille | Padding | Gap | Usage typique |
|--------|---------|-----|---------------|
| `sm` | `24px 16px` | `12px` | Panneau latéral, modale, widget |
| `md` | `48px 24px` | `16px` | Section de page, tableau |
| `lg` | `72px 32px` | `20px` | Page entière vide |

---

## Hors scope

- EmptyState avec illustration complexe (SVG inline ou image) — le slot `icon` accepte tout `ReactNode`, la composition est à la charge du consommateur.
- Animations d'apparition du EmptyState — gérées par le composant consommateur.
- Variante "erreur" — utiliser le composant `Banner` du DS RTE avec `variant="danger"` pour les états d'erreur (le EmptyState est réservé aux états vides non-erreurs).
