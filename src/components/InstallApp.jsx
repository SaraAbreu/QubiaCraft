import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import './InstallApp.css';

// Instalar Qubia Craft como app. Android/Chrome/Edge: usamos el aviso nativo
// (beforeinstallprompt, capturado en main.jsx). iPhone/iPad: Safari no tiene
// ese aviso, así que mostramos cómo añadirla a la pantalla de inicio.

const DISMISS_KEY = 'qc.install.dismissed';

export function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  const ua = navigator.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function useInstall() {
  const [prompt, setPrompt] = useState(() => window.__qcInstallPrompt || null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onReady = () => setPrompt(window.__qcInstallPrompt || null);
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('qc:install-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('qc:install-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const ios = isIOS();
  const available = !installed && (!!prompt || ios);

  async function install() {
    if (!prompt) return false;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    window.__qcInstallPrompt = null;
    setPrompt(null);
    if (choice?.outcome === 'accepted') setInstalled(true);
    return true;
  }

  return { available, ios, install };
}

function IosSteps({ onClose }) {
  return (
    <div className="install-modal" role="dialog" aria-modal="true" aria-label="Instalar Qubia Craft" onClick={onClose}>
      <div className="install-sheet" onClick={e => e.stopPropagation()}>
        <img src="/apple-touch-icon.png" alt="" className="install-sheet-icon" />
        <h3>Instala Qubia Craft</h3>
        <ol>
          <li>Pulsa el botón <strong>Compartir</strong> <span className="install-share" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V3" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
          </span> de Safari.</li>
          <li>Elige <strong>Añadir a pantalla de inicio</strong>.</li>
          <li>Pulsa <strong>Añadir</strong>. Ya la tienes como una app más.</li>
        </ol>
        <button className="btn btn-primary install-sheet-ok" onClick={onClose}>Entendido</button>
      </div>
    </div>
  );
}

// variant: 'sidebar' (botón en el menú) | 'banner' (aviso arriba, en el móvil)
export default function InstallApp({ variant = 'sidebar' }) {
  const { available, ios, install } = useInstall();
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  if (!available) return null;
  if (variant === 'banner' && dismissed) return null;

  async function onInstall() {
    const handled = await install();
    if (!handled && ios) setShowIos(true);
  }

  function dismiss() {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sin almacenamiento */ }
  }

  return (
    <>
      {variant === 'banner' ? (
        <div className="install-banner">
          <img src="/apple-touch-icon.png" alt="" />
          <span>Instala Qubia Craft en tu móvil y ábrela como una app.</span>
          <button className="install-banner-btn" onClick={onInstall}>Instalar</button>
          <button className="install-banner-x" onClick={dismiss} aria-label="Ahora no"><Icon name="x" size={16} /></button>
        </div>
      ) : (
        <button className="sidebar-nav-btn install-side-btn" onClick={onInstall} title="Instalar Qubia Craft como app">
          <span className="sidebar-nav-icon"><Icon name="download" size={19} stroke={1.8} /></span>
          <span className="sidebar-nav-label">Instalar app</span>
        </button>
      )}
      {showIos && <IosSteps onClose={() => setShowIos(false)} />}
    </>
  );
}
