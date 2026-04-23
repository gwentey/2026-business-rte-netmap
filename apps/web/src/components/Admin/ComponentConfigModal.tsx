import { useEffect, useState } from 'react';
import type { ComponentConfigResponse } from '@carto-ecp/shared';
import { api } from '../../lib/api.js';

const CloseIcon = (): JSX.Element => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    aria-hidden
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

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
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Configuration ECP de ${eic}`}
    >
      <div className="modal modal--lg">
        <div className="modal__head">
          <div>
            <div className="modal__kicker">Configuration ECP</div>
            <h3 className="mono">{eic}</h3>
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Fermer"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="modal__body scroll">
          {loading && (
            <p style={{ color: 'var(--ink-3)', textAlign: 'center', padding: 18 }}>
              Chargement…
            </p>
          )}
          {error !== null && (
            <div className="banner banner--err" role="alert">
              <div className="banner__ico">!</div>
              <div>{error}</div>
            </div>
          )}
          {!loading && error === null && data !== null && <ConfigContent data={data} />}
        </div>

        <div className="modal__foot">
          <button type="button" className="btn btn--outline" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigContent({ data }: { data: ComponentConfigResponse }): JSX.Element {
  if (data.source === null) {
    return (
      <div className="banner banner--warn">
        <div className="banner__ico">!</div>
        <div>
          Aucun dump dans la base n'a ce composant comme source. Importez un dump de{' '}
          <span className="mono">{data.eic}</span> pour voir sa configuration ECP.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          padding: 12,
          background: 'var(--dark-1)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          fontSize: 12,
        }}
      >
        <span>
          Import source :{' '}
          <strong className="mono" style={{ color: 'var(--cyan-1)' }}>
            {data.source.label}
          </strong>{' '}
          · env <strong>{data.source.envName}</strong> ·{' '}
          <span style={{ color: 'var(--ink-3)' }}>
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
          className={
            data.source.hasConfigurationProperties
              ? 'badge badge--ok'
              : 'badge badge--muted'
          }
          title={
            data.source.hasConfigurationProperties
              ? '.properties externe fourni'
              : 'CSV interne uniquement'
          }
        >
          {data.source.hasConfigurationProperties ? '✓ Properties' : '✗ Properties'}
        </span>
      </div>

      {data.sections.map((section) => (
        <section key={section.slug}>
          <h4
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              margin: '0 0 8px 0',
            }}
          >
            {section.name}{' '}
            <span style={{ color: 'var(--ink-4)' }}>({section.properties.length})</span>
          </h4>
          <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.properties.map((p) => (
              <div
                key={p.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  gap: 8,
                  padding: '4px 0',
                  fontSize: 12,
                }}
              >
                <dt
                  className="mono"
                  style={{ color: 'var(--ink-3)', wordBreak: 'break-word' }}
                >
                  {p.key}
                </dt>
                <dd
                  className="mono"
                  style={{
                    margin: 0,
                    color: 'var(--ink-1)',
                    wordBreak: 'break-all',
                  }}
                >
                  {p.value === '' ? (
                    <span style={{ color: 'var(--ink-4)' }}>(vide)</span>
                  ) : (
                    p.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      {data.sections.length === 0 && (
        <p style={{ color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
          L'import source n'a persisté aucune propriété <span className="mono">ecp.*</span>{' '}
          pour ce composant.
        </p>
      )}
    </div>
  );
}
