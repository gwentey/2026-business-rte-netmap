import type { GraphEdge } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import styles from './details.module.scss';

export function EdgeDetails({ edge }: { edge: GraphEdge }): JSX.Element {
  const { activity } = edge;

  if (edge.kind === 'PEERING' && edge.peering != null) {
    const syncClass =
      edge.peering.syncMode === 'TWO_WAY' ? styles.syncTwoWay : styles.syncOneWay;
    return (
      <div className={styles.root}>
        <h2 className={styles.title}>Peering CD ↔ CD</h2>
        <dl className={styles.dl}>
          <DlRow term="De" value={<span className={styles.mono}>{edge.fromEic}</span>} />
          <DlRow term="Vers" value={<span className={styles.mono}>{edge.toEic}</span>} />
          <DlRow
            term="Mode sync"
            value={
              <span className={`${styles.badge} ${syncClass}`}>{edge.peering.syncMode}</span>
            }
          />
          {edge.peering.directoryType ? (
            <DlRow term="Type" value={edge.peering.directoryType} />
          ) : null}
          {edge.peering.synchronizationStatus ? (
            <DlRow term="Statut sync" value={edge.peering.synchronizationStatus} />
          ) : null}
          {edge.peering.directoryUrl ? (
            <DlRow
              term="URL partenaire"
              value={
                <span className={`${styles.mono} ${styles.small} ${styles.breakAll}`}>
                  {edge.peering.directoryUrl}
                </span>
              }
            />
          ) : null}
          <DlRow term="Dernier sync" value={formatDateTime(activity.lastMessageUp)} />
        </dl>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Flux {edge.process}</h2>
      <dl className={styles.dl}>
        <DlRow term="Sens" value={edge.direction} />
        <DlRow term="De" value={<span className={styles.mono}>{edge.fromEic}</span>} />
        <DlRow term="Vers" value={<span className={styles.mono}>{edge.toEic}</span>} />
        <DlRow term="Transport" value={edge.transportPatterns.join(', ')} />
        {edge.intermediateBrokerEic ? (
          <DlRow
            term="Broker"
            value={<span className={styles.mono}>{edge.intermediateBrokerEic}</span>}
          />
        ) : null}
        <DlRow term="Statut" value={<StatusBadge status={activity.connectionStatus} />} />
        <DlRow term="Dernière msg UP" value={formatDateTime(activity.lastMessageUp)} />
        <DlRow term="Dernière msg DOWN" value={formatDateTime(activity.lastMessageDown)} />
        <DlRow term="Actif récemment" value={activity.isRecent ? 'Oui' : 'Non'} />
        <DlRow term="Volume total" value={<VolumeBadge count={activity.totalVolume} />} />
        <DlRow term="Envoyés (UP)" value={formatCount(activity.sumMessagesUp)} />
        <DlRow term="Reçus (DOWN)" value={formatCount(activity.sumMessagesDown)} />
        <DlRow
          term="Validité"
          value={`${formatDateTime(edge.validFrom)} → ${formatDateTime(edge.validTo)}`}
        />
      </dl>
      <div>
        <h3 className={styles.sectionTitle}>Message types ({edge.messageTypes.length})</h3>
        <div className={styles.msgTypes}>
          {edge.messageTypes.map((mt) => (
            <span key={mt} className={styles.msgType}>
              {mt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DlRow({ term, value }: { term: string; value: React.ReactNode }): JSX.Element {
  return (
    <div className={styles.dlRow}>
      <dt className={styles.dlTerm}>{term}</dt>
      <dd className={styles.dlValue}>{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }): JSX.Element {
  if (status == null) return <span className={`${styles.small} ${styles.muted}`}>—</span>;
  const s = status.toUpperCase();
  let variant = styles.statusNeutral;
  if (s === 'CONNECTED') variant = styles.statusActive;
  else if (s === 'NOT_CONNECTED') variant = styles.statusNotConnected;
  return <span className={`${styles.badge} ${variant}`}>{status}</span>;
}

function VolumeBadge({ count }: { count: number }): JSX.Element {
  if (count === 0) return <span className={styles.volumeZero}>Aucun</span>;
  return <span className={styles.volumePositive}>{formatCount(count)}</span>;
}

function formatCount(n: number): string {
  if (n === 0) return '0';
  return n.toLocaleString('fr-FR');
}
