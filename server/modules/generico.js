// Vertical por defecto — cubre cualquier negocio local que no tenga un
// módulo dedicado (restaurantes, retail, belleza, salud, educación,
// fitness, servicios profesionales, etc.). Es intencionalmente flexible:
// la mayoría de las pymes usan este módulo.
export default {
  key: 'generico',
  label: 'Genérico',
  // A qué valores del campo "Tipo de negocio" del perfil corresponde este
  // módulo. 'default' captura cualquier valor no listado en otro módulo.
  matches: [
    'Restaurante / Hostelería',
    'Retail / Tienda',
    'Belleza y estética',
    'Salud y bienestar',
    'Servicios profesionales',
    'Educación / Academia',
    'Fitness / Deporte',
    'Otro',
    'default',
  ],
  promptGuidance:
    'Adapta el tono al tipo de negocio y al sector indicados en el contexto de marca. ' +
    'Destaca el beneficio concreto para el cliente y cierra con una llamada a la acción clara y realista para un negocio local.',
  extraProfileFields: [],
};
