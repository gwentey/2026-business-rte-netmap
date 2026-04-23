import type { ProcessColorMap, ProcessKey } from '@carto-ecp/shared';

/**
 * Palette process — refonte ADR-040.
 * Couleurs alignées sur le langage visuel dark "carto-rte" : cyan/orange/violet/
 * vert/jaune/rose + 2 gris pour MIXTE et UNKNOWN. Doit rester en sync avec
 * `packages/registry/eic-rte-overlay.json` (champ `processColors`).
 *
 * Ce fichier est exempté du check:no-hex (data métier) — voir
 * `apps/web/scripts/check-no-hex.mjs`.
 */
export const PROCESS_COLORS: ProcessColorMap = {
  TP:         '#00bded', // cyan brand
  'UK-CC-IN': '#e6a23c', // orange
  CORE:       '#c38cf5', // violet
  MARI:       '#2fb573', // vert
  PICASSO:    '#f0c93f', // jaune
  VP:         '#ec85bd', // rose
  MIXTE:      '#9db0bb', // gris clair (ink-2)
  UNKNOWN:    '#6f8591', // gris muted (ink-3)
};

export function colorFor(
  process: ProcessKey | null | undefined,
  colors: ProcessColorMap = PROCESS_COLORS,
): string {
  if (!process) return colors.UNKNOWN;
  return colors[process];
}
