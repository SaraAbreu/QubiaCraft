import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Pantalla de entrada (está en index.html). Se quita cuando la app sabe si
// hay sesión, pero se deja ver un mínimo para que la animación luzca: más
// tiempo en la app instalada, menos en el navegador.
const SPLASH_MIN_MS = window.matchMedia?.('(display-mode: standalone)').matches ? 1600 : 700;
window.__qcHideSplash = () => {
  const el = document.getElementById('splash');
  if (!el || el.dataset.hiding) return;
  el.dataset.hiding = '1';
  const wait = Math.max(0, SPLASH_MIN_MS - performance.now());
  setTimeout(() => {
    el.classList.add('hide');
    setTimeout(() => el.remove(), 500);
  }, wait);
};
// Por si algo falla: nunca más de 6 s.
setTimeout(() => window.__qcHideSplash(), 6000);

// El aviso de "Instalar app" llega una sola vez y muy pronto: lo guardamos
// para que el botón de instalar (InstallApp.jsx) lo use cuando quiera.
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  window.__qcInstallPrompt = e;
  window.dispatchEvent(new Event('qc:install-ready'));
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}

// Si cualquier llamada a la API responde 401 (sesión caducada o cerrada en
// otra pestaña), la app vuelve a la pantalla de acceso.
const originalFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const res = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input?.url || '';
  if (res.status === 401 && url.includes('/api/') && !url.includes('/api/auth/')) {
    window.dispatchEvent(new Event('qc:session-expired'));
  }
  return res;
};

createRoot(document.getElementById('root')).render(<App />);
