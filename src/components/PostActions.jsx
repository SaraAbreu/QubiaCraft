import React, { useState, useEffect } from 'react';
import './PostActions.css';

// Acciones sobre una publicación ya generada: editar caption, programar /
// reprogramar, publicar ahora o borrar. Se usa en el Estudio (modal) y en el
// Historial (panel de detalle).
const EDITABLE = ['pending', 'scheduled', 'error', 'rejected'];

// ISO → valor para <input type="datetime-local"> en hora local.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function minLocalInput() {
  return toLocalInput(new Date(Date.now() + 2 * 60000).toISOString());
}

export default function PostActions({ item, onChanged, onDeleted }) {
  const editable = EDITABLE.includes(item.status);
  const [caption, setCaption] = useState(item.caption || '');
  const [when, setWhen] = useState(toLocalInput(item.scheduledFor));
  const [busy, setBusy] = useState(''); // '' | save | publish | delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Si cambia la publicación seleccionada, reiniciar el formulario.
  useEffect(() => {
    setCaption(item.caption || '');
    setWhen(toLocalInput(item.scheduledFor));
    setConfirmDelete(false);
    setError('');
    setNotice('');
  }, [item.id, item.status, item.scheduledFor, item.caption]);

  const captionChanged = caption !== (item.caption || '');
  const whenChanged = when !== toLocalInput(item.scheduledFor);
  const dirty = captionChanged || whenChanged;

  async function call(kind, url, options) {
    setBusy(kind);
    setError('');
    setNotice('');
    try {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        if (data.item) onChanged?.(data.item);
        throw new Error(data.detail || data.error || 'Algo salió mal');
      }
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy('');
    }
  }

  async function save() {
    const body = {};
    if (captionChanged) body.caption = caption;
    if (whenChanged) body.scheduledFor = when ? new Date(when).toISOString() : null;
    const data = await call('save', `/api/posts/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (data) {
      onChanged?.(data.item);
      setNotice(data.item.status === 'scheduled' ? 'Cambios guardados. Programación actualizada.' : 'Cambios guardados.');
    }
  }

  async function unschedule() {
    const data = await call('save', `/api/posts/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scheduledFor: null, ...(captionChanged ? { caption } : {}) }),
    });
    if (data) { onChanged?.(data.item); setNotice('Programación cancelada. Queda como pendiente.'); }
  }

  async function publishNow() {
    // Guardar antes el caption si se editó.
    if (captionChanged) {
      const saved = await call('publish', `/api/posts/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      });
      if (!saved) return;
    }
    const data = await call('publish', `/api/posts/${item.id}/publish`, { method: 'POST' });
    if (data) { onChanged?.(data.item); setNotice(data.message || 'Publicado.'); }
  }

  async function remove() {
    const data = await call('delete', `/api/posts/${item.id}`, { method: 'DELETE' });
    if (data) onDeleted?.(item.id);
  }

  return (
    <div className="post-actions">
      <div className="pa-field">
        <div className="pa-label">
          <span>Caption</span>
          {editable && <span className={`pa-count ${caption.length > 2200 ? 'over' : ''}`}>{caption.length}/2200</span>}
        </div>
        {editable ? (
          <textarea
            className="pa-textarea"
            value={caption}
            onChange={e => setCaption(e.target.value)}
            rows={8}
            disabled={!!busy}
          />
        ) : (
          <pre className="pa-readonly">{item.caption}</pre>
        )}
      </div>

      {editable && (
        <div className="pa-field">
          <div className="pa-label"><span>{item.status === 'scheduled' ? 'Fecha programada' : 'Programar para'}</span></div>
          <div className="pa-when">
            <input
              type="datetime-local"
              className="pa-input"
              value={when}
              min={minLocalInput()}
              onChange={e => setWhen(e.target.value)}
              disabled={!!busy}
            />
            {item.status === 'scheduled' && (
              <button className="btn btn-ghost pa-small" onClick={unschedule} disabled={!!busy}>Quitar fecha</button>
            )}
          </div>
        </div>
      )}

      {error && <div className="pa-msg pa-error">⚠️ {error}</div>}
      {notice && <div className="pa-msg pa-ok">✓ {notice}</div>}

      <div className="pa-buttons">
        {editable && (
          <>
            <button className="btn btn-ghost" onClick={save} disabled={!!busy || !dirty || !caption.trim()}>
              {busy === 'save' ? 'Guardando…' : when && whenChanged ? '🗓️ Guardar y programar' : '💾 Guardar cambios'}
            </button>
            <button className="btn btn-primary" onClick={publishNow} disabled={!!busy || !caption.trim()}>
              {busy === 'publish' ? <><span className="spinner" /> Publicando…</> : '🚀 Publicar ahora'}
            </button>
          </>
        )}
        {item.status !== 'publishing' && (
          confirmDelete ? (
            <div className="pa-confirm">
              <span>
                ¿Borrar definitivamente?
                {(item.status === 'published' || item.status === 'published_demo') && ' (En Instagram seguirá publicada.)'}
              </span>
              <button className="btn btn-danger pa-small" onClick={remove} disabled={!!busy}>
                {busy === 'delete' ? 'Borrando…' : 'Sí, borrar'}
              </button>
              <button className="btn btn-ghost pa-small" onClick={() => setConfirmDelete(false)} disabled={!!busy}>No</button>
            </div>
          ) : (
            <button className="btn btn-ghost pa-delete" onClick={() => setConfirmDelete(true)} disabled={!!busy}>🗑️ Borrar</button>
          )
        )}
      </div>
    </div>
  );
}
