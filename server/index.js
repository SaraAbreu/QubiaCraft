import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import generico from './modules/generico.js';
import seguros from './modules/seguros.js';
import inmobiliaria from './modules/inmobiliaria.js';
import { buildImagePrompt, generateImage } from './services/imageGen.js';
import { history, saveHistory, findEntry, saveImage, imagePath, imageMime, imageDataUrl } from './services/store.js';
import { startScheduler } from './services/scheduler.js';

// Arquitectura por verticales: cada módulo define su propio prompt y sus
// propios campos de perfil extra. 'generico' es el fallback para cualquier
// tipo de negocio que no tenga módulo dedicado.
const VERTICALS = [inmobiliaria, seguros, generico];

function resolveVertical(tipoNegocio) {
  const found = VERTICALS.find(v => v.matches.includes(tipoNegocio));
  return found || generico;
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
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: `Analiza estos ${examples.length} pares de captions de Instagram (versión IA vs versión editada por el usuario) e identifica los patrones de estilo y preferencias del usuario.

${pairs}

Responde SOLO con una lista numerada de 4-5 patrones concisos y específicos en español. Ejemplos de buenas respuestas: "Prefiere frases de máximo 10 palabras", "Siempre incluye el número de teléfono en el CTA", "Evita los signos de exclamación", "Usa tuteo informal". Sin introducción ni conclusión.`
      }],
      max_tokens: 300
    },
    { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
  );

  return response.data.choices[0].message.content.trim();
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
app.post('/api/generate', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibio imagen' });

    const base64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    const payload = {
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64}` }
          },
          {
            type: 'text',
            text: `Eres community manager experto en Instagram para pymes hispanohablantes.

${profileContext(loadProfile())}${voiceContext()}Analiza la imagen y genera EXACTAMENTE 3 captions distintos listos para publicar en Instagram, en español. Cada uno debe tener un tono diferente: el primero inspiracional, el segundo cercano/conversacional, el tercero directo/comercial.

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
      max_tokens: 1024
    };

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      payload,
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const raw = response.data.choices[0].message.content.replace(/\\#/g, '#');

    // Parsear las 3 opciones
    const parts = raw.split(/===OPCION_\d+===/);
    const captions = parts.map(p => p.trim()).filter(Boolean).slice(0, 3);
    // Fallback: si el modelo no respetó el formato, devolver el texto completo como única opción
    const captionList = captions.length >= 2 ? captions : [raw.trim()];

    // Guardar en historial con imagen en base64
    const id = Date.now();
    const entry = {
      id,
      date: new Date().toISOString(),
      caption: captionList[0],
      imageFile: saveImage(id, req.file.buffer, mimeType),
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
    res.status(500).json({ error: 'Error generando la imagen con IA', detail: err.message });
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
  if (!process.env.META_ACCESS_TOKEN || !process.env.META_INSTAGRAM_ACCOUNT_ID) {
    entry.status = 'published_demo';
    entry.publishedAt = new Date().toISOString();
    return {
      success: true,
      demo: true,
      message: 'Modo demo: Meta Graph API no configurada. El caption se aprobó correctamente.'
    };
  }

  try {
    // Paso 1: Subir imagen como contenedor
    const imageUrl = imageBase64; // En produccion deberia ser una URL publica
    const containerRes = await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.META_INSTAGRAM_ACCOUNT_ID}/media`,
      { image_url: imageUrl, caption, access_token: process.env.META_ACCESS_TOKEN }
    );
    const containerId = containerRes.data.id;

    // Paso 2: Publicar contenedor
    await axios.post(
      `https://graph.facebook.com/v19.0/${process.env.META_INSTAGRAM_ACCOUNT_ID}/media_publish`,
      { creation_id: containerId, access_token: process.env.META_ACCESS_TOKEN }
    );

    entry.status = 'published';
    entry.publishedAt = new Date().toISOString();
    return { success: true, containerId };
  } catch (err) {
    entry.status = 'error';
    console.error('Error en doPublish:', err.response?.data || err.message);
    return { success: false, error: 'Error publicando en Instagram', detail: err.message };
  }
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
    matches: v.matches,
    extraProfileFields: v.extraProfileFields,
  })));
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
  startScheduler(entry => doPublish(entry, entry.caption, entry.imageFile ? imageDataUrl(entry.imageFile) : entry.image));
});
