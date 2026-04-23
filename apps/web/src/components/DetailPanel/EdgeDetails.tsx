import type { GraphEdge } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import { colorFor, PROCESS_COLORS } from '../../lib/process-colors.js';
import { DetailSection, Kv } from './DetailPanel.js';

const PROCESS_KEY_GUARD = new Set(Object.keys(PROCESS_COLORS));

function StatusBadge({ status }: { status: string | null }): JSX.Element {
  if (status == null) return <span style={{ color: 'var(--ink-3)' }}>—</span>;
  const s = status.toUpperCase();
  if (s === 'CONNECTED') return <span className="badge badge--ok">{status}</span>;
  if (s === 'NOT_CONNECTED') return <span className="badge badge--err">{status}</span>;
  return <span className="badge badge--muted">{status}</span>;
}

function VolumeBadge({ count }: { count: number }): JSX.Element {
  if (count === 0) return <span style={{ color: 'var(--ink-3)' }}>Aucun</span>;
  return <span className="mono">{count.toLocaleString('fr-FR')}</span>;
}

function formatCount(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('fr-FR');
}

export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
  const { activity } = edge;

  if (edge.kind === 'PEERING' && edge.peering != null) {
    return (
      <>
        <h2
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--ink-0)',
            margin: '0 0 14px 0',
          }}
        >
          Peering CD ↔ CD
        </h2>
        <DetailSection title="Peering">
          <Kv label="De">
            <span className="mono">{edge.fromEic}</span>
          </Kv>
          <Kv label="Vers">
            <span className="mono">{edge.toEic}</span>
          </Kv>
          <Kv label="Mode sync">
            <span
              className={
                edge.peering.syncMode === 'TWO_WAY'
                  ? 'badge badge--ok'
                  : 'badge badge--muted'
              }
            >
              {edge.peering.syncMode}
            </span>
          </Kv>
          {edge.peering.directoryType !== null &&
            edge.peering.directoryType !== undefined && (
              <Kv label="Type">{edge.peering.directoryType}</Kv>
            )}
          {edge.peering.synchronizationStatus !== null &&
            edge.peering.synchronizationStatus !== undefined && (
              <Kv label="Statut sync">{edge.peering.synchronizationStatus}</Kv>
            )}
          {edge.peering.directoryUrl !== null &&
            edge.peering.directoryUrl !== undefined && (
              <Kv label="URL partenaire">
                <span className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                  {edge.peering.directoryUrl}
                </span>
              </Kv>
            )}
          <Kv label="Dernier sync">
            <span className="mono">{formatDateTime(activity.lastMessageUp)}</span>
          </Kv>
        </DetailSection>
      </>
    );
  }

  return (
    <>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--ink-0)',
          margin: '0 0 14px 0',
        }}
      >
        Flux {edge.process ?? '—'}
      </h2>
      <DetailSection title="Processus">
        <Kv label="Type">
          {edge.process !== null &&
          edge.process !== undefined &&
          PROCESS_KEY_GUARD.has(edge.process) ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="swatch" style={{ background: colorFor(edge.process) }} />
              <span className="mono">{edge.process}</span>
            </span>
          ) : (
            edge.process ?? '—'
          )}
        </Kv>
        <Kv label="Sens">{edge.direction}</Kv>
        <Kv label="Transport">{edge.transportPatterns.join(', ') || '—'}</Kv>
        {edge.intermediateBrokerEic !== null &&
          edge.intermediateBrokerEic !== undefined && (
            <Kv label="Broker">
              <span className="mono">{edge.intermediateBrokerEic}</span>
            </Kv>
          )}
      </DetailSection>

      <DetailSection title="Extrémités">
        <div className="detail-endpoint">
          <span className="badge badge--teal">A</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ color: 'var(--ink-0)', fontWeight: 600 }}>
              {edge.fromEic}
            </div>
          </div>
        </div>
        <div className="detail-endpoint">
          <span className="badge badge--teal">B</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="mono" style={{ color: 'var(--ink-0)', fontWeight: 600 }}>
              {edge.toEic}
            </div>
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Activité">
        <Kv label="Statut">
          <StatusBadge status={activity.connectionStatus} />
        </Kv>
        <Kv label="Dernière msg UP">
          <span className="mono">{formatDateTime(activity.lastMessageUp)}</span>
        </Kv>
        <Kv label="Dernière msg DOWN">
          <span className="mono">{formatDateTime(activity.lastMessageDown)}</span>
        </Kv>
        <Kv label="Actif récemment">
          {activity.isRecent ? (
            <span className="badge badge--ok">Oui</span>
          ) : (
            <span className="badge badge--muted">Non</span>
          )}
        </Kv>
        <Kv label="Volume total">
          <VolumeBadge count={activity.totalVolume} />
        </Kv>
        <Kv label="Envoyés (UP)">
          <span className="mono">{formatCount(activity.sumMessagesUp)}</span>
        </Kv>
        <Kv label="Reçus (DOWN)">
          <span className="mono">{formatCount(activity.sumMessagesDown)}</span>
        </Kv>
        <Kv label="Validité">
          <span className="mono" style={{ fontSize: 11 }}>
            {formatDateTime(edge.validFrom)} → {formatDateTime(edge.validTo)}
          </span>
        </Kv>
      </DetailSection>

      {edge.messageTypes.length > 0 && (
        <DetailSection title={`Message types (${edge.messageTypes.length})`}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {edge.messageTypes.map((mt) => (
              <span key={mt} className="badge badge--muted mono" style={{ fontSize: 10 }}>
                {mt}
              </span>
            ))}
          </div>
        </DetailSection>
      )}
    </>
  );
}
