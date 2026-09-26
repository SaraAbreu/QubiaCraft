// Vertical seguros — sector regulado: evita prometer coberturas no
// confirmadas y sugiere incluir un disclaimer legal breve al final del
// caption cuando el usuario lo haya configurado.
export default {
  key: 'seguros',
  label: 'Seguros',
  matches: ['Seguros'],
  icon: '🛡️',
  promptGuidance:
    'Transmite confianza, tranquilidad y respaldo profesional. NO prometas coberturas, indemnizaciones ni condiciones ' +
    'específicas que no estén explícitamente en el contexto de marca — habla en términos generales (protección, tranquilidad, respaldo) ' +
    'y deriva los detalles concretos a una llamada o consulta con el agente. Evita lenguaje alarmista sobre riesgos.',
  imageStyle: 'fotografía cálida de familias y hogares, sensación de tranquilidad y protección, luz natural',
  ejemplos: {
    servicios: 'Ej: Seguros de hogar, auto, vida y salud para familias y autónomos',
    cta: 'Ej: Llámanos al 900 123 456 o escríbenos por DM',
    hashtags: 'Ej: #SegurosGarcía #TuSeguroDeConfianza',
  },
  extraProfileFields: [
    { name: 'tiposPoliza', label: 'Tipos de póliza que ofreces', placeholder: 'Ej: Hogar, Auto, Vida, Salud' },
    { name: 'disclaimer', label: 'Disclaimer legal (opcional)', placeholder: 'Ej: Sujeto a condiciones de la póliza. Consulta términos y condiciones.' },
  ],
};
