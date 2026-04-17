export type ComponentType = 'ENDPOINT' | 'COMPONENT_DIRECTORY';

export type Warning = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};

export type SnapshotSummary = {
  id: string;
  label: string;
  envName: string;
  componentType: ComponentType;
  sourceComponentCode: string;
  cdCode: string | null;
  uploadedAt: string;
  warningCount: number;
};

export type SnapshotDetail = SnapshotSummary & {
  organization: string | null;
  stats: {
    componentsCount: number;
    pathsCount: number;
    statsCount: number;
  };
  warnings: Warning[];
};
