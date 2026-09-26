// Vertical belleza y estética — peluquerías, estética, uñas, tatuajes.
export default {
  key: 'belleza',
  label: 'Belleza y estética',
  icon: '💅',
  limites: ['Sin resultados garantizados', 'Sin afirmaciones médicas'],
  matches: ['Belleza y estética'],
  promptGuidance:
    'Enfoca en cómo se siente la persona después (confianza, cuidado, estilo propio) y en el oficio detrás del trabajo. ' +
    'NO prometas resultados garantizados ni permanentes ni hagas afirmaciones médicas; en tratamientos, sugiere una ' +
    'valoración previa. Invita a pedir cita.',
  imageStyle: 'fotografía de estudio de belleza, luz suave, detalle del trabajo, estética limpia y elegante',
  ejemplos: {
    servicios: 'Ej: Color, cortes, tratamientos capilares y manicura',
    cta: 'Ej: Pide tu cita por DM o en el link de la bio',
    hashtags: 'Ej: #PeluqueriaTenerife #Balayage',
  },
  extraProfileFields: [
    { name: 'servicioEstrella', label: 'Servicio estrella', placeholder: 'Ej: Balayage y tratamientos de keratina' },
    { name: 'citas', label: 'Cómo pedir cita', placeholder: 'Ej: Booksy, WhatsApp o DM' },
  ],
};
