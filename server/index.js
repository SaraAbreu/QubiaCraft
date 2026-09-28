import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { VERTICALS, resolveVertical } from './modules/index.js';
import { buildImagePrompt, generateImage } from './services/imageGen.js';
import { history, saveHistory, findEntry, saveImage, imagePath, imageMime, imageDataUrl } from './services/store.js';
import { startScheduler } from './services/scheduler.js';
import * as ig from './services/instagram.js';

// Arquitectura por verticales: cada módulo (server/modules) define su propio
// prompt, campos de perfil extra, estilo de imagen y ejemplos. 'generico' es
// el fallback para cualquier tipo de negocio sin módulo dedicado.

// Modelo de visión de Groq. llama-4-scout fue retirado (model_not_found);
// se puede cambiar sin tocar código con GROQ_VISION_MODEL en el .env.
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.8-27b';

// Los modelos Qwen de Groq "piensan" por defecto: lo desactivamos para que
// la respuesta sea solo el caption (y más rápida).
function groqReasoningOpts() {
  return GROQ_VISION_MODEL.startsWith('qwen/') ? { reasoning_effort: 'none' } : {};
}

// Por si algún modelo devuelve igualmente su razonamiento entre <think>…</think>.
function stripThinking(text = '') {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

// Qwen a veces "se cuela" al chino a mitad de frase. Mensaje de sistema que
// fija el idioma + detección de caracteres chinos/japoneses/coreanos.
const SPANISH_ONLY = {
  role: 'system',
  content: 'Responde SIEMPRE y ÚNICAMENTE en español de España. Nunca uses chino, inglés ni ningún otro idioma ni caracteres no latinos (salvo emojis).'
};
const CJK_RE = /[\u3000-\u303f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uff00-\uffef]/;
const CJK_RE_G = new RegExp(CJK_RE.source, 'g');
function removeCJK(text = '') {
  return text.replace(CJK_RE_G, '').replace(/[ \t]{2,}/g, ' ');
}

const __file = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = path.join(__file, 'profile.json');
const VOICE_PATH   = path.join(__file, 'voice.json');

function loadProfile() {
  try { return JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')); }
  catch { return {}; }
}

function loadVoice() {
  try { return JSON.parse(fs.readFileSync(VOICE_PATH, 'utf8')); }
  catch { return { examples: [], patterns: null }; }
}

function saveVoice(data) {
  fs.writeFileSync(VOICE_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function analyzeVoice(examples) {
  const pairs = examples.map((e, i) =>
    `--- Par ${i + 1} ---\nOriginal IA:\n${e.original}\n\nEditado por el usuario:\n${e.final}`
  ).join('\n\n');

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: GROQ_VISION_MODEL,
      ...groqReasoningOpts(),
      messages: [SPANISH_ONLY, {
        role: 'user',
        content: `Analiza estos ${examples.length} pares de captions de Instagram (versión IA vs versión editada por el usuario) e identifica los patrones de estilo y preferencias del usuario.

${pairs}

Responde SOLO con una lista numerada de 4-5 patrones concisos y específicos en español. Ejemplos de buenas respuestas: "Prefiere frases de máximo 10 palabras", "Siempre incluye el número de teléfono en el CTA", "Evita los signos de exclamación", "Usa tuteo informal". Sin introducción ni conclusión.`
      }],
      max_tokens: 300
    },
    { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
  );

  return removeCJK(stripThinking(response.data.choices[0].message.content));
}

function profileContext(p) {
  if (!p || !p.nombre) return '';
  const vertical = resolveVertical(p.tipoNegocio);
  const v = p.vertical || {};

  const lines = [
    `Empresa: ${p.nombre}`,
    p.tipoNegocio ? `Tipo de negocio: ${p.tipoNegocio}` : '',
    p.sector    ? `Sector / detalle: ${p.sector}` : '',
    p.ciudad    ? `Ubicación: ${p.ciudad}` : '',
    p.servicios ? `Productos/servicios: ${p.servicios}` : '',
    p.tono      ? `Tono de comunicación: ${p.tono}` : '',
    p.cta       ? `CTA habitual: ${p.cta}` : '',
    p.hashtags  ? `Hashtags propios: ${p.hashtags}` : '',
  ];

  // Campos extra propios del módulo/vertical activo (ej: zona de cobertura
  // para inmobiliaria, tipos de póliza para seguros).
  vertical.extraProfileFields.forEach(f => {
    if (v[f.name]) lines.push(`${f.label}: ${v[f.name]}`);
  });

  const hintBlock = vertical.promptGuidance
    ? `\nEnfoque recomendado para este tipo de negocio (${vertical.label}): ${vertical.promptGuidance}`
    : '';
  const disclaimerBlock = v.disclaimer
    ? `\nIncluye este disclaimer al final del caption, en una línea aparte: "${v.disclaimer}"`
    : '';

  return `CONTEXTO DE MARCA (úsalo siempre, no pongas placeholders):\n${lines.filter(Boolean).join('\n')}${hintBlock}${disclaimerBlock}\n\n`;
}

function voiceContext() {
  const { patterns } = loadVoice();
  if (!patterns) return '';
  return `ESTILO APRENDIDO DEL USUARIO (respétalos estrictamente):\n${patterns}\n\n`;
}

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// El historial vive en server/data/history.json (ver services/store.js) y
// sobrevive a reinicios del servidor.

// Multer — almacena en memoria para pasarlo a Groq como base64
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

app.use(cors());
app.use(express.json());

// ─── API: Generar caption con Groq Vision ────────────────────────────────────
// Acepta una imagen ('image', compatibilidad) o varias ('images', carrusel).
const uploadImages = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 10 }]);
// Groq admite como máximo 3 imágenes por petición: la IA ve las 3 primeras.
const MAX_VISION_IMAGES = 3;

