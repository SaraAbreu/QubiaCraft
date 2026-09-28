// Conexión con Instagram por OAuth ("Instagram API with Instagram Login").
// Cada usuario de Qubia Craft conecta SU cuenta profesional; la conexión se
// guarda en la base de datos (tabla instagram_connections, ver repo.js).
// Este módulo no guarda nada: recibe y devuelve objetos de conexión.
// El token nunca se envía al frontend.
//
// Variables de entorno necesarias:
//   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET → panel de Meta for Developers
//   PUBLIC_URL → URL pública del backend (Meta no acepta localhost). Se usa
//                para el callback OAuth y para servir las imágenes a Meta.
import crypto from 'crypto';
import axios from 'axios';

const GRAPH = 'https://graph.instagram.com';
const API_VERSION = 'v21.0';
const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish'];
const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Configuración ──────────────────────────────────────────────────────────
export function publicUrl() {
  return (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
}

export function redirectUri() {
  return `${publicUrl()}/api/instagram/callback`;
}

export function missingConfig() {
  return ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET', 'PUBLIC_URL'].filter(k => !process.env[k]);
}

export function isConnected(c) {
  return !!(c?.accessToken && c?.igUserId && (!c.expiresAt || new Date(c.expiresAt) > new Date()));
}

// Estado seguro para el frontend (sin token).
export function publicStatus(c) {
  const expired = !!(c?.expiresAt && new Date(c.expiresAt) <= new Date());
  return {
    configured: missingConfig().length === 0,
    missing: missingConfig(),
    connected: isConnected(c),
    expired,
    username: c?.username || null,
    profilePicture: c?.profilePicture || null,
    accountType: c?.accountType || null,
    connectedAt: c?.connectedAt || null,
    expiresAt: c?.expiresAt || null,
  };
}

// ─── OAuth ──────────────────────────────────────────────────────────────────
// state anti-CSRF: en memoria, un solo uso, caduca a los 10 minutos.
// Además dice qué usuario inició la conexión: el callback llega desde
// Instagram a PUBLIC_URL, donde no está la cookie de sesión de la app.
const STATE_TTL = 10 * 60 * 1000;
const pendingStates = new Map(); // state → { t, userId }

export function buildAuthUrl(userId) {
  const state = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  for (const [s, v] of pendingStates) if (now - v.t > STATE_TTL) pendingStates.delete(s);
  pendingStates.set(state, { t: now, userId });

  const params = new URLSearchParams({
    client_id: process.env.INSTAGRAM_APP_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES.join(','),
    state,
    enable_fb_login: '0',
    force_authentication: '1',
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

// Devuelve el id del usuario que inició la conexión, o null si no vale.
export function consumeState(state) {
  const v = pendingStates.get(state);
  pendingStates.delete(state);
  return v && Date.now() - v.t <= STATE_TTL ? v.userId : null;
}

// Código → token corto (~1 h) → token largo (60 días) → datos de la cuenta.
export async function completeOAuth(rawCode) {
  const code = String(rawCode).replace(/#_$/, '');

  const shortRes = await axios.post(
    'https://api.instagram.com/oauth/access_token',
    new URLSearchParams({
      client_id: process.env.INSTAGRAM_APP_ID,
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri(),
      code,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const short = Array.isArray(shortRes.data?.data) ? shortRes.data.data[0] : shortRes.data;

  const longRes = await axios.get(`${GRAPH}/access_token`, {
    params: {
      grant_type: 'ig_exchange_token',
      client_secret: process.env.INSTAGRAM_APP_SECRET,
      access_token: short.access_token,
    },
  });
  const { access_token, expires_in } = longRes.data;

  const meRes = await axios.get(`${GRAPH}/${API_VERSION}/me`, {
    params: { fields: 'user_id,username,account_type,profile_picture_url', access_token },
  });
  const me = meRes.data;

  const conn = {
    accessToken: access_token,
    igUserId: String(me.user_id || me.id || short.user_id),
    username: me.username,
    accountType: me.account_type || null,
    profilePicture: me.profile_picture_url || null,
    connectedAt: new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + (expires_in || 60 * 24 * 3600) * 1000).toISOString(),
  };
  return conn;
}

// ─── Renovación del token ───────────────────────────────────────────────────
// Meta permite renovar un token largo si tiene más de 24 h y no ha caducado.
// Renovamos cuando le quedan menos de 10 días. Devuelve la conexión
// renovada, o null si no hacía falta (o no se pudo).
export async function refreshIfNeeded(c) {
  if (!c?.accessToken || !c.expiresAt) return null;
  const left = new Date(c.expiresAt).getTime() - Date.now();
  const age = Date.now() - new Date(c.refreshedAt || c.connectedAt).getTime();
  if (left <= 0 || left > 10 * DAY_MS || age < DAY_MS) return null;

  try {
    const res = await axios.get(`${GRAPH}/refresh_access_token`, {
      params: { grant_type: 'ig_refresh_token', access_token: c.accessToken },
    });
    return {
      ...c,
      accessToken: res.data.access_token,
      refreshedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + res.data.expires_in * 1000).toISOString(),
    };
  } catch (err) {
    console.error(`[instagram] No se pudo renovar el token de @${c.username}:`, err.response?.data?.error?.message || err.message);
    return null;
  }
}

// ─── Publicación ────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Espera a que Meta termine de procesar un contenedor (normalmente inmediato).
async function waitForContainer(creationId, token) {
  for (let i = 0; i < 15; i++) {
    const st = await axios.get(`${GRAPH}/${API_VERSION}/${creationId}`, {
      params: { fields: 'status_code', access_token: token },
    });
    const code = st.data.status_code;
    if (code === 'FINISHED' || !code) return;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Meta no pudo procesar la imagen (${code})`);
    await sleep(2000);
  }
}

function requireConnection(c) {
  if (!isConnected(c)) throw new Error('No hay ninguna cuenta de Instagram conectada (o el token caducó)');
  return c;
}

// imageUrl debe ser una URL pública (https) accesible por Meta.
export async function publishImage(conn, imageUrl, caption) {
  const c = requireConnection(conn);
  const base = `${GRAPH}/${API_VERSION}/${c.igUserId}`;
  const container = await axios.post(`${base}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: c.accessToken },
  });
  const creationId = container.data.id;
  await waitForContainer(creationId, c.accessToken);

  const pub = await axios.post(`${base}/media_publish`, null, {
    params: { creation_id: creationId, access_token: c.accessToken },
  });
  return { containerId: creationId, mediaId: pub.data.id };
}

// Carrusel: de 2 a 10 imágenes (límite de la API de Meta). Se crea un
// contenedor por imagen (is_carousel_item) y luego el contenedor CAROUSEL
// que las agrupa, en el orden recibido.
export const CAROUSEL_MAX = 10;
export async function publishCarousel(conn, imageUrls, caption) {
  if (imageUrls.length < 2) return publishImage(conn, imageUrls[0], caption);
  if (imageUrls.length > CAROUSEL_MAX) throw new Error(`Un carrusel admite como máximo ${CAROUSEL_MAX} imágenes`);
  const c = requireConnection(conn);
  const base = `${GRAPH}/${API_VERSION}/${c.igUserId}`;

  const children = [];
  for (const url of imageUrls) {
    const child = await axios.post(`${base}/media`, null, {
      params: { image_url: url, is_carousel_item: true, access_token: c.accessToken },
    });
    await waitForContainer(child.data.id, c.accessToken);
    children.push(child.data.id);
  }

  const container = await axios.post(`${base}/media`, null, {
    params: { media_type: 'CAROUSEL', children: children.join(','), caption, access_token: c.accessToken },
  });
  const creationId = container.data.id;
  await waitForContainer(creationId, c.accessToken);

  const pub = await axios.post(`${base}/media_publish`, null, {
    params: { creation_id: creationId, access_token: c.accessToken },
  });
  return { containerId: creationId, mediaId: pub.data.id };
}

// Mensaje legible a partir de un error de axios/Graph.
export function graphError(err) {
  return err.response?.data?.error?.message || err.response?.data?.error_message || err.message;
}
