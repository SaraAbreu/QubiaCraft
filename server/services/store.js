// Imágenes de las publicaciones, en disco: server/data/images/<archivo>.
// Los nombres nuevos llevan el id de usuario y una parte aleatoria
// (u<id>-<aleatorio>.jpg): la ruta /api/images es pública porque Meta tiene
// que poder descargarlas, así que no deben poder adivinarse.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dir, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

// Guarda una imagen recibida como Buffer y devuelve el nombre de archivo.
export function saveImage(userId, buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const file = `u${userId}-${crypto.randomBytes(12).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, file), buffer);
  return file;
}

export function imagePath(file) {
  // Evita path traversal: solo nombres de archivo simples.
  if (!file || file !== path.basename(file) || file.startsWith('.')) return null;
  const p = path.join(IMAGES_DIR, file);
  return fs.existsSync(p) ? p : null;
}

export function imageMime(file) {
  return MIME_BY_EXT[path.extname(file).slice(1).toLowerCase()] || 'image/jpeg';
}

export function deleteImages(files = []) {
  files.forEach(f => {
    const p = imagePath(f);
    if (p) { try { fs.unlinkSync(p); } catch { /* ya no existe */ } }
  });
}
