// Encuadre de las fotos para Instagram: proporción, recorte o foto entera,
// y punto de encuadre. Lo mismo se usa para la vista previa (CSS) y para
// generar la imagen final (canvas), así lo que ves es lo que se publica.

// Instagram (feed y API) solo admite proporciones entre 4:5 y 1.91:1.
export const MIN_RATIO = 4 / 5;
export const MAX_RATIO = 1.91;

export const RATIOS = [
  { key: 'original', label: 'Original' },
  { key: '1:1', label: '1:1', hint: 'Cuadrado', value: 1 },
  { key: '4:5', label: '4:5', hint: 'Vertical', value: 4 / 5 },
  { key: '1.91:1', label: '1.91:1', hint: 'Horizontal', value: 1.91 },
];

export const BACKGROUNDS = [
  { key: 'blur', label: 'Difuminado' },
  { key: 'white', label: 'Blanco' },
  { key: 'black', label: 'Negro' },
];

export const DEFAULT_FRAME = { ratio: 'original', fit: 'cover', bg: 'blur' };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Proporción real a usar. "Original" toma la de la primera foto, ajustada
// al rango que admite Instagram.
export function resolveRatio(ratioKey, first) {
  const preset = RATIOS.find(r => r.key === ratioKey && r.value);
  if (preset) return { value: preset.value, adjusted: false };
  if (!first?.w || !first?.h) return { value: 1, adjusted: false };
  const natural = first.w / first.h;
  const value = clamp(natural, MIN_RATIO, MAX_RATIO);
  return { value, adjusted: Math.abs(value - natural) > 0.01, natural };
}

export function ratioLabel(value) {
  const known = RATIOS.find(r => r.value && Math.abs(r.value - value) < 0.01);
  return known ? known.label : `${value.toFixed(2)}:1`;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = src;
  });
}

// Genera la imagen final (JPEG) con el encuadre elegido.
// focus: {x, y} de 0 a 1 — qué parte de la foto queda visible al recortar.
export async function renderFramed(src, { ratio, fit, bg, focus = { x: 0.5, y: 0.5 } }, outWidth = 1080, quality = 0.9) {
  const img = await loadImage(src);
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const W = outWidth, H = Math.round(outWidth / ratio);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';

  if (fit === 'contain') {
    if (bg === 'blur') {
      const s = Math.max(W / nw, H / nh) * 1.15;
      ctx.filter = 'blur(40px) brightness(0.8)';
      ctx.drawImage(img, (W - nw * s) / 2, (H - nh * s) / 2, nw * s, nh * s);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = bg === 'black' ? '#000' : '#fff';
      ctx.fillRect(0, 0, W, H);
    }
    const s = Math.min(W / nw, H / nh);
    ctx.drawImage(img, (W - nw * s) / 2, (H - nh * s) / 2, nw * s, nh * s);
  } else {
    const s = Math.max(W / nw, H / nh);
    const dw = nw * s, dh = nh * s;
    ctx.drawImage(img, (W - dw) * focus.x, (H - dh) * focus.y, dw, dh);
  }

  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}
