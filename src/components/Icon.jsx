import React from 'react';

// Iconos de línea (estilo minimalista, trazo fino). Heredan el color del
// texto (currentColor). Uso: <Icon name="upload" size={20} />
const PATHS = {
  upload: <><path d="M12 15V4" /><path d="M7.5 8.5 12 4l4.5 4.5" /><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /></>,
  sparkle: <><path d="M12 3.5c.4 3.9 2.6 6.1 6.5 6.5-3.9.4-6.1 2.6-6.5 6.5-.4-3.9-2.6-6.1-6.5-6.5 3.9-.4 6.1-2.6 6.5-6.5Z" /><path d="M18.5 15.5c.2 1.6 1 2.4 2.5 2.5-1.5.1-2.3.9-2.5 2.5-.1-1.6-.9-2.4-2.5-2.5 1.6-.1 2.4-.9 2.5-2.5Z" /></>,
  send: <><path d="M20.5 3.5 10 14" /><path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4 17-6.5Z" /></>,
  layers: <><path d="m12 3.5 8.5 4.5-8.5 4.5L3.5 8 12 3.5Z" /><path d="m3.5 12 8.5 4.5 8.5-4.5" /><path d="m3.5 16 8.5 4.5 8.5-4.5" /></>,
  voice: <><path d="M4 10v4" /><path d="M8 7v10" /><path d="M12 4v16" /><path d="M16 7v10" /><path d="M20 10v4" /></>,
  images: <><rect x="7" y="3.5" width="13.5" height="13.5" rx="2" /><path d="M3.5 7v11.5a2 2 0 0 0 2 2H17" /><path d="m7 14 3.5-3.5 3 3 2-2L20.5 16" /></>,
  crop: <><path d="M6.5 2.5v13a2 2 0 0 0 2 2h13" /><path d="M2.5 6.5h13a2 2 0 0 1 2 2v13" /></>,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17" /><path d="M8 3v4" /><path d="M16 3v4" /><path d="M8 14h2" /><path d="M14 14h2" /><path d="M8 17h2" /></>,
  shield: <><path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5 7.5-9.5V6L12 3Z" /><path d="m9 12 2 2 4-4" /></>,
  pen: <><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6 6 18" /></>,
  arrow: <><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  zap: <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" />,
  chat: <><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l.9-4.4A8 8 0 1 1 20 12Z" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></>,
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r=".6" fill="currentColor" /></>,
  // Estrategia
  ban: <><circle cx="12" cy="12" r="8.5" /><path d="m6 6 12 12" /></>,
  repeat: <><path d="M4 11V9a3 3 0 0 1 3-3h13" /><path d="m17 3 3 3-3 3" /><path d="M20 13v2a3 3 0 0 1-3 3H4" /><path d="m7 21-3-3 3-3" /></>,
  music: <><path d="M9 18V5l11-2v13" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></>,
  hash: <><path d="M5 9h15" /><path d="M4 15h15" /><path d="M10 3 8 21" /><path d="M16 3l-2 18" /></>,
  eyeoff: <><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5" /><path d="M6.6 7.6C4.6 9 3.2 10.9 2.5 12c1 1.5 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  useroff: <><circle cx="10" cy="8" r="3.5" /><path d="M3.5 20a6.5 6.5 0 0 1 10.3-5.3" /><path d="m16 15 5 5" /><path d="m21 15-5 5" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></>,
  tag: <><path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" /><circle cx="8" cy="8" r="1.2" /></>,
  heart: <path d="M12 20s-8-4.7-8-10.3A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.7C20 15.3 12 20 12 20Z" />,
  book: <><path d="M4 5.5A2 2 0 0 1 6 3.5h13.5V18H6a2 2 0 0 0-2 2V5.5Z" /><path d="M4 20a2 2 0 0 0 2 1h13.5v-3" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z" />,
  map: <><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  megaphone: <><path d="M4 10v4h3l8 4.5v-13L7 10H4Z" /><path d="M18.5 9a4 4 0 0 1 0 6" /><path d="M7 14l1.5 5.5" /></>,
  camera: <><path d="M4 8a1.5 1.5 0 0 1 1.5-1.5h2.5l1.5-2h5l1.5 2h2.5A1.5 1.5 0 0 1 20 8v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18V8Z" /><circle cx="12" cy="12.5" r="3.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".6" fill="currentColor" /></>,
  copy: <><rect x="8.5" y="8.5" width="12" height="12" rx="2" /><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" /><path d="M4 3.5V8h4.5" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" /><path d="M20 20.5V16h-4.5" /></>,
  // Sectores
  hosteleria: <><path d="M6 3v7a2 2 0 0 0 2 2v9" /><path d="M10 3v7a2 2 0 0 1-2 2" /><path d="M8 3v5" /><path d="M17.5 21V3c-2 1.5-3 4-3 7.5V13h3" /></>,
  comercio: <><path d="M5 8h14l-1 12.5H6L5 8Z" /><path d="M9 10V6.5a3 3 0 0 1 6 0V10" /></>,
  belleza: <><path d="M12 3.5c3 3.6 5.5 6.8 5.5 10a5.5 5.5 0 0 1-11 0c0-3.2 2.5-6.4 5.5-10Z" /><path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" /></>,
  salud: <><path d="M20 9.5c0 5.5-8 10.5-8 10.5S4 15 4 9.5A4.5 4.5 0 0 1 12 6.7a4.5 4.5 0 0 1 8 2.8Z" /><path d="M7.5 12h2.5l1.5-2.5 2 4.5 1.5-2H17" /></>,
  fitness: <><path d="M6.5 7.5v9" /><path d="M17.5 7.5v9" /><path d="M3.5 10v4" /><path d="M20.5 10v4" /><path d="M6.5 12h11" /></>,
  educacion: <><path d="m12 5 9.5 4.5L12 14 2.5 9.5 12 5Z" /><path d="M6.5 11.5v4.5c1.5 1.3 3.3 2 5.5 2s4-.7 5.5-2v-4.5" /><path d="M21.5 9.5V15" /></>,
  servicios: <><rect x="3.5" y="7.5" width="17" height="12" rx="2" /><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2" /><path d="M3.5 12.5h17" /></>,
  inmobiliaria: <><path d="m3.5 11 8.5-7 8.5 7" /><path d="M5.5 9.5V20h13V9.5" /><path d="M10 20v-5.5h4V20" /></>,
  seguros: <path d="M12 3 4.5 6v5.5c0 4.5 3.1 8.1 7.5 9.5 4.4-1.4 7.5-5 7.5-9.5V6L12 3Z" />,
  fotografia: <><path d="M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5Z" /><circle cx="12" cy="13" r="3.5" /></>,
  generico: <><circle cx="12" cy="12" r="8.5" /><path d="M8.5 12h7" /><path d="M12 8.5v7" /></>,
};

export default function Icon({ name, size = 20, stroke = 1.5, className = '', title }) {
  const content = PATHS[name] || PATHS.generico;
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}
