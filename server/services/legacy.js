// Migración única de los datos de la versión de un solo usuario (archivos
// JSON) a la base de datos. Se ejecuta cuando se registra el PRIMER usuario:
// ese usuario hereda el perfil de marca, la voz, el historial y la conexión
// de Instagram que ya existían. Los archivos se renombran a *.migrated para
// no importarlos dos veces (no se borra nada).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as repo from './repo.js';
import { DATA_DIR } from './store.js';

const SERVER_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = {
  profile: path.join(SERVER_DIR, 'profile.json'),
  voice: path.join(SERVER_DIR, 'voice.json'),
  history: path.join(DATA_DIR, 'history.json'),
  instagram: path.join(DATA_DIR, 'instagram.json'),
};

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function markMigrated(file) {
  try { fs.renameSync(file, `${file}.migrated`); } catch { /* no existía */ }
}

export function hasLegacyData() {
  return Object.values(FILES).some(f => fs.existsSync(f));
}

export async function migrateLegacyInto(userId) {
  const summary = { profile: false, voice: false, posts: 0, instagram: false };

  const profile = readJson(FILES.profile);
  if (profile && typeof profile === 'object') {
    await repo.saveProfile(userId, profile);
    summary.profile = true;
  }

  const voice = readJson(FILES.voice);
  if (voice && typeof voice === 'object') {
    await repo.saveVoice(userId, { examples: voice.examples || [], patterns: voice.patterns || null, lastAnalyzed: voice.lastAnalyzed });
    summary.voice = true;
  }

  const history = readJson(FILES.history);
  if (Array.isArray(history)) {
    // Del más antiguo al más reciente para conservar el orden.
    for (const h of [...history].reverse()) {
      const imageFiles = h.imageFiles?.length ? h.imageFiles : (h.imageFile ? [h.imageFile] : []);
      await repo.createPost(userId, {
        caption: h.caption || '',
        status: h.status === 'publishing' ? 'error' : (h.status || 'pending'),
        imageFiles,
        createdAt: h.date,
        scheduledFor: h.scheduledFor,
        publishedAt: h.publishedAt,
        publishedLate: h.publishedLate,
        errorDetail: h.status === 'publishing' ? 'Interrumpida durante la migración' : h.errorDetail,
        igMediaId: h.igMediaId,
      });
      summary.posts++;
    }
  }

  const ig = readJson(FILES.instagram);
  if (ig?.accessToken) {
    await repo.saveIgConnection(userId, ig);
    summary.instagram = true;
  }

  Object.values(FILES).forEach(markMigrated);
  return summary;
}
