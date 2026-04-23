import type { ProcessColorMap, ProcessKey } from './registry.js';
import type { Warning } from './snapshot.js';

export type NodeKind =
  | 'RTE_ENDPOINT'
  | 'RTE_CD'
  | 'BROKER'
  | 'EXTERNAL_CD'
  | 'EXTERNAL_ENDPOINT';

export type EdgeDirection = 'IN' | 'OUT';

export type InterlocutorDirection = 'IN' | 'OUT' | 'BIDI';

export type BusinessApplicationCriticality = 'P1' | 'P2' | 'P3';

export type BusinessApplicationSummary = {
  /** Code métier (OCAPPI, PLANET, CIA…). Identifiant unique. */
  code: string;
  /** P1 (critique), P2 (important), P3 (standard). */
  criticality: BusinessApplicationCriticality;
};

export type GraphNodeInterlocutor = {
  /** EIC de l'interlocuteur. Toujours différent du noeud courant. */
  eic: string;
  /** Union des messageTypes échangés avec cet interlocuteur, triés alpha. */
  messageTypes: string[];
  /**
   * Direction vue depuis le noeud courant :
   * IN   = il m'envoie
   * OUT  = je lui envoie
   * BIDI = les deux (au moins un message dans chaque sens)
   */
  direction: InterlocutorDirection;
};

export type GraphNode = {
  id: string;
  eic: string;
  kind: NodeKind;
  displayName: string;
  projectName: string | null;
  envName: string | null;
  organization: string;
  /** Contact ECP (depuis le XML MADES) — nom de la personne responsable. */
  personName: string | null;
  /** Contact ECP (depuis le XML MADES) — email. */
  email: string | null;
  /** Contact ECP (depuis le XML MADES) — téléphone au format international. */
  phone: string | null;
  /** EIC du Component Directory auquel ce composant est rattaché. */
  homeCdCode: string | null;
  /** `ecp.internal.status` (ex. "ACTIVE") si lu depuis un dump de ce composant. */
  status: string | null;
  /** `ecp.appTheme` (DEFAULT | BLUE | WHITE) si lu depuis un dump de ce composant. */
  appTheme: string | null;
  /**
   * Dernière synchronisation vue par un CD (component_statistics.csv) —
   * max sur l'ensemble des Imports CD de l'env. Null si jamais observé.
   */
  lastSync: string | null;
  /**
   * Cumul sentMessages observé par un CD pour ce composant (component_statistics.csv).
   * Null si le composant n'a jamais été observé par un CD dans cet env.
   */
  sentMessages: number | null;
  /**
   * Cumul receivedMessages observé par un CD pour ce composant.
   */
  receivedMessages: number | null;
  /**
   * EICs des cibles d'upload prioritaires déclarées par ce composant
   * (message_upload_route.csv). Endpoint seulement ; vide pour les autres.
   */
  uploadTargets: string[];
  /**
   * Liste des interlocuteurs dérivés des edges BUSINESS agrégées pour ce
   * noeud. Vide si le noeud n'a aucune edge BUSINESS. Calculée par le
   * backend à la lecture (compute-on-read) — ne pas confondre avec les
   * cibles d'upload qui sont déclarées sans observation de trafic.
   */
  interlocutors: GraphNodeInterlocutor[];
  /**
   * Business Applications RTE qui utilisent ce noeud. Résolu uniquement
   * pour les endpoints RTE via le mapping statique de l'overlay
   * (packages/registry/eic-rte-overlay.json → rteBusinessApplications).
   * Vide pour les partenaires externes, les brokers et les CDs.
   */
  businessApplications: BusinessApplicationSummary[];
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

export type EdgeKind = 'BUSINESS' | 'PEERING';

export type GraphEdge = {
  id: string;
  /** Distingue les flux métier (message paths) du peering CD↔CD. */
  kind: EdgeKind;
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
    /** Somme bi-directionnelle des messages envoyés sur la paire (A→B + B→A). */
    sumMessagesUp: number;
    /** Somme bi-directionnelle des messages reçus sur la paire. */
    sumMessagesDown: number;
    /** sumMessagesUp + sumMessagesDown, utilisé pour l'épaisseur d'edge. */
    totalVolume: number;
  };
  validFrom: string;
  validTo: string | null;
  /** Propriétés spécifiques aux edges de peering CD↔CD (null pour BUSINESS). */
  peering: {
    syncMode: 'ONE_WAY' | 'TWO_WAY';
    directoryType: string | null;
    directoryUrl: string | null;
    synchronizationStatus: string | null;
  } | null;
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
  processColors: ProcessColorMap;
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
  hasConfigurationProperties: boolean;
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

export type RegistryColorRow = {
  process: ProcessKey;
  color: string;
  isOverride: boolean;
  default: string;
};

export type RegistryRteEndpointRow = {
  eic: string;
  code: string;
  displayName: string;
  city: string;
  lat: number;
  lng: number;
  hasOverride: boolean;
};

export type ComponentConfigProperty = {
  key: string;
  value: string;
};

export type ComponentConfigSection = {
  /** Nom lisible de la section (Identification, Réseau, Antivirus…). */
  name: string;
  /** Clé courte utilisée pour icônes / expand-collapse UI. */
  slug: string;
  properties: ComponentConfigProperty[];
};

export type ComponentConfigResponse = {
  eic: string;
  /** Import dont les `application_property.csv` ont été retenus (le plus récent). */
  source: {
    importId: string;
    label: string;
    envName: string;
    uploadedAt: string;
    hasConfigurationProperties: boolean;
  } | null;
  sections: ComponentConfigSection[];
};
