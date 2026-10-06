import React, { useEffect, useState } from 'react';
import './Strategy.css';

const DAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

const fmtDay = iso =>
  new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtSlot = iso =>
  new Date(iso).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function Strategy({ onUseSlot, onOpenSettings }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/strategy')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError('No se pudo cargar la estrategia. Inténtalo de nuevo.'));
  }, []);

  if (error) return <div className="strategy"><p className="strategy-error">{error}</p></div>;
  if (!data) return <div className="strategy"><p className="strategy-loading">Cargando…</p></div>;

  const a = data.activity;
  const maxCount = Math.max(1, ...a.byWeekday.map(d => d.count));
  const paceOk = a.perWeekLast30 >= a.targetPerWeek;

  return (
    <div className="strategy">
      <header className="strategy-header">
        <h1>Estrategia</h1>
        <p>
          Cuándo y qué publicar · {data.vertical.icon} {data.vertical.label}
        </p>
      </header>

      {!data.hasProfile && (
        <div className="strategy-banner">
          <span>Elige el tipo de negocio en tu Perfil de marca para ver las pautas de tu sector.</span>
          <button className="strategy-link" onClick={onOpenSettings}>Configurar ahora →</button>
        </div>
      )}

      <div className="strategy-grid">
        {/* Próximos huecos */}
        <section className="strategy-card strategy-wide">
          <div className="strategy-card-head">
            <h2>Próximos huecos recomendados</h2>
            <p>Días y horas buenos para tu sector en los que aún no tienes nada programado</p>
          </div>
          {data.nextSlots.length ? (
            <ul className="slot-list">
              {data.nextSlots.map(s => (
                <li key={s.iso} className="slot">
                  <span className="slot-date">{fmtSlot(s.iso)}</span>
                  <button className="btn btn-primary slot-btn" onClick={() => onUseSlot(s.iso)}>Preparar publicación</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="strategy-muted">Tienes cubiertos los próximos días buenos. ¡Bien!</p>
          )}
        </section>

        {/* Mejores días y horas */}
        <section className="strategy-card">
          <div className="strategy-card-head">
            <h2>Mejores días y horas</h2>
            <p>Hora de Canarias</p>
          </div>
          <div className="week-row">
            {DAY_SHORT.map((d, i) => (
              <span key={d} className={`week-day ${data.bestDays.includes(DAY_NAMES[i]) ? 'on' : ''}`} title={DAY_NAMES[i]}>{d}</span>
            ))}
          </div>
          <div className="hour-row">
            {data.bestHours.map(h => <span key={h} className="hour-chip">{String(h).padStart(2, '0')}:00</span>)}
          </div>
          <p className="strategy-why">{data.why}</p>
          <p className="strategy-note">
            Pauta orientativa del sector, no datos de tu cuenta. Cuando se active el permiso de estadísticas de Instagram, se ajustará a tus seguidores.
          </p>
        </section>

        {/* Tu ritmo */}
        <section className="strategy-card">
          <div className="strategy-card-head">
            <h2>Tu ritmo</h2>
            <p>Lo publicado desde Qubia Craft</p>
          </div>
          <div className="pace">
            <div className="pace-stat">
              <strong className={paceOk ? 'ok' : 'low'}>{a.perWeekLast30}</strong>
              <span>posts/semana (objetivo {a.targetPerWeek})</span>
            </div>
            <div className="pace-stat">
              <strong>{a.scheduled}</strong>
              <span>programadas</span>
            </div>
            <div className="pace-stat">
              <strong>{a.daysSinceLast ?? '—'}</strong>
              <span>días desde la última</span>
            </div>
          </div>
          <div className="bars" aria-label="Publicaciones por día de la semana">
            {a.byWeekday.map((d, i) => (
              <div key={d.name} className="bar-col" title={`${d.name}: ${d.count}`}>
                <div className="bar" style={{ height: `${(d.count / maxCount) * 100}%` }} />
                <span>{DAY_SHORT[i]}</span>
              </div>
            ))}
          </div>
          {!paceOk && <p className="strategy-why">Publicar con regularidad pesa más que la hora exacta: intenta llegar a {a.targetPerWeek} por semana.</p>}
        </section>

        {/* Qué publicar */}
        <section className="strategy-card">
          <div className="strategy-card-head">
            <h2>Qué publicar</h2>
            <p>Lo que mejor funciona en tu sector</p>
          </div>
          <ul className="tick-list do">
            {data.publish.map(t => <li key={t}>{t}</li>)}
          </ul>
          <h3 className="strategy-sub">Formatos</h3>
          <div className="format-row">
            {data.formats.map(f => <span key={f} className="format-chip">{f}</span>)}
          </div>
        </section>

        {/* Qué evitar */}
        <section className="strategy-card">
          <div className="strategy-card-head">
            <h2>Qué evitar</h2>
            <p>Resta alcance o confianza</p>
          </div>
          <ul className="tick-list dont">
            {data.avoid.map(t => <li key={t}>{t}</li>)}
          </ul>
        </section>

        {/* Fechas clave */}
        <section className="strategy-card strategy-wide">
          <div className="strategy-card-head">
            <h2>Fechas clave</h2>
            <p>Próximos 60 días, para tu sector</p>
          </div>
          {data.keyDates.length ? (
            <ul className="date-list">
              {data.keyDates.map(k => (
                <li key={k.date + k.name} className="date-item">
                  <span className="date-when">{fmtDay(k.date)}</span>
                  <div className="date-body">
                    <strong>{k.name}</strong>
                    <span>{k.idea}</span>
                  </div>
                  <span className="date-prep">
                    {k.daysLeft === 0 ? 'Es hoy' : `Tenlo listo el ${fmtDay(k.prepareBy)}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="strategy-muted">No hay fechas especiales de tu sector en los próximos 60 días.</p>
          )}
        </section>
      </div>
    </div>
  );
}
