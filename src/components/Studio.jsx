import React, { useState, useEffect, useRef, useMemo } from 'react';
import './Studio.css';
import './InstagramConnect.css';
import PostActions from './PostActions.jsx';
import CropFrame from './CropFrame.jsx';
import Icon from './Icon.jsx';
import './StudioLayout.css';
import { RATIOS, BACKGROUNDS, DEFAULT_FRAME, resolveRatio, ratioLabel, renderFramed, loadImage } from '../lib/framing.js';

const TONOS = [
  { label: 'Inspiracional', icon: 'sparkle' },
  { label: 'Cercano', icon: 'chat' },
  { label: 'Comercial', icon: 'tag' },
];
const STEPS = ['Fotos', 'Texto', 'Publicar'];

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
  const [imageGenOn, setImageGenOn] = useState(false); // IMAGE_GEN_ENABLED en el .env
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
    fetch('/api/features').then(r => r.json()).then(f => setImageGenOn(!!f.imageGen)).catch(() => {});
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


  const upcoming = useMemo(() => {
    return [...history]
      .sort((a, b) => {
        const da = a.scheduledFor || a.date;
        const db = b.scheduledFor || b.date;
        return new Date(db) - new Date(da);
      })
      .slice(0, 8);
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

  const step = result ? 3 : captions.length ? 2 : items.length ? 1 : 0;
  const connected = igStatus?.connected || igStatus?.legacyEnv;
  const brandName = profile?.nombre || '';
  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      multiple
      style={{ display: 'none' }}
      onChange={e => { addFiles(e.target.files); e.target.value = ''; }}
    />
  );

  return (
    <div className="studio sx">
      {/* ── Cabecera ── */}
      <header className="sx-top">
        <div>
          <h1>Estudio</h1>
          <p>Tus fotos, con tu voz, listas para Instagram.</p>
        </div>
        <div className="sx-top-right">
          {brandName ? (
            <button
              className="sx-brand"
              onClick={onOpenSettings}
              title={activeVertical?.limites?.length ? `La IA respeta: ${activeVertical.limites.join(' · ')}` : 'Editar perfil de marca'}
            >
              <span className="sx-brand-avatar">{brandName.slice(0, 1).toUpperCase()}</span>
              <span className="sx-brand-text">
                <strong>{brandName}</strong>
                {activeVertical && <small><Icon name={activeVertical.key} size={13} /> {activeVertical.label}</small>}
              </span>
            </button>
          ) : (
            <button className="sx-brand empty" onClick={onOpenSettings}>
              <Icon name="pen" size={16} /> Configura tu perfil de marca
            </button>
          )}
          {igStatus && (
            <button className={`sx-ig ${connected ? 'on' : ''}`} onClick={connected ? undefined : onOpenSettings} title={connected ? 'Cuenta conectada' : 'Conectar Instagram'}>
              <Icon name="instagram" size={15} />
              {igStatus.connected ? `@${igStatus.username}` : igStatus.legacyEnv ? 'Token del .env' : 'Modo demo · Conectar'}
            </button>
          )}
        </div>
      </header>

      {/* ── Pasos ── */}
      <ol className="sx-steps" aria-label="Pasos">
        {STEPS.map((label, i) => (
          <li key={label} className={i < step ? 'done' : i === step ? 'current' : ''}>
            <span className="sx-step-num">{i < step ? <Icon name="check" size={14} stroke={2.2} /> : i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="sx-main">
        {/* ── Lienzo: fotos y vista previa ── */}
        <section className="sx-canvas">
          {!items.length ? (
            <div className="sx-empty">
              <div className="sx-seg" role="tablist">
                <button className={!aiMode ? 'active' : ''} onClick={() => setAiMode(false)}><Icon name="upload" size={15} /> Subir fotos</button>
                <button
                  className={aiMode ? 'active' : ''}
                  onClick={() => imageGenOn && setAiMode(true)}
                  disabled={!imageGenOn}
                  title={imageGenOn ? 'Crear una imagen desde una descripción' : 'En desarrollo: estará disponible pronto'}
                >
                  <Icon name="sparkle" size={15} /> Crear imagen con IA
                  {!imageGenOn && <span className="sx-soon">En desarrollo</span>}
                </button>
              </div>

              {aiMode && imageGenOn ? (
                <div className="sx-ai">
                  <textarea
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    rows={4}
                    placeholder="Escaparate de la tienda con luz cálida de atardecer"
                    disabled={aiGenerating}
                  />
                  <button className="sx-primary" onClick={generateAiImage} disabled={aiGenerating}>
                    {aiGenerating ? <><span className="spinner" /> Creando imagen…</> : <><Icon name="sparkle" size={16} /> Crear imagen</>}
                  </button>
                  <p className="sx-hint">Usa tu saldo de Pollinations y puede tardar unos segundos.</p>
                </div>
              ) : (
                <div
                  className={`sx-drop ${dragging ? 'dragging' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current.click()}
                  role="button"
                  tabIndex={0}
                >
                  <span className="sx-drop-icon"><Icon name="images" size={34} stroke={1.3} /></span>
                  <p className="sx-drop-title">Arrastra tus fotos aquí</p>
                  <p className="sx-drop-sub">o <u>elígelas</u> de tu ordenador</p>
                  <p className="sx-hint">JPG, PNG o WEBP · de 2 a {MAX_IMAGES} fotos se publican como carrusel</p>
                  {fileInput}
                </div>
              )}
            </div>
          ) : (
            <div className="sx-workspace">
              <div className="sx-phone">
                <div className="ig-header">
                  <div className="ig-avatar"><span>{igInitials}</span></div>
                  <div className="ig-username-wrap">
                    <span className="ig-username">{igUser}</span>
                    <span className="ig-location">{igLocation}</span>
                  </div>
                  <button className="sx-icon-btn" onClick={resetAll} title="Quitar todas las fotos"><Icon name="x" size={16} /></button>
                </div>
                <div className="ig-media sx-media">
                  <CropFrame
                    src={preview}
                    natural={activeItem}
                    ratio={ratioInfo.value}
                    fit={frame.fit}
                    bg={frame.bg}
                    focus={activeItem?.focus}
                    onFocus={f => setItemFocus(activeIdx, f)}
                    maxHeight={460}
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
                <div className="sx-caption-preview">
                  {caption ? (
                    <p><strong>{igUser}</strong> {caption}</p>
                  ) : (
                    <div className="sx-skeleton" aria-hidden="true"><span /><span /><span /></div>
                  )}
                </div>
              </div>

              <div className="sx-tools">
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
                    <button className="thumb thumb-add" onClick={() => inputRef.current.click()} title="Añadir fotos"><Icon name="plus" size={18} /></button>
                  )}
                  {fileInput}
                </div>

                <div className="sx-tool-row">
                  <span className="sx-tool-label">Formato</span>
                  {RATIOS.map(r => (
                    <button
                      key={r.key}
                      className={`sx-chip ${frame.ratio === r.key ? 'active' : ''}`}
                      onClick={() => setFrame(fr => ({ ...fr, ratio: r.key }))}
                      title={r.hint || 'Proporción original de la foto'}
                    >
                      {r.value && <span className="ratio-icon" style={{ aspectRatio: String(r.value) }} />}
                      {r.hint || r.label}
                    </button>
                  ))}
                </div>
                <div className="sx-tool-row">
                  <span className="sx-tool-label">Ajuste</span>
                  <button className={`sx-chip ${frame.fit === 'cover' ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, fit: 'cover' }))}>
                    <Icon name="crop" size={14} /> Recortar
                  </button>
                  <button className={`sx-chip ${frame.fit === 'contain' ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, fit: 'contain' }))}>
                    <Icon name="images" size={14} /> Foto entera
                  </button>
                  {frame.fit === 'contain' && BACKGROUNDS.map(b => (
                    <button key={b.key} className={`sx-chip sx-chip-sm ${frame.bg === b.key ? 'active' : ''}`} onClick={() => setFrame(fr => ({ ...fr, bg: b.key }))}>{b.label}</button>
                  ))}
                </div>
                <p className="sx-hint">
                  {frame.fit === 'cover' ? 'Arrastra la foto para encuadrarla. ' : ''}
                  {frame.ratio === 'original' && ratioInfo.adjusted
                    ? `Instagram admite de 4:5 a 1.91:1: se ajusta a ${ratioLabel(ratioInfo.value)}.`
                    : `Proporción ${ratioLabel(ratioInfo.value)}.`}
                  {isCarousel && ' Todas las fotos usan el mismo formato.'}
                </p>
              </div>
            </div>
          )}
          {genError && <div className="inline-error">{genError}</div>}
        </section>

        {/* ── Inspector: texto y publicación ── */}
        <aside className="sx-inspector">
          <div className={`sx-card ${!items.length ? 'locked' : ''}`}>
            <div className="sx-card-head">
              <span className="sx-card-icon"><Icon name="pen" size={16} /></span>
              <h2>Texto</h2>
              {captions.length > 0 && (
                <button className="sx-link" onClick={generate} disabled={generating} title="Escribir otras versiones">
                  {generating ? <span className="spinner" /> : <Icon name="refresh" size={14} />} Otras versiones
                </button>
              )}
            </div>

            {!captions.length ? (
              <>
                <p className="sx-text">
                  {items.length
                    ? <>La IA escribe tres versiones con la voz de <strong>{brandName || 'tu marca'}</strong>{activeVertical ? <> y las pautas de <strong>{activeVertical.label.toLowerCase()}</strong></> : null}.</>
                    : 'Añade una o varias fotos y la IA escribirá el texto a partir de ellas.'}
                </p>
                {isCarousel && <p className="sx-hint">Carrusel de {items.length} fotos: la IA mira las 3 primeras.</p>}
                <button className="sx-primary" onClick={generate} disabled={!items.length || generating}>
                  {generating ? <><span className="spinner" /> Escribiendo…</> : <><Icon name="sparkle" size={16} /> Generar texto</>}
                </button>
              </>
            ) : (
              <>
                <div className="sx-seg sx-variants">
                  {captions.map((c, i) => (
                    <button key={i} className={selected === i ? 'active' : ''} onClick={() => selectVariant(i)}>
                      <Icon name={TONOS[i]?.icon || 'pen'} size={14} /> {TONOS[i]?.label ?? `Opción ${i + 1}`}
                    </button>
                  ))}
                </div>
                <textarea
                  className="sx-textarea"
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  rows={9}
                  maxLength={2500}
                />
                <div className="sx-text-foot">
                  <span className={`char-count ${charCount > charLimit ? 'over' : ''}`}>{charCount}/{charLimit}</span>
                  <button className="sx-link" onClick={copyCaption}>
                    <Icon name={copied ? 'check' : 'copy'} size={14} /> {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className={`sx-card ${!jobId && !result ? 'locked' : ''}`}>
            <div className="sx-card-head">
              <span className="sx-card-icon"><Icon name="send" size={16} /></span>
              <h2>Publicar</h2>
            </div>

            {result ? (
              <div className="sx-done">
                <span className="sx-done-icon"><Icon name={result.scheduled ? 'calendar' : 'check'} size={26} stroke={2} /></span>
                <p>{result.message}</p>
                {result.voiceExamples > 0 && (
                  <p className="sx-hint">La IA ha aprendido de tu edición ({result.voiceExamples} ejemplo{result.voiceExamples === 1 ? '' : 's'} de tu voz).</p>
                )}
                <button className="sx-primary" onClick={resetAll}><Icon name="plus" size={16} /> Nueva publicación</button>
              </div>
            ) : (
              <>
                <div className="sx-seg">
                  <button className={mode === 'now' ? 'active' : ''} onClick={() => setMode('now')}><Icon name="zap" size={14} /> Ahora</button>
                  <button className={mode === 'schedule' ? 'active' : ''} onClick={() => setMode('schedule')}><Icon name="clock" size={14} /> Programar</button>
                </div>

                {mode === 'schedule' && (
                  <>
                    {suggested.length > 0 && (
                      <div className="slot-suggest">
                        <span>Buenos momentos para tu sector</span>
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
                    <input
                      type="datetime-local"
                      className="schedule-input"
                      min={minDateTime}
                      value={scheduledFor}
                      onChange={e => setScheduledFor(e.target.value)}
                    />
                  </>
                )}

                {pubError && <div className="inline-error">{pubError}</div>}

                <button className="sx-primary" onClick={submitPublish} disabled={!jobId || !caption.trim() || publishing}>
                  {publishing
                    ? <><span className="spinner" /> Enviando…</>
                    : mode === 'schedule'
                      ? <><Icon name="calendar" size={16} /> Programar publicación</>
                      : <><Icon name="send" size={16} /> {connected ? 'Publicar en Instagram' : 'Aprobar (modo demo)'}</>}
                </button>
                {jobId && (
                  <button className="sx-discard" onClick={reject} disabled={publishing}>Descartar esta publicación</button>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      {/* ── Cola de publicaciones ── */}
      <section className="sx-queue">
        <div className="sx-queue-head">
          <h2>Tus publicaciones</h2>
          <span className="sx-hint">Pulsa una para verla, editarla o publicarla</span>
        </div>
        {historyLoading ? (
          <p className="sx-hint">Cargando…</p>
        ) : upcoming.length === 0 ? (
          <p className="sx-hint">Aquí aparecerán las publicaciones que vayas creando.</p>
        ) : (
          <div className="sx-queue-row">
            {upcoming.map(item => {
              const meta = statusMeta(item.status);
              const dateRef = item.scheduledFor || item.date;
              return (
                <button key={item.id} className="sx-post" onClick={() => setOpenPost(item)}>
                  <span className="sx-post-img">
                    {item.image && <img src={item.image} alt="" />}
                    {item.images?.length > 1 && <span className="sx-post-multi"><Icon name="layers" size={12} /></span>}
                  </span>
                  <span className={`status-dot ${meta.cls}`}>{meta.label}</span>
                  <span className="sx-post-date">{item.scheduledFor ? formatFull(dateRef) : formatShort(dateRef)}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

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
