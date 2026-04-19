import type { ComponentType, ProcessKey, Warning } from '@carto-ecp/shared';
import type { DumpType } from './dump-type-detector.js';

export const REQUIRED_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
] as const;

export const USABLE_CSV_FILES = [
  'application_property.csv',
  'component_directory.csv',
  'message_path.csv',
  'messaging_statistics.csv',
] as const;

export const IGNORED_CSV_FILES = [
  'component_statistics.csv',
  'synchronized_directories.csv',
  'pending_edit_directories.csv',
  'pending_removal_directories.csv',
] as const;

export const SENSITIVE_CSV_FILES = [
  'local_key_store.csv',
  'registration_store.csv',
  'registration_requests.csv',
] as const;

export type ExtractedZip = {
  files: Map<string, Buffer>;
};

export type AppPropertyRow = {
  key: string;
  value: string | null;
  changedBy: string | null;
  createdDate: Date | null;
  modifiedDate: Date | null;
};

export type MessagePathRow = {
  allowedSenders: string | null;
  applied: boolean | null;
  intermediateBrokerCode: string | null;
  intermediateComponent: string | null;
  messagePathType: 'ACKNOWLEDGEMENT' | 'BUSINESS' | null;
  messageType: string | null;
  receiver: string | null;
  remote: boolean | null;
  status: string | null;
  transportPattern: 'DIRECT' | 'INDIRECT' | null;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MessagingStatisticRow = {
  connectionStatus: string | null;
  deleted: boolean | null;
  lastMessageDown: Date | null;
  lastMessageUp: Date | null;
  localEcpInstanceId: string | null;
  remoteComponentCode: string | null;
  sumMessagesDown: number | null;
  sumMessagesUp: number | null;
};

export type ComponentDirectoryRow = {
  directoryContent: string;
  id: string;
  signature: string | null;
  version: string | null;
};

export type MadesPath = {
  senderComponent: string | null;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  brokerCode: string | null;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MadesCertificate = {
  certificateID: string;
  type: string;
  validFrom: Date | null;
  validTo: Date | null;
};

export type MadesComponent = {
  organization: string;
  personName: string;
  email: string;
  phone: string;
  code: string;
  type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY';
  networks: string[];
  urls: { network: string; url: string }[];
  certificates: MadesCertificate[];
  creationTs: Date | null;
  modificationTs: Date | null;
  homeCdCode: string;
  paths: MadesPath[];
};

export type MadesTree = {
  cdCode: string;
  contentId: number;
  ttl: number;
  brokers: MadesComponent[];
  endpoints: MadesComponent[];
  componentDirectories: MadesComponent[];
};

export type ComponentRecord = {
  eic: string;
  type: 'BROKER' | 'ENDPOINT' | 'COMPONENT_DIRECTORY';
  organization: string;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string;
  networks: string[];
  urls: { network: string; url: string }[];
  creationTs: Date | null;
  modificationTs: Date | null;
  displayName: string;
  country: string | null;
  lat: number;
  lng: number;
  isDefaultPosition: boolean;
  process: ProcessKey | null;
  sourceType: 'XML_CD' | 'LOCAL_CSV';
};

export type MessagePathRecord = {
  receiverEic: string;
  senderEicOrWildcard: string;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  process: ProcessKey;
  direction: 'IN' | 'OUT';
  source: 'XML_CD_PATHS' | 'LOCAL_CSV_PATHS';
  isExpired: boolean;
};

export type NetworkSnapshot = {
  meta: {
    envName: string;
    componentType: ComponentType;
    sourceComponentCode: string;
    cdCode: string | null;
    organization: string;
    networks: string[];
  };
  components: ComponentRecord[];
  messagePaths: MessagePathRecord[];
  messagingStats: MessagingStatisticRow[];
  appProperties: AppPropertyRow[];
  warnings: Warning[];
};

export type IngestionInput = {
  zipBuffer: Buffer;
  label: string;
  envName: string;
};

export type IngestionResult = {
  snapshotId: string;
  componentType: ComponentType;
  sourceComponentCode: string;
  cdCode: string | null;
  warnings: Warning[];
};

export type BuiltImportedComponent = {
  eic: string;
  type: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER' | 'BA';
  organization: string | null;
  personName: string | null;
  email: string | null;
  phone: string | null;
  homeCdCode: string | null;
  networksCsv: string | null;
  displayName: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  isDefaultPosition: boolean;
  sourceType: 'XML_CD' | 'LOCAL_CSV';
  creationTs: Date | null;
  modificationTs: Date | null;
  urls: { network: string; url: string }[];
};

export type BuiltImportedPath = {
  receiverEic: string;
  senderEic: string;
  messageType: string;
  transportPattern: 'DIRECT' | 'INDIRECT';
  intermediateBrokerEic: string | null;
  validFrom: Date | null;
  validTo: Date | null;
  isExpired: boolean;
};

export type BuiltImportedMessagingStat = {
  sourceEndpointCode: string;
  remoteComponentCode: string;
  connectionStatus: string | null;
  lastMessageUp: Date | null;
  lastMessageDown: Date | null;
  sumMessagesUp: number;
  sumMessagesDown: number;
  deleted: boolean;
};

export type BuiltImport = {
  envName: string;
  label: string;
  fileName: string;
  fileHash: string;
  dumpType: DumpType;
  sourceComponentEic: string | null;
  sourceDumpTimestamp: Date | null;
  effectiveDate: Date;
  components: BuiltImportedComponent[];
  paths: BuiltImportedPath[];
  messagingStats: BuiltImportedMessagingStat[];
  appProperties: { key: string; value: string }[];
  warnings: Warning[];
};
