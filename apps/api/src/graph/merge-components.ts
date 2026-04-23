export type ImportedComponentWithImport = {
  eic: string;
  type: string;
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string | null;
  projectName: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  isDefaultPosition: boolean;
  sourceType: string;
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
  _effectiveDate: Date;
};

export type MergedComponent = Omit<ImportedComponentWithImport, '_effectiveDate'>;

const OVERWRITABLE_FIELDS = [
  'type',
  'organization',
  'personName',
  'email',
  'phone',
  'homeCdCode',
  'networksCsv',
  'displayName',
  'projectName',
  'country',
  'lat',
  'lng',
  'sourceType',
  'creationTs',
  'modificationTs',
] as const;

export function mergeComponentsLatestWins(
  rows: ImportedComponentWithImport[],
): Map<string, MergedComponent> {
  const byEic = new Map<string, ImportedComponentWithImport[]>();
  for (const r of rows) {
    const list = byEic.get(r.eic) ?? [];
    list.push(r);
    byEic.set(r.eic, list);
  }

  const out = new Map<string, MergedComponent>();
  for (const [eic, list] of byEic) {
    list.sort((a, b) => a._effectiveDate.getTime() - b._effectiveDate.getTime());
    const first = list[0]!;
    const base: MergedComponent = {
      eic: first.eic,
      type: first.type,
      organization: first.organization,
      personName: first.personName,
      email: first.email,
      phone: first.phone,
      homeCdCode: first.homeCdCode,
      networksCsv: first.networksCsv,
      displayName: first.displayName,
      projectName: first.projectName,
      country: first.country,
      lat: first.lat,
      lng: first.lng,
      isDefaultPosition: first.isDefaultPosition,
      sourceType: first.sourceType,
      creationTs: first.creationTs,
      modificationTs: first.modificationTs,
      urls: [],
    };

    for (const r of list) {
      for (const f of OVERWRITABLE_FIELDS) {
        const v = r[f];
        if (v != null) (base as Record<string, unknown>)[f] = v;
      }
      if (r.isDefaultPosition === false) base.isDefaultPosition = false;
    }

    // URLs : latest-wins — on prend les urls du dernier import qui en fournit
    const latestWithUrls = [...list].reverse().find((r) => r.urls.length > 0);
    base.urls = latestWithUrls?.urls ?? [];

    out.set(eic, base);
  }
  return out;
}
