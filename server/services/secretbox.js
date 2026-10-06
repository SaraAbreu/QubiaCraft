// Cifrado de datos sensibles en la base de datos (tokens de Instagram).
// AES-256-GCM con la clave TOKEN_ENC_KEY del .env (obligatoria en producción).
// En local, si no está, se genera una y se guarda en server/data/.token-key.
// ¡Ojo! Si se pierde o cambia la clave, los tokens guardados no se pueden leer
// y cada usuario tendrá que volver a conectar su Instagram.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { DATA_DIR } from './store.js';

const IS_PROD = process.env.NODE_ENV === 'production';

function loadKey() {
  let raw = process.env.TOKEN_ENC_KEY;
  if (!raw) {
    if (IS_PROD) throw new Error('Falta TOKEN_ENC_KEY en las variables de entorno (obligatoria en producción)');
    const file = path.join(DATA_DIR, '.token-key');
    try { raw = fs.readFileSync(file, 'utf8').trim(); }
    catch {
      raw = crypto.randomBytes(32).toString('base64');
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(file, raw, 'utf8');
    }
  }
  // Cualquier texto vale: se deriva una clave de 32 bytes
  return crypto.createHash('sha256').update(raw).digest();
}
const KEY = loadKey();

export function seal(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return { enc: `v1.${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}` };
}

// Devuelve el objeto descifrado. Datos antiguos sin cifrar: se devuelven tal
// cual. Si no se puede descifrar (clave distinta): null.
export function open(stored) {
  if (!stored || typeof stored !== 'object') return null;
  if (!stored.enc) return stored;
  try {
    const [, iv, tag, data] = stored.enc.split('.');
    const d = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8'));
  } catch {
    console.error('[secretbox] No se pudo descifrar un dato: ¿ha cambiado TOKEN_ENC_KEY?');
    return null;
  }
}

export const isSealed = stored => !!stored?.enc;
