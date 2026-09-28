import React, { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import './LandingSections.css';

// Secciones interactivas de la landing (entre el hero y el CTA final).
// Animaciones con IntersectionObserver + CSS; todas respetan
// prefers-reduced-motion.

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ─── Utilidades ─────────────────────────────────────────────────────────────
export function useInView(options = { threshold: 0.25 }, once = true) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { setInView(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setInView(true); if (once) io.disconnect(); }
      else if (!once) setInView(false);
    }, options);
    io.observe(el);
    return () => io.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return [ref, inView];
}

export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  return (
    <Tag ref={ref} className={`rv ${inView ? 'in' : ''} ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}

// Número que cuenta hasta su valor al aparecer.
export function CountUp({ value, suffix = '' }) {
  const [ref, inView] = useInView({ threshold: 0.6 });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion()) { setN(value); return; }
    let raf;
    const t0 = performance.now();
    const tick = t => {
      const p = Math.min(1, (t - t0) / 1200);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value]);
  return <span ref={ref}>{n}{suffix}</span>;
}

// ─── 1. Manifiesto: las palabras se iluminan al hacer scroll ─────────────────
const MANIFESTO = [
  { t: 'Tienes fotos preciosas.' },
  { t: 'Pero ningún texto.', dim: true },
  { t: 'Publicas a rachas.' },
  { t: 'Y los textos genéricos', dim: true },
  { t: 'no suenan a ti.', dim: true },
  { t: 'Qubia Craft', accent: true },
  { t: 'convierte cada foto en una publicación con tu voz.', accent: true },
];

export function Manifesto() {
  const ref = useRef(null);
  const words = MANIFESTO.flatMap((line, li) =>
    line.t.split(' ').map((w, wi) => ({ w, accent: line.accent, key: `${li}-${wi}` }))
  );
  const [lit, setLit] = useState(reducedMotion() ? words.length : 0);

  useEffect(() => {
    if (reducedMotion()) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        // 0 cuando el bloque entra por abajo, 1 cuando su centro pasa el 35% superior
        const p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
        setLit(Math.round(Math.max(0, Math.min(1, p)) * words.length));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); cancelAnimationFrame(raf); };
  }, [words.length]);

  return (
    <section className="ls-manifesto">
      <div className="lp-wrap">
        <span className="lp-eyebrow">¿Te suena?</span>
        <p ref={ref} className="ls-manifesto-text">
          {words.map((w, i) => (
            <span key={w.key} className={`ls-word ${i < lit ? 'lit' : ''} ${w.accent ? 'accent' : ''}`}>{w.w} </span>
          ))}
        </p>
      </div>
    </section>
  );
}

// ─── 2. Cómo funciona: scroll con escenario fijo ─────────────────────────────
const STEPS = [
  { icon: 'upload', title: 'Sube tus fotos', text: 'Una o un carrusel de hasta 10. Elige la proporción y encuádralas arrastrando, como en Instagram.' },
  { icon: 'sparkle', title: 'La IA escribe por ti', text: 'En segundos tienes tres propuestas —inspiracional, cercana y comercial— con tu tono y las reglas de tu sector.' },
  { icon: 'send', title: 'Publica o programa', text: 'Directo a tu cuenta de Instagram, ahora o el día y la hora que elijas. Nada sale sin tu aprobación.' },
];

const DEMO_CAPTION = 'La luz de la mañana, un café recién hecho y ese rincón que ya es tuyo. Te esperamos ☕';

function StageUpload({ active }) {
  return (
    <div className={`ls-stage ls-stage-upload ${active ? 'on' : ''}`}>
      <div className="ls-drop">
        <Icon name="upload" size={26} />
        <span>Arrastra tus fotos</span>
      </div>
      <div className="ls-thumbs">
        {[0, 1, 2].map(i => <i key={i} className={`ls-thumb t${i}`} style={{ '--i': i }} />)}
      </div>
      <div className="ls-chips"><b>Original</b><b className="on">4:5</b><b>1:1</b><b>1.91:1</b></div>
    </div>
  );
}

function StageWrite({ active }) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!active) { setTyped(''); return; }
    if (reducedMotion()) { setTyped(DEMO_CAPTION); return; }
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(DEMO_CAPTION.slice(0, i));
      if (i >= DEMO_CAPTION.length) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div className={`ls-stage ls-stage-write ${active ? 'on' : ''}`}>
      <div className="ls-tabs"><b className="on"><Icon name="sparkle" size={13} /> Inspiracional</b><b>Cercano</b><b>Comercial</b></div>
      <p className="ls-typed">{typed}<span className="ls-caret" /></p>
      <span className="ls-hashtags">#CaféDeEspecialidad #Tenerife #SlowMorning</span>
    </div>
  );
}

function StagePublish({ active }) {
  return (
    <div className={`ls-stage ls-stage-publish ${active ? 'on' : ''}`}>
      <div className="ls-mini-post">
        <div className="ls-mini-photo" />
        <div className="ls-mini-lines"><i /><i className="s" /></div>
      </div>
      <div className="ls-toast ls-toast-1"><Icon name="check" size={16} /> Publicado en @tu_negocio</div>
      <div className="ls-toast ls-toast-2"><Icon name="calendar" size={16} /> Próxima: jueves, 10:00</div>
    </div>
  );
}

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const stepRefs = useRef([]);

  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    stepRefs.current.forEach(el => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <section className="ls-how" id="como-funciona">
      <div className="lp-wrap">
        <Reveal className="ls-head">
          <span className="lp-eyebrow">Cómo funciona</span>
          <h2>De la foto a la publicación.<br /><span className="lp-grad">En tres pasos.</span></h2>
        </Reveal>

        <div className="ls-how-grid">
          <div className="ls-how-sticky">
            <div className="ls-device">
              <div className="ls-device-bar"><span /><span /><span /><em>Estudio · Qubia Craft</em></div>
              <div className="ls-device-body">
                <StageUpload active={active === 0} />
                <StageWrite active={active === 1} />
                <StagePublish active={active === 2} />
              </div>
              <div className="ls-progress"><i style={{ transform: `scaleX(${(active + 1) / 3})` }} /></div>
            </div>
          </div>

          <ol className="ls-how-steps">
            {STEPS.map((s, i) => (
              <li
                key={s.title}
                ref={el => (stepRefs.current[i] = el)}
                data-i={i}
                className={`ls-how-step ${active === i ? 'on' : ''}`}
              >
                <span className="ls-how-num">0{i + 1}</span>
                <div>
                  <h3><Icon name={s.icon} size={22} /> {s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ─── 3. Funciones como demos en vivo ────────────────────────────────────────
const TONES = [
  { key: 'Inspiracional', icon: 'sparkle', text: 'Cada detalle cuenta una historia. Hoy, la nuestra empieza con luz de mañana y un café que sabe a hogar.' },
  { key: 'Cercano', icon: 'chat', text: '¿Plan para el sábado? Nosotros ya tenemos la mesa junto a la ventana esperándote. ¡Pásate! 😊' },
  { key: 'Comercial', icon: 'target', text: 'Desayuno completo por 8,50 € hasta las 12:00. Reserva por DM y asegura tu mesa este fin de semana.' },
];

function ToneDemo() {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!inView || !auto || reducedMotion()) return;
    const id = setInterval(() => setI(v => (v + 1) % TONES.length), 3800);
    return () => clearInterval(id);
  }, [inView, auto]);
  return (
    <div ref={ref} className="ls-demo ls-tone">
      <div className="ls-tone-tabs" role="tablist">
        {TONES.map((t, k) => (
          <button key={t.key} role="tab" aria-selected={i === k} className={i === k ? 'on' : ''} onClick={() => { setI(k); setAuto(false); }}>
            <Icon name={t.icon} size={14} /> {t.key}
          </button>
        ))}
        <span className="ls-tone-pill" style={{ transform: `translateX(${i * 100}%)` }} />
      </div>
      <div className="ls-tone-body">
        {TONES.map((t, k) => (
          <p key={t.key} className={`ls-tone-text ${i === k ? 'on' : ''}`}>{t.text}</p>
        ))}
      </div>
      <div className="ls-tone-foot">
        <span><Icon name="voice" size={15} /> Aprendido de tus ediciones</span>
        <span className="ls-tone-count">{i + 1} / 3</span>
      </div>
    </div>
  );
}

const RATIOS = [
  { label: '4:5', w: 240, h: 300 },
  { label: '1:1', w: 280, h: 280 },
  { label: '1.91:1', w: 320, h: 168 },
];

function RatioDemo() {
  const [ref, inView] = useInView({ threshold: 0.4 });
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!inView || reducedMotion()) return;
    const id = setInterval(() => setI(v => (v + 1) % RATIOS.length), 2200);
    return () => clearInterval(id);
  }, [inView]);
  const r = RATIOS[i];
  return (
    <div ref={ref} className="ls-demo ls-ratio">
      <div className="ls-ratio-stage">
        <div className="ls-ratio-frame" style={{ width: r.w, height: r.h }}>
          <div className="ls-ratio-photo" />
          <div className="ls-ratio-grid" />
          <span className="ls-ratio-corner tl" /><span className="ls-ratio-corner tr" />
          <span className="ls-ratio-corner bl" /><span className="ls-ratio-corner br" />
        </div>
      </div>
      <div className="ls-ratio-chips">
        {RATIOS.map((x, k) => (
          <button key={x.label} className={i === k ? 'on' : ''} onClick={() => setI(k)}>{x.label}</button>
        ))}
      </div>
    </div>
  );
}

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const POSTS = [
  { d: 0, t: '09:30', c: 'gold' },
  { d: 2, t: '13:00', c: 'teal' },
  { d: 3, t: '10:00', c: 'gold' },
  { d: 5, t: '11:15', c: 'teal' },
  { d: 6, t: '19:00', c: 'gold' },
];

function CalendarDemo() {
  const [ref, inView] = useInView({ threshold: 0.4 });
  return (
    <div ref={ref} className={`ls-demo ls-cal ${inView ? 'in' : ''}`}>
      <div className="ls-cal-head"><span>Esta semana</span><b>5 programadas</b></div>
      <div className="ls-cal-grid">
        {WEEK.map((d, k) => (
          <div key={d} className="ls-cal-day">
            <span className="ls-cal-label">{d}</span>
            <div className="ls-cal-slot">
              {POSTS.filter(p => p.d === k).map(p => (
                <div key={p.t} className={`ls-cal-post ${p.c}`} style={{ '--i': k }}>
                  <i /> {p.t}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURES = [
  {
    eyebrow: 'Tu voz',
    title: 'Escribe como tú. No como una IA.',
    text: 'Tres propuestas por publicación con el tono de tu marca: tus servicios, tu llamada a la acción, tus hashtags. Y cada vez que retocas un texto, Qubia Craft aprende cómo te gusta.',
    points: ['Tres tonos para elegir', 'Aprende de tus ediciones', 'Solo en español, sin frases de plantilla'],
    demo: <ToneDemo />,
  },
  {
    eyebrow: 'Encuadre',
    title: 'Cada foto, en su sitio.',
    text: 'Elige la proporción que mejor funciona en Instagram, arrastra para encuadrar o muestra la foto entera con un fondo elegante. Lo que ves es exactamente lo que se publica.',
    points: ['4:5, 1:1 y horizontal', 'Carruseles de hasta 10 fotos', 'Foto entera con fondo difuminado'],
    demo: <RatioDemo />,
  },
  {
    eyebrow: 'Calendario',
    title: 'Tu Instagram, al día. Sin estar pendiente.',
    text: 'Programa la semana en un rato y olvídate. Adelanta, edita o cancela cualquier publicación cuando quieras.',
    points: ['Publicar ahora o programar', 'Editar antes de que salga', 'Cada negocio con su propia cuenta'],
    demo: <CalendarDemo />,
  },
];

export function Features() {
  return (
    <section className="ls-features" id="funciones">
      <div className="lp-wrap">
        <Reveal className="ls-head">
          <span className="lp-eyebrow">Funciones</span>
          <h2>Pensado para que tu Instagram<br /><span className="lp-grad">no se quede parado.</span></h2>
        </Reveal>

        {FEATURES.map((f, i) => (
          <div key={f.title} className={`ls-feature ${i % 2 ? 'flip' : ''}`}>
            <Reveal className="ls-feature-copy">
              <span className="ls-feature-eyebrow"><i />{f.eyebrow}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
              <ul>
                {f.points.map(p => <li key={p}><Icon name="check" size={16} /> {p}</li>)}
              </ul>
            </Reveal>
            <Reveal className="ls-feature-demo" delay={120}>
              <div className="ls-demo-glow" />
              {f.demo}
            </Reveal>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 4. Sectores en marquesina ───────────────────────────────────────────────
export function Sectors({ sectors }) {
  const list = sectors.length ? sectors : [];
  const half = Math.ceil(list.length / 2);
  const rows = [list.slice(0, half), list.slice(half)];
  return (
    <section className="ls-sectors" id="sectores">
      <div className="lp-wrap">
        <Reveal className="ls-head">
          <span className="lp-eyebrow">Sectores</span>
          <h2>Habla el idioma de tu negocio.</h2>
          <p>No es lo mismo vender un tratamiento que un piso o una cena. Cada sector trae sus propias pautas: qué destacar y qué no prometer nunca.</p>
        </Reveal>
      </div>
      <div className="ls-marquee-wrap">
        {rows.map((row, r) => (
          <div key={r} className={`ls-marquee ${r ? 'rev' : ''}`}>
            <div className="ls-marquee-track">
              {[...row, ...row, ...row, ...row].map((s, k) => (
                <span key={`${s.key}-${k}`} className="ls-sector" aria-hidden={k >= row.length ? true : undefined}>
                  <Icon name={s.key} size={20} /> {s.label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── 5. Antes / después con deslizador ──────────────────────────────────────
const COMPARE = [
  ['Una hora delante de la pantalla en blanco', 'Tres textos listos en segundos'],
  ['Textos genéricos que podrían ser de cualquiera', 'Tu tono, tu sector, tus hashtags'],
  ['Publicar cuando te acuerdas', 'Un calendario que publica por ti'],
  ['Recortes que cortan lo importante', 'Encuadre exacto antes de publicar'],
  ['Riesgo de prometer lo que no debes', 'Pautas por sector sobre qué no decir'],
];

export function BeforeAfter() {
  const boxRef = useRef(null);
  const [pos, setPos] = useState(50);
  const [touched, setTouched] = useState(false);
  const [ref, inView] = useInView({ threshold: 0.4 });

  // Pequeña pista animada la primera vez que aparece.
  useEffect(() => {
    if (!inView || touched || reducedMotion()) return;
    const seq = [30, 70, 50];
    let k = 0;
    const id = setInterval(() => { setPos(seq[k]); k++; if (k >= seq.length) clearInterval(id); }, 700);
    return () => clearInterval(id);
  }, [inView, touched]);

  function move(clientX) {
    const r = boxRef.current.getBoundingClientRect();
    setPos(Math.max(4, Math.min(96, ((clientX - r.left) / r.width) * 100)));
  }
  function onDown(e) {
    setTouched(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  }

  const list = (side) => (
    <ul className="ls-ba-list">
      {COMPARE.map(([b, a]) => (
        <li key={b}><Icon name={side === 'after' ? 'check' : 'x'} size={17} /> {side === 'after' ? a : b}</li>
      ))}
    </ul>
  );

  return (
    <section className="ls-ba" ref={ref}>
      <div className="lp-wrap">
        <Reveal className="ls-head">
          <span className="lp-eyebrow">La diferencia</span>
          <h2>Menos tiempo en el móvil.<br /><span className="lp-grad">Más negocio en tu Instagram.</span></h2>
          <p className="ls-ba-hint">Desliza para comparar.</p>
        </Reveal>

        <Reveal delay={100}>
          <div
            ref={boxRef}
            className={`ls-ba-box ${touched ? 'touched' : ''}`}
            onPointerDown={onDown}
            onPointerMove={e => e.buttons && move(e.clientX)}
            role="slider"
            aria-label="Comparar sin y con Qubia Craft"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pos)}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'ArrowLeft') { setTouched(true); setPos(p => Math.max(4, p - 5)); }
              if (e.key === 'ArrowRight') { setTouched(true); setPos(p => Math.min(96, p + 5)); }
            }}
          >
            <div className="ls-ba-side before">
              <div className="ls-ba-label">Sin Qubia Craft</div>
              {list('before')}
            </div>
            <div className="ls-ba-side after" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <div className="ls-ba-label"><img src="/logo-mark.png" alt="" /> Con Qubia Craft</div>
              {list('after')}
            </div>
            <div className="ls-ba-handle" style={{ left: `${pos}%` }}>
              <span><Icon name="arrow" size={14} className="l" /><Icon name="arrow" size={14} /></span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ─── 6. Preguntas frecuentes (líneas finas, sin cajas) ──────────────────────
const FAQ = [
  { q: '¿Necesito saber de inteligencia artificial?', a: 'No. Subes la foto, eliges el texto que más te guste, lo retocas si quieres y publicas. Nada más.' },
  { q: '¿Publica algo sin que yo lo vea?', a: 'Nunca. Cada publicación la apruebas tú, ya sea para publicarla al momento o para programarla.' },
  { q: '¿Qué cuenta de Instagram necesito?', a: 'Una cuenta profesional (de empresa o de creador). La conectas en un par de clics desde tu perfil de marca.' },
  { q: '¿De verdad suena a mi marca?', a: 'Rellenas tu perfil de marca una vez —tono, servicios, llamada a la acción, hashtags— y Qubia Craft aprende de cada texto que retocas.' },
  { q: '¿Mis datos y mi Instagram están seguros?', a: 'Cada negocio tiene su propio espacio y su propia conexión. Nadie más puede ver tus publicaciones ni publicar en tu cuenta.' },
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="ls-faq" id="faq">
      <div className="lp-wrap ls-faq-grid">
        <Reveal className="ls-faq-intro">
          <span className="lp-eyebrow">Preguntas</span>
          <h2>Lo que nos suelen preguntar.</h2>
          <p>¿Tienes otra duda? Crea tu cuenta y pruébalo con tu primera foto.</p>
        </Reveal>
        <div className="ls-faq-list">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 60} className={`ls-faq-item ${open === i ? 'open' : ''}`}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                <span className="ls-faq-n">0{i + 1}</span>
                <span className="ls-faq-q">{f.q}</span>
                <span className="ls-faq-icon"><Icon name="plus" size={18} /></span>
              </button>
              <div className="ls-faq-a"><p>{f.a}</p></div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
