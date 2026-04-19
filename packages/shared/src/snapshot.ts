export type ComponentType = 'ENDPOINT' | 'COMPONENT_DIRECTORY';

export type Warning = {
  code: string;
  message: string;
  context?: Record<string, unknown>;
};
