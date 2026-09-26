// Vertical servicios profesionales — asesorías, abogados, arquitectos, agencias.
export default {
  key: 'servicios',
  label: 'Servicios profesionales',
  icon: '💼',
  limites: ['No promete resultados', 'No inventa cifras ni casos'],
  matches: ['Servicios profesionales'],
  promptGuidance:
    'Transmite autoridad y cercanía: plantea un problema real del cliente y cómo lo resuelves. Usa lenguaje claro, sin ' +
    'tecnicismos innecesarios. NO prometas resultados (juicios ganados, ahorros concretos) ni inventes cifras o casos. ' +
    'Cierra invitando a una primera consulta.',
  imageStyle: 'fotografía corporativa natural, espacio de trabajo real, luz de día, sensación de confianza',
  ejemplos: {
    servicios: 'Ej: Asesoría fiscal y contable para autónomos y pymes',
    cta: 'Ej: Pide tu primera consulta gratuita',
    hashtags: 'Ej: #Autonomos #AsesoriaFiscal',
  },
  extraProfileFields: [
    { name: 'clienteIdeal', label: 'Cliente ideal', placeholder: 'Ej: Autónomos y pymes de Canarias' },
    { name: 'diferencial', label: 'Qué te diferencia', placeholder: 'Ej: Respuesta en 24h y gestión 100% online' },
  ],
};
