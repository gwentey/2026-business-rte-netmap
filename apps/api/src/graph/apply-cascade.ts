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

export type CascadeInputs = {
  override: OverrideInput | null;
  entsoe: EntsoeInput | null;
  registry: RegistryInput | null;
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

  const country = pickField(
    override?.country,
    entsoe?.country,
    registry?.country,
    merged?.country,
  );

  const type =
    pickField(
      override?.type,
      registry?.type,
      merged?.type,
    ) ?? 'ENDPOINT';

  const lat = pickField(override?.lat, registry?.lat, merged?.lat);
  const lng = pickField(override?.lng, registry?.lng, merged?.lng);
  const hasExplicitCoord = lat != null && lng != null;

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
