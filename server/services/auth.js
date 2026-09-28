// Autenticación: email + contraseña (bcrypt) y sesión JWT en una cookie
// httpOnly. El frontend no toca el token: el navegador manda la cookie solo.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as repo from './repo.js';
import { DATA_DIR } from './store.js';

const COOKIE = 'qc_session';
const SESSION_DAYS = 30;
const IS_PROD = process.env.NODE_ENV === 'production';

// JWT_SECRET: obligatorio en producción. En local, si no está en el .env,
// se genera uno y se guarda en server/data/.jwt-secret (fuera de git).
function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (IS_PROD) throw new Error('Falta JWT_SECRET en las variables de entorno (obligatoria en producción)');
  const file = path.join(DATA_DIR, '.jwt-secret');
  try { return fs.readFileSync(file, 'utf8').trim(); }
  catch {
    const s = crypto.randomBytes(48).toString('hex');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(file, s, 'utf8');
    return s;
  }
}
const SECRET = loadSecret();

export const hashPassword = pw => bcrypt.hash(pw, 11);
export const checkPassword = (pw, hash) => bcrypt.compare(pw, hash);

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}
export function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

// ─── Registro abierto o con código de invitación ────────────────────────────
// ALLOW_SIGNUP=false → nadie puede registrarse (solo las cuentas existentes).
// INVITE_CODE=xxxx  → para registrarse hay que escribir ese código.
export function signupConfig() {
  return {
    signupOpen: process.env.ALLOW_SIGNUP !== 'false',
    inviteRequired: !!process.env.INVITE_CODE,
  };
}
export function inviteOk(code) {
  const expected = process.env.INVITE_CODE;
  if (!expected) return true;
  const a = Buffer.from(String(code || ''));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ─── Cookie de sesión ───────────────────────────────────────────────────────
export function setSession(res, userId) {
  const token = jwt.sign({ uid: userId }, SECRET, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/' });
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

// Rellena req.user si hay una sesión válida (no bloquea).
export async function loadUser(req, res, next) {
  const token = readCookie(req, COOKIE);
  if (token) {
    try {
      const { uid } = jwt.verify(token, SECRET);
      req.user = await repo.findUserById(uid);
    } catch { /* token caducado o manipulado → sin sesión */ }
  }
  next();
}

// Bloquea si no hay sesión.
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Inicia sesión para continuar' });
  next();
}

// ─── Límite de intentos (login / registro) ──────────────────────────────────
const attempts = new Map(); // clave → [timestamps]
const WINDOW = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function tooManyAttempts(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < WINDOW);
  attempts.set(key, list);
  return list.length >= MAX_ATTEMPTS;
}
export function recordAttempt(key) {
  const list = attempts.get(key) || [];
  list.push(Date.now());
  attempts.set(key, list);
}
export function clearAttempts(key) {
  attempts.delete(key);
}

export function publicUser(u) {
  return u ? { id: u.id, email: u.email, name: u.name || '' } : null;
}
