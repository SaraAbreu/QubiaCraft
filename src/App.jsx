import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Studio from './components/Studio.jsx';
import History from './components/History.jsx';
import Settings from './components/Settings.jsx';
import Strategy from './components/Strategy.jsx';
import Login from './components/Login.jsx';
import Landing from './components/Landing.jsx';
import './App.css';
import './components/Login.css';
import './components/Landing.css';

export default function App() {
  // undefined = comprobando sesión · null = sin sesión · objeto = usuario
  const [user, setUser] = useState(undefined);
  const [migrated, setMigrated] = useState(null);
  // Sin sesión: landing de presentación, o pantalla de acceso ('login' | 'register')
  const [authMode, setAuthMode] = useState(null);
  const [signupOpen, setSignupOpen] = useState(true);

  // Vuelta del OAuth de Instagram: ?instagram=connected|error&msg=…
  const [igFlash] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const type = q.get('instagram');
    if (!type) return null;
    window.history.replaceState(null, '', window.location.pathname);
    return { type, msg: q.get('msg') || 'No se pudo conectar Instagram' };
  });
  const [screen, setScreen] = useState(igFlash ? 'settings' : 'studio'); // studio | strategy | history | settings
  const [historyKey, setHistoryKey] = useState(0);
  // Hueco elegido en Estrategia → el Estudio abre en modo programar con esa fecha
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    fetch('/api/auth/config').then(r => r.json()).then(c => setSignupOpen(c.signupOpen !== false)).catch(() => {});
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => setUser(d.user || null))
      .catch(() => setUser(null));

    // main.jsx avisa si alguna llamada a la API responde 401 (sesión caducada).
    const onExpired = () => setUser(null);
    window.addEventListener('qc:session-expired', onExpired);
    return () => window.removeEventListener('qc:session-expired', onExpired);
  }, []);

  function navigate(key) {
    if (key === 'history') setHistoryKey(k => k + 1);
    if (key !== 'studio') setSlot(null);
    setScreen(key);
  }

  function handleLogin(u, migratedInfo) {
    setUser(u);
    setScreen('studio');
    if (migratedInfo && (migratedInfo.posts || migratedInfo.profile || migratedInfo.instagram)) setMigrated(migratedInfo);
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setMigrated(null);
    setAuthMode(null);
    setScreen('studio');
  }

  if (user === undefined) return <div className="app-loading">Cargando…</div>;
  if (!user) {
    if (!authMode) {
      return <Landing signupOpen={signupOpen} onAuth={mode => { setAuthMode(mode); window.scrollTo(0, 0); }} />;
    }
    return <Login key={authMode} initialMode={authMode} onLogin={handleLogin} onBack={() => setAuthMode(null)} />;
  }

  return (
    <div className="app-shell">
      {/* key: al cambiar de cuenta se vuelve a montar todo, sin datos de la anterior */}
      <Sidebar key={`sb-${user.id}`} screen={screen} onNavigate={navigate} user={user} onLogout={logout} />

      <div className="app-content" key={`c-${user.id}`}>
        {migrated && (
          <div className="migrated-banner">
            <span>
              Hemos pasado a tu cuenta los datos que ya tenías
              {migrated.posts ? ` (${migrated.posts} publicaciones` : ' ('}
              {migrated.instagram ? ', conexión de Instagram' : ''}
              {migrated.profile ? ', perfil de marca' : ''}).
            </span>
            <button onClick={() => setMigrated(null)} title="Cerrar">✕</button>
          </div>
        )}
        <main className="app-main">
          {screen === 'studio' && <Studio key={slot || 'studio'} initialSlot={slot} onOpenSettings={() => navigate('settings')} />}
          {screen === 'strategy' && (
            <Strategy
              onUseSlot={iso => { setSlot(iso); setScreen('studio'); }}
              onOpenSettings={() => navigate('settings')}
            />
          )}
          {screen === 'history' && <History key={historyKey} />}
          {screen === 'settings' && <Settings igFlash={igFlash} />}
        </main>
      </div>
    </div>
  );
}
