// Programador de publicaciones persistente.
// Cada TICK_MS revisa el historial en disco y publica las entradas
// 'scheduled' cuya hora ya llegó. Al arrancar hace una pasada inmediata, así
// que las publicaciones que vencieron con el servidor apagado se publican en
// cuanto vuelve a encenderse (marcadas con publishedLate).
import { history, saveHistory } from './store.js';

const TICK_MS = 60 * 1000;
let running = false;

export function recoverInterrupted() {
  // Si el servidor se cayó en mitad de una publicación, no reintentamos a
  // ciegas (podría duplicar el post en Instagram): se marca como error para
  // que el usuario lo revise.
  let changed = false;
  history.forEach(h => {
    if (h.status === 'publishing') {
      h.status = 'error';
      h.errorDetail = 'El servidor se detuvo durante la publicación. Revisa Instagram antes de reintentar.';
      changed = true;
    }
  });
  if (changed) saveHistory();
}

async function tick(publishFn) {
  if (running) return; // evita solapar pasadas si una publicación tarda
  running = true;
  try {
    const now = Date.now();
    const due = history.filter(h => h.status === 'scheduled' && h.scheduledFor && new Date(h.scheduledFor).getTime() <= now);
    for (const entry of due) {
      const lateMs = now - new Date(entry.scheduledFor).getTime();
      entry.status = 'publishing';
      if (lateMs > 5 * TICK_MS) entry.publishedLate = true;
      saveHistory();
      try {
        const result = await publishFn(entry);
        if (!result?.success) entry.errorDetail = result?.detail || result?.error || 'Error desconocido';
        console.log(`[scheduler] ${entry.id} → ${entry.status}${entry.publishedLate ? ' (con retraso)' : ''}`);
      } catch (err) {
        entry.status = 'error';
        entry.errorDetail = err.message;
        console.error(`[scheduler] Error publicando ${entry.id}:`, err.message);
      }
      saveHistory();
    }
  } finally {
    running = false;
  }
}

export function startScheduler(publishFn) {
  recoverInterrupted();
  const pending = history.filter(h => h.status === 'scheduled').length;
  console.log(`[scheduler] Activo — revisa cada ${TICK_MS / 1000}s. Programadas en cola: ${pending}`);
  tick(publishFn);
  return setInterval(() => tick(publishFn), TICK_MS);
}