app.post('/api/generate', uploadImages, async (req, res) => {
  try {
    const files = [...(req.files?.images || []), ...(req.files?.image || [])].slice(0, 10);
    if (!files.length) return res.status(400).json({ error: 'No se recibio imagen' });

    const isCarousel = files.length > 1;
    const seen = files.slice(0, MAX_VISION_IMAGES);
    const imageParts = seen.map(f => ({
      type: 'image_url',
      image_url: { url: `data:${f.mimetype};base64,${f.buffer.toString('base64')}` }
    }));
    const carouselNote = isCarousel
      ? `Es un CARRUSEL de ${files.length} fotos (se te muestran ${seen.length === files.length ? 'todas' : `las ${seen.length} primeras`}, en orden). Escribe un caption que funcione para la serie completa, no para una sola foto, e invita a deslizar para ver el resto.\n\n`
      : '';

    const payload = {
      model: GROQ_VISION_MODEL,
      ...groqReasoningOpts(),
      messages: [SPANISH_ONLY, {
        role: 'user',
        content: [
          ...imageParts,
          {
            type: 'text',
            text: `Eres community manager experto en Instagram para pymes hispanohablantes.

${profileContext(loadProfile())}${voiceContext()}${carouselNote}Analiza la imagen y genera EXACTAMENTE 3 captions distintos listos para publicar en Instagram, en español. Cada uno debe tener un tono diferente: el primero inspiracional, el segundo cercano/conversacional, el tercero directo/comercial.

Formato OBLIGATORIO — respeta los separadores exactos:

===OPCION_1===
[caption completo]
===OPCION_2===
[caption completo]
===OPCION_3===
[caption completo]

Cada caption debe tener:
- Primera línea: frase gancho impactante
- 2-3 frases conectando la imagen con un producto o servicio
- Llamada a la acción clara
- 5 hashtags relevantes al final

NO incluyas descripciones, explicaciones ni texto fuera de los separadores. Máximo 2200 caracteres por caption.`
          }
        ]
      }],
      max_tokens: 1024,
      temperature: 0.6
    };

    const callGroq = async () => {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        payload,
        { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
      );
      return stripThinking(response.data.choices[0].message.content).replace(/\\#/g, '#');
    };

    let raw = await callGroq();
    if (CJK_RE.test(raw)) {
      console.warn('Caption con caracteres no latinos; reintentando una vez…');
      raw = await callGroq();
    }
    raw = removeCJK(raw);

    // Parsear las 3 opciones
    const parts = raw.split(/===OPCION_\d+===/);
    const captions = parts.map(p => p.trim()).filter(Boolean).slice(0, 3);
    // Fallback: si el modelo no respetó el formato, devolver el texto completo como única opción
    const captionList = captions.length >= 2 ? captions : [raw.trim()];

    // Guardar en historial con imagen en base64
    const id = Date.now();
    const imageFiles = files.map((f, i) => saveImage(i === 0 ? id : `${id}-${i + 1}`, f.buffer, f.mimetype));
    const entry = {
      id,
      date: new Date().toISOString(),
      caption: captionList[0],
      imageFile: imageFiles[0],
      ...(isCarousel ? { imageFiles } : {}),
      status: 'pending'
    };
    history.unshift(entry);
    saveHistory();

    res.json({ captions: captionList, id: entry.id });
  } catch (err) {
    console.error('Error en /api/generate:', err.response?.data || err.message);
    res.status(500).json({ error: 'Error generando caption', detail: err.message });
  }
});

// ─── API: Generar imagen con IA (Pollinations.AI, sin API key) ──────────────
app.post('/api/generate-image', express.json(), async (req, res) => {
  try {
    const { description } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Describe qué imagen quieres generar' });
    }

    const profile = loadProfile();
    const vertical = resolveVertical(profile.tipoNegocio);
    const prompt = buildImagePrompt(description, profile, vertical);

    const { buffer, contentType } = await generateImage(prompt);
    res.set('Content-Type', contentType);
    res.send(buffer);
  } catch (err) {
    console.error('Error en /api/generate-image:', err.response?.data || err.message);
    res.status(500).json({ error: err.message || 'Error generando la imagen con IA' });
  }
});

