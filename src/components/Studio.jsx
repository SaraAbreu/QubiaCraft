import React, { useState, useEffect, useRef, useMemo } from 'react';
import './Studio.css';

const TONOS = [
  { label: 'Inspiracional', icon: '✨' },
  { label: 'Cercano', icon: '💬' },
  { label: 'Comercial', icon: '🎯' },
];

const STATUS_META = {
  pending: { label: 'Pendiente', cls: 'st-pending' },
  scheduled: { label: 'Programada', cls: 'st-scheduled' },
  published: { label: 'Publicada', cls: 'st-published' },
  published_demo: { label: 'Aprobada (demo)', cls: 'st-published' },
  publishing: { label: 'Publicando…', cls: 'st-pending' },
  rejected: { label: 'Rechazada', cls: 'st-rejected' },
  error: { label: 'Error', cls: 'st-rejected' },
};

function statusMeta(status) {
  return STATUS_META[status] || { label: status, cls: 'st-pending' };
}

function formatShort(iso) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

function formatFull(iso) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Compresión de imagen en el cliente antes de enviarla a la IA
async function compressImage(f, maxPx = 1200, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * maxPx / width); width = maxPx; }
        else { width = Math.round(width * maxPx / height); height = maxPx; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(new File([blob], f.name, { type: 'image/jpeg' })), 'image/jpeg', quality);
    };
    img.src = url;
  });
}

function next7Days() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

