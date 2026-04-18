import { Navigate, Route, Routes } from 'react-router-dom';
import { UploadPage } from './pages/UploadPage.js';
import { MapPage } from './pages/MapPage.js';

export function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/upload" replace />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/map" element={<MapPage />} />
    </Routes>
  );
}
