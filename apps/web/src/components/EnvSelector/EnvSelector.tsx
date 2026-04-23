import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/app-store.js';

/**
 * EnvSelector — chip teal interactif intégré dans l'AppHeader (ADR-040).
 * Markup `.env-selector` défini dans `styles/components.scss`.
 *
 * Comportement : clic ouvre une mini-popover avec la liste des envs disponibles.
 * Préserve la logique store actuelle (`envs`, `activeEnv`, `setActiveEnv`).
 */
export function EnvSelector(): JSX.Element {
  const envs = useAppStore((s) => s.envs);
  const activeEnv = useAppStore((s) => s.activeEnv);
  const setActiveEnv = useAppStore((s) => s.setActiveEnv);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [open]);

  if (envs.length === 0) {
    return (
      <div className="env-selector" aria-disabled="true">
        <span className="env-selector__label">Env</span>
        <span className="badge badge--muted mono">aucun</span>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="env-selector"
      role="button"
      tabIndex={0}
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      <span className="env-selector__label">Env</span>
      <span className="env-chip">{activeEnv ?? envs[0]}</span>
      <span className="env-caret">▾</span>

      {open && (
        <ul
          role="listbox"
          aria-label="Choisir un environnement"
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            background: 'var(--dark-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            padding: 4,
            minWidth: 160,
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
            listStyle: 'none',
            margin: 0,
          }}
        >
          {envs.map((env) => {
            const isActive = env === activeEnv;
            return (
              <li key={env}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  aria-label={env}
                  className="btn btn--ghost"
                  style={{
                    width: '100%',
                    justifyContent: 'flex-start',
                    height: 28,
                    fontSize: 12.5,
                    color: isActive ? 'var(--cyan-1)' : 'var(--ink-2)',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    void setActiveEnv(env);
                  }}
                >
                  <span
                    className="mono"
                    style={{ marginRight: 'auto' }}
                  >
                    {env}
                  </span>
                  {isActive && <span style={{ color: 'var(--cyan-2)' }}>✓</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
