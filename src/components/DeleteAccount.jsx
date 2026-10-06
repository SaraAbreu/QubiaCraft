import React, { useState } from 'react';
import './DeleteAccount.css';

// Zona de borrado de cuenta (RGPD): pide la contraseña y escribir BORRAR.
export default function DeleteAccount({ onDeleted }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function remove() {
    setError('');
    if (!password) return setError('Escribe tu contraseña');
    if (confirm.trim().toUpperCase() !== 'BORRAR') return setError('Escribe BORRAR para confirmar');
    setBusy(true);
    try {
      const r = await fetch('/api/account/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'No se pudo borrar la cuenta');
      onDeleted();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <section className="delete-account">
      <div className="delete-head">
        <div>
          <h3>Eliminar mi cuenta</h3>
          <p>Se borran para siempre tu perfil de marca, tus publicaciones y fotos, la voz aprendida y la conexión con Instagram. Lo ya publicado en Instagram no se toca.</p>
        </div>
        {!open && <button type="button" className="delete-open" onClick={() => setOpen(true)}>Eliminar cuenta</button>}
      </div>

      {open && (
        <div className="delete-form">
          <input type="password" placeholder="Tu contraseña" value={password} autoComplete="current-password"
            onChange={e => { setPassword(e.target.value); setError(''); }} />
          <input type="text" placeholder="Escribe BORRAR" value={confirm}
            onChange={e => { setConfirm(e.target.value); setError(''); }} />
          {error && <p className="delete-error">{error}</p>}
          <div className="delete-actions">
            <button type="button" className="delete-cancel" onClick={() => { setOpen(false); setPassword(''); setConfirm(''); setError(''); }}>Cancelar</button>
            <button type="button" className="delete-confirm" onClick={remove} disabled={busy}>{busy ? 'Borrando…' : 'Borrar definitivamente'}</button>
          </div>
        </div>
      )}
    </section>
  );
}
