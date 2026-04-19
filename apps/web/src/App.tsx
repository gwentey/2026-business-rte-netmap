import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { MapPage } from './pages/MapPage.js';
import { UploadPage } from './pages/UploadPage.js';
import { EnvSelector } from './components/EnvSelector/EnvSelector.js';

export function App(): JSX.Element {
  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <Link to="/" className="text-lg font-semibold">Carto ECP — RTE</Link>
        <div className="flex items-center gap-3">
          <EnvSelector />
          <Link to="/upload" className="text-sm text-rte underline">+ Importer</Link>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<MapPage />} />
          <Route path="/map" element={<Navigate to="/" replace />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
