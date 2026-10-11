// Historias animadas: se anima en un canvas la foto (zoom lento) y la
// plantilla (entra con fundido y movimiento) y se graba con MediaRecorder.
// El servidor convierte la grabación a MP4 para Instagram (ffmpeg).
import { renderFramed, loadImage } from './framing.js';
import { drawDesign, designAnchor } from './templates.js';

export const ANIM_W = 1080;
export const ANIM_H = 1920;
export const DEFAULT_ANIM = { zoom: true, duration: 7 };

export function canRecordVideo() {
  return typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
}

function pickMime() {
  const options = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return options.find(m => MediaRecorder.isTypeSupported?.(m)) || '';
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const backOut = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// Prepara las capas fijas: la foto encuadrada y la plantilla sola.
async function prepareLayers({ src, frame, ratio, focus, design, brand, withDesign }) {
  const blob = await renderFramed(src, { ...frame, ratio, focus }, ANIM_W, 0.95);
  const url = URL.createObjectURL(blob);
  const base = await loadImage(url);
  URL.revokeObjectURL(url);
  let overlay = null;
  if (withDesign) {
    overlay = document.createElement('canvas');
    overlay.width = ANIM_W;
    overlay.height = ANIM_H;
    await drawDesign(overlay.getContext('2d'), ANIM_W, ANIM_H, design, brand);
  }
  return { base, overlay };
}

// Dibuja el fotograma del instante t (segundos).
function drawFrame(ctx, t, { base, overlay }, { design, anim }) {
  const W = ANIM_W, H = ANIM_H, D = anim.duration;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Foto: zoom lento hacia dentro (Ken Burns).
  const z = anim.zoom ? 1 + 0.09 * easeInOut(clamp(t / D, 0, 1)) : 1;
  ctx.drawImage(base, (W - W * z) / 2, (H - H * z) / 2, W * z, H * z);

  if (!overlay) return;
  // Plantilla: entra a los 0,35 s y tarda 0,9 s.
  const p = clamp((t - 0.35) / 0.9, 0, 1);
  if (p <= 0) return;
  ctx.save();
  const tpl = design.template;
  if (tpl === 'oferta') {
    const a = designAnchor(design, W, H);
    const sc = 0.35 + 0.65 * backOut(p);
    ctx.globalAlpha = clamp(p * 2.2, 0, 1);
    ctx.translate(a.x, a.y);
    ctx.scale(sc, sc);
    ctx.translate(-a.x, -a.y);
  } else if (tpl === 'marca') {
    ctx.globalAlpha = easeOut(p);
  } else {
    // Titular y Aviso: sube (o baja, si el titular va arriba) con fundido.
    const e = easeOut(p);
    const dir = tpl === 'titular' && design.position === 'top' ? -1 : 1;
    ctx.globalAlpha = e;
    ctx.translate(0, dir * (1 - e) * 110);
  }
  ctx.drawImage(overlay, 0, 0);
  ctx.restore();
}

// Graba la animación en tiempo real. onProgress(0..1).
export async function recordStory(opts, onProgress) {
  const layers = await prepareLayers(opts);
  const canvas = document.createElement('canvas');
  canvas.width = ANIM_W;
  canvas.height = ANIM_H;
  const ctx = canvas.getContext('2d');
  drawFrame(ctx, 0, layers, opts);

  const mimeType = pickMime();
  const stream = canvas.captureStream(30);
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 10_000_000 });
  const chunks = [];
  rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
  const done = new Promise(resolve => { rec.onstop = resolve; });

  const D = opts.anim.duration;
  rec.start(250);
  // El grabador tarda un instante en arrancar: esperamos para no perder el inicio.
  await new Promise(r => setTimeout(r, 400));
  const t0 = performance.now();
  await new Promise(resolve => {
    function tick() {
      const t = (performance.now() - t0) / 1000;
      drawFrame(ctx, Math.min(t, D), layers, opts);
      onProgress?.(clamp(t / D, 0, 1));
      if (t >= D + 0.5) return resolve();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  rec.stop();
  await done;
  stream.getTracks().forEach(tr => tr.stop());
  const type = (rec.mimeType || mimeType || 'video/webm').split(';')[0];
  return new Blob(chunks, { type });
}
