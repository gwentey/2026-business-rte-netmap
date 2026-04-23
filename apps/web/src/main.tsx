import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
// Ordre des styles — important :
import '@design-system-rte/react/style.css';  // 1. DS RTE : composants pré-stylés + reset
import 'leaflet/dist/leaflet.css';             // 2. Leaflet : pour la carte
import './styles/fonts.scss';                  // 3. Nunito @font-face
import './styles/globals.scss';                // 4. Overrides projet (passe en dernier)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
