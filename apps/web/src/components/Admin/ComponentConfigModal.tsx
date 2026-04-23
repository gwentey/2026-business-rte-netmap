import { useEffect, useState } from 'react';
import type { ComponentConfigResponse } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';
import styles from './ComponentConfigModal.module.scss';

type Props = {
  eic: string;
  onClose: () => void;
};

export function ComponentConfigModal({ eic, onClose }: Props): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComponentConfigResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getComponentConfig(eic)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [eic]);

  return (
    <div
      className={styles.backdrop}
      role="dialog"
      aria-modal="true"
      aria-label={`Configuration ECP de ${eic}`}
    >
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.headerTitle}>Configuration ECP</h3>
            <p className={styles.eic}>{eic}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {loading ? <p className={styles.loading}>Chargement…</p> : null}
          {error ? (
            <p className={styles.alertError} role="alert">
              {error}
            </p>
          ) : null}
          {!loading && !error && data != null ? <ConfigContent data={data} /> : null}
        </div>
      </div>
    </div>
  );
}

function ConfigContent({ data }: { data: ComponentConfigResponse }): JSX.Element {
  if (data.source == null) {
    return (
      <div className={styles.noSource}>
        Aucun dump dans la base n'a ce composant comme source ; impossible d'afficher ses
        propriétés. Importez un dump du composant {data.eic} pour voir sa configuration ECP.
      </div>
    );
  }

  return (
    <div className={styles.contentWrapper}>
      <div className={styles.sourceBox}>
        <div className={styles.sourceRow}>
          <span>
            Import source : <strong className={styles.sourceMono}>{data.source.label}</strong>
            {' · '}
            <span>env {data.source.envName}</span>
            {' · '}
            <span>
              {new Date(data.source.uploadedAt).toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </span>
          <span
            className={`${styles.propsBadge} ${
              data.source.hasConfigurationProperties
                ? styles.propsBadgeOk
                : styles.propsBadgeMissing
            }`}
            title={
              data.source.hasConfigurationProperties
                ? ".properties externe fourni à l'ingestion"
                : 'Valeurs issues uniquement du CSV interne au zip'
            }
          >
            {data.source.hasConfigurationProperties ? '✓ Properties' : '✗ Properties'}
          </span>
        </div>
      </div>

      {data.sections.map((section) => (
        <section key={section.slug} className={styles.section}>
          <h4 className={styles.sectionHeader}>
            {section.name}{' '}
            <span className={styles.sectionCount}>({section.properties.length})</span>
          </h4>
          <dl className={styles.propsList}>
            {section.properties.map((p) => (
              <div key={p.key} className={styles.propRow}>
                <dt className={styles.propKey}>{p.key}</dt>
                <dd className={styles.propValue}>
                  {p.value === '' ? <span className={styles.emptyValue}>(vide)</span> : p.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {data.sections.length === 0 ? (
        <p className={styles.emptySections}>
          L'import source n'a persisté aucune propriété `ecp.*` pour ce composant.
        </p>
      ) : null}
    </div>
  );
}
