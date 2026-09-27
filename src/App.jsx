import React, { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Studio from './components/Studio.jsx';
import History from './components/History.jsx';
import Settings from './components/Settings.jsx';
import './App.css';

export default function App() {
  // Vuelta del OAuth de Instagram: ?instagram=connected|error&msg=…
  const [igFlash] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const type = q.get('instagram');
    if (!type) return null;
    window.history.replaceState(null, '', window.location.pathname);
    return { type, msg: q.get('msg') || 'No se pudo conectar Instagram' };
  });
  const [screen, setScreen] = useState(igFlash ? 'settings' : 'studio'); // studio | history | settings
  const [historyKey, setHistoryKey] = useState(0);

  function navigate(key) {
    if (key === 'history') setHistoryKey(k => k + 1);
    setScreen(key);
  }

  return (
    <div className="app-shell">
      <Sidebar screen={screen} onNavigate={navigate} />

      <div className="app-content">
        <main className="app-main">
          {screen === 'studio' && <Studio onOpenSettings={() => navigate('settings')} />}
          {screen === 'history' && <History key={historyKey} />}
          {screen === 'settings' && <Settings igFlash={igFlash} />}
        </main>
      </div>
    </div>
  );
}
