// Persistencia en disco del historial de publicaciones.
// - server/data/history.json → metadatos (id, caption, estado, fechas…)
// - server/data/images/<id>.<ext> → la imagen de cada entrada
// Escritura atómica (archivo temporal + rename) para no corromper el JSON si
// el proceso se corta a mitad de un guardado.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dir, '..', 'data');
const IMAGES_DIR = path.join(DATA_DIR, 'images');
const HISTORY_PATH = path.join(DATA_DIR, 'history.json');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
const MIME_BY_EXT = Object.fromEntries(Object.entries(EXT_BY_MIME).map(([m, e]) => [e, m]));

function load() {
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const history = load();

export function saveHistory() {
  const tmp = HISTORY_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(history, null, 2), 'utf8');
  fs.renameSync(tmp, HISTORY_PATH);
}

export function findEntry(id) {
  return history.find(h => String(h.id) === String(id));
}

// Guarda una imagen recibida como Buffer y devuelve el nombre de archivo.
export function saveImage(id, buffer, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || 'jpg';
  const file = `${id}.${ext}`;
  fs.writeFileSync(path.join(IMAGES_DIR, file), buffer);
  return file;
}

export function imagePath(file) {
  // Evita path traversal: solo nombres de archivo simples.
  if (!file || file !== path.basename(file)) return null;
  const p = path.join(IMAGES_DIR, file);
  return fs.existsSync(p) ? p : null;
}

export function imageMime(file) {
  return MIME_BY_EXT[path.extname(file).slice(1).toLowerCase()] || 'image/jpeg';
}

// Devuelve la imagen como data URL (lo que espera doPublish hoy).
export function imageDataUrl(file) {
  const p = imagePath(file);
  if (!p) return null;
  return `data:${imageMime(file)};base64,${fs.readFileSync(p).toString('base64')}`;
}

// Borra una entrada del historial y sus imágenes. Devuelve true si existía.
export function deleteEntry(id) {
  const idx = history.findIndex(h => String(h.id) === String(id));
  if (idx === -1) return false;
  const [entry] = history.splice(idx, 1);
  const files = entry.imageFiles?.length ? entry.imageFiles : (entry.imageFile ? [entry.imageFile] : []);
  files.forEach(f => {
    const p = imagePath(f);
    if (p) { try { fs.unlinkSync(p); } catch { /* ya no existe */ } }
  });
  saveHistory();
  return true;
}
