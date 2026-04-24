import { useState } from 'react';
import { api } from '../../lib/api.js';

type Action =
  | 'replay-imports'
  | 'purge-imports'
  | 'reset-overrides'
  | 'maintenance'
  | 'purge-all';

interface ActionConfig {
  label: string;
  icon: string;
  description: string;
  keyword: string;
  variant: 'outline' | 'solid';
  /** false = endpoint backend non encore disponible (UI stub). */
  enabled: boolean;
}

const ACTION_CONFIG: Record<Action, ActionConfig> = {
  'replay-imports': {
    label: "Rejouer l'intégralité des imports",
    icon: '⟲',
    description:
      "Purge la base puis rejoue tous les snapshots archivés dans l'ordre chronologique. Durée estimée : ~45 min. Rend la carte indisponible pendant l'opération.",
    keyword: 'REJOUER',
    variant: 'outline',
    enabled: false,
  },
  'purge-imports': {
    label: "Purger l'historique des snapshots",
    icon: '✕',
    description:
      "Supprime TOUS les imports (tous envs), tous les composants et paths associés, et les zips stockés sur disque. Les overrides et l'annuaire ENTSO-E ne sont pas touchés.",
    keyword: 'PURGER',
    variant: 'outline',
    enabled: true,
  },
  'reset-overrides': {
    label: 'Réinitialiser les overrides manuels',
    icon: '⟳',
    description:
      "Remet tous les composants surchargés (displayName, lat/lng, org, pays) à leur valeur importée d'origine. Supprime tous les overrides actuels.",
    keyword: 'RÉINITIALISER',
    variant: 'outline',
    enabled: true,
  },
  maintenance: {
    label: 'Activer le mode maintenance',
    icon: '⏸',
    description:
      "Met l'application en lecture seule. Bloque les imports et l'édition de composants pour tous les utilisateurs non-admin.",
    keyword: 'ACTIVER',
    variant: 'solid',
    enabled: false,
  },
  'purge-all': {
    label: 'Détruire la base de données',
    icon: '💣',
    description:
      "DÉTRUIT toutes les données applicatives : imports + composants + paths + overrides + entrées ENTSO-E. Le registry RTE (fichier JSON) n'est pas touché.",
    keyword: 'JE COMPRENDS · DÉTRUIRE',
    variant: 'solid',
    enabled: true,
  },
};

export function DangerZoneTab(): JSX.Element {
  const [pending, setPending] = useState<Action | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openConfirm = (action: Action): void => {
    setPending(action);
    setConfirmText('');
    setResult(null);
    setError(null);
  };

  const closeConfirm = (): void => {
    setPending(null);
    setConfirmText('');
  };

  const execute = async (): Promise<void> => {
    if (pending === null) return;
    setRunning(true);
    setError(null);
    try {
      if (pending === 'purge-imports') {
        const r = await api.purgeImportsAll();
        setResult(`${r.deletedCount} imports supprimés.`);
      } else if (pending === 'reset-overrides') {
        const r = await api.purgeOverridesAll();
        setResult(`${r.deletedCount} surcharges réinitialisées.`);
      } else if (pending === 'purge-all') {
        const r = await api.purgeAll();
        setResult(
          `Reset total : ${r.imports} imports + ${r.overrides} overrides + ${r.entsoe} entrées ENTSO-E.`,
        );
      } else {
        // Stubs UI : endpoint backend à venir
        setResult(`Action « ${pendingCfg?.label} » — endpoint backend à venir.`);
      }
      closeConfirm();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  const pendingCfg = pending !== null ? ACTION_CONFIG[pending] : null;
  const canConfirm = pendingCfg !== null && confirmText === pendingCfg.keyword;

  return (
    <>
      <div className="banner banner--err" style={{ marginBottom: 20 }}>
        <div className="banner__ico">⚠</div>
        <div>
          <b style={{ color: 'var(--err-strong)' }}>Zone protégée — actions irréversibles.</b>{' '}
          Conformément à l'ADR-040, c'est la seule zone de l'application habilitée à
          utiliser le rouge d'alerte. Une confirmation par saisie de mot-clé est requise.
        </div>
      </div>

      {(Object.keys(ACTION_CONFIG) as Action[]).map((action) => {
        const cfg = ACTION_CONFIG[action];
        return (
          <div className="danger-card" key={action}>
            <div className="danger-card__icon" aria-hidden>
              {cfg.icon}
            </div>
            <div className="danger-card__body">
              <h3>{cfg.label}</h3>
              <p>
                {cfg.description}
                {!cfg.enabled && (
                  <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>
                    {' '}
                    (Endpoint backend à venir.)
                  </span>
                )}
              </p>
            </div>
            <button
              type="button"
              className={
                cfg.variant === 'solid' ? 'btn btn--danger' : 'btn btn--danger-outline'
              }
              onClick={() => openConfirm(action)}
              aria-label={cfg.label}
              disabled={!cfg.enabled}
              title={cfg.enabled ? undefined : 'Endpoint backend à venir'}
            >
              {cfg.keyword}
            </button>
          </div>
        );
      })}

      {result !== null && (
        <div className="banner banner--ok" style={{ marginTop: 16 }}>
          <div className="banner__ico">✓</div>
          <div>{result}</div>
        </div>
      )}

      {error !== null && (
        <div className="banner banner--err" role="alert" style={{ marginTop: 16 }}>
          <div className="banner__ico">!</div>
          <div>{error}</div>
        </div>
      )}

      {pending !== null && pendingCfg !== null && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal__head">
              <div>
                <div className="modal__kicker" style={{ color: 'var(--err)' }}>
                  Action irréversible
                </div>
                <h3>{pendingCfg.label}</h3>
              </div>
            </div>
            <div className="modal__body">
              <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.5 }}>
                {pendingCfg.description}
              </p>
              <div className="confirm-line" style={{ marginTop: 16 }}>
                <span>
                  Tapez exactement{' '}
                  <code
                    className="mono"
                    style={{
                      background: 'var(--dark-1)',
                      padding: '2px 6px',
                      borderRadius: 3,
                      color: 'var(--err)',
                    }}
                  >
                    {pendingCfg.keyword}
                  </code>{' '}
                  pour confirmer :
                </span>
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="input mono"
                aria-label="Confirmation"
                autoFocus
                style={{ marginTop: 8, width: '100%' }}
              />
            </div>
            <div className="modal__foot">
              <button
                type="button"
                className="btn btn--outline"
                onClick={closeConfirm}
                disabled={running}
              >
                Annuler
              </button>
              <button
                type="button"
                className="btn btn--danger"
                onClick={() => {
                  void execute();
                }}
                disabled={!canConfirm || running}
              >
                {running ? 'Exécution…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
