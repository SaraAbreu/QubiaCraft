import React, { useState, useEffect } from 'react';
import './Settings.css';
import InstagramConnect from './InstagramConnect.jsx';

const TONOS = ['Profesional', 'Cercano', 'Inspiracional', 'Divertido'];

// Los tipos de negocio salen del registro de módulos del servidor
// (GET /api/verticals) para no duplicar la lista aquí.

export default function Settings({ igFlash }) {
  const [form, setForm] = useState({
    nombre: '', instagram: '', tipoNegocio: '', sector: '', ciudad: '', servicios: '', tono: 'Cercano', cta: '', hashtags: '', vertical: {}
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [voice, setVoice] = useState({ count: 0, patterns: null });
  const [verticals, setVerticals] = useState([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/profile').then(r => r.json()),
      fetch('/api/voice').then(r => r.json()),
      fetch('/api/verticals').then(r => r.json())
    ]).then(([profile, voiceData, verticalsData]) => {
      if (profile) setForm(f => ({ ...f, ...profile, vertical: profile.vertical || {} }));
      if (voiceData) setVoice(voiceData);
      if (Array.isArray(verticalsData)) setVerticals(verticalsData);
    }).finally(() => setLoading(false));
  }, []);

  const activeVertical = verticals.find(v => v.matches.includes(form.tipoNegocio))
    || verticals.find(v => v.key === 'generico');
  const ej = (form.tipoNegocio && activeVertical?.ejemplos) || {};
  const tiposNegocio = verticals.flatMap(v => v.matches.map(m => ({ value: m, icon: v.icon })));

  function update(e) {
    setSaved(false);
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function updateVertical(e) {
    setSaved(false);
    const { name, value } = e.target;
    setForm(f => ({ ...f, vertical: { ...f.vertical, [name]: value } }));
  }

  async function save(e) {
    e.preventDefault();
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setSaved(true);
  }

  if (loading) return <div className="settings-page"><p className="settings-loading">Cargando perfil…</p></div>;

  return (
    <div className="settings-page">
      <div className="settings-header">
        <h1>Perfil de marca</h1>
        <p>La IA usará estos datos para generar captions adaptados a tu empresa</p>
      </div>

      <InstagramConnect flash={igFlash} />

      <form className="settings-form" onSubmit={save}>
        <div className="settings-grid">

          <div className="field-group">
            <label>Nombre de la empresa *</label>
            <input name="nombre" value={form.nombre} onChange={update} placeholder="Ej: Seguros García" required />
          </div>

          <div className="field-group">
            <label>Tipo de negocio</label>
            <select name="tipoNegocio" value={form.tipoNegocio} onChange={update}>
              <option value="">Selecciona un tipo…</option>
              {tiposNegocio.map(t => <option key={t.value} value={t.value}>{t.icon} {t.value}</option>)}
              {form.tipoNegocio && !tiposNegocio.some(t => t.value === form.tipoNegocio) && (
                <option value={form.tipoNegocio}>{form.tipoNegocio}</option>
              )}
            </select>
          </div>

          <div className="field-group">
            <label>Usuario de Instagram</label>
            <input name="instagram" value={form.instagram} onChange={update} placeholder="Ej: sa_draftstudio" />
          </div>

          <div className="field-group">
            <label>Sector / industria (detalle)</label>
            <input name="sector" value={form.sector} onChange={update} placeholder="Ej: Correduría de seguros" />
          </div>

          <div className="field-group">
            <label>Ciudad / ubicación</label>
            <input name="ciudad" value={form.ciudad} onChange={update} placeholder="Ej: Madrid" />
          </div>

          <div className="field-group">
            <label>Tono de comunicación</label>
            <select name="tono" value={form.tono} onChange={update}>
              {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="field-group full">
            <label>Productos y servicios principales</label>
            <textarea
              name="servicios"
              value={form.servicios}
              onChange={update}
              rows={3}
              placeholder={ej.servicios || 'Ej: Qué vendes u ofreces y a quién'}
            />
          </div>

          <div className="field-group full">
            <label>Llamada a la acción habitual</label>
            <input
              name="cta"
              value={form.cta}
              onChange={update}
              placeholder={ej.cta || 'Ej: Escríbenos por DM o llámanos'}
            />
          </div>

          <div className="field-group full">
            <label>Hashtags propios (separados por espacios)</label>
            <input
              name="hashtags"
              value={form.hashtags}
              onChange={update}
              placeholder={ej.hashtags || 'Ej: #TuMarca #TuCiudad'}
            />
          </div>

        </div>

        {activeVertical && activeVertical.extraProfileFields.length > 0 && (
          <div className="vertical-section">
            <div className="vertical-section-title">
              {activeVertical.icon || '📋'} Campos de {activeVertical.label}
            </div>
            <div className="settings-grid">
              {activeVertical.extraProfileFields.map(f => (
                <div className="field-group full" key={f.name}>
                  <label>{f.label}</label>
                  <input
                    name={f.name}
                    value={form.vertical?.[f.name] || ''}
                    onChange={updateVertical}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sección voz aprendida */}
        <div className="voice-section">
          <div className="voice-header">
            <span className="voice-title">🧠 Voz aprendida</span>
            <span className="voice-count">{voice.count} {voice.count === 1 ? 'edición guardada' : 'ediciones guardadas'}</span>
          </div>
          {voice.patterns ? (
            <div className="voice-patterns">
              <p className="voice-patterns-label">Patrones detectados:</p>
              <pre className="voice-patterns-text">{voice.patterns}</pre>
            </div>
          ) : (
            <p className="voice-empty">
              {voice.count === 0
                ? 'Aún no hay datos. Edita un caption antes de aprobarlo y la IA irá aprendiendo tu estilo.'
                : `${voice.count}/3 ediciones guardadas. Con 3 la IA activará el aprendizaje automático.`}
            </p>
          )}
        </div>

        <div className="settings-footer">
          {saved && <span className="settings-saved">✅ Perfil guardado</span>}
          <button type="submit" className="btn btn-primary">Guardar perfil</button>
        </div>
      </form>
    </div>
  );
}
