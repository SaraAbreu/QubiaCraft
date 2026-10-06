// Fechas clave para planificar contenido (España y Canarias). Cada fecha
// indica a qué sectores interesa ('all' = a todos) y una idea de enfoque.

function easter(year) {
  // Algoritmo de Meeus/Jones/Butcher (calendario gregoriano)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// n-ésimo día de la semana (0 = domingo) de un mes
function nthWeekday(year, month, weekday, n) {
  const first = new Date(Date.UTC(year, month, 1));
  return addDays(first, ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7);
}

function datesOfYear(y) {
  const d = (m, day) => new Date(Date.UTC(y, m - 1, day));
  const e = easter(y);
  const blackFriday = addDays(nthWeekday(y, 10, 4, 4), 1); // viernes tras el 4.º jueves de noviembre
  return [
    { date: d(1, 1), name: 'Año Nuevo', sectors: ['all'], idea: 'Propósitos y lo que viene este año' },
    { date: d(1, 6), name: 'Reyes', sectors: ['comercio', 'hosteleria', 'belleza', 'educacion'], idea: 'Regalos de última hora y planes en familia' },
    { date: d(1, 7), name: 'Inicio de rebajas', sectors: ['comercio'], idea: 'Qué entra en rebajas y hasta cuándo' },
    { date: d(2, 14), name: 'San Valentín', sectors: ['all'], idea: 'Planes, regalos y sesiones en pareja' },
    { date: addDays(e, -47), name: 'Martes de Carnaval', sectors: ['all'], idea: 'Carnaval de Tenerife: disfraces, maquillaje, ambiente' },
    { date: d(3, 8), name: 'Día de la Mujer', sectors: ['all'], idea: 'Mujeres del equipo o clientas que inspiran (sin oportunismo)' },
    { date: d(3, 19), name: 'Día del Padre', sectors: ['comercio', 'hosteleria', 'fotografia', 'belleza'], idea: 'Regalos y planes con papá' },
    { date: addDays(e, -7), name: 'Semana Santa', sectors: ['hosteleria', 'comercio', 'educacion', 'seguros'], idea: 'Horarios especiales, escapadas, viajes' },
    { date: d(4, 7), name: 'Día Mundial de la Salud', sectors: ['salud', 'fitness'], idea: 'Un hábito sencillo y bien explicado' },
    { date: d(4, 23), name: 'Día del Libro', sectors: ['educacion', 'comercio'], idea: 'Recomendaciones y lecturas del equipo' },
    { date: nthWeekday(y, 4, 0, 1), name: 'Día de la Madre', sectors: ['all'], idea: 'Regalos, planes y homenaje' },
    { date: d(5, 30), name: 'Día de Canarias', sectors: ['all'], idea: 'Producto local, tradición y orgullo canario' },
    { date: d(6, 21), name: 'Empieza el verano', sectors: ['all'], idea: 'Horarios de verano, temporada, novedades' },
    { date: d(6, 23), name: 'Noche de San Juan', sectors: ['hosteleria', 'fotografia', 'comercio'], idea: 'Hogueras, playa y planes de esa noche' },
    { date: d(7, 1), name: 'Rebajas de verano', sectors: ['comercio'], idea: 'Qué entra en rebajas' },
    { date: d(8, 19), name: 'Día Mundial de la Fotografía', sectors: ['fotografia'], idea: 'Tu foto favorita y por qué' },
    { date: d(9, 1), name: 'Vuelta a la rutina', sectors: ['all'], idea: 'Nuevos horarios, matrículas, propósitos de septiembre' },
    { date: d(9, 27), name: 'Día Mundial del Turismo', sectors: ['hosteleria', 'inmobiliaria'], idea: 'Lo mejor de tu zona para quien viene de fuera' },
    { date: d(10, 12), name: 'Fiesta Nacional', sectors: ['hosteleria', 'comercio'], idea: 'Puente y horarios especiales' },
    { date: d(10, 31), name: 'Halloween', sectors: ['all'], idea: 'Decoración, disfraces, ediciones especiales' },
    { date: blackFriday, name: 'Black Friday', sectors: ['comercio', 'belleza', 'fitness', 'fotografia', 'servicios', 'educacion'], idea: 'Oferta clara, con fecha de fin y sin letra pequeña' },
    { date: d(12, 6), name: 'Puente de diciembre', sectors: ['hosteleria', 'comercio'], idea: 'Planes y horarios del puente' },
    { date: d(12, 24), name: 'Nochebuena', sectors: ['all'], idea: 'Felicitación del equipo y horarios de fiestas' },
    { date: d(12, 31), name: 'Nochevieja', sectors: ['all'], idea: 'Resumen del año y gracias a tus clientes' },
  ];
}

// Fechas entre hoy y dentro de `days` días que interesan al sector.
// prepareBy: día recomendado para tener el post listo (unos días antes).
export function upcomingKeyDates(sectorKey, today = new Date(), days = 60) {
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const end = addDays(start, days);
  const y = start.getUTCFullYear();
  return [...datesOfYear(y), ...datesOfYear(y + 1)]
    .filter(k => k.date >= start && k.date <= end)
    .filter(k => k.sectors.includes('all') || k.sectors.includes(sectorKey))
    .sort((a, b) => a.date - b.date)
    .map(k => {
      const daysLeft = Math.round((k.date - start) / 86400000);
      const prep = addDays(k.date, -Math.min(5, daysLeft));
      return {
        date: k.date.toISOString().slice(0, 10),
        name: k.name,
        idea: k.idea,
        daysLeft,
        prepareBy: prep.toISOString().slice(0, 10),
      };
    });
}
