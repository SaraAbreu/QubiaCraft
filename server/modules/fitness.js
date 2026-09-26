// Vertical fitness y deporte — gimnasios, entrenadores, estudios de yoga/pilates.
export default {
  key: 'fitness',
  label: 'Fitness y deporte',
  icon: '🏋️',
  matches: ['Fitness / Deporte'],
  promptGuidance:
    'Energía y motivación realista: constancia, comunidad, sentirse mejor. NO prometas pérdidas de peso, cambios ' +
    'físicos ni plazos concretos, evita el body-shaming y los antes/después. Invita a probar una clase o sesión.',
  imageStyle: 'fotografía deportiva dinámica, movimiento, luz contrastada, energía',
  ejemplos: {
    servicios: 'Ej: Entrenamiento funcional en grupos reducidos y entrenamiento personal',
    cta: 'Ej: Prueba tu primera clase gratis',
    hashtags: 'Ej: #EntrenamientoFuncional #FitnessTenerife',
  },
  extraProfileFields: [
    { name: 'disciplinas', label: 'Disciplinas / clases', placeholder: 'Ej: Funcional, yoga, pilates' },
    { name: 'horarios', label: 'Horarios de clases', placeholder: 'Ej: L–V 7:00–21:00, sábados mañana' },
  ],
};