// Límite de antelación para programar (el programador es persistente, así
// que ya no depende de timers en memoria).
const MAX_SCHEDULE_MS = 365 * 24 * 60 * 60 * 1000; // 1 año

// Ejecuta la publicación real (demo o Meta Graph API) sobre una entrada del
// historial. Se usa tanto para "publicar ahora" como para el disparo diferido
// de una publicación programada.
async function doPublish(entry, caption, imageBase64) {
  entry = entry || {};
  const files = entry.imageFiles?.length ? entry.imageFiles : (entry.imageFile ? [entry.imageFile] : []);
  const publicUrls = ig.publicUrl() ? files.map(f => `${ig.publicUrl()}/api/images/${f}`) : [];
  const imagePublicUrl = publicUrls[0] || null;
  const isCarousel = files.length > 1;

  // 1) Cuenta conectada por OAuth (Instagram Login) — modo principal.
  if (ig.isConnected()) {
    if (!imagePublicUrl) {
      entry.status = 'error';
      return {
        success: false,
        error: 'Falta la URL pública de la imagen',
        detail: 'Configura PUBLIC_URL en el .env para que Meta pueda descargar la imagen.'
      };
    }
    try {
      const { containerId, mediaId } = isCarousel
        ? await ig.publishCarousel(publicUrls, caption)
        : await ig.publishImage(imagePublicUrl, caption);
      entry.status = 'published';
      entry.publishedAt = new Date().toISOString();
      entry.igMediaId = mediaId;
      return { success: true, containerId, mediaId, message: isCarousel ? `¡Carrusel de ${files.length} fotos publicado en Instagram!` : '¡Publicado en Instagram!' };
    } catch (err) {
      entry.status = 'error';
      const detail = ig.graphError(err);
      console.error('Error publicando (Instagram Login):', err.response?.data || err.message);
      return { success: false, error: 'Error publicando en Instagram', detail };
    }
  }

  // 2) Token fijo en .env (META_ACCESS_TOKEN + META_INSTAGRAM_ACCOUNT_ID) — modo antiguo.
  if (process.env.META_ACCESS_TOKEN && process.env.META_INSTAGRAM_ACCOUNT_ID) {
    if (isCarousel) {
      entry.status = 'error';
      return { success: false, error: 'Carrusel no disponible en este modo', detail: 'Conecta tu Instagram en Perfil de marca para publicar carruseles.' };
    }
    try {
      const containerRes = await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.META_INSTAGRAM_ACCOUNT_ID}/media`,
        { image_url: imagePublicUrl || imageBase64, caption, access_token: process.env.META_ACCESS_TOKEN }
      );
      const containerId = containerRes.data.id;
      await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.META_INSTAGRAM_ACCOUNT_ID}/media_publish`,
        { creation_id: containerId, access_token: process.env.META_ACCESS_TOKEN }
      );
      entry.status = 'published';
      entry.publishedAt = new Date().toISOString();
      return { success: true, containerId, message: '¡Publicado en Instagram!' };
    } catch (err) {
      entry.status = 'error';
      console.error('Error en doPublish:', err.response?.data || err.message);
      return { success: false, error: 'Error publicando en Instagram', detail: ig.graphError(err) };
    }
  }

  // 3) Sin conexión → modo demo.
  entry.status = 'published_demo';
  entry.publishedAt = new Date().toISOString();
  return {
    success: true,
    demo: true,
    message: 'Modo demo: conecta tu Instagram en Perfil de marca para publicar de verdad. El caption se aprobó correctamente.'
  };
}

