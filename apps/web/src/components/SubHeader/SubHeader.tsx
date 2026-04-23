import { Fragment, type ReactNode } from 'react';

interface SubHeaderProps {
  /** Segments de breadcrumb. Le dernier est rendu en couleur ink-1 (actif). */
  breadcrumb: string[];
  /** Contenu aligné à droite (boutons, badges, statut). */
  right?: ReactNode;
}

/**
 * SubHeader — bandeau page 48px (ADR-040). Réutilisé par chaque page.
 * Markup `.sub-header` défini dans `styles/components.scss`.
 */
export function SubHeader({ breadcrumb, right }: SubHeaderProps): JSX.Element {
  return (
    <div className="sub-header">
      <div className="breadcrumb">
        {breadcrumb.map((segment, i) => (
          <Fragment key={`${segment}-${i}`}>
            {i > 0 && <span className="sep">/</span>}
            <span style={{ color: i === breadcrumb.length - 1 ? 'var(--ink-1)' : 'var(--ink-3)' }}>
              {segment}
            </span>
          </Fragment>
        ))}
      </div>
      {right !== undefined && <div className="sh-right">{right}</div>}
    </div>
  );
}
