import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';

/**
 * Composants d'état pour la carte (Empty / Loading / Error). Markup
 * `.map-overlay-state > .state-card` défini dans `styles/pages.scss`.
 */

export function MapEmptyState({ envName }: { envName: string | null }): JSX.Element {
  const target =
    envName !== null
      ? `/upload?env=${encodeURIComponent(envName)}`
      : '/upload';
  return (
    <StateOverlay>
      <div className="state-card">
        <div className="state-card__icon">∅</div>
        <div className="state-card__title">Aucun snapshot disponible</div>
        <div className="state-card__body">
          {envName !== null ? (
            <>
              L'environnement <strong className="mono">{envName}</strong> n'a pas encore
              reçu de dump ECP. Importez un premier ZIP pour démarrer la
              visualisation.
            </>
          ) : (
            <>
              Aucun environnement actif. Importez un dump ECP pour amorcer la
              base.
            </>
          )}
        </div>
        <div className="state-card__actions">
          <Link className="btn btn--primary btn--lg" to={target}>
            Importer un dump →
          </Link>
        </div>
      </div>
    </StateOverlay>
  );
}

export function MapLoadingState(): JSX.Element {
  return (
    <StateOverlay>
      <div className="state-card">
        <span
          className="dot-pulse"
          style={{ width: 14, height: 14, marginBottom: 16 }}
          aria-hidden
        />
        <div className="state-card__title">Chargement du snapshot…</div>
        <div className="state-card__body">
          Récupération de la topologie auprès de l'API.
        </div>
      </div>
    </StateOverlay>
  );
}

export function MapErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <StateOverlay>
      <div className="state-card state-card--error">
        <div className="state-card__icon state-card__icon--error">!</div>
        <div className="state-card__title state-card__title--error">
          Impossible de charger le snapshot
        </div>
        <div className="state-card__body state-card__body--error">{message}</div>
        <div className="state-card__actions">
          {onRetry !== undefined && (
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              Réessayer
            </button>
          )}
        </div>
      </div>
    </StateOverlay>
  );
}

function StateOverlay({ children }: { children: ReactNode }): JSX.Element {
  return <div className="map-overlay-state">{children}</div>;
}
