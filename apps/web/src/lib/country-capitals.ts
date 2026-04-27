// Capitales ISO-2 alignées avec `packages/registry/eic-rte-overlay.json#countryGeocode`.
// Duplication voulue côté front pour le bouton "Utiliser la capitale" sans roundtrip API.
// À garder en sync manuellement lors d'un bump de `overlay.version`.

export type CountryCapital = {
  lat: number;
  lng: number;
  label: string;
};

export const COUNTRY_CAPITALS: Record<string, CountryCapital> = {
  AL: { lat: 41.3275, lng: 19.8189, label: 'Tirana' },
  AT: { lat: 48.2082, lng: 16.3738, label: 'Vienne' },
  BA: { lat: 43.8563, lng: 18.4131, label: 'Sarajevo' },
  BE: { lat: 50.8503, lng: 4.3517, label: 'Bruxelles' },
  BG: { lat: 42.6977, lng: 23.3219, label: 'Sofia' },
  BY: { lat: 53.9045, lng: 27.5615, label: 'Minsk' },
  CH: { lat: 46.9481, lng: 7.4474, label: 'Berne' },
  CY: { lat: 35.1856, lng: 33.3823, label: 'Nicosie' },
  CZ: { lat: 50.0755, lng: 14.4378, label: 'Prague' },
  DE: { lat: 52.52, lng: 13.405, label: 'Berlin' },
  DK: { lat: 55.6761, lng: 12.5683, label: 'Copenhague' },
  EE: { lat: 59.437, lng: 24.7536, label: 'Tallinn' },
  EL: { lat: 37.9838, lng: 23.7275, label: 'Athènes' },
  ES: { lat: 40.4168, lng: -3.7038, label: 'Madrid' },
  FI: { lat: 60.1699, lng: 24.9384, label: 'Helsinki' },
  FR: { lat: 48.8566, lng: 2.3522, label: 'Paris' },
  GB: { lat: 51.5074, lng: -0.1278, label: 'Londres' },
  GR: { lat: 37.9838, lng: 23.7275, label: 'Athènes' },
  HR: { lat: 45.815, lng: 15.9819, label: 'Zagreb' },
  HU: { lat: 47.4979, lng: 19.0402, label: 'Budapest' },
  IE: { lat: 53.3498, lng: -6.2603, label: 'Dublin' },
  IS: { lat: 64.1466, lng: -21.9426, label: 'Reykjavik' },
  IT: { lat: 41.9028, lng: 12.4964, label: 'Rome' },
  LT: { lat: 54.6872, lng: 25.2797, label: 'Vilnius' },
  LU: { lat: 49.6116, lng: 6.1319, label: 'Luxembourg' },
  LV: { lat: 56.9496, lng: 24.1052, label: 'Riga' },
  MD: { lat: 47.0105, lng: 28.8638, label: 'Chișinău' },
  ME: { lat: 42.4304, lng: 19.2594, label: 'Podgorica' },
  MK: { lat: 41.9981, lng: 21.4254, label: 'Skopje' },
  MT: { lat: 35.8989, lng: 14.5146, label: 'La Valette' },
  NL: { lat: 52.3676, lng: 4.9041, label: 'Amsterdam' },
  NO: { lat: 59.9139, lng: 10.7522, label: 'Oslo' },
  PL: { lat: 52.2297, lng: 21.0122, label: 'Varsovie' },
  PT: { lat: 38.7223, lng: -9.1393, label: 'Lisbonne' },
  RO: { lat: 44.4268, lng: 26.1025, label: 'Bucarest' },
  RS: { lat: 44.7866, lng: 20.4489, label: 'Belgrade' },
  SE: { lat: 59.3293, lng: 18.0686, label: 'Stockholm' },
  SI: { lat: 46.0569, lng: 14.5058, label: 'Ljubljana' },
  SK: { lat: 48.1486, lng: 17.1077, label: 'Bratislava' },
  TR: { lat: 39.9334, lng: 32.8597, label: 'Ankara' },
  UA: { lat: 50.4501, lng: 30.5234, label: 'Kyiv' },
};

export function capitalFor(country: string | null | undefined): CountryCapital | null {
  if (country == null) return null;
  const code = country.trim().toUpperCase();
  return COUNTRY_CAPITALS[code] ?? null;
}
