// Vertical inmobiliaria — destaca ubicación y características del
// inmueble, genera urgencia sutil para agendar visita.
export default {
  key: 'inmobiliaria',
  label: 'Inmobiliaria',
  matches: ['Inmobiliaria'],
  promptGuidance:
    'Destaca ubicación, superficie, características diferenciales del inmueble (luz, terraza, vistas, estado) y genera ' +
    'urgencia sutil para agendar una visita. Evita inventar precios, metros cuadrados o cantidad de habitaciones si no ' +
    'aparecen explícitamente en el contexto de marca — en ese caso habla en términos generales del tipo de propiedad.',
  extraProfileFields: [
    { name: 'zonaCobertura', label: 'Zona de cobertura', placeholder: 'Ej: Santa Cruz de Tenerife y alrededores' },
    { name: 'tipoOperacion', label: 'Tipo de operación habitual', placeholder: 'Ej: Venta, Alquiler, Ambas' },
  ],
};
