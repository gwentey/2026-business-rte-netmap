import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import { useAppStore } from '../../store/app-store.js';
import { healthStatusFromLastSync } from '../Map/node-icon.js';
import { colorFor, PROCESS_COLORS } from '../../lib/process-colors.js';
import { DetailSection, Kv } from './DetailPanel.js';

const PROCESS_KEY_GUARD = new Set(Object.keys(PROCESS_COLORS));

function formatCount(n: number): string {
  return n.toLocaleString('fr-FR');
}

function HealthBadge({
  status,
}: {
  status: 'healthy' | 'warning' | 'stale' | 'unknown';
}): JSX.Element {
  if (status === 'healthy') return <span className="badge badge--ok">Frais</span>;
  if (status === 'warning') return <span className="badge badge--warn">&lt; 24h</span>;
  if (status === 'stale') return <span className="badge badge--err">Obsolète</span>;
  return <span className="badge badge--muted">Inconnu</span>;
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const isActive = status.toUpperCase() === 'ACTIVE';
  return (
    <span className={isActive ? 'badge badge--ok' : 'badge badge--muted'}>{status}</span>
  );
}

function DirectionBadge({
  direction,
}: {
  direction: 'IN' | 'OUT' | 'BIDI';
}): JSX.Element {
  if (direction === 'OUT') return <span className="badge badge--cyan">OUT</span>;
  if (direction === 'BIDI') return <span className="badge badge--teal">⇄</span>;
  return <span className="badge badge--cyan">IN</span>;
}

function BaBadge({
  code,
  criticality,
}: {
  code: string;
  criticality: 'P1' | 'P2' | 'P3';
}): JSX.Element {
  const variant =
    criticality === 'P1'
      ? 'badge--err'
      : criticality === 'P2'
        ? 'badge--warn'
        : 'badge--muted';
  return (
    <span className={`badge ${variant}`} title={`Criticité ${criticality}`}>
      <span className="mono">{code}</span>
      <span style={{ opacity: 0.7 }}>·</span>
      <span>{criticality}</span>
    </span>
  );
}

