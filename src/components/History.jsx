import React, { useState, useEffect } from 'react';
import './History.css';

const STATUS_LABEL = {
  pending: { label: 'Pendiente', cls: 'badge-pending' },
  scheduled: { label: 'Programado', cls: 'badge-scheduled' },
  published: { label: 'Publicado', cls: 'badge-published' },
  published_demo: { label: 'Aprobado (demo)', cls: 'badge-demo' },
  rejected: { label: 'Rechazado', cls: 'badge-rejected' },
  publishing: { label: 'Publicando...', cls: 'badge-pending' },
  error: { label: 'Error', cls: 'badge-rejected' },
};

export default function History() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  async function cancelSchedule(item) {
    setCancelling(true);
    try {
      const res = await fetch('/api/unschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id })
      });
      if (res.ok) {
        const updated = { ...item, status: 'pending', scheduledFor: null };
        setItems(list => list.map(i => (i.id === item.id ? updated : i)));
        setSelected(updated);
      }
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function formatDate(iso) {
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  if (loading) return <div className="history-loading">Cargando historial...</div>;

  if (items.length === 0) return (
    <div className="history-empty">
      <span>📋</span>
      <p>Sin publicaciones aún</p>
      <p className="history-empty-sub">Las publicaciones generadas aparecerán aquí</p>
    </div>
  );

  return (
    <div className="history-page">
      <div className="history-header">
        <h1>Historial</h1>
        <p>{items.length} publicaciones</p>
      </div>

      <div className="history-grid">
        {/* Lista */}
        <div className="history-list">
          {items.map(item => {
            const s = STATUS_LABEL[item.status] || { label: item.status, cls: 'badge-pending' };
            return (
              <div
                key={item.id}
                className={`history-item card ${selected?.id === item.id ? 'selected' : ''}`}
                onClick={() => setSelected(item)}
              >
                <img src={item.image} alt="" className="history-thumb" />
                <div className="history-item-info">
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <p className="history-date">
                    {item.publishedAt
                      ? `Publicado: ${formatDate(item.publishedAt)}`
                      : item.status === 'scheduled' && item.scheduledFor
                        ? `Programado: ${formatDate(item.scheduledFor)}`
                        : formatDate(item.date)}
                  </p>
                  <p className="history-caption-preview">
                    {item.caption.slice(0, 80)}{item.caption.length > 80 ? '...' : ''}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detalle */}
        {selected && (
          <div className="history-detail card">
            <button className="detail-close" onClick={() => setSelected(null)}>✕</button>
            <img src={selected.image} alt="" className="detail-image" />
            <div className="detail-meta">
              <span className={`badge ${(STATUS_LABEL[selected.status] || {}).cls}`}>
                {(STATUS_LABEL[selected.status] || {}).label}
              </span>
              <span className="detail-date">{formatDate(selected.date)}</span>
            </div>
            {selected.status === 'scheduled' && selected.scheduledFor && (
              <div className="detail-schedule">
                <span>🗓️ Se publicará el <strong>{formatDate(selected.scheduledFor)}</strong></span>
                <button className="btn btn-ghost" disabled={cancelling} onClick={() => cancelSchedule(selected)}>
                  {cancelling ? 'Cancelando…' : 'Cancelar programación'}
                </button>
              </div>
            )}
            {selected.publishedAt && (
              <p className="detail-note">
                Publicado el {formatDate(selected.publishedAt)}
                {selected.publishedLate && ' — con retraso: el servidor estaba apagado a la hora programada'}
              </p>
            )}
            {selected.status === 'error' && selected.errorDetail && (
              <p className="detail-note detail-error">⚠️ {selected.errorDetail}</p>
            )}
            <div className="detail-caption">
              <div className="detail-caption-label">Caption</div>
              <pre className="detail-caption-text">{selected.caption}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
