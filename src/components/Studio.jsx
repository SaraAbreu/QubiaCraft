import React, { useState, useEffect, useRef, useMemo } from 'react';
import './Studio.css';
import './InstagramConnect.css';
import PostActions from './PostActions.jsx';
import CropFrame from './CropFrame.jsx';
import { RATIOS, BACKGROUNDS, DEFAULT_FRAME, resolveRatio, ratioLabel, renderFramed, loadImage } from '../lib/framing.js';

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

const MAX_IMAGES = 10;

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

// ISO → valor para <input type="datetime-local"> en la hora local del navegador
const toLocalInput = iso => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Studio({ onOpenSettings, initialSlot }) {
  const [profile, setProfile] = useState(null);
  const [verticals, setVerticals] = useState([]);
  const [igStatus, setIgStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Panel 1 — imagen
  // Una o varias imágenes (carrusel, máx. 10 — límite de la API de Meta).
  const [items, setItems] = useState([]); // [{ file, url }]
  const [activeIdx, setActiveIdx] = useState(0);
  const file = items[0]?.file || null;
  const preview = items[Math.min(activeIdx, items.length - 1)]?.url || null;
  const isCarousel = items.length > 1;

  // Encuadre (igual para todas las fotos del carrusel, como en Instagram) y
  // el encuadre con el que se generó el contenido, para saber si cambió.
  const [frame, setFrame] = useState(DEFAULT_FRAME);
  const [generatedFrameKey, setGeneratedFrameKey] = useState(null);
  const ratioInfo = resolveRatio(frame.ratio, items[0]);
  const frameKey = JSON.stringify({ ...frame, r: ratioInfo.value, f: items.map(it => it.focus) });
  const activeItem = items[Math.min(activeIdx, items.length - 1)] || null;

  function setItemFocus(i, focus) {
    setItems(prev => prev.map((it, j) => (j === i ? { ...it, focus } : it)));
  }
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
  const [mode, setMode] = useState(initialSlot ? 'schedule' : 'now'); // now | schedule
  const [suggested, setSuggested] = useState([]); // huecos recomendados (pantalla Estrategia)
  const [scheduledFor, setScheduledFor] = useState(initialSlot ? toLocalInput(initialSlot) : '');
  const [publishing, setPublishing] = useState(false);
  const [pubError, setPubError] = useState('');
  const [result, setResult] = useState(null);

  // Publicación abierta desde "Próximas publicaciones"
  const [openPost, setOpenPost] = useState(null);

  useEffect(() => {
    fetch('/api/profile').then(r => r.json()).then(setProfile).catch(() => setProfile({}));
    fetch('/api/instagram/status').then(r => r.json()).then(setIgStatus).catch(() => setIgStatus(null));
    fetch('/api/verticals').then(r => r.json()).then(setVerticals).catch(() => setVerticals([]));
    refreshHistory();
  }, []);

  function refreshHistory() {
    setHistoryLoading(true);
    fetch('/api/history')
      .then(r => r.json())
      .then(data => { setHistory(data); setHistoryLoading(false); })
      .catch(() => setHistoryLoading(false));
  }

  // Módulo activo: el que corresponde al "Tipo de negocio" del perfil
  // (misma lógica que resolveVertical en el server; fallback: genérico).
  const activeVertical = useMemo(() => {
    if (!verticals.length) return null;
    return verticals.find(v => v.matches.includes(profile?.tipoNegocio))
      || verticals.find(v => v.key === 'generico')
      || null;
  }, [verticals, profile]);

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

  // Cualquier cambio en las fotos invalida el contenido ya generado.
  function invalidateContent() {
    setCaptions([]);
    setJobId(null);
    setResult(null);
  }

  function addFiles(list) {
    const all = Array.from(list || []);
    const imgs = all.filter(f => f && f.type.startsWith('image/'));
    if (!imgs.length) {
      setGenError('Por favor sube una imagen (JPG, PNG, WEBP)');
      return;
    }
    const room = MAX_IMAGES - items.length;
    const accepted = imgs.slice(0, Math.max(room, 0));
    setGenError(
      imgs.length > accepted.length ? `Máximo ${MAX_IMAGES} imágenes por carrusel: se añadieron ${accepted.length}.`
      : imgs.length < all.length ? 'Algunos archivos no eran imágenes y se ignoraron.'
      : ''
    );
    if (!accepted.length) return;
    const added = accepted.map(f => ({ file: f, url: URL.createObjectURL(f), focus: { x: 0.5, y: 0.5 } }));
    setItems(prev => [...prev, ...added]);
    setAiMode(false);
    invalidateContent();
    // Tamaño real de cada foto (para "Original" y para arrastrar el encuadre).
    added.forEach(it => {
      loadImage(it.url)
        .then(img => setItems(prev => prev.map(p => (p.url === it.url ? { ...p, w: img.naturalWidth, h: img.naturalHeight } : p))))
        .catch(() => {});
    });
  }

  // Las fotos tal y como se publicarán (proporción + encuadre), en JPEG.
  async function framedFiles() {
    const out = [];
    for (const it of items) {
      const blob = await renderFramed(it.url, { ...frame, ratio: ratioInfo.value, focus: it.focus });
      out.push(new File([blob], 'foto.jpg', { type: 'image/jpeg' }));
    }
    return out;
  }

  // Compatibilidad: la imagen generada con IA entra por aquí.
  function handleFile(f) { addFiles([f]); }

  function removeItem(i) {
    setItems(prev => {
      URL.revokeObjectURL(prev[i]?.url);
      return prev.filter((_, j) => j !== i);
    });
    setActiveIdx(0);
    invalidateContent();
  }

  function moveItem(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    setItems(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setActiveIdx(j);
    invalidateContent();
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function resetAll() {
    items.forEach(it => URL.revokeObjectURL(it.url));
    setItems([]);
    setActiveIdx(0);
    setFrame(DEFAULT_FRAME);
    setGeneratedFrameKey(null);
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
    // Con foto propia nunca se genera imagen: la IA de imagen solo se usa
    // cuando no hay ninguna imagen cargada.
    if (file) { setAiMode(false); return; }
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
      const form = new FormData();
      for (const f of await framedFiles()) form.append('images', f);
      const keyAtGeneration = frameKey;
      const res = await fetch('/api/generate', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error generando caption');
      const list = data.captions ?? [data.caption];
      setCaptions(list);
      setJobId(data.id);
      setGeneratedFrameKey(keyAtGeneration);
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
      // Si cambiaste el encuadre después de generar, se suben las fotos nuevas.
      if (generatedFrameKey !== frameKey) {
        const form = new FormData();
        for (const f of await framedFiles()) form.append('images', f);
        const up = await fetch(`/api/posts/${jobId}/images`, { method: 'POST', body: form });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error || 'No se pudo actualizar el encuadre');
        setGeneratedFrameKey(frameKey);
      }
      const body = { id: jobId, caption, originalCaption };
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

  const igUser = (igStatus?.connected && igStatus.username) || profile?.instagram || profile?.nombre || 'tu_empresa';
  const igInitials = igUser.slice(0, 2).toUpperCase();
  const igLocation = profile?.ciudad || 'España';
  const charCount = caption.length;
  const charLimit = 2200;
  useEffect(() => {
    if (mode !== 'schedule' || suggested.length) return;
    fetch('/api/strategy').then(r => (r.ok ? r.json() : null)).then(d => d && setSuggested(d.nextSlots || [])).catch(() => {});
  }, [mode]);

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
                {activeVertical && (
                  <div className="module-badge" title="La IA adapta el contenido a este sector">
                    <span className="module-icon">{activeVertical.icon}</span>
                    <div className="module-info">
                      <span className="module-kicker">Módulo activo</span>
                      <span className="module-label">{activeVertical.label}</span>
                    </div>
                  </div>
                )}
                {activeVertical?.limites?.length > 0 && (
                  <ul className="module-limits" aria-label="Límites del sector">
                    {activeVertical.limites.map(l => <li key={l}>{l}</li>)}
                  </ul>
                )}
                <div className="brand-summary-tags">
                  {profile.tipoNegocio && profile.tipoNegocio !== activeVertical?.label && <span className="tag">{profile.tipoNegocio}</span>}
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
                    <p className="ai-image-hint">Usa tu saldo de Pollinations — puede tardar unos segundos. Si ya tienes foto, súbela y no se genera nada.</p>
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
                    <p className="drop-title">Arrastra una o varias imágenes</p>
                    <p className="drop-sub">o haz clic para seleccionar</p>
                    <p className="drop-hint">JPG, PNG, WEBP · Hasta {MAX_IMAGES} fotos = carrusel</p>
                    <input
                      ref={inputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                      onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="preview-block">
                <div className="preview-image-wrap">
                  <CropFrame
                    src={preview}
                    natural={activeItem}
                    ratio={ratioInfo.value}
                    fit={frame.fit}
                    bg={frame.bg}
                    focus={activeItem?.focus}
                    onFocus={f => setItemFocus(activeIdx, f)}
                    maxHeight={320}
                    className="preview-frame"
                  />
                  {isCarousel && <span className="carousel-badge">{activeIdx + 1}/{items.length}</span>}
                  <button className="preview-remove" onClick={resetAll} title="Quitar todas">✕</button>
                </div>

                <div className="thumb-strip">
                  {items.map((it, i) => (
                    <div key={it.url} className={`thumb ${i === activeIdx ? 'active' : ''}`}>
                      <img src={it.url} alt={`Foto ${i + 1}`} onClick={() => setActiveIdx(i)} />
                      <span className="thumb-num">{i + 1}</span>
                      {isCarousel && (
                        <div className="thumb-actions">
                          <button onClick={() => moveItem(i, -1)} disabled={i === 0} title="Mover a la izquierda">‹</button>
                          <button onClick={() => removeItem(i)} title="Quitar">✕</button>
                          <button onClick={() => moveItem(i, 1)} disabled={i === items.length - 1} title="Mover a la derecha">›</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {items.length < MAX_IMAGES && (
                    <button className="thumb thumb-add" onClick={() => inputRef.current.click()} title="Añadir fotos">+</button>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>
                <div className="frame-controls">
                  <div className="frame-row">
                    {RATIOS.map(r => (
                      <button
                        key={r.key}
                        className={`frame-chip ${frame.ratio === r.key ? 'active' : ''}`}
                        onClick={() => setFrame(fr => ({ ...fr, ratio: r.key }))}
                        title={r.hint || 'Proporción de la foto'}
                      >
                        {r.value && <span className="ratio-icon" style={{ aspectRatio: String(r.value) }} />}
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="frame-row">
                    <div className="mode-toggle frame-fit">
                      <button className={`mode-btn ${frame.fit === 'cover' ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, fit: 'cover' }))}>✂️ Recortar</button>
                      <button className={`mode-btn ${frame.fit === 'contain' ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, fit: 'contain' }))}>🖼️ Foto entera</button>
                    </div>
                  </div>
                  {frame.fit === 'contain' && (
                    <div className="frame-row">
                      <span className="frame-label">Fondo</span>
                      {BACKGROUNDS.map(b => (
                        <button key={b.key} className={`frame-chip ${frame.bg === b.key ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, bg: b.key }))}>{b.label}</button>
                      ))}
                    </div>
                  )}
                  <p className="frame-hint">
                    {frame.fit === 'cover' ? 'Arrastra la foto para encuadrarla. ' : 'Se ve la foto completa, con bordes. '}
                    {frame.ratio === 'original' && ratioInfo.adjusted
                      ? `Instagram solo admite de 4:5 a 1.91:1: se ajusta a ${ratioLabel(ratioInfo.value)}.`
                      : `Proporción ${ratioLabel(ratioInfo.value)}.`}
                  </p>
                </div>

                {isCarousel && <p className="carousel-hint">Carrusel de {items.length} fotos · la IA analiza las 3 primeras. Todas usan la misma proporción; el encuadre es de cada foto.</p>}
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
                  <div className="ig-media">
                    <CropFrame
                      src={preview}
                      natural={activeItem}
                      ratio={ratioInfo.value}
                      fit={frame.fit}
                      bg={frame.bg}
                      focus={activeItem?.focus}
                      className="ig-image"
                    />
                    {isCarousel && (
                      <>
                        <span className="carousel-badge">{activeIdx + 1}/{items.length}</span>
                        {activeIdx > 0 && <button className="ig-nav prev" onClick={() => setActiveIdx(activeIdx - 1)}>‹</button>}
                        {activeIdx < items.length - 1 && <button className="ig-nav next" onClick={() => setActiveIdx(activeIdx + 1)}>›</button>}
                      </>
                    )}
                  </div>
                  {isCarousel && (
                    <div className="ig-dots">
                      {items.map((_, i) => <span key={i} className={i === activeIdx ? 'on' : ''} />)}
                    </div>
                  )}
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
            {igStatus && (
              <div className={`ig-status-line ${igStatus.connected || igStatus.legacyEnv ? 'on' : ''}`}>
                <span className="dot" />
                {igStatus.connected
                  ? <span>Publicando en <strong>@{igStatus.username}</strong></span>
                  : igStatus.legacyEnv
                    ? <span>Publicando con el token del <strong>.env</strong></span>
                    : <span><strong>Modo demo</strong> · no se publica en Instagram</span>}
                {!igStatus.connected && (
                  <button className="link-btn" onClick={onOpenSettings}>Conectar</button>
                )}
              </div>
            )}

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

                {mode === 'schedule' && suggested.length > 0 && (
                  <div className="slot-suggest">
                    <span>Buenos momentos para tu sector:</span>
                    {suggested.map(sl => {
                      const v = toLocalInput(sl.iso);
                      return (
                        <button key={sl.iso} type="button" className={`slot-chip ${scheduledFor === v ? 'active' : ''}`} onClick={() => setScheduledFor(v)}>
                          {new Date(sl.iso).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </button>
                      );
                    })}
                  </div>
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
                    <div
                      key={item.id}
                      className="upcoming-item clickable"
                      onClick={() => setOpenPost(item)}
                      title="Ver, editar, publicar o borrar"
                    >
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

      {openPost && (
        <div className="pa-overlay" onClick={() => setOpenPost(null)}>
          <div className="pa-modal" onClick={e => e.stopPropagation()}>
            <button className="pa-modal-close" onClick={() => setOpenPost(null)} title="Cerrar">✕</button>
            <div className="pa-modal-head">
              <img src={openPost.image} alt="" />
              <div>
                <span className={`status-dot ${statusMeta(openPost.status).cls}`}>{statusMeta(openPost.status).label}</span>
                {openPost.images?.length > 1 && <p className="upcoming-date">Carrusel · {openPost.images.length} fotos</p>}
                {openPost.errorDetail && <p className="upcoming-date">⚠️ {openPost.errorDetail}</p>}
              </div>
            </div>
            <PostActions
              item={openPost}
              onChanged={updated => { setOpenPost(updated); refreshHistory(); }}
              onDeleted={id => {
                setOpenPost(null);
                if (id === jobId) resetAll();
                refreshHistory();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
