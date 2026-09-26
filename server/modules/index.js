// Registro de módulos por tipo de negocio. Para añadir uno nuevo: crea el
// archivo en esta carpeta e impórtalo aquí. El orden define el orden del
// desplegable "Tipo de negocio" en el perfil. 'generico' va el último y es
// el fallback para cualquier valor que no case con otro módulo.
import hosteleria from './hosteleria.js';
import comercio from './comercio.js';
import belleza from './belleza.js';
import salud from './salud.js';
import fitness from './fitness.js';
import educacion from './educacion.js';
import servicios from './servicios.js';
import inmobiliaria from './inmobiliaria.js';
import seguros from './seguros.js';
import generico from './generico.js';

export const VERTICALS = [
  hosteleria, comercio, belleza, salud, fitness, educacion, servicios, inmobiliaria, seguros, generico,
];

export function resolveVertical(tipoNegocio) {
  return VERTICALS.find(v => v.matches.includes(tipoNegocio)) || generico;
}