// ─── API: Publicar o programar en Instagram ──────────────────────────────────
app.post('/api/publish', async (req, res) => {
  const { id, caption, originalCaption, imageBase64, mimeType, scheduledFor } = req.body;

  const entry = findEntry(id);
  if (entry) { entry.caption = caption; delete entry.errorDetail; }

  // Guardar par para aprendizaje de voz (solo si el usuario editó)
  let voiceExamples = 0;
  if (originalCaption && caption && originalCaption.trim() !== caption.trim()) {
    const voice = loadVoice();
    voice.examples.push({ original: originalCaption.trim(), final: caption.trim(), date: new Date().toISOString() });
    saveVoice(voice);
    voiceExamples = voice.examples.length;

    // Analizar patrones a partir de 3 ejemplos (en background, sin bloquear respuesta)
    if (voiceExamples >= 3) {
      analyzeVoice(voice.examples).then(patterns => {
        const v = loadVoice();
        v.patterns = patterns;
        v.lastAnalyzed = new Date().toISOString();
        saveVoice(v);
        console.log(`Voz actualizada con ${voiceExamples} ejemplos`);
      }).catch(err => console.error('Error analizando voz:', err.message));
    }
  }

  // ¿Publicación programada para el futuro?
  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
  const delay = scheduledDate ? scheduledDate.getTime() - Date.now() : 0;

  if (scheduledDate && !isNaN(delay) && delay > 60000 && delay <= MAX_SCHEDULE_MS) {
    if (!entry) {
      return res.status(404).json({ success: false, error: 'No se encontró la publicación a programar' });
    }
    entry.status = 'scheduled';
    entry.scheduledFor = scheduledDate.toISOString();
    saveHistory();

    return res.json({
      success: true,
      scheduled: true,
      scheduledFor: entry.scheduledFor,
      voiceExamples,
      message: `Publicación programada para el ${scheduledDate.toLocaleString('es-ES')}.`
    });
  }

  // Publicación inmediata
  if (entry) { entry.status = 'publishing'; saveHistory(); }
  const result = await doPublish(entry, caption, imageBase64);
  if (entry) { if (!result.success) entry.errorDetail = result.detail; saveHistory(); }
  if (!result.success) return res.status(500).json(result);
  res.json({ ...result, voiceExamples });
});

// ─── API: Rechazar ───────────────────────────────────────────────────────────
app.post('/api/reject', (req, res) => {
  const { id } = req.body;
  const entry = findEntry(id);
  if (entry) { entry.status = 'rejected'; saveHistory(); }
  res.json({ success: true });
});

