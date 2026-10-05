import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Register PWA service worker for mobile installation and offline support
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => {
        console.warn('NexPlay Service Worker registration failed:', error);
      });
  });
}

// Web Vitals measurement (TC-E of the performance test plan) — dynamic import
// so collection never blocks the critical rendering path it measures.
if (typeof window !== 'undefined') {
  void import('./shared/utils/webVitals').then((m) => m.initWebVitals());
}
