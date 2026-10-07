import React, { useEffect, useState } from 'react';
import './InstagramConnect.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Tarjeta de conexión con Instagram (OAuth). `flash` llega de App cuando el
// navegador vuelve de Instagram con ?instagram=connected|error.
export default function InstagramConnect({ flash }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(flash?.type === 'error' ? flash.msg : '');

  function load() {
    fetch('/api/instagram/status').then(r => r.json()).then(setStatus).catch(() => setStatus(null));
  }
  useEffect(load, []);

  async function connect() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/instagram/connect');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar la conexión');
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await fetch('/api/instagram/disconnect', { method: 'POST' });
    setBusy(false);
    load();
  }

  if (!status) return null;

  const daysLeft = status.expiresAt
    ? Math.ceil((new Date(status.expiresAt) - Date.now()) / 86400000)
    : null;

  return (
    <section className="ig-connect card">
      <div className="ig-connect-head">
        <span className="ig-connect-logo">📷</span>
        <div className="ig-connect-titles">
          <span className="ig-connect-title">Conexión con Instagram</span>
          <span className="ig-connect-sub">Para publicar y programar directamente en tu cuenta</span>
        </div>
        <span className={`ig-pill ${status.connected ? 'on' : 'off'}`}>
          {status.connected ? 'Conectada' : status.legacyEnv ? 'Token .env' : 'Sin conectar'}
        </span>
      </div>

      {flash?.type === 'connected' && status.connected && (
        <div className="ig-flash ok">✅ ¡Cuenta conectada! Ya puedes publicar desde el Estudio.</div>
      )}

      {status.connected ? (
        <div className="ig-account">
          {status.profilePicture
            ? <img src={status.profilePicture} alt="" className="ig-account-pic" />
            : <span className="ig-account-pic ig-account-initials">{(status.username || '?').slice(0, 2).toUpperCase()}</span>}
          <div className="ig-account-info">
            <span className="ig-account-user">@{status.username}</span>
            <span className="ig-account-meta">
              {daysLeft !== null && `Token válido ${daysLeft} día${daysLeft === 1 ? '' : 's'} más · se renueva solo`}
            </span>
          </div>
          <button type="button" className="btn btn-ghost ig-btn-sm" onClick={disconnect} disabled={busy}>Desconectar</button>
        </div>
      ) : (
        <div className="ig-connect-body">
          {status.expired && <p className="ig-note warn">La conexión caducó. Vuelve a conectar tu cuenta.</p>}
          {!status.configured ? (
            <p className="ig-note">
              Para activar la conexión rellena en el <code>.env</code>: {status.missing.map((m, i) => <React.Fragment key={m}>{i > 0 && ', '}<code>{m}</code></React.Fragment>)}.
              Luego reinicia <code>npm run dev</code>.
            </p>
          ) : (
            <>
              <p className="ig-note">Necesitas una cuenta profesional (empresa o creador). Te llevaremos a Instagram para autorizar a Qubia Craft.</p>
              <p className="ig-note">Durante el acceso anticipado, la conexión directa solo está disponible para cuentas invitadas. Mientras tanto, desde el Estudio puedes descargar las fotos y copiar el texto para publicarlos tú.</p>
            </>
          )}
          <button type="button" className="btn btn-primary" onClick={connect} disabled={busy || !status.configured}>
            {busy ? <><span className="spinner" /> Abriendo Instagram…</> : 'Conectar mi Instagram'}
          </button>
        </div>
      )}

      {error && <div className="ig-flash err">⚠️ {error}</div>}
    </section>
  );
}
