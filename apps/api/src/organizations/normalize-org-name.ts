/**
 * Normalise un nom d'organisation pour servir de clé de lookup.
 * - trim
 * - collapse des espaces multiples
 * - lowercase (fr) pour gérer les casses « Swissgrid » vs « SWISSGRID »
 *
 * Retourne null pour une entrée nulle, vide ou uniquement whitespace.
 */
export function normalizeOrgName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (trimmed.length === 0) return null;
  return trimmed.toLocaleLowerCase('fr');
}
