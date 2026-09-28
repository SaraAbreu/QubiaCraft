// Programador de publicaciones persistente (todas las cuentas).
// Cada TICK_MS reclama en la base de datos las publicaciones 'scheduled'
// cuya hora ya llegó y las publica con la cuenta de Instagram de su dueño.
// Al arrancar hace una pasada inmediata, así que lo que venció con el
// servidor apagado se publica en cuanto vuelve (marcado con publishedLate).
import * as repo from './repo.js';

const TICK_MS = 60 * 1000;
let running = false;

async function tick(publishFn) {
  if (running) return; // evita solapar pasadas si una publicación tarda
  running = true;
  try {
    const due = await repo.claimDuePosts(5 * TICK_MS);
    for (const post of due) {
      try {
        const result = await publishFn(post);
        console.log(`[scheduler] usuario ${post.userId} · post ${post.id} → ${result?.success ? 'publicado' : 'error'}${post.publishedLate ? ' (con retraso)' : ''}`);
      } catch (err) {
        await repo.updatePost(post.userId, post.id, { status: 'error', errorDetail: err.message });
        console.error(`[scheduler] Error publicando ${post.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[scheduler] Error en la pasada:', err.message);
  } finally {
    running = false;
  }
}

export async function startScheduler(publishFn) {
  const recovered = await repo.recoverInterrupted();
  if (recovered) console.log(`[scheduler] ${recovered} publicación(es) interrumpida(s) marcadas como error`);
  const pending = await repo.countScheduled();
  console.log(`[scheduler] Activo — revisa cada ${TICK_MS / 1000}s. Programadas en cola: ${pending}`);
  tick(publishFn);
  return setInterval(() => tick(publishFn), TICK_MS);
}
