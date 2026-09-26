// Vertical salud y bienestar — clínicas, fisioterapia, nutrición, psicología.
// Sector sensible: evita afirmaciones médicas y promesas de curación.
export default {
  key: 'salud',
  label: 'Salud y bienestar',
  icon: '🩺',
  limites: ['No diagnostica ni promete curas', 'Sin antes/después', 'Remite a consulta'],
  matches: ['Salud y bienestar'],
  promptGuidance:
    'Tono cercano, empático y riguroso. Informa y acompaña, no diagnostiques. NO prometas curas, resultados ni plazos, ' +
    'no uses antes/después ni lenguaje alarmista, y no des consejos médicos concretos: remite siempre a una consulta ' +
    'con el profesional. Destaca la experiencia del equipo y el trato.',
  imageStyle: 'fotografía de clínica luminosa y serena, tonos neutros, sensación de calma y profesionalidad',
  ejemplos: {
    servicios: 'Ej: Fisioterapia deportiva, pilates terapéutico y readaptación',
    cta: 'Ej: Reserva tu primera valoración',
    hashtags: 'Ej: #FisioterapiaTenerife #Bienestar',
  },
  extraProfileFields: [
    { name: 'especialidades', label: 'Especialidades', placeholder: 'Ej: Fisioterapia deportiva, suelo pélvico' },
    { name: 'colegiado', label: 'Nº de colegiado / registro sanitario (opcional)', placeholder: 'Ej: Col. 1234' },
    { name: 'disclaimer', label: 'Aviso legal (opcional)', placeholder: 'Ej: Este contenido es informativo y no sustituye la consulta profesional.' },
  ],
};
