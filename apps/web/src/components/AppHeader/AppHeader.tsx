import { Link, NavLink } from 'react-router-dom';
import { EnvSelector } from '../EnvSelector/EnvSelector.js';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'v3.0';

/**
 * AppHeader — chrome global 56px (ADR-040).
 * Brand + nav + EnvSelector + bloc utilisateur (version + avatar mock).
 * Markup `.app-header` défini dans `styles/components.scss`.
 */
export function AppHeader(): JSX.Element {
  return (
    <header className="app-header">
      <Link to="/" className="brand" aria-label="Carto ECP — accueil">
        <span className="brand-logo">Rte</span>
        <span>
          <span className="brand-title">Carto ECP · RTE</span>
          <br />
          <span className="brand-tagline">Topologie réseau — vue opérationnelle</span>
        </span>
      </Link>

      <nav className="app-nav" aria-label="Navigation principale">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Carte
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Import
        </NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          Administration
        </NavLink>
      </nav>

      <EnvSelector />

      <div className="hdr-user">
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
          {APP_VERSION}
        </span>
        <span className="avatar" aria-hidden="true">
          MC
        </span>
      </div>
    </header>
  );
}
