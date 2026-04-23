import { useState } from 'react';
import { api } from '../../lib/api.js';
import styles from './DangerZoneTab.module.scss';

type Action = 'purge-imports' | 'purge-overrides' | 'purge-all';

const ACTION_CONFIG: Record<Action, { label: string; description: string; keyword: string }> = {
  'purge-imports': {
    label: 'Purger tous les imports',
    description:
      "Supprime TOUS les imports (tous envs), tous les composants et paths associés, et les zips stockés sur disque. Les overrides et l'annuaire ENTSO-E ne sont pas touchés.",
    keyword: 'PURGER',
  },
  'purge-overrides': {
    label: 'Purger toutes les surcharges',
    description:
      "Supprime TOUS les ComponentOverride. Les imports et l'annuaire ENTSO-E ne sont pas touchés.",
    keyword: 'PURGER',
  },
  'purge-all': {
    label: '⚠ Reset total (imports + overrides + ENTSO-E)',
    description:
      "DÉTRUIT toutes les données applicatives : imports + composants + paths + overrides + entrées ENTSO-E. Le registry RTE (fichier JSON) n'est pas touché.",
    keyword: 'RESET',
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
      } else if (pending === 'purge-overrides') {
        const r = await api.purgeOverridesAll();
        setResult(`${r.deletedCount} surcharges supprimées.`);
      } else if (pending === 'purge-all') {
        const r = await api.purgeAll();
        setResult(
          `Reset total : ${r.imports} imports + ${r.overrides} overrides + ${r.entsoe} entrées ENTSO-E.`,
        );
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
    <div className={styles.container}>
      <h2 className={styles.title}>⚠ Zone danger</h2>
      <p className={styles.intro}>
        Les actions ci-dessous sont <strong>irréversibles</strong>. Une confirmation par saisie de
        mot-clé est requise.
      </p>

      <div className={styles.actionsList}>
        {(Object.keys(ACTION_CONFIG) as Action[]).map((action) => {
          const cfg = ACTION_CONFIG[action];
          return (
            <div key={action} className={styles.actionCard}>
              <p className={styles.actionLabel}>{cfg.label}</p>
              <p className={styles.actionDescription}>{cfg.description}</p>
              <button
                type="button"
                onClick={() => openConfirm(action)}
                className={styles.actionButton}
              >
                {cfg.label}
              </button>
            </div>
          );
        })}
      </div>

      {result !== null ? <p className={styles.alertSuccess}>{result}</p> : null}
      {error !== null ? (
        <p className={styles.alertError} role="alert">
          {error}
        </p>
      ) : null}

      {pending !== null && pendingCfg !== null ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>{pendingCfg.label}</h3>
            <p className={styles.modalDescription}>{pendingCfg.description}</p>
            <p className={styles.modalHint}>
              Tapez exactement <code>{pendingCfg.keyword}</code> pour confirmer :
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className={styles.modalInput}
              aria-label="Confirmation"
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={running}
                className={styles.cancelButton}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  void execute();
                }}
                disabled={!canConfirm || running}
                className={styles.confirmButton}
              >
                {running ? 'Exécution…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
