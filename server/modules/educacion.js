// Vertical educación — academias, formación, clases particulares.
export default {
  key: 'educacion',
  label: 'Educación',
  icon: '🎓',
  matches: ['Educación / Academia'],
  promptGuidance:
    'Habla a quien decide (alumno o familia): progreso, acompañamiento y método. Motiva sin presionar. ' +
    'NO garantices aprobados, notas ni certificaciones que no estén en el contexto de marca. Menciona plazas o fechas ' +
    'de inicio solo si aparecen en el contexto.',
  imageStyle: 'fotografía de aula o estudio luminoso, ambiente dinámico y cercano, materiales de aprendizaje',
  ejemplos: {
    servicios: 'Ej: Inglés para niños y adultos, preparación Cambridge',
    cta: 'Ej: Reserva tu clase de prueba',
    hashtags: 'Ej: #AcademiaTenerife #AprenderIngles',
  },
  extraProfileFields: [
    { name: 'niveles', label: 'Niveles / edades', placeholder: 'Ej: Primaria, ESO, Bachillerato y adultos' },
    { name: 'modalidad', label: 'Modalidad', placeholder: 'Ej: Presencial y online' },
  ],
};
