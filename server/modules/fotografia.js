// Vertical fotografía — estudios de fotografía, fotógrafos, estudios creativos
// y de contenido visual (editorial, retrato, producto, eventos).
export default {
  key: 'fotografia',
  label: 'Fotografía y estudio creativo',
  icon: '📷',
  limites: ['No inventa precios ni fechas libres', 'Acredita a modelos y colaboradores', 'Sin retoques ni resultados prometidos'],
  matches: ['Fotografía / Estudio creativo'],
  promptGuidance:
    'Habla de la mirada y del proceso detrás de la imagen: luz, intención, la historia o la marca que se cuenta. ' +
    'Tono de autor, cercano y con criterio estético; evita tópicos ("capturamos momentos únicos"). Invita a reservar ' +
    'sesión o a escribir para un proyecto. NO inventes precios, paquetes, fechas disponibles ni plazos de entrega que ' +
    'no estén en el contexto de marca. Si en el contexto hay modelos, maquillaje, estilismo o marcas colaboradoras, ' +
    'acredítalos con su @; si no, no inventes nombres. No prometas resultados de retoque ni cambios físicos.',
  imageStyle: 'fotografía editorial, dirección de arte cuidada, luz natural o de estudio con intención, grano sutil, paleta coherente',
  ejemplos: {
    servicios: 'Ej: Sesiones editoriales, retrato de marca personal, fotografía de producto para e-commerce',
    cta: 'Ej: Reserva tu sesión por DM · Plazas limitadas este mes',
    hashtags: 'Ej: #FotografiaEditorial #TenerifePhotographer',
  },
  extraProfileFields: [
    { name: 'especialidad', label: 'Especialidad fotográfica', placeholder: 'Ej: Editorial, retrato de marca, producto' },
    { name: 'estilo', label: 'Estilo visual', placeholder: 'Ej: Luz natural, tonos cálidos, minimalista' },
    { name: 'colaboradores', label: 'Colaboradores habituales (@)', placeholder: 'Ej: @maquilladora @estilista' },
    { name: 'reservas', label: 'Cómo reservar sesión', placeholder: 'Ej: DM o formulario en la bio' },
  ],
};
