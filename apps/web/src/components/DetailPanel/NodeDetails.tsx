import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';

export function NodeDetails({ node }: { node: GraphNode }): JSX.Element {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{node.displayName}</h2>
      <dl className="text-sm">
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">EIC</dt>
          <dd className="col-span-2 font-mono">{node.eic}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Type</dt>
          <dd className="col-span-2">{node.kind}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Organisation</dt>
          <dd className="col-span-2">{node.organization}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Pays</dt>
          <dd className="col-span-2">{node.country ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Networks</dt>
          <dd className="col-span-2">{node.networks.join(', ') || '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Processus</dt>
          <dd className="col-span-2">{node.process ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Créé</dt>
          <dd className="col-span-2">{formatDateTime(node.creationTs)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Modifié</dt>
          <dd className="col-span-2">{formatDateTime(node.modificationTs)}</dd>
        </div>
      </dl>
      {node.urls.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium">URLs</h3>
          <ul className="space-y-1 text-xs font-mono">
            {node.urls.map((u, idx) => (
              <li key={idx}>
                <span className="text-gray-500">{u.network}</span> — {u.url}
              </li>
            ))}
          </ul>
        </div>
      )}
      {node.isDefaultPosition && (
        <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          Position par défaut (EIC non géolocalisé dans le registry)
        </p>
      )}
    </div>
  );
}