export default function Studio({ onOpenSettings }) {
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Panel 1 — imagen
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [aiMode, setAiMode] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const inputRef = useRef();

  // Panel 2 — contenido generado
  const [jobId, setJobId] = useState(null);
  const [captions, setCaptions] = useState([]);
  const [selected, setSelected] = useState(0);
  const [caption, setCaption] = useState('');
  const [originalCaption, setOriginalCaption] = useState('');
  const [copied, setCopied] = useState(false);

  // Panel 3 — publicación
  const [mode, setMode] = useState('now'); // now | schedule
  const [scheduledFor, setScheduledFor] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile).catch(() => setProfile({}));
    refreshHistory();
  }, []);

  function refreshHistory() {
    setHistoryLoading(true);
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { setHistory(data); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }

  const stats = useMemo(() => {
    const s = { pending: 0, scheduled: 0, published: 0, rejected: 0 };
    history.forEach(h => {
      if (h.status === 'pending' || h.status === 'publishing') s.pending++;
      else if (h.status === 'scheduled') s.scheduled++;
      else if (h.status === 'published' || h.status === 'published_demo') s.published++;
      else if (h.status === 'rejected' || h.status === 'error') s.rejected++;
    });
    return s;
  }, [history]);

  const upcoming = useMemo(() => {
    return [...history]
      .sort((a, b) => {
        const da = a.scheduledFor || a.date;
        const db = b.scheduledFor || b.date;
        return new Date(db) - new Date(da);
      })
      .slice(0, 6);
  }, [history]);

  const dayMarkers = useMemo(() => {
    const days = next7Days();
    return days.map(d => {
      const key = d.toDateString();
      const count = history.filter(h => {
        const ref = h.scheduledFor || h.date;
        return ref && new Date(ref).toDateString() === key;
      }).length;
      return { date: d, count };
    });
  }, [history]);

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) {
      setGenError('Por favor sube una imagen (JPG, PNG, WEBP)');
      return;
    }
    setFile(f);
    setGenError('');
    setPreview(URL.createObjectURL(f));
    setCaptions([]);
    setJobId(null);
    setResult(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function resetAll() {
    setFile(null);
    setPreview(null);
    setCaptions([]);
    setJobId(null);
    setCaption('');
    setOriginalCaption('');
    setResult(null);
    setGenError('');
    setPubError('');
    setScheduledFor('');
    setMode('now');
    setAiMode(false);
    setAiDescription('');
  }

  async function generateAiImage() {
    if (!aiDescription.trim()) {
      setGenError('Describe qué imagen quieres generar');
      return;
    }
    setAiGenerating(true);
    setGenError('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Error generando la imagen con IA');
      }
      const blob = await res.blob();
      const file = new File([blob], 'imagen-ia.jpg', { type: blob.type || 'image/jpeg' });
      handleFile(file);
      setAiMode(false);
      setAiDescription('');
    } catch (err) {
      setGenError(err.message);
    } finally {
      setAiGenerating(false);
    }
  }

  async function generate() {
    if (!file) return;
    setGenerating(true);
    setGenError('');
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append('image', compressed);
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando caption');
      const list = data.captions ?? [data.caption];
      setCaptions(list);
      setJobId(data.id);
      setSelected(0);
      setCaption(list[0]);
      setOriginalCaption(list[0]);
      setResult(null);
      refreshHistory();
    } catch (err) {
      setGenError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  function selectVariant(i) {
    setSelected(i);
    setCaption(captions[i]);
    setOriginalCaption(captions[i]);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setPubError('No se pudo copiar al portapapeles');
    }
  }

  async function submitPublish() {
    if (!jobId || !caption.trim()) return;
    setPublishing(true);
    setPubError('');
    try {
      const body = { id: jobId, caption, originalCaption, imageBase64: preview };
      if (mode === 'schedule') {
        if (!scheduledFor) { setPubError('Elige una fecha y hora para programar'); setPublishing(false); return; }
        body.scheduledFor = new Date(scheduledFor).toISOString();
      }
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error publicando');
      setResult(data);
      refreshHistory();
    } catch (err) {
      setPubError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function reject() {
    if (!jobId) return;
    setPublishing(true);
    await fetch('/api/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: jobId })
    });
    setPublishing(false);
    refreshHistory();
    resetAll();
  }

  const igUser = profile?.instagram || profile?.nombre || 'tu_empresa';
  const igInitials = igUser.slice(0, 2).toUpperCase();
  const igLocation = profile?.ciudad || 'España';
  const charCount = caption.length;
  const charLimit = 2200;
  const minDateTime = new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16);

  return (
    <div className="studio">
      <div className="studio-header">
        <h1>Estudio de contenido</h1>
        <p>De la imagen a una publicación lista para Instagram, en tres pasos.</p>
      </div>

      <div className="studio-grid">
        {/* ── Panel 1: Información del contenido ── */}
        <section className="studio-panel">
          <div className="panel-head">
            <span className="panel-step">01</span>
            <div>
              <h2>Información del contenido</h2>
              <p>Tu perfil de marca y la imagen a publicar</p>
            </div>
          </div>

          <div className="panel-body">
            {profile?.nombre ? (
              <div className="brand-summary card">
                <div className="brand-summary-row">
                  <span className="brand-summary-name">{profile.nombre}</span>
                  <button className="link-btn" onClick={onOpenSettings}>Editar</button>
                </div>
                <div className="brand-summary-tags">
                  {profile.tipoNegocio && <span className="tag">{profile.tipoNegocio}</span>}
                  {profile.tono && <span className="tag tag-muted">{profile.tono}</span>}
                  {profile.ciudad && <span className="tag tag-muted">{profile.ciudad}</span>}
                </div>
              </div>
            ) : (
              <div className="brand-summary card brand-summary-empty">
                <p>Aún no configuraste tu perfil de marca.</p>
                <button className="link-btn" onClick={onOpenSettings}>Configurar ahora →</button>
              </div>
            )}

            {!preview ? (
              <>
                <div className="mode-toggle">
                  <button className={`mode-btn ${!aiMode ? 'active' : ''}`} onClick={() => setAiMode(false)}>📸 Subir imagen</button>
                  <button className={`mode-btn ${aiMode ? 'active' : ''}`} onClick={() => setAiMode(true)}>✨ Generar con IA</button>
                </div>

                {aiMode ? (
                  <div className="ai-image-block">
                    <textarea
                      className="ai-image-textarea"
                      value={aiDescription}
                      onChange={e => setAiDescription(e.target.value)}
                      rows={3}
                      placeholder="Describe la imagen que quieres, ej: escaparate de la tienda con luz cálida de atardecer"
                      disabled={aiGenerating}
                    />
                    <button className="btn btn-primary generate-btn" onClick={generateAiImage} disabled={aiGenerating}>
                      {aiGenerating ? <><span className="spinner" /> Generando imagen…</> : '✨ Generar imagen con IA'}
                    </button>
                    <p className="ai-image-hint">Gratis, sin API key — puede tardar unos segundos.</p>
                  </div>
                ) : (
                  <div
                    className={`drop-zone ${dragging ? 'dragging' : ''}`}
                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => inputRef.current.click()}
                  >
                    <div className="drop-icon">📸</div>
                    <p className="drop-title">Arrastra una imagen aquí</p>
                    <p className="drop-sub">o haz clic para seleccionar</p>
                    <p className="drop-hint">JPG, PNG, WEBP · Máx. 20MB</p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={e => handleFile(e.target.files[0])}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="preview-block">
                <div className="preview-image-wrap">
                  <img src={preview} alt="Preview" className="preview-image" />
                  <button className="preview-remove" onClick={resetAll} title="Cambiar imagen">✕</button>
                </div>
                <button className="btn btn-primary generate-btn" onClick={generate} disabled={generating}>
                  {generating ? <><span className="spinner" /> Generando…</> : captions.length ? '🔄 Regenerar contenido' : '✨ Generar contenido'}
                </button>
              </div>
            )}

            {genError && <div className="inline-error">⚠️ {genError}</div>}
          </div>
        </section>

        {/* ── Panel 2: Contenido y diseño ── */}
        <section className="studio-panel">
          <div className="panel-head">
            <span className="panel-step">02</span>
            <div>
              <h2>Contenido y diseño</h2>
              <p>Variantes generadas por IA, listas para editar</p>
            </div>
          </div>

          <div className="panel-body">
            {captions.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">🪄</span>
                <p>Sube una imagen en el paso 1 y genera contenido para ver las variantes aquí.</p>
              </div>
            ) : (
              <>
                <div className="variant-tabs">
                  {captions.map((c, i) => (
                    <button
                      key={i}
                      className={`variant-tab ${selected === i ? 'active' : ''}`}
                      onClick={() => selectVariant(i)}
                    >
                      <span>{TONOS[i]?.icon ?? '📝'}</span> {TONOS[i]?.label ?? `Opción ${i + 1}`}
                    </button>
                  ))}
                </div>

                <div className="ig-post">
                  <div className="ig-header">
                    <div className="ig-avatar"><span>{igInitials}</span></div>
                    <div className="ig-username-wrap">
                      <span className="ig-username">{igUser}</span>
                      <span className="ig-location">{igLocation}</span>
                    </div>
                    <span className="ig-more">•••</span>
                  </div>
                  <img src={preview} alt="Post" className="ig-image" />
                  <div className="ig-caption-preview">
                    <span className="ig-caption-user">{igUser}</span>{' '}
                    <span className="ig-caption-text">{caption.split('\n')[0].slice(0, 90)}</span>
                  </div>
                </div>

                <div className="caption-editor">
                  <div className="caption-label">
                    <span>Caption</span>
                    <span className={`char-count ${charCount > charLimit ? 'over' : ''}`}>{charCount}/{charLimit}</span>
                  </div>
                  <textarea
                    className="caption-textarea"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    rows={8}
                    maxLength={2500}
                  />
                </div>

                <button className="btn btn-ghost copy-btn" onClick={copyCaption}>
                  {copied ? '✅ ¡Copiado!' : '📋 Copiar caption'}
                </button>
              </>
            )}
          </div>
        </section>

        {/* ── Panel 3: Calendario y publicación ── */}
        <section className="studio-panel">
          <div className="panel-head">
            <span className="panel-step">03</span>
            <div>
              <h2>Calendario y publicación</h2>
              <p>Aprueba, programa y sigue el estado de tus posts</p>
            </div>
          </div>

          <div className="panel-body">
            <div className="stats-row">
              <div className="stat-tile">
                <span className="stat-value">{stats.pending}</span>
                <span className="stat-label">Pendientes</span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{stats.scheduled}</span>
                <span className="stat-label">Programadas</span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{stats.published}</span>
                <span className="stat-label">Publicadas</span>
              </div>
              <div className="stat-tile">
                <span className="stat-value">{stats.rejected}</span>
                <span className="stat-label">Rechazadas</span>
              </div>
            </div>

            <div className="mini-calendar">
              {dayMarkers.map(({ date, count }, i) => (
                <div key={i} className={`mini-calendar-day ${i === 0 ? 'today' : ''}`}>
                  <span className="mcd-dow">{date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '')}</span>
                  <span className="mcd-num">{date.getDate()}</span>
                  {count > 0 && <span className="mcd-dot" />}
                </div>
              ))}
            </div>

            {result ? (
              <div className="publish-result">
                <div className="publish-result-icon">{result.scheduled ? '🗓️' : result.demo ? '✅' : '🎉'}</div>
                <p className="publish-result-msg">{result.message}</p>
                {result.voiceExamples > 0 && (
                  <p className="publish-result-voice">🧠 La IA guardó tu edición ({result.voiceExamples} ejemplo{result.voiceExamples === 1 ? '' : 's'} de tu voz)</p>
                )}
                <button className="btn btn-primary" onClick={resetAll}>Nueva publicación</button>
              </div>
            ) : (
              <div className="publish-controls">
                <div className="mode-toggle">
                  <button className={`mode-btn ${mode === 'now' ? 'active' : ''}`} onClick={() => setMode('now')}>Publicar ahora</button>
                  <button className={`mode-btn ${mode === 'schedule' ? 'active' : ''}`} onClick={() => setMode('schedule')}>Programar</button>
                </div>

                {mode === 'schedule' && (
                  <input
                    type="datetime-local"
                    className="schedule-input"
                    min={minDateTime}
                    value={scheduledFor}
                    onChange={e => setScheduledFor(e.target.value)}
                  />
                )}

                {pubError && <div className="inline-error">⚠️ {pubError}</div>}

                <div className="publish-actions">
                  <button
                    className="btn btn-success"
                    onClick={submitPublish}
                    disabled={!jobId || !caption.trim() || publishing}
                  >
                    {publishing ? <><span className="spinner" /> Enviando…</> : mode === 'schedule' ? '🗓️ Programar publicación' : '✅ Aprobar y publicar'}
                  </button>
                  <button className="btn btn-danger" onClick={reject} disabled={!jobId || publishing}>
                    ❌ Rechazar
                  </button>
                </div>
              </div>
            )}

            <div className="upcoming-list">
              <div className="upcoming-title">Próximas publicaciones</div>
              {historyLoading ? (
                <p className="upcoming-empty">Cargando…</p>
              ) : upcoming.length === 0 ? (
                <p className="upcoming-empty">Todavía no hay publicaciones generadas.</p>
              ) : (
                upcoming.map(item => {
                  const meta = statusMeta(item.status);
                  const dateRef = item.scheduledFor || item.date;
                  return (
                    <div key={item.id} className="upcoming-item">
                      <img src={item.image} alt="" className="upcoming-thumb" />
                      <div className="upcoming-info">
                        <span className={`status-dot ${meta.cls}`}>{meta.label}</span>
                        <p className="upcoming-date">{item.scheduledFor ? `Programada: ${formatFull(dateRef)}` : formatShort(dateRef)}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
