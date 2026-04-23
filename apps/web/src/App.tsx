import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { EnvSelector } from './components/EnvSelector/EnvSelector.js';
import styles from './App.module.scss';

export function App(): JSX.Element {
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>Carto ECP — RTE</Link>
        <div className={styles.rightNav}>
          <EnvSelector />
          <Link to="/admin" className={styles.adminLink}>Admin</Link>
        </div>
      </header>
      <main className={styles.main}>
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/map" element={<Navigate to="/" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
