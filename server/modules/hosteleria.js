// Vertical hostelería — restaurantes, cafeterías, bares.
export default {
  key: 'hosteleria',
  label: 'Hostelería',
  icon: '🍽️',
  matches: ['Restaurante / Hostelería'],
  promptGuidance:
    'Haz que el plato o el espacio se "saboree" con la lectura: texturas, aromas, temperatura, momento del día. ' +
    'Invita a reservar o a pasarse hoy mismo. NO inventes precios, ingredientes, alérgenos ni horarios que no estén ' +
    'en el contexto de marca; si hablas de alérgenos, remite a consultar al personal.',
  imageStyle: 'fotografía gastronómica, luz cálida lateral, profundidad de campo reducida, ambiente acogedor',
  ejemplos: {
    servicios: 'Ej: Cocina canaria de temporada, brunch los domingos, terraza con vistas',
    cta: 'Ej: Reserva por DM o al 922 000 000',
    hashtags: 'Ej: #ComerEnTenerife #BrunchSantaCruz',
  },
  extraProfileFields: [
    { name: 'especialidad', label: 'Especialidad / tipo de cocina', placeholder: 'Ej: Cocina canaria de mercado' },
    { name: 'horario', label: 'Horario', placeholder: 'Ej: Mar–Dom 13:00–23:00' },
    { name: 'reservas', label: 'Cómo reservar', placeholder: 'Ej: WhatsApp 600 000 000 o TheFork' },
  ],
};