// ─── API: Cancelar una publicación programada ───────────────────────────────
app.post('/api/unschedule', (req, res) => {
  const entry = findEntry(req.body.id);
  if (!entry || entry.status !== 'scheduled') {
    return res.status(400).json({ success: false, error: 'Esta publicación no está programada' });
  }
  entry.status = 'pending';
  delete entry.scheduledFor;
  saveHistory();
  res.json({ success: true });
});

// ─── API: Imágenes del historial ─────────────────────────────────────────────
app.get('/api/images/:file', (req, res) => {
  const p = imagePath(req.params.file);
  if (!p) return res.status(404).end();
  res.type(imageMime(req.params.file)).sendFile(p);
});

// ─── API: Verticales disponibles ─────────────────────────────────────────────
app.get('/api/verticals', (req, res) => {
  res.json(VERTICALS.map(v => ({
    key: v.key,
    label: v.label,
    icon: v.icon || '',
    limites: v.limites || [],
    matches: v.matches.filter(m => m !== 'default'),
    ejemplos: v.ejemplos || {},
    extraProfileFields: v.extraProfileFields,
  })));
});

// ─── API: Conexión con Instagram (OAuth) ─────────────────────────────────────
// A dónde volver tras el OAuth: el frontend (en dev, Vite en :5173).
function appUrl() {
  return (process.env.APP_URL || (IS_PROD ? ig.publicUrl() : 'http://localhost:5173')).replace(/\/+$/, '');
}

app.get('/api/instagram/status', (req, res) => res.json(ig.publicStatus()));

app.get('/api/instagram/connect', (req, res) => {
  const missing = ig.missingConfig();
  if (missing.length) {
    return res.status(400).json({ error: `Faltan variables en el .env: ${missing.join(', ')}`, missing });
  }
  res.json({ url: ig.buildAuthUrl() });
});

app.get('/api/instagram/callback', async (req, res) => {
  const back = (status, msg) =>
    res.redirect(`${appUrl()}/?instagram=${status}${msg ? `&msg=${encodeURIComponent(msg)}` : ''}`);

  const { code, state, error, error_description } = req.query;
  if (error) return back('error', error_description || 'Autorización cancelada');
  if (!code || !ig.consumeState(state)) return back('error', 'La sesión de conexión caducó. Vuelve a intentarlo.');

  try {
    const conn = await ig.completeOAuth(code);
    console.log(`[instagram] Conectada @${conn.username}`);
    back('connected');
  } catch (err) {
    console.error('[instagram] Error en OAuth:', err.response?.data || err.message);
    back('error', ig.graphError(err));
  }
});

app.post('/api/instagram/disconnect', (req, res) => {
  ig.clearConnection();
  res.json({ success: true });
});

// ─── API: Perfil de marca ────────────────────────────────────────────────────
app.get('/api/profile', (req, res) => res.json(loadProfile()));

app.post('/api/profile', express.json(), (req, res) => {
  try {
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el perfil' });
  }
});

// ─── API: Voz aprendida ──────────────────────────────────────────────────────
app.get('/api/voice', (req, res) => {
  const { examples, patterns, lastAnalyzed } = loadVoice();
  res.json({ count: examples.length, patterns, lastAnalyzed });
});

// ─── API: Historial ──────────────────────────────────────────────────────────
app.get('/api/history', (req, res) => {
  res.json(history.map(h => ({
    id: h.id,
    date: h.date,
    caption: h.caption,
    status: h.status,
    image: h.imageFile ? `/api/images/${h.imageFile}` : h.image,
    images: (h.imageFiles || (h.imageFile ? [h.imageFile] : [])).map(f => `/api/images/${f}`),
    scheduledFor: h.scheduledFor || null,
    publishedAt: h.publishedAt || null,
    publishedLate: !!h.publishedLate,
    errorDetail: h.errorDetail || null
  })));
});

// ─── Servir frontend en produccion ───────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__file, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Qubia Craft corriendo en http://localhost:${PORT}`);
  if (!IS_PROD) console.log(`Frontend dev: http://localhost:5173`);
  ig.startTokenRefresher();
  startScheduler(entry => doPublish(entry, entry.caption, entry.imageFile ? imageDataUrl(entry.imageFile) : entry.image));
});
