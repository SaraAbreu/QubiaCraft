// Plantillas de diseño para las fotos: capas (titular, oferta, logo…) que se
// dibujan ENCIMA de la foto ya encuadrada. La misma función pinta la vista
// previa (canvas transparente sobre la foto) y la imagen final que se publica.

import '@fontsource/montserrat/latin-600.css';
import '@fontsource/montserrat/latin-800.css';
import '@fontsource/playfair-display/latin-700.css';
import '@fontsource/bebas-neue/latin-400.css';
import '@fontsource/caveat/latin-700.css';
import { loadImage } from './framing.js';

export const FONTS = {
  moderna: { label: 'Moderna', family: 'Montserrat', weight: 800, upper: false },
  elegante: { label: 'Elegante', family: 'Playfair Display', weight: 700, upper: false },
  impacto: { label: 'Impacto', family: 'Bebas Neue', weight: 400, upper: true },
  manuscrita: { label: 'Manuscrita', family: 'Caveat', weight: 700, upper: false },
};

export const DEFAULT_BRAND = { primary: '#c69758', secondary: '#0a1220', font: 'moderna', logo: '' };

export const TEMPLATES = [
  { key: 'none', label: 'Sin diseño', icon: 'images', hint: 'La foto tal cual' },
  { key: 'titular', label: 'Titular', icon: 'pen', hint: 'Una frase grande sobre la foto' },
  { key: 'oferta', label: 'Oferta', icon: 'tag', hint: 'Precio o descuento destacado' },
  { key: 'marca', label: 'Marca', icon: 'star', hint: 'Tu logo y un marco fino' },
  { key: 'aviso', label: 'Aviso', icon: 'megaphone', hint: 'Novedad, agenda abierta, horario…' },
];

// Dónde se aplica por defecto cada plantilla en un carrusel.
export const DEFAULT_SCOPE = { titular: 'first', oferta: 'first', marca: 'all', aviso: 'first' };

export const DEFAULT_DESIGN = {
  template: 'none',
  scope: 'first',        // first | all
  headline: '',
  position: 'bottom',    // titular: top | bottom
  offer: '',             // oferta: texto grande (-20 %, 39 €…)
  offerSub: '',          // oferta: texto pequeño (Solo este mes)
  label: 'Novedad',      // aviso: etiqueta
  sub: '',               // aviso: texto pequeño
};

export function brandOf(profile) {
  const b = profile?.brand || {};
  return {
    primary: /^#[0-9a-f]{6}$/i.test(b.primary || '') ? b.primary : DEFAULT_BRAND.primary,
    secondary: /^#[0-9a-f]{6}$/i.test(b.secondary || '') ? b.secondary : DEFAULT_BRAND.secondary,
    font: FONTS[b.font] ? b.font : DEFAULT_BRAND.font,
    logo: typeof b.logo === 'string' && b.logo.startsWith('data:image/') ? b.logo : '',
    name: profile?.nombre || '',
  };
}

// ¿Esta foto (índice i) lleva el diseño?
export function appliesTo(design, i) {
  if (!design || design.template === 'none') return false;
  return design.scope === 'all' || i === 0;
}

