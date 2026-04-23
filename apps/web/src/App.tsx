import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader/AppHeader.js';
import { MapPage } from './pages/MapPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { useAppStore } from './store/app-store.js';

export function App(): JSX.Element {
  const loadEnvs = useAppStore((s) => s.loadEnvs);

  useEffect(() => {
    void loadEnvs();
  }, [loadEnvs]);

  return (
    <div className="app">
      <AppHeader />
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/map" element={<Navigate to="/" replace />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
