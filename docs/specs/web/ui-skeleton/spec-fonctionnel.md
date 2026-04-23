# Spec Fonctionnelle — web/ui-skeleton

| Champ  | Valeur                                    |
|--------|-------------------------------------------|
| Module | web/ui-skeleton                           |
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

`Skeleton` est un composant UI maison de type "placeholder de chargement". Il affiche une forme animée (shimmer) indiquant qu'un contenu est en cours de chargement, sans révéler ni la structure ni le contenu final.

Le DS RTE (`@design-system-rte/react`) ne fournit pas de composant Skeleton. Ce composant est donc créé dans la couche `components/ui/` conformément à l'ADR-038.

---

## Règles métier

1. **Tokens exclusifs** — toutes les valeurs de couleur et de forme sont lues depuis les tokens `--c-*` / `--r-*` de `brand.scss`. Aucun hex hardcodé dans `Skeleton.module.scss`.

2. **Accessibilité** — le composant expose `role="status"`, `aria-label="Chargement"` et `aria-live="polite"` pour informer les lecteurs d'écran que du contenu est en cours de chargement.

3. **Respect de `prefers-reduced-motion`** — l'animation shimmer est désactivée (`animation: none`, `background-image: none`) lorsque l'utilisateur a activé la réduction des animations.

4. **Variant par défaut `text`** — à utiliser pour tout placeholder de ligne de texte. Les autres variants couvrent les cas typiques (titre, carte, avatar, rectangle générique).

5. **Multi-lignes** — la prop `lines` n'est active que pour le variant `text`. La dernière ligne est rendue à 60% de largeur pour simuler une fin de paragraphe naturelle.

---

## Cas d'usage

### CU-001 — Afficher un placeholder de texte pendant le chargement d'une liste

**Acteur** : composant métier (ex : table Admin, DetailPanel)

**Flux** : le composant parent est en état `loading`. Il rend `<Skeleton variant="text" lines={3} />` à la place du contenu.

**Résultat** : 3 barres animées s'affichent, la dernière à 60% de largeur.

### CU-002 — Afficher un placeholder de carte

**Acteur** : composant métier (ex : page Upload pendant le parse)

**Flux** : le composant rend `<Skeleton variant="card" />`.

**Résultat** : un rectangle de 120px de hauteur avec `border-radius: var(--r-md)` s'affiche avec l'animation shimmer.

### CU-003 — Afficher un placeholder d'avatar

**Acteur** : composant métier

**Flux** : le composant rend `<Skeleton variant="circle" width={40} height={40} />`.

**Résultat** : un cercle de 40×40 px avec l'animation shimmer.

### CU-004 — Override de dimensions

**Acteur** : développeur

**Flux** : le développeur passe `width="200px"` et/ou `height="32px"` pour forcer les dimensions indépendamment du variant.

**Résultat** : les styles inline surchargent les hauteurs/largeurs par défaut du variant.

---

## Variantes

| Variant | Dimensions par défaut | Radius | Usage typique |
|---------|----------------------|--------|---------------|
| `text` | `width: 100%`, `height: 14px` | `--r-sm` | Lignes de texte |
| `title` | `width: 60%`, `height: 24px` | `--r-sm` | Titre de section |
| `card` | `width: 100%`, `height: 120px` | `--r-md` | Carte / panneau |
| `circle` | `width: 40px`, `height: 40px` | `--r-pill` | Avatar / icône ronde |
| `rect` | `width: 100%`, `height: 100%` | hérite | Rectangle libre |

---

## Hors scope

- Skeleton avec structure imbriquée (ex : skeleton d'une ligne de tableau complète) — à composer à partir de plusieurs instances `<Skeleton>` dans le composant consommateur.
- Skeleton avec délai d'apparition (anti-flash) — géré par le composant consommateur via CSS ou logique d'état.
- Variants métier spécifiques (ex : skeleton d'un NodeMarker) — le composant reste générique.
