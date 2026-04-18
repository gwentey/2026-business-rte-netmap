import type { GraphEdge } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';

export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
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
        {edge.intermediateBrokerEic && (
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Broker</dt>
            <dd className="col-span-2 font-mono">{edge.intermediateBrokerEic}</dd>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Statut</dt>
          <dd className="col-span-2">{edge.activity.connectionStatus ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Dernière msg UP</dt>
          <dd className="col-span-2">{formatDateTime(edge.activity.lastMessageUp)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Actif récemment</dt>
          <dd className="col-span-2">{edge.activity.isRecent ? 'Oui' : 'Non'}</dd>
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
