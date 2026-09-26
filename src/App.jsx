import React, { useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Studio from './components/Studio.jsx';
import History from './components/History.jsx';
import Settings from './components/Settings.jsx';
import './App.css';

export default function App() {
  const [screen, setScreen] = useState('studio'); // studio | history | settings
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
          {screen === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