// ¿Hay algo que dibujar? (evita aplicar una plantilla vacía)
export function hasContent(design, brand) {
  switch (design?.template) {
    case 'titular': return !!design.headline.trim();
    case 'oferta': return !!design.offer.trim();
    case 'marca': return true;
    case 'aviso': return !!design.headline.trim();
    default: return false;
  }
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Texto legible sobre un color de fondo.
export function textOn(hex) {
  return luminance(hex) > 0.45 ? '#111111' : '#ffffff';
}

function fontCss(fontKey, size, weight) {
  const f = FONTS[fontKey] || FONTS.moderna;
  return `${weight || f.weight} ${Math.round(size)}px "${f.family}", system-ui, sans-serif`;
}

export async function ensureFonts(fontKey) {
  const f = FONTS[fontKey] || FONTS.moderna;
  if (!document.fonts?.load) return;
  try {
    await Promise.all([
      document.fonts.load(`${f.weight} 40px "${f.family}"`),
      document.fonts.load('600 40px "Montserrat"'),
    ]);
  } catch { /* si falla, se usa la fuente del sistema */ }
}

function wrap(ctx, text, maxW) {
  // Solo se corta en espacios normales: el espacio duro (\u00A0) une "20 %".
  const words = text.split(/[ \t\n]+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxW || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines;
}

// Busca el tamaño de letra más grande con el que el texto cabe en maxLines.
function fit(ctx, text, fontKey, { maxW, maxLines, start, min, weight }) {
  let size = start;
  let lines;
  while (size >= min) {
    ctx.font = fontCss(fontKey, size, weight);
    lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) break;
    size -= 4;
  }
  ctx.font = fontCss(fontKey, Math.max(size, min), weight);
  return { size: Math.max(size, min), lines: wrap(ctx, text, maxW) };
}

const logoCache = new Map();
async function getLogo(src) {
  if (!src) return null;
  if (!logoCache.has(src)) logoCache.set(src, loadImage(src).catch(() => null));
  return logoCache.get(src);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ─── Plantillas ────────────────────────────────────────────────────────────

// En las historias (9:16) Instagram tapa arriba (nombre, barra de progreso) y
// abajo (responder, enlaces): ahí no ponemos nada importante.
function safe(W, H) {
  const tall = H / W > 1.6;
  return { top: tall ? H * 0.13 : 0, bottom: tall ? H * 0.17 : 0 };
}

function drawTitular(ctx, W, H, d, brand) {
  const s = W / 1080;
  const raw = d.headline.trim();
  if (!raw) return;
  const font = FONTS[brand.font] || FONTS.moderna;
  const text = font.upper ? raw.toUpperCase() : raw;
  const pad = 72 * s;
  const top = d.position === 'top';
  const sz = safe(W, H);

  ctx.textBaseline = 'alphabetic';
  const { size, lines } = fit(ctx, text, brand.font, {
    maxW: W - pad * 2, maxLines: 3, start: (font.upper ? 132 : 104) * s, min: 44 * s,
  });
  const lh = size * (font.upper ? 1.0 : 1.12);
  const blockH = lines.length * lh;
  const accentH = 10 * s;
  const gap = 26 * s;

  // Degradado del color de marca para que el texto se lea sobre cualquier foto.
  const gh = Math.min(H, blockH + accentH + gap + pad * 2.6 + (top ? sz.top : sz.bottom));
  const g = top ? ctx.createLinearGradient(0, 0, 0, gh) : ctx.createLinearGradient(0, H, 0, H - gh);
  g.addColorStop(0, rgba(brand.secondary, 0.88));
  g.addColorStop(0.55, rgba(brand.secondary, 0.55));
  g.addColorStop(1, rgba(brand.secondary, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, top ? 0 : H - gh, W, gh);

  const textColor = textOn(brand.secondary);
  let y = top ? sz.top + pad + accentH + gap + size * 0.85 : H - sz.bottom - pad - blockH + size * 0.85;
  const accentY = top ? sz.top + pad : y - size * 0.85 - gap - accentH;

  ctx.fillStyle = brand.primary;
  roundRect(ctx, pad, accentY, 96 * s, accentH, accentH / 2);
  ctx.fill();

  ctx.fillStyle = textColor;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 12 * s;
  for (const l of lines) {
    ctx.fillText(l, pad, y);
    y += lh;
  }
  ctx.shadowBlur = 0;
}

function drawOferta(ctx, W, H, d, brand) {
  const s = W / 1080;
  const main = d.offer.trim();
  if (!main) return;
  const font = FONTS[brand.font] || FONTS.moderna;
  const sub = d.offerSub.trim();
  const D = Math.min(W, H) * 0.38;           // diámetro del sello
  const cx = W - D / 2 - 56 * s;
  const cy = D / 2 + 56 * s + safe(W, H).top;
  const r = D / 2;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.30)';
  ctx.shadowBlur = 30 * s;
  ctx.shadowOffsetY = 8 * s;
  ctx.fillStyle = brand.primary;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Aro interior fino
  ctx.strokeStyle = rgba(textOn(brand.primary) === '#ffffff' ? '#ffffff' : '#000000', 0.35);
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 14 * s, 0, Math.PI * 2);
  ctx.stroke();

  const color = textOn(brand.primary);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const mainText = (font.upper ? main.toUpperCase() : main).replace(/ +(?=[%€$])/g, '\u00A0');
  // Mejor en una sola línea grande; si no cabe, en dos.
  let { size, lines } = fit(ctx, mainText, brand.font, {
    maxW: D * 0.74, maxLines: 1, start: D * 0.36, min: D * 0.17,
  });
  if (lines.length > 1) ({ size, lines } = fit(ctx, mainText, brand.font, {
    maxW: D * 0.74, maxLines: 2, start: D * 0.24, min: 28 * s,
  }));
  const lh = size * 1.0;
  const subSize = Math.max(22 * s, Math.min(34 * s, D * 0.1));
  const subLines = sub ? (ctx.font = fontCss('moderna', subSize, 600), wrap(ctx, sub, D * 0.68).slice(0, 2)) : [];
  const total = lines.length * lh + (subLines.length ? subLines.length * subSize * 1.15 + 10 * s : 0);
  let y = cy - total / 2 + lh / 2;
  ctx.font = fontCss(brand.font, size);
  for (const l of lines) { ctx.fillText(l, cx, y); y += lh; }
  if (subLines.length) {
    y += 10 * s - lh / 2 + subSize * 0.6;
    ctx.font = fontCss('moderna', subSize, 600);
    for (const l of subLines) { ctx.fillText(l, cx, y); y += subSize * 1.15; }
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

async function drawMarca(ctx, W, H, d, brand) {
  const s = W / 1080;
  const inset = 30 * s;
  ctx.strokeStyle = rgba(brand.primary, 0.9);
  ctx.lineWidth = 5 * s;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  const logo = await getLogo(brand.logo);
  const margin = 62 * s;
  const lift = safe(W, H).bottom;
  if (logo) {
    const maxH = Math.min(W, H) * 0.12;
    const maxW = W * 0.3;
    const k = Math.min(maxH / logo.naturalHeight, maxW / logo.naturalWidth);
    const w = logo.naturalWidth * k, h = logo.naturalHeight * k;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 16 * s;
    ctx.drawImage(logo, W - margin - w, H - margin - lift - h, w, h);
    ctx.restore();
  } else if (brand.name) {
    // Sin logo: el nombre de la marca en una pastilla.
    const size = (brand.font === 'manuscrita' ? 48 : 38) * s;
    ctx.font = fontCss(brand.font, size);
    const text = FONTS[brand.font]?.upper ? brand.name.toUpperCase() : brand.name;
    const tw = Math.min(ctx.measureText(text).width, W * 0.6);
    const ph = size * 1.7, pw = tw + size * 1.4;
    const x = W - margin - pw, y = H - margin - lift - ph;
    ctx.fillStyle = rgba(brand.secondary, 0.82);
    roundRect(ctx, x, y, pw, ph, ph / 2);
    ctx.fill();
    ctx.fillStyle = textOn(brand.secondary);
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + size * 0.7, y + ph / 2, W * 0.6);
    ctx.textBaseline = 'alphabetic';
  }
}

// Aviso: franja con etiqueta (Novedad, Agenda abierta…), titular y texto
// pequeño, en el tercio inferior (por encima de la zona que tapa Instagram).
function drawAviso(ctx, W, H, d, brand) {
  const s = W / 1080;
  const raw = d.headline.trim();
  if (!raw) return;
  const font = FONTS[brand.font] || FONTS.moderna;
  const text = font.upper ? raw.toUpperCase() : raw;
  const label = (d.label || '').trim().toUpperCase();
  const sub = (d.sub || '').trim();
  const sz = safe(W, H);
  const pad = 64 * s;
  const innerW = W - pad * 4;

  const { size, lines } = fit(ctx, text, brand.font, { maxW: innerW, maxLines: 3, start: (font.upper ? 118 : 92) * s, min: 40 * s });
  const lh = size * (font.upper ? 1.0 : 1.12);
  const labelSize = 26 * s;
  const subSize = 30 * s;
  ctx.font = fontCss('moderna', subSize, 600);
  const subLines = sub ? wrap(ctx, sub, innerW).slice(0, 2) : [];
  const gap = 26 * s;
  const panelH = pad * 1.4 + (label ? labelSize * 2.2 + gap : 0) + lines.length * lh + (subLines.length ? gap + subLines.length * subSize * 1.3 : 0) + pad * 0.9;
  const panelY = H - sz.bottom - pad - panelH;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 30 * s;
  ctx.fillStyle = rgba(brand.secondary, 0.88);
  roundRect(ctx, pad, panelY, W - pad * 2, panelH, 28 * s);
  ctx.fill();
  ctx.restore();

  let y = panelY + pad * 1.2;
  const x = pad * 2;
  if (label) {
    ctx.font = fontCss('moderna', labelSize, 800);
    const lw = ctx.measureText(label).width + labelSize * 1.6;
    const lhgt = labelSize * 2;
    ctx.fillStyle = brand.primary;
    roundRect(ctx, x, y, lw, lhgt, lhgt / 2);
    ctx.fill();
    ctx.fillStyle = textOn(brand.primary);
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + labelSize * 0.8, y + lhgt / 2);
    ctx.textBaseline = 'alphabetic';
    y += lhgt + gap;
  }
  const color = textOn(brand.secondary);
  ctx.fillStyle = color;
  ctx.font = fontCss(brand.font, size);
  y += size * 0.85;
  for (const l of lines) { ctx.fillText(l, x, y); y += lh; }
  if (subLines.length) {
    y += gap - lh + size * 0.15 + subSize;
    ctx.font = fontCss('moderna', subSize, 600);
    ctx.fillStyle = rgba(color === '#ffffff' ? '#ffffff' : '#111111', 0.8);
    for (const l of subLines) { ctx.fillText(l, x, y); y += subSize * 1.3; }
  }
}

// Dibuja la plantilla sobre un canvas de W×H (la foto ya está debajo, o no).
export async function drawDesign(ctx, W, H, design, brand) {
  if (!design || design.template === 'none') return;
  await ensureFonts(brand.font);
  ctx.save();
  if (design.template === 'titular') drawTitular(ctx, W, H, design, brand);
  else if (design.template === 'oferta') drawOferta(ctx, W, H, design, brand);
  else if (design.template === 'marca') await drawMarca(ctx, W, H, design, brand);
  else if (design.template === 'aviso') drawAviso(ctx, W, H, design, brand);
  ctx.restore();
}

// Reduce un logo subido a un PNG pequeño (data URL) para guardarlo en el perfil.
export async function shrinkLogo(file, max = 400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
