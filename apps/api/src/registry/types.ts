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
  rteBusinessApplications: {
    code: string;
    criticality: string;
    /**
     * EICs des endpoints RTE qui portent cette BA. Mapping statique
     * maintenu par MCO via PR git sur ce fichier. Slice 3b : utilisé par
     * RegistryService.resolveBusinessApplications pour renseigner
     * GraphNode.businessApplications. Source de vérité métier :
     * carto-ecp-document-fonctionnel-v1.2.md §5bis.
     */
    endpoints: string[];
  }[];
  organizationGeocode: Record<string, { lat: number; lng: number; country: string }>;
  countryGeocode: Record<string, { lat: number; lng: number; label?: string }>;
  messageTypeClassification: {
    exact: Record<string, ProcessKey>;
    patterns: { match: string; process: ProcessKey }[];
  };
  processColors: Record<ProcessKey, string>;
  mapConfig: {
    rteClusterLat: number;
    rteClusterLng: number;
    rteClusterOffsetDeg: number;
    rteClusterProximityDeg: number;
    defaultLat: number;
    defaultLng: number;
  };
};
