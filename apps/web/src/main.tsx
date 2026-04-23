import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
// Ordre des styles :
//   1. Leaflet base (carto)
//   2. Nunito local (fallback @font-face)
//   3. globals.scss (brand → reset → components → pages)
import 'leaflet/dist/leaflet.css';
import './styles/fonts.scss';
import './styles/globals.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
