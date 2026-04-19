import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';
import { Network, Router, Zap, type LucideIcon } from 'lucide-react';
import type { NodeKind } from '@carto-ecp/shared';

type IconConfig = {
  Icon: LucideIcon;
  bgColor: string;
  label: string;
};

const KIND_CONFIG: Record<NodeKind, IconConfig> = {
  RTE_ENDPOINT:      { Icon: Zap,     bgColor: '#e30613', label: 'Endpoint RTE' },
  RTE_CD:            { Icon: Network, bgColor: '#b91c1c', label: 'CD RTE' },
  BROKER:            { Icon: Router,  bgColor: '#111827', label: 'Broker' },
  EXTERNAL_CD:       { Icon: Network, bgColor: '#1f2937', label: 'CD externe' },
  EXTERNAL_ENDPOINT: { Icon: Zap,     bgColor: '#6b7280', label: 'Endpoint externe' },
};

export function buildNodeDivIcon(
  kind: NodeKind,
  isDefaultPosition: boolean,
  selected: boolean,
): L.DivIcon {
  const cfg = KIND_CONFIG[kind];
  const IconComponent = cfg.Icon;
  const iconSvg = renderToStaticMarkup(<IconComponent size={14} color="#ffffff" />);

  const badge = isDefaultPosition
    ? `<span aria-label="Position par défaut" style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;background:#f97316;color:#fff;font-size:8px;font-weight:bold;border-radius:50%;display:flex;align-items:center;justify-content:center;border:1px solid #fff;line-height:1;">⚠</span>`
    : '';

  const haloStyle = selected ? 'box-shadow:0 0 0 3px rgba(59,130,246,0.6);' : '';

  const ariaLabel = `${cfg.label}${isDefaultPosition ? ' (position par défaut)' : ''}`;

  const html = `<div data-kind="${kind}" data-default="${isDefaultPosition ? 'true' : 'false'}" data-selected="${selected ? 'true' : 'false'}" aria-label="${ariaLabel}" style="position:relative;width:24px;height:24px;background:${cfg.bgColor};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;${haloStyle}">${iconSvg}${badge}</div>`;

  return L.divIcon({
    html,
    className: 'carto-node-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}
