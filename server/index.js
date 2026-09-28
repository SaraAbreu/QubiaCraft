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
import { saveImage, imagePath, imageMime, deleteImages } from './services/store.js';
import * as repo from './services/repo.js';
import * as auth from './services/auth.js';
import { initDb } from './db.js';
import { hasLegacyData, migrateLegacyInto } from './services/legacy.js';
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

function voiceContext(voice) {
  const patterns = voice?.patterns;
  if (!patterns) return '';
  return `ESTILO APRENDIDO DEL USUARIO (respétalos estrictamente):\n${patterns}\n\n`;
}

const app = express();
// Detrás del proxy de Railway / Render: IP real del visitante (límite de
// intentos de login) y HTTPS correcto.
app.set('trust proxy', 1);

// Express 4 no captura errores de handlers async: los envolvemos para que un
// fallo (p. ej. de la base de datos) llegue al manejador de errores en vez
// de tumbar el proceso.
for (const method of ['get', 'post', 'patch', 'delete']) {
  const original = app[method].bind(app);
  app[method] = (route, ...handlers) => {
    if (!handlers.length) return original(route); // app.get('ajuste')
    return original(route, ...handlers.map(h => (typeof h === 'function' && h.length < 4
      ? (req, res, next) => { try { const r = h(req, res, next); if (r?.catch) r.catch(next); } catch (e) { next(e); } }
      : h)));
  };
}
const PORT = process.env.PORT || 3001;
const IS_PROD = process.env.NODE_ENV === 'production';

// Los datos (usuarios, perfiles, publicaciones, conexiones de Instagram)
// viven en la base de datos (ver db.js y services/repo.js).

// Multer — almacena en memoria para pasarlo a Groq como base64
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

app.use(cors());
app.use(express.json());
app.use(auth.loadUser);

