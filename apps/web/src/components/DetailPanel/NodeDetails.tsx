import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import { useAppStore } from '../../store/app-store.js';
import { healthStatusFromLastSync } from '../Map/node-icon.js';

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
  const hasHealth =
    node.lastSync != null ||
    node.sentMessages != null ||
    node.receivedMessages != null;
  const health = healthStatusFromLastSync(node.lastSync);

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

      {node.businessApplications.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">
            Applications métier ({node.businessApplications.length})
          </h3>
          <div className="flex flex-wrap gap-1">
            {node.businessApplications.map((ba) => (
              <BaBadge key={ba.code} code={ba.code} criticality={ba.criticality} />
            ))}
          </div>
        </div>
      ) : null}
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

      {hasHealth ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Santé (vue CD)</h3>
          <dl className="text-sm">
            <div className="grid grid-cols-3 gap-2 py-1">
              <dt className="text-gray-500">Dernière sync</dt>
              <dd className="col-span-2">
                <HealthBadge status={health} /> {formatDateTime(node.lastSync)}
              </dd>
            </div>
            {node.sentMessages != null ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Msg envoyés (cumul)</dt>
                <dd className="col-span-2">{formatCount(node.sentMessages)}</dd>
              </div>
            ) : null}
            {node.receivedMessages != null ? (
              <div className="grid grid-cols-3 gap-2 py-1">
                <dt className="text-gray-500">Msg reçus (cumul)</dt>
                <dd className="col-span-2">{formatCount(node.receivedMessages)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {node.uploadTargets.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Cibles d'upload ({node.uploadTargets.length})</h3>
          <ul className="space-y-1 text-xs font-mono">
            {node.uploadTargets.map((eic) => {
              const target = graph?.nodes.find((n) => n.eic === eic) ?? null;
              return (
                <li key={eic}>
                  {target != null ? (
                    <button
                      type="button"
                      onClick={() => selectNode(eic)}
                      className="text-rte underline underline-offset-2 hover:text-red-800"
                      title={`Aller à ${target.displayName}`}
                    >
                      {eic}
                    </button>
                  ) : (
                    <span title="Cette cible n'est pas présente dans l'env courant">{eic}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {node.interlocutors.length > 0 ? (
        <div>
          <h3 className="mb-1 text-sm font-medium">Interlocuteurs ({node.interlocutors.length})</h3>
          <ul className="space-y-1 text-xs">
            {node.interlocutors.map((i) => {
              const target = graph?.nodes.find((n) => n.eic === i.eic) ?? null;
              const visibleTypes = i.messageTypes.slice(0, 3);
              const overflow = i.messageTypes.length - 3;
              return (
                <li key={i.eic} className="flex items-start gap-2">
                  <DirectionBadge direction={i.direction} />
                  <div className="min-w-0 flex-1">
                    <div className="font-mono">
                      {target != null ? (
                        <button
                          type="button"
                          onClick={() => selectNode(i.eic)}
                          className="text-rte underline underline-offset-2 hover:text-red-800"
                          title={`Aller à ${target.displayName}`}
                        >
                          {target.displayName || i.eic}
                        </button>
                      ) : (
                        <span title="Cet interlocuteur n'est pas présent dans l'env courant">
                          {i.eic}
                        </span>
                      )}
                    </div>
                    <div className="text-gray-500">
                      {visibleTypes.join(', ')}
                      {overflow > 0 && ` et ${overflow} autre${overflow > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
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

function HealthBadge({ status }: { status: 'healthy' | 'warning' | 'stale' | 'unknown' }): JSX.Element {
  const cfg = {
    healthy: { bg: 'bg-emerald-100 text-emerald-800', label: 'Frais' },
    warning: { bg: 'bg-amber-100 text-amber-800', label: '< 24h' },
    stale: { bg: 'bg-red-100 text-red-800', label: 'Obsolète' },
    unknown: { bg: 'bg-gray-100 text-gray-600', label: 'Inconnu' },
  }[status];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function formatCount(n: number): string {
  return n.toLocaleString('fr-FR');
}

function DirectionBadge({
  direction,
}: {
  direction: 'IN' | 'OUT' | 'BIDI';
}): JSX.Element {
  const cfg = {
    IN: { bg: 'bg-sky-100 text-sky-800', label: 'IN' },
    OUT: { bg: 'bg-emerald-100 text-emerald-800', label: 'OUT' },
    BIDI: { bg: 'bg-violet-100 text-violet-800', label: '⇄' },
  }[direction];
  return (
    <span
      className={`inline-flex h-5 min-w-[2rem] items-center justify-center rounded px-1 text-[10px] font-semibold ${cfg.bg}`}
    >
      {cfg.label}
    </span>
  );
}

function BaBadge({
  code,
  criticality,
}: {
  code: string;
  criticality: 'P1' | 'P2' | 'P3';
}): JSX.Element {
  const cfg = {
    P1: { bg: 'bg-red-100 text-red-800 border-red-200', label: 'P1' },
    P2: { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'P2' },
    P3: { bg: 'bg-gray-100 text-gray-700 border-gray-200', label: 'P3' },
  }[criticality];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.bg}`}
      title={`Criticité ${cfg.label}`}
    >
      <span className="font-mono">{code}</span>
      <span className="rounded bg-white/60 px-1 text-[9px] font-bold">{cfg.label}</span>
    </span>
  );
}
