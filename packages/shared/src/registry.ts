export const PROCESS_KEYS = [
  'TP',
  'UK-CC-IN',
  'CORE',
  'MARI',
  'PICASSO',
  'VP',
  'MIXTE',
  'UNKNOWN',
] as const;

export type ProcessKey = (typeof PROCESS_KEYS)[number];

export type ProcessColorMap = Record<ProcessKey, string>;