// Todo /api exige sesión salvo estas rutas públicas:
// - auth: registro / login
// - images: Meta tiene que poder descargar las fotos (nombres no adivinables)
// - instagram/callback: vuelve desde Instagram, sin la cookie de la app
// - verticals: catálogo de sectores (sin datos de usuario)
const PUBLIC_API = [/^\/auth\//, /^\/images\//, /^\/instagram\/callback$/, /^\/verticals$/, /^\/health$/];
app.use('/api', (req, res, next) =>
  PUBLIC_API.some(r => r.test(req.path)) ? next() : auth.requireAuth(req, res, next));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ─── API: Cuentas (registro, login, sesión) ─────────────────────────────────
app.get('/api/auth/config', (req, res) => res.json(auth.signupConfig()));

app.get('/api/auth/me', (req, res) => res.json({ user: auth.publicUser(req.user) }));

app.post('/api/auth/register', async (req, res) => {
  const { signupOpen } = auth.signupConfig();
  if (!signupOpen) return res.status(403).json({ error: 'El registro está cerrado. Pide acceso a la administradora.' });

  const email = auth.normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const name = String(req.body?.name || '').trim().slice(0, 80);
  const key = `reg:${req.ip}`;
  if (auth.tooManyAttempts(key)) return res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
  auth.recordAttempt(key);

  if (!auth.inviteOk(req.body?.invite)) return res.status(403).json({ error: 'El código de invitación no es correcto' });
  if (!auth.validEmail(email)) return res.status(400).json({ error: 'Escribe un email válido' });
  if (password.length < 8) return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
  if (password.length > 200) return res.status(400).json({ error: 'La contraseña es demasiado larga' });
  if (await repo.findUserByEmail(email)) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

  const isFirst = (await repo.countUsers()) === 0;
  const user = await repo.createUser({ email, name, passwordHash: await auth.hashPassword(password) });

  // El primer usuario hereda los datos de la versión anterior (archivos JSON).
  let migrated = null;
  if (isFirst && hasLegacyData()) {
    migrated = await migrateLegacyInto(user.id);
    console.log(`[auth] Datos anteriores migrados a ${email}:`, migrated);
  }

  auth.setSession(res, user.id);
  res.json({ user: auth.publicUser(user), migrated });
});

app.post('/api/auth/login', async (req, res) => {
  const email = auth.normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const key = `login:${req.ip}:${email}`;
  if (auth.tooManyAttempts(key)) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });

  const user = email ? await repo.findUserByEmail(email) : null;
  const ok = user ? await auth.checkPassword(password, user.password_hash) : false;
  if (!ok) {
    auth.recordAttempt(key);
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }
  auth.clearAttempts(key);
  auth.setSession(res, user.id);
  res.json({ user: auth.publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  auth.clearSession(res);
  res.json({ success: true });
});

// ─── API: Generar caption con Groq Vision ────────────────────────────────────
// Acepta una imagen ('image', compatibilidad) o varias ('images', carrusel).
const uploadImages = upload.fields([{ name: 'image', maxCount: 1 }, { name: 'images', maxCount: 10 }]);
// Groq admite como máximo 3 imágenes por petición: la IA ve las 3 primeras.
const MAX_VISION_IMAGES = 3;

app.post('/api/generate', uploadImages, async (req, res) => {
  try {
    const files = [...(req.files?.images || []), ...(req.files?.image || [])].slice(0, 10);
    if (!files.length) return res.status(400).json({ error: 'No se recibio imagen' });

    const uid = req.user.id;
    const [profile, voice] = await Promise.all([repo.getProfile(uid), repo.getVoice(uid)]);
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

${profileContext(profile)}${voiceContext(voice)}${carouselNote}Analiza la imagen y genera EXACTAMENTE 3 captions distintos listos para publicar en Instagram, en español. Cada uno debe tener un tono diferente: el primero inspiracional, el segundo cercano/conversacional, el tercero directo/comercial.

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

    // Guardar la publicación (pendiente) con sus imágenes
    const imageFiles = files.map(f => saveImage(uid, f.buffer, f.mimetype));
    const post = await repo.createPost(uid, { caption: captionList[0], imageFiles, status: 'pending' });

    res.json({ captions: captionList, id: post.id });
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

    const profile = await repo.getProfile(req.user.id);
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

// Ejecuta la publicación real (cuenta de Instagram del dueño del post, o
// modo demo si no tiene ninguna conectada) y guarda el resultado.
// La usan "publicar ahora", "publicar ya" desde el historial y el programador.
async function doPublish(post) {
  const conn = await repo.getIgConnection(post.userId);
  const files = post.imageFiles || [];
  const publicUrls = ig.publicUrl() ? files.map(f => `${ig.publicUrl()}/api/images/${f}`) : [];
  const isCarousel = files.length > 1;

  let result, patch;

  if (ig.isConnected(conn)) {
    if (!publicUrls.length) {
      result = {
        success: false,
        error: 'Falta la URL pública de la imagen',
        detail: 'Configura PUBLIC_URL en el .env para que Meta pueda descargar la imagen.'
      };
      patch = { status: 'error', errorDetail: result.detail };
    } else {
      try {
        const { containerId, mediaId } = isCarousel
          ? await ig.publishCarousel(conn, publicUrls, post.caption)
          : await ig.publishImage(conn, publicUrls[0], post.caption);
        result = {
          success: true, containerId, mediaId,
          message: isCarousel ? `¡Carrusel de ${files.length} fotos publicado en Instagram!` : '¡Publicado en Instagram!'
        };
        patch = { status: 'published', publishedAt: new Date().toISOString(), igMediaId: mediaId, errorDetail: null };
      } catch (err) {
        console.error(`Error publicando (usuario ${post.userId}):`, err.response?.data || err.message);
        result = { success: false, error: 'Error publicando en Instagram', detail: ig.graphError(err) };
        patch = { status: 'error', errorDetail: result.detail };
      }
    }
  } else {
    // Sin cuenta conectada → modo demo.
    result = {
      success: true,
      demo: true,
      message: 'Modo demo: conecta tu Instagram en Perfil de marca para publicar de verdad. El caption se aprobó correctamente.'
    };
    patch = { status: 'published_demo', publishedAt: new Date().toISOString(), errorDetail: null };
  }

  const updated = await repo.updatePost(post.userId, post.id, patch);
  return { ...result, post: updated };
}

// Límite de antelación para programar.
const MAX_SCHEDULE_MS = 365 * 24 * 60 * 60 * 1000; // 1 año

function checkScheduleDate(value) {
  const d = new Date(value);
  const delay = d.getTime() - Date.now();
  if (isNaN(delay)) return { error: 'Fecha no válida' };
  if (delay <= 60000) return { error: 'Elige una hora al menos 1 minuto en el futuro' };
  if (delay > MAX_SCHEDULE_MS) return { error: 'Solo se puede programar hasta 1 año vista' };
  return { date: d };
}

function checkCaption(caption) {
  if (!String(caption || '').trim()) return 'El caption no puede estar vacío';
  if (String(caption).length > 2200) return 'Instagram admite como máximo 2200 caracteres';
  return null;
}

// Guarda el par (caption IA → caption editado) para aprender la voz del
// usuario. A partir de 3 ejemplos analiza patrones en segundo plano.
async function learnVoice(uid, originalCaption, caption) {
  if (!originalCaption || !caption || originalCaption.trim() === caption.trim()) return 0;
  const voice = await repo.getVoice(uid);
  voice.examples = [...(voice.examples || []), { original: originalCaption.trim(), final: caption.trim(), date: new Date().toISOString() }];
  await repo.saveVoice(uid, voice);
  const n = voice.examples.length;
  if (n >= 3) {
    analyzeVoice(voice.examples).then(async patterns => {
      const v = await repo.getVoice(uid);
      v.patterns = patterns;
      v.lastAnalyzed = new Date().toISOString();
      await repo.saveVoice(uid, v);
      console.log(`Voz del usuario ${uid} actualizada con ${n} ejemplos`);
    }).catch(err => console.error('Error analizando voz:', err.message));
  }
  return n;
}

// ─── API: Publicar o programar (desde el Estudio) ────────────────────────────
const EDITABLE = ['pending', 'scheduled', 'error', 'rejected'];

app.post('/api/publish', async (req, res) => {
  const uid = req.user.id;
  const { id, caption, originalCaption, scheduledFor } = req.body || {};

  const post = await repo.getPost(uid, id);
  if (!post) return res.status(404).json({ success: false, error: 'No se encontró la publicación' });
  if (!EDITABLE.includes(post.status)) {
    return res.status(409).json({ success: false, error: 'Esta publicación ya se publicó o se está publicando' });
  }
  const capErr = checkCaption(caption);
  if (capErr) return res.status(400).json({ success: false, error: capErr });

  const voiceExamples = await learnVoice(uid, originalCaption, caption);

  // ¿Programada para el futuro?
  if (scheduledFor) {
    const { date, error } = checkScheduleDate(scheduledFor);
    if (error) return res.status(400).json({ success: false, error });
    await repo.updatePost(uid, post.id, { caption, status: 'scheduled', scheduledFor: date.toISOString(), errorDetail: null });
    return res.json({
      success: true,
      scheduled: true,
      scheduledFor: date.toISOString(),
      voiceExamples,
      message: `Publicación programada para el ${date.toLocaleString('es-ES', { timeZone: process.env.TZ || 'Atlantic/Canary' })}.`
    });
  }

  // Publicación inmediata
  const claimed = await repo.transitionPost(uid, post.id, EDITABLE, { status: 'publishing', caption, scheduledFor: null, errorDetail: null });
  if (!claimed) return res.status(409).json({ success: false, error: 'Esta publicación ya se está publicando' });
  const { post: _published, ...result } = await doPublish(claimed);
  if (!result.success) return res.status(500).json(result);
  res.json({ ...result, voiceExamples });
});

// ─── API: Rechazar ───────────────────────────────────────────────────────────
app.post('/api/reject', async (req, res) => {
  const post = await repo.getPost(req.user.id, req.body?.id);
  if (post && EDITABLE.includes(post.status)) {
    await repo.updatePost(req.user.id, post.id, { status: 'rejected', scheduledFor: null });
  }
  res.json({ success: true });
});

// ─── API: Cancelar una publicación programada ───────────────────────────────
app.post('/api/unschedule', async (req, res) => {
  const post = await repo.getPost(req.user.id, req.body?.id);
  if (!post || post.status !== 'scheduled') {
    return res.status(400).json({ success: false, error: 'Esta publicación no está programada' });
  }
  await repo.updatePost(req.user.id, post.id, { status: 'pending', scheduledFor: null });
  res.json({ success: true });
});

// ─── API: Imágenes (públicas: Meta las descarga para publicar) ───────────────
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

// ─── API: Conexión con Instagram (OAuth, una cuenta por usuario) ─────────────
// A dónde volver tras el OAuth: el frontend (en dev, Vite en :5173).
function appUrl() {
  return (process.env.APP_URL || (IS_PROD ? ig.publicUrl() : 'http://localhost:5173')).replace(/\/+$/, '');
}

app.get('/api/instagram/status', async (req, res) => {
  res.json(ig.publicStatus(await repo.getIgConnection(req.user.id)));
});

app.get('/api/instagram/connect', (req, res) => {
  const missing = ig.missingConfig();
  if (missing.length) {
    return res.status(400).json({ error: `Faltan variables en el .env: ${missing.join(', ')}`, missing });
  }
  res.json({ url: ig.buildAuthUrl(req.user.id) });
});

app.get('/api/instagram/callback', async (req, res) => {
  const back = (status, msg) =>
    res.redirect(`${appUrl()}/?instagram=${status}${msg ? `&msg=${encodeURIComponent(msg)}` : ''}`);

  const { code, state, error, error_description } = req.query;
  if (error) return back('error', error_description || 'Autorización cancelada');
  const userId = code ? ig.consumeState(state) : null;
  if (!userId) return back('error', 'La sesión de conexión caducó. Vuelve a intentarlo.');

  try {
    const conn = await ig.completeOAuth(code);
    await repo.saveIgConnection(userId, conn);
    console.log(`[instagram] Usuario ${userId} conectó @${conn.username}`);
    back('connected');
  } catch (err) {
    console.error('[instagram] Error en OAuth:', err.response?.data || err.message);
    back('error', ig.graphError(err));
  }
});

app.post('/api/instagram/disconnect', async (req, res) => {
  await repo.deleteIgConnection(req.user.id);
  res.json({ success: true });
});

// Renovación automática de los tokens de todas las cuentas (cada 12 h).
async function refreshAllTokens() {
  try {
    for (const row of await repo.allIgConnections()) {
      const renewed = await ig.refreshIfNeeded(row.data);
      if (renewed) {
        await repo.saveIgConnection(row.user_id, renewed);
        console.log(`[instagram] Token de @${renewed.username} renovado, caduca el ${renewed.expiresAt}`);
      }
    }
  } catch (err) {
    console.error('[instagram] Error renovando tokens:', err.message);
  }
}

// ─── API: Perfil de marca ────────────────────────────────────────────────────
app.get('/api/profile', async (req, res) => res.json(await repo.getProfile(req.user.id)));

app.post('/api/profile', async (req, res) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Perfil no válido' });
    }
    await repo.saveProfile(req.user.id, body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo guardar el perfil' });
  }
});

// ─── API: Voz aprendida ──────────────────────────────────────────────────────
app.get('/api/voice', async (req, res) => {
  const { examples = [], patterns = null, lastAnalyzed = null } = await repo.getVoice(req.user.id);
  res.json({ count: examples.length, patterns, lastAnalyzed });
});

// ─── API: Historial ──────────────────────────────────────────────────────────
function publicItem(p) {
  return {
    id: p.id,
    date: p.createdAt,
    caption: p.caption,
    status: p.status,
    image: p.imageFiles[0] ? `/api/images/${p.imageFiles[0]}` : null,
    images: p.imageFiles.map(f => `/api/images/${f}`),
    scheduledFor: p.scheduledFor,
    publishedAt: p.publishedAt,
    publishedLate: p.publishedLate,
    errorDetail: p.errorDetail || null
  };
}

app.get('/api/history', async (req, res) => {
  res.json((await repo.listPosts(req.user.id)).map(publicItem));
});

// ─── API: Gestionar una publicación (editar, publicar ya, borrar) ────────────
// Editar caption y/o fecha. scheduledFor: ISO → programar/reprogramar;
// null → quitar la programación (queda pendiente).
app.patch('/api/posts/:id', async (req, res) => {
  const uid = req.user.id;
  const post = await repo.getPost(uid, req.params.id);
  if (!post) return res.status(404).json({ error: 'No se encontró la publicación' });
  if (!EDITABLE.includes(post.status)) {
    return res.status(409).json({ error: 'Esta publicación ya no se puede modificar' });
  }
  const { caption, scheduledFor } = req.body || {};
  const patch = { errorDetail: null, publishedLate: false };

  if (caption !== undefined) {
    const capErr = checkCaption(caption);
    if (capErr) return res.status(400).json({ error: capErr });
    patch.caption = String(caption);
  }

  if (scheduledFor !== undefined) {
    if (scheduledFor === null || scheduledFor === '') {
      patch.scheduledFor = null;
      patch.status = 'pending';
    } else {
      const { date, error } = checkScheduleDate(scheduledFor);
      if (error) return res.status(400).json({ error });
      patch.scheduledFor = date.toISOString();
      patch.status = 'scheduled';
    }
  } else if (post.status === 'error' || post.status === 'rejected') {
    patch.status = 'pending'; // tras corregirla vuelve a estar lista
  }

  // Solo si nadie la ha empezado a publicar mientras tanto.
  const updated = patch.status
    ? await repo.transitionPost(uid, post.id, EDITABLE, patch)
    : await repo.updatePost(uid, post.id, patch);
  if (!updated) return res.status(409).json({ error: 'La publicación cambió mientras la editabas; recarga' });
  res.json({ success: true, item: publicItem(updated) });
});

// Publicar ya (también sirve para adelantar una programada o reintentar un error).
app.post('/api/posts/:id/publish', async (req, res) => {
  const uid = req.user.id;
  const post = await repo.getPost(uid, req.params.id);
  if (!post) return res.status(404).json({ error: 'No se encontró la publicación' });
  const claimed = await repo.transitionPost(uid, post.id, EDITABLE, { status: 'publishing', scheduledFor: null, errorDetail: null });
  if (!claimed) return res.status(409).json({ error: 'Esta publicación ya se publicó o se está publicando' });
  const { post: updated, ...result } = await doPublish(claimed);
  res.status(result.success ? 200 : 500).json({ ...result, item: publicItem(updated) });
});

// Sustituir las fotos (p. ej. cambiaste el encuadre después de generar).
app.post('/api/posts/:id/images', uploadImages, async (req, res) => {
  const uid = req.user.id;
  const post = await repo.getPost(uid, req.params.id);
  if (!post) return res.status(404).json({ error: 'No se encontró la publicación' });
  if (!EDITABLE.includes(post.status)) {
    return res.status(409).json({ error: 'Esta publicación ya no se puede modificar' });
  }
  const files = [...(req.files?.images || []), ...(req.files?.image || [])].slice(0, 10);
  if (!files.length) return res.status(400).json({ error: 'No se recibió ninguna imagen' });
  if (files.some(f => !f.mimetype?.startsWith('image/'))) return res.status(400).json({ error: 'Solo se admiten imágenes' });

  const imageFiles = files.map(f => saveImage(uid, f.buffer, f.mimetype));
  const updated = await repo.updatePost(uid, post.id, { imageFiles });
  deleteImages(post.imageFiles.filter(f => !imageFiles.includes(f)));
  res.json({ success: true, item: publicItem(updated) });
});

// Borrar de Qubia Craft (no borra nada que ya esté en Instagram).
app.delete('/api/posts/:id', async (req, res) => {
  const uid = req.user.id;
  const post = await repo.getPost(uid, req.params.id);
  if (!post) return res.status(404).json({ error: 'No se encontró la publicación' });
  if (post.status === 'publishing') {
    return res.status(409).json({ error: 'Se está publicando ahora mismo; espera a que termine' });
  }
  const deleted = await repo.deletePost(uid, post.id);
  if (deleted) deleteImages(deleted.imageFiles);
  res.json({ success: true });
});

// Errores no controlados en rutas async → 500 en JSON (no tumban el servidor).
app.use('/api', (err, req, res, next) => {
  console.error('Error en', req.method, req.path, '→', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ─── Servir frontend en produccion ───────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.join(__file, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Qubia Craft corriendo en http://localhost:${PORT}`);
    if (!IS_PROD) console.log(`Frontend dev: http://localhost:5173`);
  });
  refreshAllTokens();
  setInterval(refreshAllTokens, 12 * 60 * 60 * 1000);
  await startScheduler(doPublish);
}

start().catch(err => {
  console.error('No se pudo arrancar Qubia Craft:', err);
  process.exit(1);
});
