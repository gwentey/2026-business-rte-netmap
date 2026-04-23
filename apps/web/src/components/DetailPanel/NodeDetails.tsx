import type { GraphNode } from '@carto-ecp/shared';
import { formatDateTime } from '../../lib/format.js';
import { useAppStore } from '../../store/app-store.js';
import { healthStatusFromLastSync } from '../Map/node-icon.js';
import styles from './details.module.scss';

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
    <div className={styles.root}>
      <div>
        <h2 className={styles.title}>{node.displayName}</h2>
        {showProjectChip ? (
          <p className={styles.projectChip}>
            Projet ECP :{' '}
            <span className={styles.projectBadge}>{node.projectName}</span>
          </p>
        ) : null}
      </div>

      {node.businessApplications.length > 0 ? (
        <div>
          <h3 className={styles.sectionTitle}>
            Applications métier ({node.businessApplications.length})
          </h3>
          <div className={styles.badges}>
            {node.businessApplications.map((ba) => (
              <BaBadge key={ba.code} code={ba.code} criticality={ba.criticality} />
            ))}
          </div>
        </div>
      ) : null}
      <dl className={styles.dl}>
        <DlRow term="EIC" value={<span className={styles.mono}>{node.eic}</span>} />
        <DlRow term="Type" value={node.kind} />
        <DlRow term="Environnement" value={node.envName ?? '—'} />
        <DlRow term="Organisation" value={node.organization || '—'} />
        <DlRow term="Pays" value={node.country ?? '—'} />
        <DlRow term="Networks" value={node.networks.join(', ') || '—'} />
        <DlRow term="Processus" value={node.process ?? '—'} />
        {node.homeCdCode != null ? (
          <DlRow
            term="Home CD"
            value={
              <span className={`${styles.mono} ${styles.small}`}>
                {homeCdNode != null ? (
                  <button
                    type="button"
                    onClick={() => selectNode(node.homeCdCode)}
                    className={styles.link}
                    title={`Aller à ${homeCdNode.displayName}`}
                  >
                    {node.homeCdCode}
                  </button>
                ) : (
                  <span title="Ce CD n'est pas présent dans l'env courant">
                    {node.homeCdCode}
                  </span>
                )}
              </span>
            }
          />
        ) : null}
        <DlRow term="Créé" value={formatDateTime(node.creationTs)} />
        <DlRow term="Modifié" value={formatDateTime(node.modificationTs)} />
      </dl>

      {hasContact ? (
        <div>
          <h3 className={styles.sectionTitle}>Contact</h3>
          <dl className={styles.dl}>
            {node.personName ? (
              <DlRow term="Personne" value={node.personName} />
            ) : null}
            {node.email ? (
              <DlRow
                term="Email"
                value={
                  <a href={`mailto:${node.email}`} className={styles.link}>
                    {node.email}
                  </a>
                }
              />
            ) : null}
            {node.phone ? (
              <DlRow
                term="Téléphone"
                value={
                  <a
                    href={`tel:${node.phone.replace(/\s+/g, '')}`}
                    className={styles.link}
                  >
                    {node.phone}
                  </a>
                }
              />
            ) : null}
          </dl>
        </div>
      ) : null}

      {hasConfig ? (
        <div>
          <h3 className={styles.sectionTitle}>Config ECP</h3>
          <dl className={styles.dl}>
            {node.status ? (
              <DlRow term="Statut" value={<StatusBadge status={node.status} />} />
            ) : null}
            {node.appTheme ? (
              <DlRow term="Thème UI" value={<span className={styles.small}>{node.appTheme}</span>} />
            ) : null}
          </dl>
        </div>
      ) : null}

      {hasHealth ? (
        <div>
          <h3 className={styles.sectionTitle}>Santé (vue CD)</h3>
          <dl className={styles.dl}>
            <DlRow
              term="Dernière sync"
              value={
                <>
                  <HealthBadge status={health} /> {formatDateTime(node.lastSync)}
                </>
              }
            />
            {node.sentMessages != null ? (
              <DlRow term="Msg envoyés (cumul)" value={formatCount(node.sentMessages)} />
            ) : null}
            {node.receivedMessages != null ? (
              <DlRow term="Msg reçus (cumul)" value={formatCount(node.receivedMessages)} />
            ) : null}
          </dl>
        </div>
      ) : null}

      {node.uploadTargets.length > 0 ? (
        <div>
          <h3 className={styles.sectionTitle}>
            Cibles d'upload ({node.uploadTargets.length})
          </h3>
          <ul className={styles.urlList}>
            {node.uploadTargets.map((eic) => {
              const target = graph?.nodes.find((n) => n.eic === eic) ?? null;
              return (
                <li key={eic}>
                  {target != null ? (
                    <button
                      type="button"
                      onClick={() => selectNode(eic)}
                      className={styles.link}
                      title={`Aller à ${target.displayName}`}
                    >
                      {eic}
                    </button>
                  ) : (
                    <span title="Cette cible n'est pas présente dans l'env courant">
                      {eic}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {node.interlocutors.length > 0 ? (
        <div>
          <h3 className={styles.sectionTitle}>
            Interlocuteurs ({node.interlocutors.length})
          </h3>
          <ul className={styles.list}>
            {node.interlocutors.map((i) => {
              const target = graph?.nodes.find((n) => n.eic === i.eic) ?? null;
              const visibleTypes = i.messageTypes.slice(0, 3);
              const overflow = i.messageTypes.length - 3;
              return (
                <li key={i.eic} className={styles.listItem}>
                  <DirectionBadge direction={i.direction} />
                  <div className={styles.interlocutorBody}>
                    <div className={styles.mono}>
                      {target != null ? (
                        <button
                          type="button"
                          onClick={() => selectNode(i.eic)}
                          className={styles.link}
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
                    <div className={styles.interlocutorTypes}>
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
          <h3 className={styles.sectionTitle}>URLs</h3>
          <ul className={styles.urlList}>
            {node.urls.map((u, idx) => (
              <li key={idx}>
                <span className={styles.urlNetwork}>{u.network}</span> — {u.url}
              </li>
            ))}
          </ul>
        </div>
      )}
      {node.isDefaultPosition ? (
        <p className={styles.defaultPositionNotice}>
          Position par défaut (EIC non géolocalisé dans le registry)
        </p>
      ) : null}
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

function StatusBadge({ status }: { status: string }): JSX.Element {
  const isActive = status.toUpperCase() === 'ACTIVE';
  const className = `${styles.badge} ${isActive ? styles.statusActive : styles.statusNeutral}`;
  return <span className={className}>{status}</span>;
}

function HealthBadge({
  status,
}: {
  status: 'healthy' | 'warning' | 'stale' | 'unknown';
}): JSX.Element {
  let classes = styles.healthUnknown;
  let label = 'Inconnu';
  if (status === 'healthy') {
    classes = styles.healthFresh;
    label = 'Frais';
  } else if (status === 'warning') {
    classes = styles.healthWarning;
    label = '< 24h';
  } else if (status === 'stale') {
    classes = styles.healthStale;
    label = 'Obsolète';
  }
  return <span className={`${styles.badge} ${classes}`}>{label}</span>;
}

function formatCount(n: number): string {
  return n.toLocaleString('fr-FR');
}

function DirectionBadge({
  direction,
}: {
  direction: 'IN' | 'OUT' | 'BIDI';
}): JSX.Element {
  let classes = styles.directionIn;
  let label = 'IN';
  if (direction === 'OUT') {
    classes = styles.directionOut;
    label = 'OUT';
  } else if (direction === 'BIDI') {
    classes = styles.directionBidi;
    label = '⇄';
  }
  return <span className={`${styles.directionBadge} ${classes}`}>{label}</span>;
}

function BaBadge({
  code,
  criticality,
}: {
  code: string;
  criticality: 'P1' | 'P2' | 'P3';
}): JSX.Element {
  let classes = styles.baP3;
  if (criticality === 'P1') classes = styles.baP1;
  else if (criticality === 'P2') classes = styles.baP2;
  return (
    <span
      className={`${styles.baBadge} ${classes}`}
      title={`Criticité ${criticality}`}
    >
      <span className={styles.baCode}>{code}</span>
      <span className={styles.baCrit}>{criticality}</span>
    </span>
  );
}
