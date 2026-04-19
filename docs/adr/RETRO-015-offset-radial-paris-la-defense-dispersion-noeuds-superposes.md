# RETRO-015 — Offset radial Paris-La-Défense : dispersion visuelle des nœuds RTE superposés

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-04-17          |
| Source     | Rétro-ingénierie    |
| Features   | map                 |

## Contexte

Les 6 Endpoints RTE et le RTE CD sont tous enregistrés avec les mêmes coordonnées géographiques (lat 48.8918, lng 2.2378 — La Défense, Puteaux), car ils appartiennent à la même entité physique. Superposés sur la carte Leaflet, ils deviendraient un unique marqueur impraticable : l'utilisateur ne pourrait pas distinguer ni cliquer individuellement chaque composant.

## Décision identifiée

Le hook `useMapData` implémente une **détection automatique de groupe de superposition** et un **dispersion radiale** :

1. Tous les nœuds dont la position est à moins de 0,01° de la coordonnée de référence `(48.8918, 2.2378)` sont identifiés comme appartenant au groupe Paris.
2. Si le groupe contient plus d'un nœud, chaque nœud reçoit une position décalée distribuée uniformément sur un cercle de rayon `OFFSET_DEG = 0.6°` autour du centre.
3. L'angle de chaque nœud est `(2π × index) / total`.
4. Les positions décalées remplacent les positions originales dans les données transmises aux composants de rendu, mais les coordonnées stockées en base restent inchangées.

La valeur `0.6°` correspond environ à 60–70 km à la latitude de Paris, ce qui produit une dispersion lisible au zoom Europe (zoom 4) sans déborder dans d'autres pays.

## Conséquences observées

### Positives
- Solution autonome, sans dépendance supplémentaire.
- Transparente pour les composants `NodeMarker` et `EdgePath` : ils reçoivent simplement les coordonnées finales.
- Réversible : les données API ne sont pas modifiées, seule la représentation visuelle est affectée.
- Mémoïsée via `useMemo` : le calcul ne se refait qu'en cas de changement du `GraphResponse`.

### Négatives / Dette
- La coordonnée de référence `(48.8918, 2.2378)` est une constante hardcodée dans le hook. Si RTE change de coordonnées dans l'overlay, le hook ne détectera plus le groupe automatiquement.
- Le rayon `0.6°` est calibré pour le zoom 4 (vue Europe). À des zooms élevés sur la région parisienne, les nœuds dispersés apparaîtront éloignés de leur position réelle.
- Le seuil de proximité `0.01°` (~1 km) est arbitraire : il peut inclure des nœuds non-RTE proches qui seraient accidentellement dispersés.
- Les arêtes entre nœuds du groupe Paris (si elles existent) partent des positions décalées, pas du centre réel — ce qui peut créer des courbes surprenantes.
- Aucun indicateur visuel ne signale à l'utilisateur que les positions affichées sont des positions artificielles (à distinguer de `isDefaultPosition` qui signale une position par défaut géographique).

## Recommandation

Garder pour slice #1. Documenter dans l'UI que les nœuds RTE sont regroupés à La Défense et que leur disposition sur la carte est schématique. Pour les slices suivants, envisager une approche configurée : externaliser le centre de référence et le rayon dans l'overlay RTE JSON, et ajouter un indicateur visuel (cercle de regroupement) pour distinguer clairement les zones de dispersion artificielle des positions géographiques réelles.
