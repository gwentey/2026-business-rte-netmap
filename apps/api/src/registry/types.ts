import type { ProcessKey } from '@carto-ecp/shared';

export type EntsoeEntry = {
  eic: string;
  displayName: string;
  longName: string;
  country: string | null;
  vatCode: string | null;
  functionList: string | null;
};

export type RteEndpointOverlay = {
  eic: string;
  code: string;
  displayName: string;
  process: ProcessKey;
  lat: number;
  lng: number;
  city: string;
};

export type RteOverlay = {
  version: string;
  rteEndpoints: RteEndpointOverlay[];
  rteComponentDirectory: { eic: string; displayName: string; lat: number; lng: number };
  rteBusinessApplications: { code: string; criticality: string }[];
  organizationGeocode: Record<string, { lat: number; lng: number; country: string }>;
  countryGeocode: Record<string, { lat: number; lng: number; label?: string }>;
  messageTypeClassification: {
    exact: Record<string, ProcessKey>;
    patterns: { match: string; process: ProcessKey }[];
  };
  processColors: Record<ProcessKey, string>;
};

export type ResolvedLocation = {
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
};
