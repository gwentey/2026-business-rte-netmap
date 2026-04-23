import type { GraphEdge } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';

export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
  const { activity } = edge;

  if (edge.kind === 'PEERING' && edge.peering != null) {
    return (
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Peering CD ↔ CD</h2>
        <dl className="text-sm">
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">De</dt>
            <dd className="col-span-2 font-mono">{edge.fromEic}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Vers</dt>
            <dd className="col-span-2 font-mono">{edge.toEic}</dd>
          </div>
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Mode sync</dt>
            <dd className="col-span-2">
              <span
                className={`inline-block rounded px-2 py-0.5 text-xs ${
                  edge.peering.syncMode === 'TWO_WAY'
                    ? 'bg-indigo-100 text-indigo-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {edge.peering.syncMode}
              </span>
            </dd>
          </div>
          {edge.peering.directoryType ? (
            <div className="grid grid-cols-3 gap-2 py-1">
              <dt className="text-gray-500">Type</dt>
              <dd className="col-span-2">{edge.peering.directoryType}</dd>
            </div>
          ) : null}
          {edge.peering.synchronizationStatus ? (
            <div className="grid grid-cols-3 gap-2 py-1">
              <dt className="text-gray-500">Statut sync</dt>
              <dd className="col-span-2">{edge.peering.synchronizationStatus}</dd>
            </div>
          ) : null}
          {edge.peering.directoryUrl ? (
            <div className="grid grid-cols-3 gap-2 py-1">
              <dt className="text-gray-500">URL partenaire</dt>
              <dd className="col-span-2 font-mono text-xs break-all">
                {edge.peering.directoryUrl}
              </dd>
            </div>
          ) : null}
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Dernier sync</dt>
            <dd className="col-span-2">{formatDateTime(activity.lastMessageUp)}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Flux {edge.process}</h2>
      <dl className="text-sm">
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Sens</dt>
          <dd className="col-span-2">{edge.direction}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">De</dt>
          <dd className="col-span-2 font-mono">{edge.fromEic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Vers</dt>
          <dd className="col-span-2 font-mono">{edge.toEic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Transport</dt>
          <dd className="col-span-2">{edge.transportPatterns.join(', ')}</dd>
        </div>
        {edge.intermediateBrokerEic ? (
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Broker</dt>
            <dd className="col-span-2 font-mono">{edge.intermediateBrokerEic}</dd>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Statut</dt>
          <dd className="col-span-2">
            <StatusBadge status={activity.connectionStatus} />
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Dernière msg UP</dt>
          <dd className="col-span-2">{formatDateTime(activity.lastMessageUp)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Dernière msg DOWN</dt>
          <dd className="col-span-2">{formatDateTime(activity.lastMessageDown)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Actif récemment</dt>
          <dd className="col-span-2">{activity.isRecent ? 'Oui' : 'Non'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Volume total</dt>
          <dd className="col-span-2">
            <VolumeBadge count={activity.totalVolume} />
          </dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Envoyés (UP)</dt>
          <dd className="col-span-2">{formatCount(activity.sumMessagesUp)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Reçus (DOWN)</dt>
          <dd className="col-span-2">{formatCount(activity.sumMessagesDown)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Validité</dt>
          <dd className="col-span-2">
            {formatDateTime(edge.validFrom)} → {formatDateTime(edge.validTo)}
          </dd>
        </div>
      </dl>
      <div>
        <h3 className="mb-1 text-sm font-medium">Message types ({edge.messageTypes.length})</h3>
        <div className="flex flex-wrap gap-1 text-xs">
          {edge.messageTypes.map((mt) => (
            <span key={mt} className="rounded bg-gray-100 px-2 py-0.5 font-mono">
              {mt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }): JSX.Element {
  if (status == null) return <span className="text-xs text-gray-400">—</span>;
  const s = status.toUpperCase();
  const className =
    s === 'CONNECTED'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'NOT_CONNECTED'
        ? 'bg-red-100 text-red-800'
        : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${className}`}>
      {status}
    </span>
  );
}

function VolumeBadge({ count }: { count: number }): JSX.Element {
  if (count === 0) return <span className="text-xs text-gray-400">Aucun</span>;
  return (
    <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-800">
      {formatCount(count)}
    </span>
  );
}

function formatCount(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('fr-FR');
}
