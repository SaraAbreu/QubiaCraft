import React, { useEffect, useState } from 'react';
import './Login.css';

// Pantalla de acceso: entrar o crear cuenta. Cada cuenta tiene su propio
// perfil de marca, historial y conexión de Instagram.
export default function Login({ onLogin, onBack, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // login | register
  const [config, setConfig] = useState({ signupOpen: true, inviteRequired: false });
  const [form, setForm] = useState({ name: '', email: '', password: '', invite: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/config').then(r => r.json()).then(setConfig).catch(() => {});
  }, []);

  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));

  function switchMode(m) {
    setMode(m);
    setError('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/auth/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(!isRegister
          ? { email: form.email, password: form.password }
          : form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo continuar');
      onLogin(data.user, data.migrated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isRegister = mode === 'register' && config.signupOpen;

  return (
    <div className="login-page">
      {onBack && <button className="lp-auth-back" onClick={onBack} type="button">← Volver</button>}
      <div className="login-card">
        <div className="login-brand">
          <img src="/logo-mark.png" alt="" className="login-logo" />
          <div>
            <div className="login-title">Qubia<strong>Craft</strong></div>
            <div className="login-sub">Publicaciones con IA para tu negocio</div>
          </div>
        </div>

        {config.signupOpen && (
          <div className="login-tabs">
            <button className={!isRegister ? 'active' : ''} onClick={() => switchMode('login')} type="button">Entrar</button>
            <button className={isRegister ? 'active' : ''} onClick={() => switchMode('register')} type="button">Crear cuenta</button>
          </div>
        )}

        <form className="login-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <span>Nombre</span>
              <input value={form.name} onChange={set('name')} autoComplete="name" placeholder="Tu nombre o el de tu negocio" />
            </label>
          )}
          <label>
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label>
            <span>Contraseña</span>
            <input
              type="password"
              value={form.password}
              onChange={set('password')}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
            {isRegister && <small>Mínimo 8 caracteres</small>}
          </label>
          {isRegister && config.inviteRequired && (
            <label>
              <span>Código de invitación</span>
              <input value={form.invite} onChange={set('invite')} required />
            </label>
          )}

          {error && <div className="login-error">⚠️ {error}</div>}

          <button className="btn btn-primary login-submit" disabled={busy}>
            {busy ? <><span className="spinner" /> Un momento…</> : isRegister ? 'Crear cuenta' : 'Entrar'}
          </button>
        </form>

        {!config.signupOpen && (
          <p className="login-note">El registro está cerrado. Si necesitas acceso, pídeselo a la administradora.</p>
        )}
      </div>
    </div>
  );
}
