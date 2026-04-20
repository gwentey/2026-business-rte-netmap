import type { ProcessColorMap, ProcessKey } from '@carto-ecp/shared';

export const PROCESS_COLORS: ProcessColorMap = {
  TP: '#3b82f6',
  'UK-CC-IN': '#f97316',
  CORE: '#a855f7',
  MARI: '#22c55e',
  PICASSO: '#f59e0b',
  VP: '#ec4899',
  MIXTE: '#4b5563',
  UNKNOWN: '#9ca3af',
};

export function colorFor(
  process: ProcessKey | null | undefined,
  colors: ProcessColorMap = PROCESS_COLORS,
): string {
  if (!process) return colors.UNKNOWN;
  return colors[process];
}