export function NodeDetails({ node }: { node: GraphNode }): JSX.Element {
  const graph = useAppStore((s) => s.graph);
  const selectNode = useAppStore((s) => s.selectNode);

  const showProjectChip =
    node.projectName != null && node.projectName !== node.displayName;

  const homeCdNode =
    node.homeCdCode != null
      ? graph?.nodes.find((n) => n.eic === node.homeCdCode) ?? null
      : null;

  const hasContact =
    node.personName != null || node.email != null || node.phone != null;
  const hasConfig = node.status != null || node.appTheme != null;
  const hasHealth =
    node.lastSync != null ||
    node.sentMessages != null ||
    node.receivedMessages != null;
  const health = healthStatusFromLastSync(node.lastSync);

  return (
    <>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink-0)',
          margin: '0 0 14px 0',
          wordBreak: 'break-word',
        }}
      >
        {node.displayName}
      </h2>

      {showProjectChip && (
        <DetailSection title="Projet ECP">
          <span className="badge badge--cyan mono">{node.projectName}</span>
        </DetailSection>
      )}

      {node.businessApplications.length > 0 && (
        <DetailSection title={`Applications métier (${node.businessApplications.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {node.businessApplications.map((ba) => (
              <BaBadge key={ba.code} code={ba.code} criticality={ba.criticality} />
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection title="Identité">
        <Kv label="EIC">
          <span className="mono">{node.eic}</span>
        </Kv>
        <Kv label="Type">{node.kind}</Kv>
        <Kv label="Environnement">{node.envName ?? '—'}</Kv>
        <Kv label="Organisation">{node.organization || '—'}</Kv>
        <Kv label="Pays">
          {node.country !== null && node.country !== undefined ? (
            <span className="badge badge--muted mono">{node.country}</span>
          ) : (
            '—'
          )}
        </Kv>
        <Kv label="Networks">{node.networks.join(', ') || '—'}</Kv>
        <Kv label="Processus">
          {node.process !== null &&
          node.process !== undefined &&
          PROCESS_KEY_GUARD.has(node.process) ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="swatch" style={{ background: colorFor(node.process) }} />
              <span className="mono">{node.process}</span>
            </span>
          ) : (
            node.process ?? '—'
          )}
        </Kv>
        {node.homeCdCode != null && (
          <Kv label="Home CD">
            {homeCdNode != null ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm mono"
                onClick={() => selectNode(node.homeCdCode)}
                style={{ padding: 0, height: 'auto', minHeight: 0 }}
              >
                {node.homeCdCode}
              </button>
            ) : (
              <span className="mono" title="CD absent de l'env courant">
                {node.homeCdCode}
              </span>
            )}
          </Kv>
        )}
      </DetailSection>

      <DetailSection title="Coordonnées">
        <Kv label="Latitude">
          <span className="mono">{node.lat.toFixed(4)}</span>
        </Kv>
        <Kv label="Longitude">
          <span className="mono">{node.lng.toFixed(4)}</span>
        </Kv>
        {node.isDefaultPosition && (
          <Kv label="⚠">
            <span style={{ color: 'var(--warn)' }}>Position par défaut</span>
          </Kv>
        )}
      </DetailSection>

      <DetailSection title="Métadonnées">
        <Kv label="Créé">
          <span className="mono">{formatDateTime(node.creationTs)}</span>
        </Kv>
        <Kv label="Modifié">
          <span className="mono">{formatDateTime(node.modificationTs)}</span>
        </Kv>
      </DetailSection>

      {hasContact && (
        <DetailSection title="Contact">
          {node.personName !== null && node.personName !== undefined && (
            <Kv label="Personne">{node.personName}</Kv>
          )}
          {node.email !== null && node.email !== undefined && (
            <Kv label="Email">
              <a href={`mailto:${node.email}`} style={{ color: 'var(--cyan-2)' }}>
                {node.email}
              </a>
            </Kv>
          )}
          {node.phone !== null && node.phone !== undefined && (
            <Kv label="Téléphone">
              <a
                href={`tel:${node.phone.replace(/\s+/g, '')}`}
                style={{ color: 'var(--cyan-2)' }}
              >
                {node.phone}
              </a>
            </Kv>
          )}
        </DetailSection>
      )}

      {hasConfig && (
        <DetailSection title="Config ECP">
          {node.status !== null && node.status !== undefined && (
            <Kv label="Statut">
              <StatusBadge status={node.status} />
            </Kv>
          )}
          {node.appTheme !== null && node.appTheme !== undefined && (
            <Kv label="Thème UI">{node.appTheme}</Kv>
          )}
        </DetailSection>
      )}

      {hasHealth && (
        <DetailSection title="Santé (vue CD)">
          <Kv label="Dernière sync">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <HealthBadge status={health} />
              <span className="mono">{formatDateTime(node.lastSync)}</span>
            </span>
          </Kv>
          {node.sentMessages != null && (
            <Kv label="Msg envoyés (cumul)">
              <span className="mono">{formatCount(node.sentMessages)}</span>
            </Kv>
          )}
          {node.receivedMessages != null && (
            <Kv label="Msg reçus (cumul)">
              <span className="mono">{formatCount(node.receivedMessages)}</span>
            </Kv>
          )}
        </DetailSection>
      )}

      {node.uploadTargets.length > 0 && (
        <DetailSection title={`Cibles d'upload (${node.uploadTargets.length})`}>
          <div className="detail-connections">
            {node.uploadTargets.map((eic) => {
              const target = graph?.nodes.find((n) => n.eic === eic) ?? null;
              return (
                <button
                  key={eic}
                  type="button"
                  className="detail-conn-row"
                  onClick={() => selectNode(eic)}
                  style={{ font: 'inherit', textAlign: 'left' }}
                >
                  <span className="swatch" style={{ background: 'var(--cyan-2)' }} />
                  <span className="mono">{eic}</span>
                  {target !== null && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
                      {target.displayName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DetailSection>
      )}

      {node.interlocutors.length > 0 && (
        <DetailSection title={`Interlocuteurs (${node.interlocutors.length})`}>
          <div className="detail-connections">
            {node.interlocutors.map((i) => {
              const target = graph?.nodes.find((n) => n.eic === i.eic) ?? null;
              const visibleTypes = i.messageTypes.slice(0, 3);
              const overflow = i.messageTypes.length - 3;
              return (
                <button
                  key={i.eic}
                  type="button"
                  className="detail-conn-row"
                  onClick={() => selectNode(i.eic)}
                  style={{ font: 'inherit', textAlign: 'left' }}
                >
                  <DirectionBadge direction={i.direction} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ color: 'var(--ink-0)' }}>
                      {target !== null ? target.displayName || i.eic : i.eic}
                    </div>
                    <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
                      {visibleTypes.join(', ')}
                      {overflow > 0 && ` et ${overflow} autre${overflow > 1 ? 's' : ''}`}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </DetailSection>
      )}

      {node.urls.length > 0 && (
        <DetailSection title="URLs">
          {node.urls.map((u, idx) => (
            <Kv key={idx} label={u.network}>
              <span className="mono" style={{ wordBreak: 'break-all' }}>
                {u.url}
              </span>
            </Kv>
          ))}
        </DetailSection>
      )}
    </>
  );
}
