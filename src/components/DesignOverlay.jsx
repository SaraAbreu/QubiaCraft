import React, { useEffect, useRef } from 'react';
import { drawDesign } from '../lib/templates.js';

// Vista previa de la plantilla: canvas transparente encima de la foto.
// Se dibuja a 1080 px de ancho, igual que la imagen final, y el CSS lo escala.
export default function DesignOverlay({ ratio, design, brand }) {
  const ref = useRef(null);
  const W = 1080;
  const H = Math.round(W / ratio);

  useEffect(() => {
    let cancelled = false;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    (async () => {
      // Dibujamos en un canvas aparte y copiamos al final para que no parpadee.
      const off = document.createElement('canvas');
      off.width = W;
      off.height = H;
      await drawDesign(off.getContext('2d'), W, H, design, brand);
      if (cancelled) return;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0);
    })();
    return () => { cancelled = true; };
  }, [W, H, design, brand]);

  return <canvas ref={ref} width={W} height={H} className="design-overlay" aria-hidden="true" />;
}
