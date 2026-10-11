import React, { useState, useEffect, useRef, useMemo } from 'react';
import './Studio.css';
import './InstagramConnect.css';
import PostActions from './PostActions.jsx';
import CropFrame from './CropFrame.jsx';
import Icon from './Icon.jsx';
import './StudioLayout.css';
import { RATIOS, BACKGROUNDS, DEFAULT_FRAME, resolveRatio, ratioLabel, renderFramed, loadImage } from '../lib/framing.js';
import { TEMPLATES, DEFAULT_DESIGN, DEFAULT_SCOPE, brandOf, appliesTo, hasContent, drawDesign } from '../lib/templates.js';
import DesignOverlay from './DesignOverlay.jsx';
import { recordStory, DEFAULT_ANIM, canRecordVideo } from '../lib/animate.js';

const TONOS = [
  { label: 'Inspiracional', icon: 'sparkle' },
  { label: 'Cercano', icon: 'chat' },
  { label: 'Comercial', icon: 'tag' },
];
const STEPS = ['Fotos', 'Texto', 'Publicar'];
const STORY_STEPS = ['Fotos', 'Diseño', 'Publicar'];
const STORY_RATIO = 9 / 16; // 1080×1920

const STATUS_META = {
  pending: { label: 'Pendiente', cls: 'st-pending' },
  scheduled: { label: 'Programada', cls: 'st-scheduled' },
  published: { label: 'Publicada', cls: 'st-published' },
  published_demo: { label: 'Lista (manual)', cls: 'st-published' },
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

// Plantilla, alcance y posición se recuerdan entre publicaciones (solo en
// este navegador); los textos no.
const DESIGN_PREFS_KEY = 'qc.design';
function loadDesign() {
  try {
    const saved = JSON.parse(localStorage.getItem(DESIGN_PREFS_KEY) || '{}');
    const template = TEMPLATES.some(t => t.key === saved.template) ? saved.template : 'none';
    return {
      ...DEFAULT_DESIGN,
      template,
      scope: saved.scope === 'all' ? 'all' : 'first',
      position: saved.position === 'top' ? 'top' : 'bottom',
    };
  } catch {
    return { ...DEFAULT_DESIGN };
  }
}


// ISO → valor para <input type="datetime-local"> en la hora local del navegador
const toLocalInput = iso => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function Studio({ onOpenSettings, initialSlot, initialIdea }) {
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
  // Publicación (feed/carrusel) o historia (9:16, sin texto).
  const [kind, setKind] = useState(initialIdea?.kind === 'story' ? 'story' : 'feed');
  const [ideaOpen, setIdeaOpen] = useState(!!initialIdea);
  const isStory = kind === 'story';
  const ratioInfo = isStory ? { value: STORY_RATIO, adjusted: false } : resolveRatio(frame.ratio, items[0]);
  const baseFrameKey = JSON.stringify({ ...frame, r: ratioInfo.value, f: items.map(it => it.focus) });

  // Diseño (plantilla) que se dibuja encima de las fotos.
  // Si venimos de una idea de fecha clave, la plantilla y el titular ya vienen puestos.
  const [design, setDesign] = useState(() => {
    const d = loadDesign();
    if (!initialIdea) return d;
    const tpl = TEMPLATES.some(t => t.key === initialIdea.template) ? initialIdea.template : d.template;
    const headline = initialIdea.template === 'oferta' ? '' : (initialIdea.headline || '');
    return { ...d, template: tpl, headline, scope: DEFAULT_SCOPE[tpl] || d.scope };
  });
  const [suggesting, setSuggesting] = useState(false);
  const brand = useMemo(() => brandOf(profile), [profile]);
  const designActive = design.template !== 'none' && hasContent(design, brand);
  // La clave incluye el diseño: si cambia, al publicar se suben las fotos nuevas.
  const frameKey = baseFrameKey + (designActive
    ? JSON.stringify({ d: design, b: [brand.primary, brand.secondary, brand.font, brand.logo.length, brand.name] })
    : '');

  useEffect(() => {
    try {
      localStorage.setItem(DESIGN_PREFS_KEY, JSON.stringify({ template: design.template, scope: design.scope, position: design.position }));
    } catch { /* sin almacenamiento: no pasa nada */ }
  }, [design.template, design.scope, design.position]);

  function updateDesign(patch) {
    setDesign(d => ({ ...d, ...patch }));
  }

  function chooseTemplate(key) {
    setDesign(d => ({ ...d, template: key, scope: DEFAULT_SCOPE[key] || d.scope }));
  }

  async function suggestHeadline() {
    setSuggesting(true);
    setGenError('');
    try {
      // Historias (o sin texto aún): la IA mira la primera foto.
      let image = null;
      if (isStory || !caption.trim()) {
        const blob = await renderFramed(items[0].url, { ...frame, ratio: ratioInfo.value, focus: items[0].focus }, 512, 0.8);
        image = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
      }
      const res = await fetch('/api/headline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(image ? { image } : { caption })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo sugerir un titular');
      updateDesign({ headline: data.headline });
    } catch (err) {
      setGenError(err.message);
    } finally {
      setSuggesting(false);
    }
  }
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
  const [downloading, setDownloading] = useState(false);
  // Historias con música: sugerencia de la IA y "terminar en Instagram"
  const [music, setMusic] = useState(null); // { mood, searches }
  const [suggestingMusic, setSuggestingMusic] = useState(false);
  const [copiedTerm, setCopiedTerm] = useState('');
  const [sharedToIg, setSharedToIg] = useState(false);
  // Historias animadas (vídeo)
  const [videoOn, setVideoOn] = useState(false); // ffmpeg disponible en el servidor
  const [animated, setAnimated] = useState(false);
  const [anim, setAnim] = useState(DEFAULT_ANIM);
  const [audioFile, setAudioFile] = useState(null);
  const [video, setVideo] = useState(null); // { id, url, key }
  const [makingVideo, setMakingVideo] = useState(null); // { phase: 'rec'|'convert', progress }

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
    fetch('/api/features').then(r => r.json()).then(f => { setImageGenOn(!!f.imageGen); setVideoOn(!!f.videoStories && canRecordVideo()); }).catch(() => {});
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


  function changeKind(k) {
    if (k === kind) return;
    setKind(k);
    setGeneratedFrameKey(null);
    invalidateContent();
  }

  // Cualquier cambio en las fotos invalida el contenido ya generado.
  // Una publicación preparada pero no publicada que se abandona (cambias las
  // fotos, el tipo o empiezas de cero) se borra para que no se acumule.
  function discardDraft() {
    if (jobId && !result) fetch(`/api/posts/${jobId}`, { method: 'DELETE' }).catch(() => {});
  }

  function invalidateContent() {
    discardDraft();
    setVideo(null);
    setMusic(null);
    setSharedToIg(false);
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

  // Las fotos tal y como se publicarán (proporción + encuadre + diseño), en
  // JPEG. Para generar el texto se mandan sin diseño: la IA ve la foto limpia.
  async function framedFiles(withDesign = true) {
    const out = [];
    for (const [i, it] of items.entries()) {
      const overlay = withDesign && designActive && appliesTo(design, i)
        ? (ctx, W, H) => drawDesign(ctx, W, H, design, brand)
        : null;
      const blob = await renderFramed(it.url, { ...frame, ratio: ratioInfo.value, focus: it.focus, overlay });
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
    discardDraft();
    setVideo(null);
    setAudioFile(null);
    setMusic(null);
    setSharedToIg(false);
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
    setDesign(d => ({ ...d, headline: '', offer: '', offerSub: '' }));
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
      for (const f of await framedFiles(false)) form.append('images', f);
      // Copias pequeñas solo para que la IA las vea (gasta muchos menos tokens).
      for (const it of items.slice(0, 3)) {
        const small = await renderFramed(it.url, { ...frame, ratio: ratioInfo.value, focus: it.focus }, 640, 0.8);
        form.append('aiImages', new File([small], 'ia.jpg', { type: 'image/jpeg' }));
      }
      // «Otras versiones»: se reescribe la misma publicación, no se crea otra.
      if (jobId && !result) form.append('id', String(jobId));
      const keyAtGeneration = baseFrameKey;
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

  // Publicación manual (sin Instagram conectado): descarga las fotos ya
  // encuadradas. En el móvil abre el menú de compartir (guardar en la galería
  // o mandarlas directamente a Instagram); en el ordenador las descarga.
  // ¿El vídeo ya creado corresponde a lo que hay ahora en pantalla?
  const animKey = isStory && animated
    ? `${frameKey}|${JSON.stringify(anim)}|${audioFile ? audioFile.name + audioFile.size : ''}|${items[0]?.url || ''}`
    : '';
  const videoReady = !!(video && video.key === animKey);

  function setAnimatedMode(on) {
    if (on === animated) return;
    setAnimated(on);
    invalidateContent();
  }

  // Graba la animación y el servidor la convierte a MP4. Devuelve { id, url }.
  async function createVideo() {
    setPubError('');
    setMakingVideo({ phase: 'rec', progress: 0 });
    try {
      const it = items[0];
      const blob = await recordStory(
        { src: it.url, frame, ratio: ratioInfo.value, focus: it.focus, design, brand, withDesign: designActive, anim },
        p => setMakingVideo({ phase: 'rec', progress: p })
      );
      setMakingVideo({ phase: 'convert' });
      const form = new FormData();
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      form.append('video', new File([blob], `historia.${ext}`, { type: blob.type }));
      if (audioFile) form.append('audio', audioFile);
      form.append('duration', String(anim.duration));
      if (jobId && !result) form.append('id', String(jobId));
      const res = await fetch('/api/stories/video', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo preparar el vídeo');
      setJobId(data.id);
      setGeneratedFrameKey(frameKey);
      const v = { ...data, key: animKey };
      setVideo(v);
      return v;
    } finally {
      setMakingVideo(null);
    }
  }

  async function makeVideoClick() {
    try { await createVideo(); } catch (err) { setPubError(err.message); }
  }

  async function downloadPhotos() {
    if (!items.length) return;
    setDownloading(true);
    setPubError('');
    try {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      let files;
      if (isStory && animated) {
        const v = videoReady ? video : await createVideo();
        const mp4 = await (await fetch(v.url)).blob();
        files = [new File([mp4], `qubia-historia-${stamp}.mp4`, { type: 'video/mp4' })];
      } else {
        files = (await framedFiles()).map((f, i) =>
          new File([f], `qubia-${stamp}-${i + 1}.jpg`, { type: 'image/jpeg' }));
      }
      const touch = window.matchMedia?.('(pointer: coarse)').matches;
      if (touch && navigator.canShare?.({ files })) {
        try { await navigator.share({ files }); } catch (e) { if (e.name !== 'AbortError') throw e; }
      } else {
        for (const f of files) {
          const url = URL.createObjectURL(f);
          const a = document.createElement('a');
          a.href = url;
          a.download = f.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 10000);
          await new Promise(r => setTimeout(r, 350));
        }
      }
    } catch (err) {
      setPubError(isStory && animated ? (err.message || 'No se pudo preparar el vídeo') : 'No se pudieron descargar las fotos');
    } finally {
      setDownloading(false);
    }
  }

  // Imagen pequeña de la primera foto tal y como se verá (con diseño), en data URL.
  async function firstPreviewDataUrl() {
    const overlay = designActive && appliesTo(design, 0) ? (ctx, W, H) => drawDesign(ctx, W, H, design, brand) : null;
    const blob = await renderFramed(items[0].url, { ...frame, ratio: ratioInfo.value, focus: items[0].focus, overlay }, 512, 0.8);
    return new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
  }

  async function suggestMusic() {
    if (!items.length) return;
    setSuggestingMusic(true);
    setPubError('');
    try {
      const res = await fetch('/api/music-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: await firstPreviewDataUrl() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo sugerir música');
      setMusic(data);
    } catch (err) {
      setPubError(err.message);
    } finally {
      setSuggestingMusic(false);
    }
  }

  async function copyTerm(t) {
    try {
      await navigator.clipboard.writeText(t);
      setCopiedTerm(t);
      setTimeout(() => setCopiedTerm(''), 1800);
    } catch { /* sin portapapeles */ }
  }

  // Abre el menú de compartir (móvil) para llevarla a Instagram y ponerle música allí.
  async function finishInInstagram() {
    await downloadPhotos();
    setSharedToIg(true);
  }

  async function submitPublish(opts = {}) {
    if (isStory ? !items.length : (!jobId || !caption.trim())) return;
    setPublishing(true);
    setPubError('');
    try {
      let id = jobId;
      let uploadedKey = generatedFrameKey;
      // Historia animada: el vídeo (creado ahora si no está al día).
      if (isStory && animated) {
        const v = videoReady ? video : await createVideo();
        id = v.id;
        uploadedKey = frameKey;
      } else if (isStory && !id) {
      // Historia: no hay texto que generar; se crea al publicar con las fotos ya diseñadas.
        const form = new FormData();
        for (const f of await framedFiles()) form.append('images', f);
        const created = await fetch('/api/stories', { method: 'POST', body: form });
        const cData = await created.json().catch(() => ({}));
        if (!created.ok) throw new Error(cData.error || 'No se pudo preparar la historia');
        id = cData.id;
        uploadedKey = frameKey;
        setJobId(id);
        setGeneratedFrameKey(frameKey);
      }
      // Si cambiaste el encuadre o el diseño después de generar, se suben las fotos nuevas.
      if (uploadedKey !== frameKey) {
        const form = new FormData();
        for (const f of await framedFiles()) form.append('images', f);
        const up = await fetch(`/api/posts/${id}/images`, { method: 'POST', body: form });
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) throw new Error(upData.error || 'No se pudo actualizar el encuadre');
        setGeneratedFrameKey(frameKey);
      }
      const body = { id, caption: isStory ? '' : caption, originalCaption };
      if (opts.manual) body.manual = true;
      else if (mode === 'schedule') {
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
    // Descartar = borrarla (y sus fotos), no dejarla guardada como rechazada.
    await fetch(`/api/posts/${jobId}`, { method: 'DELETE' }).catch(() => {});
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

  const step = result ? 3
    : isStory ? (items.length ? (designActive ? 2 : 1) : 0)
    : captions.length ? 2 : items.length ? 1 : 0;
  const steps = isStory ? STORY_STEPS : STEPS;
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
              {igStatus.connected ? `@${igStatus.username}` : igStatus.legacyEnv ? 'Token del .env' : 'Publicación manual · Conectar'}
            </button>
          )}
        </div>
      </header>

      {/* ── Idea de una fecha clave (desde Estrategia) ── */}
      {initialIdea && ideaOpen && (
        <div className="sx-idea">
          <span className="sx-idea-icon"><Icon name="calendar" size={18} /></span>
          <div>
            <strong>Idea para {initialIdea.dateName}</strong>
            <p>{initialIdea.idea}</p>
            <small>
              {initialIdea.kind === 'story' ? 'Historia' : initialIdea.carousel ? 'Carrusel: sube varias fotos' : 'Publicación'}
              {initialSlot ? ` · se programará para el ${new Date(initialSlot).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}
              {' · '}Sube tus fotos para empezar.
            </small>
          </div>
          <button className="sx-icon-btn" onClick={() => setIdeaOpen(false)} title="Ocultar"><Icon name="x" size={16} /></button>
        </div>
      )}

      {/* ── Pasos ── */}
      <ol className="sx-steps" aria-label="Pasos">
        {steps.map((label, i) => (
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
                  {isStory && animated && videoReady ? (
                    <video src={video.url} className="sx-video" autoPlay loop muted playsInline style={{ aspectRatio: '9 / 16' }} />
                  ) : (
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
                  >
                    {designActive && appliesTo(design, activeIdx) && (
                      <DesignOverlay ratio={ratioInfo.value} design={design} brand={brand} />
                    )}
                  </CropFrame>
                  )}
                  {isStory && animated && !videoReady && <span className="sx-anim-badge"><Icon name="zap" size={12} /> Animada</span>}
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

                <div className="sx-seg sx-kind" role="tablist" aria-label="Tipo de publicación">
                  <button className={!isStory ? 'active' : ''} onClick={() => changeKind('feed')}><Icon name="images" size={15} /> Publicación</button>
                  <button className={isStory ? 'active' : ''} onClick={() => changeKind('story')}><Icon name="clock" size={15} /> Historia</button>
                </div>

                {!isStory && <div className="sx-tool-row">
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
                </div>}
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
                  {isStory
                    ? 'Historia vertical 9:16. Arriba y abajo Instagram pone tu nombre y la barra de respuesta: las plantillas ya dejan ese espacio libre.'
                    : frame.ratio === 'original' && ratioInfo.adjusted
                      ? `Instagram admite de 4:5 a 1.91:1: se ajusta a ${ratioLabel(ratioInfo.value)}.`
                      : `Proporción ${ratioLabel(ratioInfo.value)}.`}
                  {isCarousel && (isStory ? ' Cada foto será una historia, en este orden.' : ' Todas las fotos usan el mismo formato.')}
                </p>
              </div>
            </div>
          )}
          {genError && <div className="inline-error">{genError}</div>}
        </section>

        {/* ── Inspector: texto y publicación ── */}
        <aside className="sx-inspector">
          {isStory ? (
            <div className={`sx-card ${!items.length ? 'locked' : ''}`}>
              <div className="sx-card-head">
                <span className="sx-card-icon"><Icon name="clock" size={16} /></span>
                <h2>Historia</h2>
              </div>
              <p className="sx-text">Las historias no llevan texto de publicación: lo que quieras decir va dentro de la imagen. Elige una plantilla en <strong>Diseño</strong> (Titular o Aviso funcionan muy bien) y publícala.</p>
            </div>
          ) : (
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

          )}

          <div className={`sx-card ${!items.length ? 'locked' : ''}`}>
            <div className="sx-card-head">
              <span className="sx-card-icon"><Icon name="layers" size={16} /></span>
              <h2>Diseño</h2>
              <button className="sx-link" onClick={onOpenSettings} title="Logo, colores y tipografía">
                <span className="sx-swatch" style={{ background: brand.primary }} />
                <span className="sx-swatch" style={{ background: brand.secondary }} />
                Kit de marca
              </button>
            </div>

            <div className="sx-templates">
              {TEMPLATES.map(t => (
                <button
                  key={t.key}
                  className={`sx-template ${design.template === t.key ? 'active' : ''}`}
                  onClick={() => chooseTemplate(t.key)}
                  title={t.hint}
                >
                  <span className={`sx-template-thumb tpl-${t.key}`} style={{ '--tp': brand.primary, '--ts': brand.secondary }} />
                  {t.label}
                </button>
              ))}
            </div>

            {(design.template === 'titular' || design.template === 'aviso') && (
              <>
                <div className="sx-field-row">
                  <input
                    className="sx-input"
                    value={design.headline}
                    onChange={e => updateDesign({ headline: e.target.value })}
                    maxLength={80}
                    placeholder="Escribe un titular corto"
                  />
                  <button
                    className="sx-secondary sx-suggest"
                    onClick={suggestHeadline}
                    disabled={!items.length || (!isStory && !caption.trim()) || suggesting}
                    title={isStory ? 'La IA propone un titular mirando la foto' : caption.trim() ? 'La IA propone un titular a partir del texto' : 'Genera primero el texto'}
                  >
                    {suggesting ? <span className="spinner" /> : <Icon name="sparkle" size={14} />} Sugerir
                  </button>
                </div>
                {design.template === 'aviso' && (
                  <div className="sx-field-col">
                    <input className="sx-input" value={design.label} onChange={e => updateDesign({ label: e.target.value })} maxLength={22} placeholder="Etiqueta: Novedad, Agenda abierta, Hoy…" />
                    <input className="sx-input" value={design.sub} onChange={e => updateDesign({ sub: e.target.value })} maxLength={60} placeholder="Texto pequeño (opcional): Escríbeme por DM" />
                  </div>
                )}
                {design.template === 'titular' && <div className="sx-tool-row">
                  <span className="sx-tool-label">Posición</span>
                  <button className={`sx-chip sx-chip-sm ${design.position === 'bottom' ? 'active' : ''}`} onClick={() => updateDesign({ position: 'bottom' })}>Abajo</button>
                  <button className={`sx-chip sx-chip-sm ${design.position === 'top' ? 'active' : ''}`} onClick={() => updateDesign({ position: 'top' })}>Arriba</button>
                </div>}
              </>
            )}

            {design.template === 'oferta' && (
              <div className="sx-field-col">
                <input
                  className="sx-input"
                  value={design.offer}
                  onChange={e => updateDesign({ offer: e.target.value })}
                  maxLength={16}
                  placeholder="-20 %  ·  39 €  ·  2x1"
                />
                <input
                  className="sx-input"
                  value={design.offerSub}
                  onChange={e => updateDesign({ offerSub: e.target.value })}
                  maxLength={36}
                  placeholder="Texto pequeño (opcional): Solo este mes"
                />
              </div>
            )}

            {design.template === 'marca' && (
              <p className="sx-hint">
                {brand.logo
                  ? 'Tu logo en una esquina y un marco fino con tu color.'
                  : <>Aún no tienes logo: se muestra el nombre de tu marca. <button className="sx-link sx-inline" onClick={onOpenSettings}>Subir logo</button></>}
              </p>
            )}

            {design.template !== 'none' && isCarousel && (
              <div className="sx-tool-row">
                <span className="sx-tool-label">Aplicar a</span>
                <button className={`sx-chip sx-chip-sm ${design.scope === 'first' ? 'active' : ''}`} onClick={() => updateDesign({ scope: 'first' })}>Solo la portada</button>
                <button className={`sx-chip sx-chip-sm ${design.scope === 'all' ? 'active' : ''}`} onClick={() => updateDesign({ scope: 'all' })}>Todas las fotos</button>
              </div>
            )}

            {design.template !== 'none' && !designActive && (
              <p className="sx-hint">Escribe el texto y verás el diseño sobre la foto.</p>
            )}

            {isStory && videoOn && (
              <div className="sx-anim">
                <div className="sx-seg">
                  <button className={!animated ? 'active' : ''} onClick={() => setAnimatedMode(false)}><Icon name="images" size={14} /> Foto fija</button>
                  <button className={animated ? 'active' : ''} onClick={() => setAnimatedMode(true)}><Icon name="zap" size={14} /> Animada (vídeo)</button>
                </div>
                {animated && (
                  <>
                    <div className="sx-tool-row">
                      <span className="sx-tool-label">Movimiento</span>
                      <button className={`sx-chip sx-chip-sm ${anim.zoom ? 'active' : ''}`} onClick={() => setAnim(a => ({ ...a, zoom: true }))}>Zoom lento</button>
                      <button className={`sx-chip sx-chip-sm ${!anim.zoom ? 'active' : ''}`} onClick={() => setAnim(a => ({ ...a, zoom: false }))}>Sin zoom</button>
                    </div>
                    <div className="sx-tool-row">
                      <span className="sx-tool-label">Duración</span>
                      {[5, 7, 10].map(d => (
                        <button key={d} className={`sx-chip sx-chip-sm ${anim.duration === d ? 'active' : ''}`} onClick={() => setAnim(a => ({ ...a, duration: d }))}>{d} s</button>
                      ))}
                    </div>
                    <div className="sx-tool-row">
                      <span className="sx-tool-label">Audio</span>
                      {audioFile ? (
                        <>
                          <span className="sx-audio-name"><Icon name="music" size={13} /> {audioFile.name}</span>
                          <button className="sx-link" onClick={() => setAudioFile(null)}>Quitar</button>
                        </>
                      ) : (
                        <label className="sx-chip sx-chip-sm sx-file">
                          <Icon name="music" size={13} /> Añadir audio
                          <input type="file" accept="audio/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setAudioFile(f); }} />
                        </label>
                      )}
                    </div>
                    <p className="sx-hint">
                      {isCarousel ? 'La animación usa la primera foto. ' : ''}
                      Usa audio tuyo o libre de derechos. Si prefieres la música de Instagram, déjalo vacío y termínala en Instagram.
                    </p>
                    <button className="sx-secondary" onClick={makeVideoClick} disabled={!!makingVideo || !items.length}>
                      {makingVideo
                        ? <><span className="spinner" /> {makingVideo.phase === 'rec' ? `Grabando la animación… ${Math.round((makingVideo.progress || 0) * 100)} %` : 'Preparando el vídeo…'}</>
                        : <><Icon name={videoReady ? 'refresh' : 'zap'} size={15} /> {videoReady ? 'Volver a crear el vídeo' : 'Crear vídeo y ver cómo queda'}</>}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className={`sx-card ${(isStory ? !items.length : !jobId) && !result ? 'locked' : ''}`}>
            <div className="sx-card-head">
              <span className="sx-card-icon"><Icon name="send" size={16} /></span>
              <h2>Publicar</h2>
            </div>

            {result ? (
              <div className="sx-done">
                <span className="sx-done-icon"><Icon name={result.scheduled ? 'calendar' : 'check'} size={26} stroke={2} /></span>
                <p>{result.message}</p>
                {result.demo && items.length > 0 && (
                  <div className="sx-manual-actions">
                    <button className="sx-secondary" onClick={downloadPhotos} disabled={!items.length || downloading}>
                      {downloading ? <><span className="spinner" /> Preparando…</> : <><Icon name="download" size={15} /> {items.length > 1 ? `Descargar ${items.length} fotos` : 'Descargar foto'}</>}
                    </button>
                    {!isStory && (
                    <button className="sx-secondary" onClick={copyCaption} disabled={!caption.trim()}>
                        <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copiado' : 'Copiar texto'}
                      </button>
                    )}
                  </div>
                )}
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

                {!connected && (
                  <div className="sx-manual">
                    <p className="sx-hint">
                      <Icon name="info" size={14} /> {isStory
                        ? 'Publicación manual: descarga la imagen ya diseñada y súbela como historia desde Instagram.'
                        : 'Publicación manual: descarga las fotos ya encuadradas y copia el texto para subirlos tú a Instagram. La publicación directa llegará pronto.'}
                    </p>
                    <div className="sx-manual-actions">
                      <button className="sx-secondary" onClick={downloadPhotos} disabled={!items.length || downloading}>
                        {downloading ? <><span className="spinner" /> Preparando…</> : <><Icon name="download" size={15} /> {items.length > 1 ? `Descargar ${items.length} fotos` : 'Descargar foto'}</>}
                      </button>
                      {!isStory && (
                      <button className="sx-secondary" onClick={copyCaption} disabled={!caption.trim()}>
                          <Icon name={copied ? 'check' : 'copy'} size={15} /> {copied ? 'Copiado' : 'Copiar texto'}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {isStory && (
                  <div className="sx-music">
                    <div className="sx-music-head"><Icon name="music" size={15} /> <strong>¿Con música?</strong></div>
                    <p className="sx-hint">Instagram no deja añadir música desde otras apps. Ábrela en Instagram, pon el sticker de Música y publícala desde allí.</p>
                    {music ? (
                      <div className="sx-music-tip">
                        {music.mood && <p>Ambiente: <strong>{music.mood}</strong></p>}
                        {music.searches?.length > 0 && (
                          <>
                            <div className="sx-tool-row">
                              {music.searches.map(t => (
                                <button key={t} className="sx-chip sx-chip-sm" onClick={() => copyTerm(t)} title="Copiar para pegarlo en el buscador de Música">
                                  <Icon name={copiedTerm === t ? 'check' : 'copy'} size={12} /> {copiedTerm === t ? 'Copiado' : t}
                                </button>
                              ))}
                            </div>
                            <p className="sx-hint">Toca un término para copiarlo y pégalo en el buscador del sticker de Música.</p>
                          </>
                        )}
                      </div>
                    ) : (
                      <button className="sx-link" onClick={suggestMusic} disabled={!items.length || suggestingMusic}>
                        {suggestingMusic ? <span className="spinner" /> : <Icon name="sparkle" size={14} />} Sugerir música para esta historia
                      </button>
                    )}
                    <button className="sx-secondary sx-music-go" onClick={finishInInstagram} disabled={!items.length || downloading}>
                      {downloading ? <><span className="spinner" /> Preparando…</> : <><Icon name="instagram" size={15} /> Terminar en Instagram con música</>}
                    </button>
                    {sharedToIg && (
                      <button className="sx-link" onClick={() => submitPublish({ manual: true })} disabled={publishing}>
                        <Icon name="check" size={14} /> Ya la publiqué en Instagram
                      </button>
                    )}
                  </div>
                )}

                {pubError && <div className="inline-error">{pubError}</div>}

                <button className="sx-primary" onClick={() => submitPublish()} disabled={isStory ? (!items.length || publishing || !!makingVideo) : (!jobId || !caption.trim() || publishing)}>
                  {publishing
                    ? <><span className="spinner" /> {makingVideo ? (makingVideo.phase === 'rec' ? 'Grabando la animación…' : 'Preparando el vídeo…') : 'Enviando…'}</>
                    : mode === 'schedule'
                      ? <><Icon name="calendar" size={16} /> {connected ? (isStory ? 'Programar historia' : 'Programar publicación') : 'Guardar en el calendario'}</>
                      : connected
                        ? <><Icon name="send" size={16} /> {isStory ? (items.length > 1 ? `Publicar ${items.length} historias` : 'Publicar historia') : 'Publicar en Instagram'}</>
                        : <><Icon name="check" size={16} /> Marcar como lista</>}
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
                    {item.image && (item.isVideo
                      ? <video src={item.image} muted playsInline preload="metadata" />
                      : <img src={item.image} alt="" />)}
                    {item.images?.length > 1 && item.kind !== 'story' && <span className="sx-post-multi"><Icon name="layers" size={12} /></span>}
                    {item.kind === 'story' && <span className="sx-post-story">Historia</span>}
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
              {openPost.isVideo
                ? <video src={openPost.image} controls playsInline style={{ maxWidth: '100%' }} />
                : <img src={openPost.image} alt="" />}
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
