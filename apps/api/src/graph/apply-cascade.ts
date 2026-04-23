import type { MergedComponent } from './merge-components.js';

export type OverrideInput = {
  displayName?: string | null;
  type?: string | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tagsCsv?: string | null;
  notes?: string | null;
};

export type EntsoeInput = {
  displayName?: string | null;
  organization?: string | null;
  country?: string | null;
};

export type RegistryInput = {
  displayName?: string | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  type?: string | null;
  process?: string | null;
};

/** Slice 3d — mémoire interne DB (par nom d'organisation). */
export type OrganizationMemoryInput = {
  country?: string | null;
  address?: string | null;
  displayName?: string | null;
  /** Coords GPS précises saisies par l'utilisateur via /admin. */
  lat?: number | null;
  lng?: number | null;
};

/** Slice 3d — overlay.organizationGeocode statique MCO (par nom d'organisation). */
export type OrganizationOverlayInput = {
  lat: number;
  lng: number;
  country: string;
};

/** Slice 3d — overlay.countryGeocode fallback par pays résolu. */
export type CountryGeoInput = {
  lat: number;
  lng: number;
};

export type CascadeInputs = {
  override: OverrideInput | null;
  entsoe: EntsoeInput | null;
  registry: RegistryInput | null;
  /**
   * Entrée de la mémoire interne DB pour `merged.organization`.
   * Apporte country + address quand l'organisation est connue.
   */
  organizationMemory?: OrganizationMemoryInput | null;
  /**
   * Entrée statique `organizationGeocode` de l'overlay pour
   * `merged.organization`. Apporte lat/lng/country précises.
   */
  organizationOverlay?: OrganizationOverlayInput | null;
  /**
   * Entrée `countryGeocode[country]` — coords approximatives du pays
   * résolu plus haut dans la cascade. Appliqué en fallback avant
   * l'ultime default Brussels.
   */
  countryGeo?: CountryGeoInput | null;
};

export type GlobalComponent = {
  eic: string;
  type: string;
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string;
  projectName: string | null;
  country: string | null;
  /** Slice 3d — adresse issue de la mémoire interne (null sinon). */
  address: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  sourceType: string;
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
  tagsCsv: string | null;
  notes: string | null;
  process: string | null;
};

function pickField<T>(...values: Array<T | null | undefined>): T | null {
  for (const v of values) {
    if (v != null) return v;
  }
  return null;
}

export function applyCascade(
  eic: string,
  merged: MergedComponent | null,
  inputs: CascadeInputs,
  defaultFallback: { lat: number; lng: number },
): GlobalComponent {
  const { override, entsoe, registry } = inputs;
  const organizationMemory = inputs.organizationMemory ?? null;
  const organizationOverlay = inputs.organizationOverlay ?? null;
  const countryGeo = inputs.countryGeo ?? null;

  // Cascade displayName : priorité à la saisie admin (Override), puis au nom
  // humain officiel ECP (`ecp.projectName` lu depuis le dump, ex. "INTERNET-EP1")
  // qui est la source de vérité pour les composants dumpés. On retombe sur les
  // référentiels externes (ENTSO-E, overlay RTE) pour les EICs partenaires non
  // dumpés, puis sur `merged.displayName` local (rare) et l'EIC en fallback.
  const displayName =
    pickField(
      override?.displayName,
      merged?.projectName,
      entsoe?.displayName,
      registry?.displayName,
      merged?.displayName,
    ) ?? eic;

  const organization = pickField(
    override?.organization,
    entsoe?.organization,
    registry?.organization,
    merged?.organization,
  );

  // Slice 3d — country : on insère la mémoire interne DB entre ENTSO-E et
  // registry RTE. Permet de résoudre le pays pour une organisation connue
  // (ex. "Swissgrid AG" → "CH") sans attendre l'upload CSV ENTSO-E.
  const country = pickField(
    override?.country,
    entsoe?.country,
    registry?.country,
    organizationOverlay?.country,
    organizationMemory?.country,
    merged?.country,
  );

  const type =
    pickField(
      override?.type,
      registry?.type,
      merged?.type,
    ) ?? 'ENDPOINT';

  // Slice 3d — lat/lng : injection de organizationOverlay (coords précises
  // MCO statiques), puis organizationMemory (coords saisies par
  // l'utilisateur via /admin), puis countryGeo (fallback approximatif par
  // pays). Les lat/lng sont indépendants (on évite un couple partiel).
  const lat = pickField(
    override?.lat,
    registry?.lat,
    organizationOverlay?.lat,
    organizationMemory?.lat,
    countryGeo?.lat,
    merged?.lat,
  );
  const lng = pickField(
    override?.lng,
    registry?.lng,
    organizationOverlay?.lng,
    organizationMemory?.lng,
    countryGeo?.lng,
    merged?.lng,
  );
  const hasExplicitCoord = lat != null && lng != null;

  // Slice 3d — address : uniquement depuis la mémoire interne DB
  // (pas d'address côté overlay/registry/ENTSO-E). Null par défaut.
  const address = organizationMemory?.address ?? null;

  return {
    eic,
    type,
    organization,
    personName: merged?.personName ?? null,
    email: merged?.email ?? null,
    phone: merged?.phone ?? null,
    homeCdCode: merged?.homeCdCode ?? null,
    networksCsv: merged?.networksCsv ?? null,
    displayName,
    projectName: merged?.projectName ?? null,
    country,
    address,
    lat: hasExplicitCoord ? lat : defaultFallback.lat,
    lng: hasExplicitCoord ? lng : defaultFallback.lng,
    isDefaultPosition: !hasExplicitCoord,
    sourceType: merged?.sourceType ?? 'LOCAL_CSV',
    creationTs: merged?.creationTs ?? null,
    modificationTs: merged?.modificationTs ?? null,
    urls: merged?.urls ?? [],
    tagsCsv: override?.tagsCsv ?? null,
    notes: override?.notes ?? null,
    process: registry?.process ?? null,
  };
}
