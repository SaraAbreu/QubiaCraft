// Pautas de publicación por sector. Son orientativas (comportamiento habitual
// del público de cada sector en Instagram), no datos de la cuenta: la pantalla
// Estrategia lo indica y propone afinarlas con los resultados propios.
// days: 1 = lunes … 7 = domingo. hours: hora local (Atlantic/Canary).

const COMMON_AVOID = [
  'Pedir "me gusta" o seguidores a cambio de algo: Instagram lo penaliza.',
  'Repetir la misma foto o el mismo texto en poco tiempo.',
  'Usar música, imágenes o marcas ajenas sin permiso.',
  'Más de 15 hashtags o hashtags que no tengan que ver con el post.',
];

export const STRATEGY = {
  hosteleria: {
    days: [4, 5, 6], hours: [12, 19],
    why: 'La gente decide dónde comer o salir justo antes: mediodía y tarde, de jueves a sábado.',
    formats: ['Carrusel del plato o la carta', 'Reel corto de cocina o servicio', 'Foto del local con ambiente'],
    publish: ['Platos con luz natural y de cerca', 'Novedades de carta y menú del día', 'El equipo y la cocina por dentro', 'Eventos, música en vivo, fechas especiales'],
    avoid: ['Fotos de comida oscuras o con flash', 'Precios que luego no coinciden con la carta', 'Publicar el menú del día cuando ya ha pasado la hora de comer'],
  },
  comercio: {
    days: [3, 4, 6], hours: [13, 20],
    why: 'Las compras se piensan en la pausa de mediodía y por la noche; el sábado es día de tienda.',
    formats: ['Carrusel de producto (detalle + uso)', 'Reel de novedades o unboxing', 'Foto de escaparate'],
    publish: ['Novedades y reposiciones', 'El producto en uso, no solo sobre fondo blanco', 'Promociones con fecha clara de fin', 'Preguntas frecuentes del mostrador'],
    avoid: ['Solo catálogo sin contexto', 'Ofertas sin condiciones claras', 'Fotos de proveedor iguales a las de la competencia'],
  },
  belleza: {
    days: [2, 4, 6], hours: [11, 20],
    why: 'Las citas se reservan con antelación: entre semana a media mañana y de noche, y el sábado.',
    formats: ['Carrusel antes/después (con permiso)', 'Reel del proceso', 'Foto de detalle del resultado'],
    publish: ['Resultados reales con permiso de la clienta', 'Procesos y técnicas explicadas', 'Huecos libres de la semana', 'Cuidados en casa'],
    avoid: ['Filtros que cambian el resultado real', 'Prometer resultados permanentes', 'Fotos de clientas sin su permiso'],
  },
  salud: {
    days: [1, 3, 5], hours: [9, 19],
    why: 'Se busca información de salud al empezar el día y por la tarde, entre semana.',
    formats: ['Carrusel divulgativo', 'Reel respondiendo una duda', 'Foto del equipo o la consulta'],
    publish: ['Divulgación sencilla y con fuente fiable', 'Prevención y hábitos', 'Presentación del equipo', 'Cómo pedir cita'],
    avoid: ['Diagnósticos o consejos personalizados en redes', 'Promesas de curación', 'Imágenes de pacientes identificables'],
  },
  fitness: {
    days: [1, 3, 7], hours: [7, 18],
    why: 'El lunes y el domingo son días de propósitos; las horas fuertes son antes y después de trabajar.',
    formats: ['Reel de ejercicio con técnica', 'Carrusel de rutina', 'Foto de comunidad en clase'],
    publish: ['Ejercicios bien explicados', 'Horarios de clases y novedades', 'Progresos reales de socios (con permiso)', 'Retos de la semana'],
    avoid: ['Cuerpos como "objetivo" o comparaciones', 'Dietas extremas', 'Promesas de kilos en días'],
  },
  educacion: {
    days: [1, 2, 4], hours: [17, 21],
    why: 'Familias y alumnos miran redes al salir de clase o del trabajo, al principio de la semana.',
    formats: ['Carrusel con un consejo práctico', 'Reel de clase o alumno', 'Foto de evento o resultado'],
    publish: ['Consejos de estudio útiles', 'Logros de alumnos (con permiso)', 'Plazos de matrícula', 'El día a día en el aula'],
    avoid: ['Menores identificables sin autorización', 'Garantizar aprobados', 'Solo publicidad de cursos'],
  },
  servicios: {
    days: [2, 3, 4], hours: [8, 13],
    why: 'Las decisiones profesionales se toman en horario laboral, a mitad de semana.',
    formats: ['Carrusel que resuelve un problema', 'Reel corto de presentación', 'Foto profesional del equipo'],
    publish: ['Casos resueltos (sin datos del cliente)', 'Errores frecuentes y cómo evitarlos', 'Quién está detrás', 'Testimonios con permiso'],
    avoid: ['Lenguaje técnico sin explicar', 'Datos de clientes', 'Publicar solo los fines de semana'],
  },
  inmobiliaria: {
    days: [2, 4, 7], hours: [13, 20],
    why: 'Se buscan viviendas en la pausa de mediodía, por la noche y con calma el domingo.',
    formats: ['Carrusel del inmueble (fachada, salón, cocina, vistas)', 'Reel de visita', 'Foto de zona o barrio'],
    publish: ['Inmuebles con fotos luminosas y ordenadas', 'Datos clave: zona, metros, habitaciones', 'Vendidos y alquilados', 'Guía de barrios'],
    avoid: ['Fotos con gran angular que deforman', 'Precios desactualizados', 'Direcciones exactas sin permiso del propietario'],
  },
  seguros: {
    days: [1, 2, 4], hours: [9, 14],
    why: 'Los trámites se miran en horario de oficina, a principio de semana.',
    formats: ['Carrusel explicativo', 'Reel de una duda frecuente', 'Foto del equipo'],
    publish: ['Explicar coberturas con ejemplos', 'Qué hacer ante un siniestro', 'Recordatorios por temporada (viajes, hogar, coche)', 'Quién te atiende'],
    avoid: ['Letra pequeña escondida', 'Miedo como gancho', 'Comparar con aseguradoras por su nombre'],
  },
  fotografia: {
    days: [2, 4, 7], hours: [12, 20],
    why: 'El público creativo mira con calma por la noche y el domingo; el mediodía funciona para marcas.',
    formats: ['Carrusel de una sesión completa', 'Reel del detrás de cámaras', 'Foto única de portada'],
    publish: ['Sesiones completas con una historia', 'Detrás de cámaras y luz', 'Créditos a modelos y equipo', 'Huecos para reservar sesión'],
    avoid: ['Fotos sin el permiso de quien aparece', 'Retoques que cambian el cuerpo', 'Publicar fotos sueltas sin hilo entre ellas'],
  },
  generico: {
    days: [2, 3, 4], hours: [13, 20],
    why: 'Pauta general: mitad de semana, a mediodía y por la noche.',
    formats: ['Carrusel', 'Reel corto', 'Foto con buena luz'],
    publish: ['Tu producto o servicio en uso', 'El equipo y el proceso', 'Preguntas de tus clientes', 'Novedades con fecha'],
    avoid: ['Solo publicidad', 'Fotos de banco de imágenes', 'Textos larguísimos sin llamada a la acción'],
  },
};

export function strategyFor(key) {
  const s = STRATEGY[key] || STRATEGY.generico;
  return { ...s, avoid: [...s.avoid, ...COMMON_AVOID] };
}
