import React, { useRef, useState } from 'react';
import { clamp } from '../lib/framing.js';

// Vista previa de una foto con el encuadre elegido. Si se pasa onFocus y el
// modo es "recortar", se puede arrastrar para elegir qué parte se ve.
export default function CropFrame({ src, natural, ratio, fit, bg, focus, onFocus, maxHeight, className = '' }) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [dragging, setDragging] = useState(false);
  const f = focus || { x: 0.5, y: 0.5 };
  const draggable = !!onFocus && fit === 'cover' && natural?.w;

  function onPointerDown(e) {
    if (!draggable) return;
    const rect = ref.current.getBoundingClientRect();
    const s = Math.max(rect.width / natural.w, rect.height / natural.h);
    drag.current = {
      startX: e.clientX, startY: e.clientY, fx: f.x, fy: f.y,
      overX: natural.w * s - rect.width, overY: natural.h * s - rect.height,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const x = d.overX > 1 ? clamp(d.fx - (e.clientX - d.startX) / d.overX, 0, 1) : 0.5;
    const y = d.overY > 1 ? clamp(d.fy - (e.clientY - d.startY) / d.overY, 0, 1) : 0.5;
    onFocus({ x, y });
  }

  function onPointerUp() {
    drag.current = null;
    setDragging(false);
  }

  const bgColor = bg === 'black' ? '#000' : bg === 'white' ? '#fff' : undefined;

  return (
    <div
      ref={ref}
      className={`crop-frame ${draggable ? 'draggable' : ''} ${dragging ? 'dragging' : ''} ${className}`}
      style={{
        aspectRatio: String(ratio),
        width: maxHeight ? `min(100%, ${Math.round(maxHeight * ratio)}px)` : '100%',
        background: fit === 'contain' ? bgColor : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {fit === 'contain' && bg === 'blur' && <img src={src} alt="" className="crop-bg" draggable={false} />}
      <img
        src={src}
        alt=""
        draggable={false}
        className="crop-img"
        style={{
          objectFit: fit === 'contain' ? 'contain' : 'cover',
          objectPosition: fit === 'contain' ? '50% 50%' : `${f.x * 100}% ${f.y * 100}%`,
        }}
      />
      {dragging && <div className="crop-grid" />}
    </div>
  );
}
