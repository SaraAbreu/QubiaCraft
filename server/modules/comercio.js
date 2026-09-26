// Vertical comercio — tiendas físicas y online.
export default {
  key: 'comercio',
  label: 'Comercio',
  icon: '🛍️',
  limites: ['No inventa precios, descuentos ni stock', 'Urgencia solo si es real'],
  matches: ['Retail / Tienda'],
  promptGuidance:
    'Presenta el producto por lo que aporta a quien lo compra (uso, ocasión, sensación), no solo por sus características. ' +
    'Usa urgencia honesta (novedad, pocas unidades, temporada) solo si encaja con la imagen. NO inventes precios, ' +
    'descuentos ni stock que no estén en el contexto de marca.',
  imageStyle: 'fotografía de producto, fondo limpio, composición cuidada, colores fieles',
  ejemplos: {
    servicios: 'Ej: Moda sostenible de mujer, complementos y regalo',
    cta: 'Ej: Ven a la tienda o compra online (link en bio)',
    hashtags: 'Ej: #ComercioLocal #ModaSostenible',
  },
  extraProfileFields: [
    { name: 'canalVenta', label: 'Dónde se compra', placeholder: 'Ej: Tienda física en C/ Castillo y web' },
    { name: 'envios', label: 'Envíos / recogida', placeholder: 'Ej: Envío 24–48h en Canarias, recogida gratis en tienda' },
  ],
};
