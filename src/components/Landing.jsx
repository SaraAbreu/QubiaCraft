import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { Manifesto, HowItWorks, Features, Sectors, BeforeAfter, Faq, CountUp } from './LandingSections.jsx';
import './Landing.css';

// Página de presentación de Qubia Craft (antes de iniciar sesión).
// onAuth('login' | 'register') abre la pantalla de acceso.
// Todo lo que se afirma aquí es lo que la app hace de verdad: sin
// testimonios ni cifras inventadas.

const FACTS = [
  { value: 3, label: 'propuestas de texto por publicación' },
  { value: 10, label: 'fotos por carrusel' },
  { value: 10, label: 'sectores con pautas propias' },
  { value: 1, suffix: ' clic', label: 'para publicar o programar' },
];

export default function Landing({ onAuth, signupOpen = true }) {
  const [sectors, setSectors] = useState([]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch('/api/verticals')
      .then(r => r.json())
      .then(v => setSectors(Array.isArray(v) ? v.filter(s => s.key !== 'generico') : []))
      .catch(() => {});
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const start = () => onAuth(signupOpen ? 'register' : 'login');
  const ctaLabel = signupOpen ? 'Crear mi cuenta' : 'Entrar';
  const go = id => e => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="lp">
      {/* ── Navegación ── */}
      <header className={`lp-nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lp-wrap lp-nav-inner">
          <a href="#top" className="lp-brand" onClick={go('top')}>
            <img src="/logo-mark.png" alt="" />
            <span>Qubia<strong>Craft</strong></span>
          </a>
          <nav className="lp-links">
            <a href="#como-funciona" onClick={go('como-funciona')}>Cómo funciona</a>
            <a href="#funciones" onClick={go('funciones')}>Funciones</a>
            <a href="#sectores" onClick={go('sectores')}>Sectores</a>
            <a href="#faq" onClick={go('faq')}>Preguntas</a>
          </nav>
          <div className="lp-nav-cta">
            <button className="lp-btn-link" onClick={() => onAuth('login')}>Entrar</button>
            {signupOpen && (
              <button className="lp-btn lp-btn-gold lp-btn-sm" onClick={() => onAuth('register')}>
                Empezar <Icon name="arrow" size={16} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="lp-hero" id="top">
        <div className="lp-glow lp-glow-gold" />
        <div className="lp-glow lp-glow-teal" />
        <div className="lp-grid-bg" />
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-pill"><span className="lp-pill-dot" /> Contenido para Instagram con IA</span>
            <h1>
              Tus fotos ya cuentan la historia.
              <span className="lp-grad"> Nosotros le ponemos las palabras.</span>
            </h1>
            <p className="lp-lead">
              Sube una foto y Qubia Craft escribe el texto con la voz de tu marca, la encuadra como
              Instagram manda y la publica —o la programa— en tu cuenta. En minutos, no en horas.
            </p>
            <div className="lp-hero-cta">
              <button className="lp-btn lp-btn-gold lp-btn-lg" onClick={start}>
                {ctaLabel} <Icon name="arrow" size={18} />
              </button>
              <a className="lp-btn lp-btn-outline lp-btn-lg" href="#como-funciona" onClick={go('como-funciona')}>Ver cómo funciona</a>
            </div>
            <ul className="lp-checks">
              <li><Icon name="check" size={16} /> Tu voz de marca</li>
              <li><Icon name="check" size={16} /> Pautas de tu sector</li>
              <li><Icon name="check" size={16} /> Tú apruebas siempre</li>
            </ul>
          </div>

          {/* Marco: ventana de la app + móvil con la publicación */}
          <div
            className="lp-frame"
            aria-hidden="true"
            onMouseMove={e => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty('--rx', `${((e.clientY - r.top) / r.height - 0.5) * -6}deg`);
              e.currentTarget.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
            }}
            onMouseLeave={e => { e.currentTarget.style.setProperty('--rx', '0deg'); e.currentTarget.style.setProperty('--ry', '0deg'); }}
          >
            <div className="lp-window">
              <div className="lp-window-bar">
                <span /><span /><span />
                <div className="lp-window-url">q-craft.qubia.es</div>
              </div>
              <div className="lp-window-body">
                <div className="lp-mini-side">
                  <img src="/logo-mark.png" alt="" />
                  <i className="on" /><i /><i />
                </div>
                <div className="lp-mini-col">
                  <div className="lp-mini-title">01 · Tus fotos</div>
                  <div className="lp-mini-photo" />
                  <div className="lp-mini-chips"><b>Original</b><b className="on">4:5</b><b>1:1</b></div>
                </div>
                <div className="lp-mini-col">
                  <div className="lp-mini-title">02 · Textos</div>
                  <div className="lp-mini-tabs"><b className="on">Inspiracional</b><b>Cercano</b></div>
                  <div className="lp-mini-lines"><i /><i /><i className="short" /><i /><i className="short" /></div>
                </div>
              </div>
            </div>

            <div className="lp-phone">
              <div className="lp-phone-notch" />
              <div className="lp-ig-head">
                <span className="lp-ig-avatar">Q</span>
                <div><b>tu_negocio</b><small>Santa Cruz de Tenerife</small></div>
              </div>
              <div className="lp-ig-photo">
                <img src="/logo-mark.png" alt="" />
                <span className="lp-ig-count">1/3</span>
              </div>
              <div className="lp-ig-dots"><i className="on" /><i /><i /></div>
              <div className="lp-ig-caption">
                <b>tu_negocio</b> Cada detalle cuenta una historia. Desliza y descubre la nuestra.
                <span className="lp-ig-tags">#HechoEnCanarias #TuMarca</span>
              </div>
            </div>

            <div className="lp-float lp-float-1"><Icon name="calendar" size={15} /> Programado · jue 10:00</div>
            <div className="lp-float lp-float-2"><Icon name="sparkle" size={15} /> 3 propuestas listas</div>
          </div>
        </div>

        {/* Datos del producto */}
        <div className="lp-wrap">
          <div className="lp-facts">
            {FACTS.map(f => (
              <div key={f.label} className="lp-fact">
                <strong><CountUp value={f.value} suffix={f.suffix || ''} /></strong>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Manifesto />
      <HowItWorks />
      <Features />
      <Sectors sectors={sectors} />
      <BeforeAfter />
      <Faq />

      {/* ── CTA final ── */}
      <section className="lp-section">
        <div className="lp-wrap">
          <div className="lp-cta">
            <img src="/logo-mark.png" alt="" className="lp-cta-logo" />
            <h2>Metricool te organiza las redes.<br /><span className="lp-grad">Qubia Craft te las llena.</span></h2>
            <p>Sube tu primera foto hoy y mira lo que Qubia Craft escribe para ti.</p>
            <button className="lp-btn lp-btn-gold lp-btn-lg" onClick={start}>
              {ctaLabel} <Icon name="arrow" size={18} />
            </button>
          </div>
        </div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap lp-footer-inner">
          <span className="lp-brand small"><img src="/logo-mark.png" alt="" /><span>Qubia<strong>Craft</strong></span></span>
          <span>© {new Date().getFullYear()} Qubia Craft · Hecho en Canarias</span>
          <span className="lp-legal"><a href="/privacidad">Privacidad</a><a href="/eliminacion-datos">Eliminación de datos</a></span>
          <button className="lp-btn-link" onClick={() => onAuth('login')}>Entrar</button>
        </div>
      </footer>
    </div>
  );
}
