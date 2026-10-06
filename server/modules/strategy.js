// Pautas de publicación por sector. Son orientativas (comportamiento habitual
// del público de cada sector en Instagram), no datos de la cuenta: la pantalla
// Estrategia lo indica y propone afinarlas con los resultados propios.
// days: 1 = lunes … 7 = domingo. hours: hora local del público.
// publish / avoid: [texto corto, explicación, icono de Icon.jsx]

const COMMON_AVOID = [
  ['Pedir likes', 'Pedir "me gusta" o seguidores a cambio de algo: Instagram lo penaliza.', 'ban'],
  ['Repetir', 'Repetir la misma foto o el mismo texto en poco tiempo.', 'repeat'],
  ['Música ajena', 'Usar música, imágenes o marcas ajenas sin permiso.', 'music'],
  ['+15 hashtags', 'Más de 15 hashtags, o hashtags que no tengan que ver con el post.', 'hash'],
];

export const STRATEGY = {
  hosteleria: {
    days: [4, 5, 6], hours: [12, 19],
    why: 'La gente decide dónde comer o salir justo antes: mediodía y tarde, de jueves a sábado.',
    formats: ['Carrusel del plato o la carta', 'Reel corto de cocina o servicio', 'Foto del local con ambiente'],
    publish: [
      ['Platos de cerca', 'Platos con luz natural y de cerca.', 'images'],
      ['Novedades', 'Novedades de carta y menú del día.', 'sparkle'],
      ['Cocina por dentro', 'El equipo y la cocina por dentro.', 'users'],
      ['Eventos', 'Eventos, música en vivo y fechas especiales.', 'calendar'],
    ],
    avoid: [
      ['Fotos oscuras', 'Fotos de comida oscuras o con flash.', 'eyeoff'],
      ['Precios dudosos', 'Precios que luego no coinciden con la carta.', 'tag'],
      ['Menú tarde', 'Publicar el menú del día cuando ya ha pasado la hora de comer.', 'clock'],
    ],
  },
  comercio: {
    days: [3, 4, 6], hours: [13, 20],
    why: 'Las compras se piensan en la pausa de mediodía y por la noche; el sábado es día de tienda.',
    formats: ['Carrusel de producto (detalle + uso)', 'Reel de novedades o unboxing', 'Foto de escaparate'],
    publish: [
      ['Novedades', 'Novedades y reposiciones.', 'sparkle'],
      ['Producto en uso', 'El producto en uso, no solo sobre fondo blanco.', 'images'],
      ['Promociones', 'Promociones con fecha clara de fin.', 'tag'],
      ['Dudas del cliente', 'Preguntas frecuentes del mostrador.', 'chat'],
    ],
    avoid: [
      ['Solo catálogo', 'Solo catálogo, sin contexto ni uso.', 'layers'],
      ['Letra pequeña', 'Ofertas sin condiciones claras.', 'tag'],
      ['Fotos de proveedor', 'Fotos de proveedor iguales a las de la competencia.', 'images'],
    ],
  },
  belleza: {
    days: [2, 4, 6], hours: [11, 20],
    why: 'Las citas se reservan con antelación: entre semana a media mañana y de noche, y el sábado.',
    formats: ['Carrusel antes/después (con permiso)', 'Reel del proceso', 'Foto de detalle del resultado'],
    publish: [
      ['Resultados reales', 'Resultados reales con permiso de la clienta.', 'sparkle'],
      ['El proceso', 'Procesos y técnicas explicadas.', 'pen'],
      ['Huecos libres', 'Huecos libres de la semana.', 'calendar'],
      ['Cuidados', 'Cuidados para hacer en casa.', 'heart'],
    ],
    avoid: [
      ['Filtros', 'Filtros que cambian el resultado real.', 'eyeoff'],
      ['Prometer', 'Prometer resultados permanentes.', 'ban'],
      ['Sin permiso', 'Fotos de clientas sin su permiso.', 'useroff'],
    ],
  },
  salud: {
    days: [1, 3, 5], hours: [9, 19],
    why: 'Se busca información de salud al empezar el día y por la tarde, entre semana.',
    formats: ['Carrusel divulgativo', 'Reel respondiendo una duda', 'Foto del equipo o la consulta'],
    publish: [
      ['Divulgación', 'Divulgación sencilla y con fuente fiable.', 'book'],
      ['Prevención', 'Prevención y hábitos saludables.', 'shield'],
      ['El equipo', 'Presentación del equipo.', 'users'],
      ['Pedir cita', 'Cómo pedir cita.', 'calendar'],
    ],
    avoid: [
      ['Diagnosticar', 'Diagnósticos o consejos personalizados en redes.', 'ban'],
      ['Curas milagro', 'Promesas de curación.', 'zap'],
      ['Pacientes', 'Imágenes de pacientes identificables.', 'useroff'],
    ],
  },
  fitness: {
    days: [1, 3, 7], hours: [7, 18],
    why: 'El lunes y el domingo son días de propósitos; las horas fuertes son antes y después de trabajar.',
    formats: ['Reel de ejercicio con técnica', 'Carrusel de rutina', 'Foto de comunidad en clase'],
    publish: [
      ['Técnica', 'Ejercicios bien explicados.', 'target'],
      ['Horarios', 'Horarios de clases y novedades.', 'clock'],
      ['Progresos', 'Progresos reales de socios (con permiso).', 'star'],
      ['Retos', 'Retos de la semana.', 'zap'],
    ],
    avoid: [
      ['Comparar cuerpos', 'Cuerpos como "objetivo" o comparaciones.', 'useroff'],
      ['Dietas extremas', 'Dietas extremas.', 'ban'],
      ['Kilos en días', 'Promesas de kilos en pocos días.', 'clock'],
    ],
  },
  educacion: {
    days: [1, 2, 4], hours: [17, 21],
    why: 'Familias y alumnos miran redes al salir de clase o del trabajo, al principio de la semana.',
    formats: ['Carrusel con un consejo práctico', 'Reel de clase o alumno', 'Foto de evento o resultado'],
    publish: [
      ['Consejos', 'Consejos de estudio útiles.', 'book'],
      ['Logros', 'Logros de alumnos (con permiso).', 'star'],
      ['Matrícula', 'Plazos de matrícula.', 'calendar'],
      ['El aula', 'El día a día en el aula.', 'users'],
    ],
    avoid: [
      ['Menores', 'Menores identificables sin autorización.', 'useroff'],
      ['Garantizar', 'Garantizar aprobados.', 'ban'],
      ['Solo anuncios', 'Solo publicidad de cursos.', 'megaphone'],
    ],
  },
  servicios: {
    days: [2, 3, 4], hours: [8, 13],
    why: 'Las decisiones profesionales se toman en horario laboral, a mitad de semana.',
    formats: ['Carrusel que resuelve un problema', 'Reel corto de presentación', 'Foto profesional del equipo'],
    publish: [
      ['Casos resueltos', 'Casos resueltos, sin datos del cliente.', 'check'],
      ['Errores típicos', 'Errores frecuentes y cómo evitarlos.', 'target'],
      ['Quién eres', 'Quién está detrás.', 'users'],
      ['Testimonios', 'Testimonios con permiso.', 'chat'],
    ],
    avoid: [
      ['Tecnicismos', 'Lenguaje técnico sin explicar.', 'book'],
      ['Datos de clientes', 'Datos de clientes.', 'useroff'],
      ['Solo finde', 'Publicar solo los fines de semana.', 'calendar'],
    ],
  },
  inmobiliaria: {
    days: [2, 4, 7], hours: [13, 20],
    why: 'Se buscan viviendas en la pausa de mediodía, por la noche y con calma el domingo.',
    formats: ['Carrusel del inmueble (fachada, salón, cocina, vistas)', 'Reel de visita', 'Foto de zona o barrio'],
    publish: [
      ['Fotos luminosas', 'Inmuebles con fotos luminosas y ordenadas.', 'images'],
      ['Datos clave', 'Zona, metros y habitaciones.', 'layers'],
      ['Vendidos', 'Vendidos y alquilados.', 'check'],
      ['Barrios', 'Guía de barrios.', 'map'],
    ],
    avoid: [
      ['Gran angular', 'Fotos con gran angular que deforman.', 'eyeoff'],
      ['Precios viejos', 'Precios desactualizados.', 'tag'],
      ['Dirección exacta', 'Direcciones exactas sin permiso del propietario.', 'map'],
    ],
  },
  seguros: {
    days: [1, 2, 4], hours: [9, 14],
    why: 'Los trámites se miran en horario de oficina, a principio de semana.',
    formats: ['Carrusel explicativo', 'Reel de una duda frecuente', 'Foto del equipo'],
    publish: [
      ['Coberturas', 'Explicar coberturas con ejemplos.', 'shield'],
      ['Siniestros', 'Qué hacer ante un siniestro.', 'zap'],
      ['Temporada', 'Recordatorios por temporada: viajes, hogar, coche.', 'calendar'],
      ['Quién atiende', 'Quién te atiende.', 'users'],
    ],
    avoid: [
      ['Letra pequeña', 'Letra pequeña escondida.', 'eyeoff'],
      ['Meter miedo', 'Usar el miedo como gancho.', 'ban'],
      ['Nombrar rivales', 'Comparar con aseguradoras por su nombre.', 'megaphone'],
    ],
  },
  fotografia: {
    days: [2, 4, 7], hours: [12, 20],
    why: 'El público creativo mira con calma por la noche y el domingo; el mediodía funciona para marcas.',
    formats: ['Carrusel de una sesión completa', 'Reel del detrás de cámaras', 'Foto única de portada'],
    publish: [
      ['Sesión completa', 'Sesiones completas que cuentan una historia.', 'images'],
      ['Detrás de cámaras', 'Detrás de cámaras y trabajo con la luz.', 'camera'],
      ['Créditos', 'Créditos a modelos y equipo con su @.', 'users'],
      ['Huecos libres', 'Huecos para reservar sesión.', 'calendar'],
    ],
    avoid: [
      ['Sin permiso', 'Fotos sin el permiso de quien aparece.', 'useroff'],
      ['Retoque corporal', 'Retoques que cambian el cuerpo.', 'eyeoff'],
      ['Fotos sueltas', 'Fotos sueltas sin hilo entre ellas.', 'layers'],
    ],
  },
  generico: {
    days: [2, 3, 4], hours: [13, 20],
    why: 'Pauta general: mitad de semana, a mediodía y por la noche.',
    formats: ['Carrusel', 'Reel corto', 'Foto con buena luz'],
    publish: [
      ['Producto en uso', 'Tu producto o servicio en uso.', 'images'],
      ['El equipo', 'El equipo y el proceso.', 'users'],
      ['Dudas', 'Preguntas de tus clientes.', 'chat'],
      ['Novedades', 'Novedades con fecha.', 'sparkle'],
    ],
    avoid: [
      ['Solo anuncios', 'Solo publicidad.', 'megaphone'],
      ['Fotos de banco', 'Fotos de banco de imágenes.', 'images'],
      ['Sin llamada', 'Textos larguísimos sin llamada a la acción.', 'chat'],
    ],
  },
};

const toItems = list => list.map(([label, detail, icon]) => ({ label, detail, icon }));

export function strategyFor(key) {
  const s = STRATEGY[key] || STRATEGY.generico;
  return { ...s, publish: toItems(s.publish), avoid: toItems([...s.avoid, ...COMMON_AVOID]) };
}
