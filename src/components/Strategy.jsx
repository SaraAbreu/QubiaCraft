import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import './Strategy.css';

const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const BANDS = [
  { label: 'Mañana', from: 6, to: 11 },
  { label: 'Mediodía', from: 12, to: 15 },
  { label: 'Tarde', from: 16, to: 19 },
  { label: 'Noche', from: 20, to: 23 },
];
const ZONE = {
  canarias: { tz: 'Atlantic/Canary', name: 'Canarias', other: 'peninsula' },
  peninsula: { tz: 'Europe/Madrid', name: 'Península', other: 'canarias' },
};
const hh = h => `${String((h + 24) % 24).padStart(2, '0')}:00`;
const timeIn = (iso, zone) =>
  new Date(iso).toLocaleTimeString('es-ES', { timeZone: ZONE[zone].tz, hour: '2-digit', minute: '2-digit' });
const partsIn = (iso, zone) => {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('es-ES', { timeZone: ZONE[zone].tz, weekday: 'long' }),
    day: d.toLocaleDateString('es-ES', { timeZone: ZONE[zone].tz, day: 'numeric' }),
    month: d.toLocaleDateString('es-ES', { timeZone: ZONE[zone].tz, month: 'short' }),
  };
};
const fmtDay = iso =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });

function Info({ text }) {
  return (
    <span className="st-info" tabIndex={0} aria-label={text}>
      <Icon name="info" size={16} />
      <span className="st-tip" role="tooltip">{text}</span>
    </span>
  );
}

function Ring({ value, target }) {
  const r = 32, c = 2 * Math.PI * r, pct = Math.min(1, value / target);
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" role="img" aria-label={`${value} de ${target} publicaciones`}>
      <circle cx="42" cy="42" r={r} fill="none" stroke="var(--bg3)" strokeWidth="8" />
      {pct > 0 && <circle cx="42" cy="42" r={r} fill="none" stroke={pct >= 1 ? 'var(--success)' : 'var(--accent)'} strokeWidth="8"
        strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 42 42)" />}
      <text x="42" y="47" textAnchor="middle" fill="var(--text)" fontSize="17" fontWeight="700">{value}/{target}</text>
    </svg>
  );
}

const FORMAT_ICON = { 'Publicación': 'images', 'Carrusel': 'layers', 'Historia': 'clock' };

