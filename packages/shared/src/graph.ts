import type { ProcessKey } from './registry.js';
import type { Warning } from './snapshot.js';

export type NodeKind =
  | 'RTE_ENDPOINT'
  | 'RTE_CD'
  | 'BROKER'
  | 'EXTERNAL_CD'
  | 'EXTERNAL_ENDPOINT';

export type EdgeDirection = 'IN' | 'OUT';

export type GraphNode = {
  id: string;
  eic: string;
  kind: NodeKind;
  displayName: string;
  organization: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  networks: string[];
  process: ProcessKey | null;
  urls: { network: string; url: string }[];
  creationTs: string;
  modificationTs: string;
};

export type GraphEdge = {
  id: string;
  fromEic: string;
  toEic: string;
  direction: EdgeDirection;
  process: ProcessKey;
  messageTypes: string[];
  transportPatterns: ('DIRECT' | 'INDIRECT')[];
  intermediateBrokerEic: string | null;
  activity: {
    connectionStatus: string | null;
    lastMessageUp: string | null;
    lastMessageDown: string | null;
    isRecent: boolean;
  };
  validFrom: string;
  validTo: string | null;
};

export type GraphBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapConfig = {
  rteClusterLat: number;
  rteClusterLng: number;
  rteClusterOffsetDeg: number;
  rteClusterProximityDeg: number;
  defaultLat: number;
  defaultLng: number;
};

export type GraphResponse = {
  bounds: GraphBounds;
  nodes: GraphNode[];
  edges: GraphEdge[];
  mapConfig: MapConfig;
};

export type ImportSummary = {
  id: string;
  envName: string;
  label: string;
  fileName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  sourceComponentEic: string | null;
  sourceDumpTimestamp: string | null;
  uploadedAt: string;
  effectiveDate: string;
};

export type ImportDetail = ImportSummary & {
  warnings: Warning[];
  stats: {
    componentsCount: number;
    pathsCount: number;
    messagingStatsCount: number;
  };
};

export type InspectResult = {
  fileName: string;
  fileSize: number;
  fileHash: string;
  sourceComponentEic: string | null;
  sourceDumpTimestamp: string | null;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  confidence: 'HIGH' | 'FALLBACK';
  reason: string;
  duplicateOf: {
    importId: string;
    label: string;
    uploadedAt: string;
  } | null;
  warnings: Warning[];
};

export type AdminComponentRow = {
  eic: string;
  current: {
    displayName: string;
    type: string;
    organization: string | null;
    country: string | null;
    lat: number;
    lng: number;
    isDefaultPosition: boolean;
  };
  override: {
    displayName: string | null;
    type: string | null;
    organization: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
    tagsCsv: string | null;
    notes: string | null;
    updatedAt: string;
  } | null;
  importsCount: number;
};

export type OverrideUpsertInput = {
  displayName?: string | null;
  type?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA' | null;
  organization?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  tagsCsv?: string | null;
  notes?: string | null;
};

export type EntsoeStatus = { count: number; refreshedAt: string | null };
export type PurgeResult = { deletedCount: number };
export type ResetAllResult = { imports: number; overrides: number; entsoe: number };
