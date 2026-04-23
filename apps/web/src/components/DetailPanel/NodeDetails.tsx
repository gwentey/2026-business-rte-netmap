import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import { useAppStore } from '../../store/app-store.js';

export function NodeDetails({ node }: { node: GraphNode }): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectNode = useAppStore((s) => s.selectNode);

  const showProjectChip =
    node.projectName != null && node.projectName !== node.displayName;

  const homeCdNode =
    node.homeCdCode != null
      ? graph?.nodes.find((n) => n.eic === node.homeCdCode) ?? null
      : null;

  const hasContact = node.personName != null || node.email != null || node.phone != null;
  const hasConfig = node.status != null || node.appTheme != null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{node.displayName}</h2>
        {showProjectChip ? (
          <p className="mt-0.5 text-xs text-gray-500">
            Projet ECP :{' '}
            <span className="inline-block rounded bg-violet-50 px-1.5 py-0.5 font-mono text-violet-700">
              {node.projectName}
            </span>
          </p>
        ) : null}
      </div>
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
          <dt className="text-gray-500">Environnement</dt>
          <dd className="col-span-2">{node.envName ?? '—'}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Organisation</dt>
          <dd className="col-span-2">{node.organization || '—'}</dd>
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
        {node.homeCdCode != null ? (
          <div className="grid grid-cols-3 gap-2 py-1">
            <dt className="text-gray-500">Home CD</dt>
            <dd className="col-span-2 font-mono text-xs">
              {homeCdNode != null ? (
                <button
                  type="button"
                  onClick={() => selectNode(node.homeCdCode)}
                  className="text-rte underline underline-offset-2 hover:text-red-800"
                  title={`Aller à ${homeCdNode.displayName}`}
                >
                  {node.homeCdCode}
                </button>
              ) : (
                <span title="Ce CD n'est pas présent dans l'env courant">{node.homeCdCode}</span>
              )}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Créé</dt>
          <dd className="col-span-2">{formatDateTime(node.creationTs)}</dd>
        </div>
        <div className="grid grid-cols-3 gap-2 py-1">
          <dt className="text-gray-500">Modifié</dt>
          <dd className="col-span-2">{formatDateTime(node.modificationTs)}</dd>
        </div>
      </dl>

      {hasContact ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Contact</h3>
          <dl className="text-sm">
            {node.personName ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Personne</dt>
                <dd className="col-span-2">{node.personName}</dd>
              </div>
            ) : null}
            {node.email ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Email</dt>
                <dd className="col-span-2">
                  <a
                    href={`mailto:${node.email}`}
                    className="text-rte underline underline-offset-2 hover:text-red-800"
                  >
                    {node.email}
                  </a>
                </dd>
              </div>
            ) : null}
            {node.phone ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Téléphone</dt>
                <dd className="col-span-2">
                  <a
                    href={`tel:${node.phone.replace(/\s+/g, '')}`}
                    className="text-rte underline underline-offset-2 hover:text-red-800"
                  >
                    {node.phone}
                  </a>
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {hasConfig ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Config ECP</h3>
          <dl className="text-sm">
            {node.status ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Statut</dt>
                <dd className="col-span-2">
                  <StatusBadge status={node.status} />
                </dd>
              </div>
            ) : null}
            {node.appTheme ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Thème UI</dt>
                <dd className="col-span-2 text-xs">{node.appTheme}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

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
      {node.isDefaultPosition ? (
        <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-800">
          Position par défaut (EIC non géolocalisé dans le registry)
        </p>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const isActive = status.toUpperCase() === 'ACTIVE';
  const className = isActive
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${className}`}>
      {status}
    </span>
  );
}
