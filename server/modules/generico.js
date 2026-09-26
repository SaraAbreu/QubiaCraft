// Vertical por defecto — cubre cualquier negocio que no tenga un módulo
// dedicado ('Otro' o valores antiguos del perfil). Intencionalmente flexible.
export default {
  key: 'generico',
  label: 'Otro',
  // A qué valores del campo "Tipo de negocio" del perfil corresponde este
  // módulo. 'default' captura cualquier valor no listado en otro módulo.
  matches: ['Otro', 'default'],
  icon: '✨',
  promptGuidance:
    'Adapta el tono al tipo de negocio y al sector indicados en el contexto de marca. ' +
    'Destaca el beneficio concreto para el cliente y cierra con una llamada a la acción clara y realista para un negocio local.',
  imageStyle: 'fotografía profesional, luz natural',
  extraProfileFields: [],
};
