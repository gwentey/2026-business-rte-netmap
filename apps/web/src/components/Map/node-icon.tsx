import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Network, Router, Zap, type LucideIcon } from 'lucide-react';
import type { NodeKind } from '@carto-ecp/shared';

type IconConfig = {
  Icon: LucideIcon;
  bgColor: string;
  label: string;
};

export type HealthStatus = 'healthy' | 'warning' | 'stale' | 'unknown';

// Refonte ADR-040 — couleurs dark cohérentes avec la légende du nouveau design.
// RTE = cyan brand, externes = violet/gris.
const KIND_CONFIG: Record<NodeKind, IconConfig> = {
  RTE_ENDPOINT:      { Icon: Zap,     bgColor: '#2fb573', label: 'Endpoint RTE' },
  RTE_CD:            { Icon: Network, bgColor: '#00bded', label: 'CD RTE' },
  BROKER:            { Icon: Router,  bgColor: '#0f4a5e', label: 'Broker' },
  EXTERNAL_CD:       { Icon: Network, bgColor: '#c38cf5', label: 'CD externe' },
  EXTERNAL_ENDPOINT: { Icon: Zap,     bgColor: '#6f8591', label: 'Endpoint externe' },
};

const HEALTH_COLOR: Record<Exclude<HealthStatus, 'unknown'>, string> = {
  healthy: '#2fb573', // ok
  warning: '#e6a23c', // warn
  stale:   '#e74c4c', // err
};

const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: 'Sync récente (< 1h)',
  warning: 'Sync entre 1h et 24h',
  stale:   'Sync > 24h',
  unknown: 'Sync inconnu',
};

/**
 * Dérive le statut de santé d'un node à partir de son `lastSync` et de l'instant courant.
 */
export function healthStatusFromLastSync(
  lastSync: string | null,
  now: number = Date.now(),
): HealthStatus {
  if (lastSync == null) return 'unknown';
  const t = Date.parse(lastSync);
  if (!Number.isFinite(t)) return 'unknown';
  const deltaMs = now - t;
  if (deltaMs < 60 * 60 * 1000) return 'healthy';
  if (deltaMs < 24 * 60 * 60 * 1000) return 'warning';
  return 'stale';
}

export function buildNodeDivIcon(
  kind: NodeKind,
  isDefaultPosition: boolean,
  selected: boolean,
  health: HealthStatus = 'unknown',
): L.DivIcon {
  const cfg = KIND_CONFIG[kind];
  const IconComponent = cfg.Icon;
  const iconSvg = renderToStaticMarkup(<IconComponent size={14} color="#0a1114" />);

  const defaultPosBadge = isDefaultPosition
    ? `<span aria-label="Position par défaut" style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;background:#e6a23c;color:#0a1114;font-size:8px;font-weight:bold;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #0a1114;line-height:1;">⚠</span>`
    : '';

  const healthBadge =
    health !== 'unknown'
      ? `<span aria-label="${HEALTH_LABEL[health]}" title="${HEALTH_LABEL[health]}" style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;background:${HEALTH_COLOR[health]};border-radius:50%;border:1px solid #0a1114;"></span>`
      : '';

  const haloStyle = selected
    ? 'box-shadow:0 0 0 3px #ffffff,0 0 0 5px rgba(0,189,237,0.6);'
    : '';

  const ariaLabel = `${cfg.label}${isDefaultPosition ? ' (position par défaut)' : ''}`;

  const html = `<div data-kind="${kind}" data-default="${isDefaultPosition ? 'true' : 'false'}" data-selected="${selected ? 'true' : 'false'}" data-health="${health}" aria-label="${ariaLabel}" style="position:relative;width:24px;height:24px;background:${cfg.bgColor};border:2px solid #0a1114;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;${haloStyle}">${iconSvg}${healthBadge}${defaultPosBadge}</div>`;

  return L.divIcon({
    html,
    className: 'carto-node-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Re-export pour autres modules (légendes etc.)
export const NODE_KIND_COLOR: Record<NodeKind, string> = {
  RTE_ENDPOINT:      '#2fb573',
  RTE_CD:            '#00bded',
  BROKER:            '#0f4a5e',
  EXTERNAL_CD:       '#c38cf5',
  EXTERNAL_ENDPOINT: '#6f8591',
};

export const NODE_KIND_LABEL: Record<NodeKind, string> = {
  RTE_ENDPOINT:      'Endpoint RTE',
  RTE_CD:            'CD RTE',
  BROKER:            'Broker',
  EXTERNAL_CD:       'CD externe',
  EXTERNAL_ENDPOINT: 'Endpoint externe',
};