export default function Strategy({ onUseSlot, onUseIdea, onOpenSettings }) {
  const [data, setData] = useState(null);
  // Ideas de la IA por fecha clave: { [clave]: { loading, error, list } }
  const [ideas, setIdeas] = useState({});

  async function loadIdeas(k, refresh = false) {
    const id = k.date + k.name;
    setIdeas(m => ({ ...m, [id]: { ...(m[id] || {}), loading: true, error: '' } }));
    try {
      const res = await fetch('/api/key-date-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: k.date, name: k.name, idea: k.idea, refresh })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudieron generar ideas');
      setIdeas(m => ({ ...m, [id]: { loading: false, error: '', list: d.ideas } }));
    } catch (err) {
      setIdeas(m => ({ ...m, [id]: { ...(m[id] || {}), loading: false, error: err.message } }));
    }
  }

  function useIdea(k, it) {
    const slot = (it.when === 'antes' ? k.slotBefore : k.slotDay) || k.slotDay || k.slotBefore || null;
    onUseIdea?.({
      key: `${k.date}-${k.name}-${it.headline}`,
      dateName: k.name,
      date: k.date,
      slot,
      kind: it.format === 'Historia' ? 'story' : 'feed',
      carousel: it.format === 'Carrusel',
      template: it.template,
      headline: it.headline,
      idea: it.idea,
    });
  }
  const [error, setError] = useState('');

  const load = () =>
    fetch('/api/strategy')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError('No se pudo cargar la estrategia. Inténtalo de nuevo.'));

  useEffect(() => { load(); }, []);

  async function changeZone(zona) {
    if (zona === data.zone) return;
    setData(d => ({ ...d, zone: zona }));
    await fetch('/api/strategy/zone', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ zona }),
    }).catch(() => {});
    load();
  }

  if (error) return <div className="strategy"><p className="strategy-error">{error}</p></div>;
  if (!data) return <div className="strategy"><p className="strategy-loading">Cargando…</p></div>;

  const zone = data.zone, other = ZONE[zone].other;
  const shift = zone === 'canarias' ? 1 : -1; // península = Canarias + 1 h
  const a = data.activity;
  const hot = (dayIdx, band) =>
    data.bestDays.includes(DAY_NAMES[dayIdx]) && data.bestHours.some(h => h >= band.from && h <= band.to);
  const maxDays = 60;

  return (
    <div className="strategy">
      <header className="strategy-header">
        <div>
          <h1>Estrategia</h1>
          <p>Cuándo y qué publicar · {data.vertical.label}</p>
        </div>
        <div className="zone-toggle" role="group" aria-label="Dónde está tu público">
          <span>Tu público</span>
          {Object.entries(ZONE).map(([k, z]) => (
            <button key={k} className={zone === k ? 'active' : ''} onClick={() => changeZone(k)}>{z.name}</button>
          ))}
        </div>
      </header>

      {!data.hasProfile && (
        <div className="strategy-banner">
          <span>Elige el tipo de negocio en tu Perfil de marca para ver las pautas de tu sector.</span>
          <button className="strategy-link" onClick={onOpenSettings}>Configurar ahora →</button>
        </div>
      )}

      <div className="strategy-grid">
        {/* Mapa de calor */}
        <section className="strategy-card span-2">
          <div className="card-title">
            <h2>Cuándo publicar</h2>
            <Info text={`${data.why} Pauta orientativa del sector, no datos de tu cuenta.`} />
          </div>
          <div className="heat" role="table" aria-label="Mejores momentos de la semana">
            <span />
            {DAY_SHORT.map((d, i) => <span key={d} className="heat-day" title={DAY_NAMES[i]}>{d}</span>)}
            {BANDS.map(b => (
              <React.Fragment key={b.label}>
                <span className="heat-band">{b.label}</span>
                {DAY_SHORT.map((d, i) => (
                  <span key={d} className={`heat-cell ${hot(i, b) ? 'hot' : ''}`} title={hot(i, b) ? `${DAY_NAMES[i]}, ${b.label.toLowerCase()}` : ''} />
                ))}
              </React.Fragment>
            ))}
          </div>
          <div className="hour-row">
            {data.bestHours.map(h => (
              <span key={h} className="hour-chip">
                <strong>{hh(h)}</strong> {ZONE[zone].name}
                <em>{hh(h + shift)} {ZONE[other].name}</em>
              </span>
            ))}
          </div>
        </section>

        {/* Ritmo */}
        <section className="strategy-card ring-card">
          <div className="card-title">
            <h2>Tu ritmo</h2>
            <Info text="Publicaciones hechas desde Qubia Craft en los últimos 7 días. Publicar con regularidad pesa más que la hora exacta." />
          </div>
          <div className="ring-row">
            <Ring value={a.publishedLast7} target={a.targetPerWeek} />
            <div>
              <p className="ring-main">
                {a.publishedLast7 >= a.targetPerWeek ? '¡Objetivo cumplido!' : `Te faltan ${a.targetPerWeek - a.publishedLast7}`}
              </p>
              <p className="ring-sub">{a.scheduled} programadas · {a.daysSinceLast == null ? 'aún sin publicar' : `última hace ${a.daysSinceLast} d`}</p>
            </div>
          </div>
        </section>

        {/* Huecos */}
        <section className="strategy-card span-3">
          <div className="card-title"><h2>Huecos libres recomendados</h2></div>
          {data.nextSlots.length ? (
            <div className="slots">
              {data.nextSlots.map(s => {
                const p = partsIn(s.iso, zone);
                return (
                  <div key={s.iso} className="slot-tile">
                    <span className="slot-wd">{p.weekday}</span>
                    <span className="slot-num">{p.day}</span>
                    <span className="slot-month">{p.month}</span>
                    <span className="slot-time">{timeIn(s.iso, zone)} <small>{ZONE[zone].name}</small></span>
                    <span className="slot-alt">{timeIn(s.iso, other)} {ZONE[other].name}</span>
                    <button className="slot-btn" onClick={() => onUseSlot(s.iso)}><Icon name="plus" size={14} /> Preparar</button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="strategy-muted">Tienes cubiertos los próximos días buenos.</p>
          )}
        </section>

        {/* Qué publicar */}
        <section className="strategy-card span-half">
          <div className="card-title"><h2>Qué publicar</h2></div>
          <div className="icon-grid">
            {data.publish.map(it => (
              <div key={it.label} className="icon-tile do" title={it.detail} tabIndex={0}>
                <Icon name={it.icon} size={22} />
                <span>{it.label}</span>
              </div>
            ))}
          </div>
          <div className="format-row">
            {data.formats.map(f => <span key={f} className="format-chip">{f}</span>)}
          </div>
        </section>

        {/* Qué evitar */}
        <section className="strategy-card span-half">
          <div className="card-title"><h2>Qué evitar</h2></div>
          <div className="icon-grid">
            {data.avoid.map(it => (
              <div key={it.label} className="icon-tile dont" title={it.detail} tabIndex={0}>
                <Icon name={it.icon} size={22} />
                <span>{it.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Fechas clave */}
        <section className="strategy-card span-3">
          <div className="card-title">
            <h2>Fechas clave</h2>
            <Info text="Próximos 60 días para tu sector. Pasa el ratón por cada fecha para ver la idea y cuándo tenerlo listo." />
          </div>
          {data.keyDates.length ? (
            <div className="timeline">
              <div className="tl-line" />
              <div className="tl-point today" style={{ left: '0%' }}><span className="tl-dot" /><span className="tl-below">Hoy</span></div>
              {data.keyDates.map((k, i) => (
                <div
                  key={k.date + k.name}
                  className={`tl-point ${i % 2 ? 'alt' : ''}`}
                  style={{ left: `${Math.max(6, Math.min(94, (k.daysLeft / maxDays) * 100))}%` }}
                  title={`${fmtDay(k.date)} · ${k.idea}. Tenlo listo el ${fmtDay(k.prepareBy)}.`}
                  tabIndex={0}
                >
                  <span className="tl-above">{k.name}</span>
                  <span className="tl-dot" />
                  <span className="tl-below">{k.daysLeft === 0 ? 'hoy' : `en ${k.daysLeft} días`}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="strategy-muted">No hay fechas especiales de tu sector en los próximos 60 días.</p>
          )}

          {data.keyDates.length > 0 && (
            <div className="kd-list">
              {data.keyDates.map(k => {
                const id = k.date + k.name;
                const st = ideas[id] || {};
                return (
                  <div key={id} className="kd-item">
                    <div className="kd-head">
                      <div>
                        <strong>{k.name}</strong>
                        <span className="kd-date">{fmtDay(k.date)} · {k.daysLeft === 0 ? 'hoy' : `en ${k.daysLeft} días`}</span>
                      </div>
                      <button className="kd-btn" onClick={() => loadIdeas(k, !!st.list)} disabled={st.loading}>
                        {st.loading ? <span className="spinner" /> : <Icon name={st.list ? 'refresh' : 'sparkle'} size={14} />}
                        {st.list ? 'Otras ideas' : 'Ideas para mi negocio'}
                      </button>
                    </div>
                    <p className="kd-base">{k.idea}. <span>Tenlo listo el {fmtDay(k.prepareBy)}.</span></p>
                    {st.error && <p className="kd-error">{st.error}</p>}
                    {st.list && (
                      <div className="kd-ideas">
                        {st.list.map((it, j) => (
                          <div key={j} className="kd-idea">
                            <span className="kd-format"><Icon name={FORMAT_ICON[it.format] || 'images'} size={13} /> {it.format} · {it.when === 'antes' ? 'unos días antes' : 'el mismo día'}</span>
                            {it.headline && <strong className="kd-title">{it.headline}</strong>}
                            <p>{it.idea}</p>
                            <button className="kd-create" onClick={() => useIdea(k, it)}><Icon name="plus" size={14} /> Crear</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
