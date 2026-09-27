// Conexión con Instagram por OAuth ("Instagram API with Instagram Login").
// Conecta una cuenta profesional directamente, sin página de Facebook.
// Las llamadas van a graph.instagram.com.
//
// Modo actual: una sola cuenta conectada para toda la app, guardada en
// server/data/instagram.json (fuera de git). El token nunca se envía al
// frontend. Cuando haya multi-usuario, esto pasa a la tabla de usuarios.
//
// Variables de entorno necesarias:
//   INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET → panel de Meta for Developers
//   PUBLIC_URL → URL pública del backend (Meta no acepta localhost). Se usa
//                para el callback OAuth y para servir las imágenes a Meta.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const CONN_PATH = path.join(__dir, '..', 'data', 'instagram.json');

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

// ─── Persistencia de la conexión ────────────────────────────────────────────
export function loadConnection() {
  try { return JSON.parse(fs.readFileSync(CONN_PATH, 'utf8')); }
  catch { return null; }
}

function saveConnection(conn) {
  fs.mkdirSync(path.dirname(CONN_PATH), { recursive: true });
  const tmp = CONN_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(conn, null, 2), 'utf8');
  fs.renameSync(tmp, CONN_PATH);
}

export function clearConnection() {
  try { fs.unlinkSync(CONN_PATH); } catch { /* ya no existía */ }
}

export function isConnected() {
  const c = loadConnection();
  return !!(c?.accessToken && c?.igUserId && (!c.expiresAt || new Date(c.expiresAt) > new Date()));
}

// Estado seguro para el frontend (sin token).
export function publicStatus() {
  const c = loadConnection();
  const expired = !!(c?.expiresAt && new Date(c.expiresAt) <= new Date());
  return {
    configured: missingConfig().length === 0,
    missing: missingConfig(),
    connected: isConnected(),
    expired,
    username: c?.username || null,
    profilePicture: c?.profilePicture || null,
    accountType: c?.accountType || null,
    connectedAt: c?.connectedAt || null,
    expiresAt: c?.expiresAt || null,
    legacyEnv: !!(process.env.META_ACCESS_TOKEN && process.env.META_INSTAGRAM_ACCOUNT_ID),
  };
}

// ─── OAuth ──────────────────────────────────────────────────────────────────
// state anti-CSRF: en memoria, un solo uso, caduca a los 10 minutos.
const pendingStates = new Map();

export function buildAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  for (const [s, t] of pendingStates) if (now - t > 10 * 60 * 1000) pendingStates.delete(s);
  pendingStates.set(state, now);

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

export function consumeState(state) {
  const t = pendingStates.get(state);
  pendingStates.delete(state);
  return !!t && Date.now() - t <= 10 * 60 * 1000;
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
  saveConnection(conn);
  return conn;
}

// ─── Renovación automática del token ────────────────────────────────────────
// Meta permite renovar un token largo si tiene más de 24 h y no ha caducado.
// Renovamos cuando le quedan menos de 10 días.
export async function refreshIfNeeded() {
  const c = loadConnection();
  if (!c?.accessToken || !c.expiresAt) return;
  const left = new Date(c.expiresAt).getTime() - Date.now();
  const age = Date.now() - new Date(c.refreshedAt || c.connectedAt).getTime();
  if (left <= 0 || left > 10 * DAY_MS || age < DAY_MS) return;

  try {
    const res = await axios.get(`${GRAPH}/refresh_access_token`, {
      params: { grant_type: 'ig_refresh_token', access_token: c.accessToken },
    });
    c.accessToken = res.data.access_token;
    c.refreshedAt = new Date().toISOString();
    c.expiresAt = new Date(Date.now() + res.data.expires_in * 1000).toISOString();
    saveConnection(c);
    console.log(`[instagram] Token renovado, caduca el ${c.expiresAt}`);
  } catch (err) {
    console.error('[instagram] No se pudo renovar el token:', err.response?.data?.error?.message || err.message);
  }
}

export function startTokenRefresher() {
  refreshIfNeeded();
  return setInterval(refreshIfNeeded, 12 * 60 * 60 * 1000);
}

// ─── Publicación ────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// imageUrl debe ser una URL pública (https) accesible por Meta.
export async function publishImage(imageUrl, caption) {
  const c = loadConnection();
  if (!c?.accessToken) throw new Error('No hay ninguna cuenta de Instagram conectada');

  const base = `${GRAPH}/${API_VERSION}/${c.igUserId}`;
  const container = await axios.post(`${base}/media`, null, {
    params: { image_url: imageUrl, caption, access_token: c.accessToken },
  });
  const creationId = container.data.id;

  // Esperar a que Meta procese la imagen (normalmente es inmediato).
  for (let i = 0; i < 10; i++) {
    const st = await axios.get(`${GRAPH}/${API_VERSION}/${creationId}`, {
      params: { fields: 'status_code', access_token: c.accessToken },
    });
    const code = st.data.status_code;
    if (code === 'FINISHED' || !code) break;
    if (code === 'ERROR' || code === 'EXPIRED') throw new Error(`Meta no pudo procesar la imagen (${code})`);
    await sleep(2000);
  }

  const pub = await axios.post(`${base}/media_publish`, null, {
    params: { creation_id: creationId, access_token: c.accessToken },
  });
  return { containerId: creationId, mediaId: pub.data.id };
}

// Mensaje legible a partir de un error de axios/Graph.
export function graphError(err) {
  return err.response?.data?.error?.message || err.response?.data?.error_message || err.message;
}
