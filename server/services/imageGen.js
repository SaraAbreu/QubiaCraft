import axios from 'axios';

// Pollinations.AI: generación de imágenes por IA. Funciona sin API key (nivel
// gratuito); si POLLINATIONS_API_KEY está en .env se envía como Bearer token
// para usar el nivel de tu cuenta (menos límites, sin cola).
// Documentación: https://pollinations.ai — el endpoint devuelve la imagen
// directamente al pedir la URL con el prompt codificado.
// API actual: gen.pollinations.ai/image/{prompt} (clave sk_… como Bearer).
// La antigua image.pollinations.ai/prompt queda como respaldo.
const POLLINATIONS_GEN = 'https://gen.pollinations.ai/image';
const POLLINATIONS_LEGACY = 'https://image.pollinations.ai/prompt';

// Construye un prompt enriquecido con el estilo visual de marca y del
// módulo/vertical activo, para que la imagen generada encaje con el resto
// del contenido del negocio.
export function buildImagePrompt(description, profile = {}, vertical) {
  const parts = [description.trim()];

  if (profile?.sector) parts.push(`negocio del sector ${profile.sector}`);
  if (vertical?.imageStyle) parts.push(vertical.imageStyle);
  else if (vertical?.label) parts.push(`estilo visual apropiado para ${vertical.label.toLowerCase()}`);
  if (profile?.tono) parts.push(`tono visual ${profile.tono.toLowerCase()}`);

  parts.push('fotografía profesional, alta calidad, iluminación natural, apta para publicar en Instagram');
  return parts.filter(Boolean).join(', ');
}

// Descarga la imagen generada como buffer binario para tratarla igual que
// una imagen subida por el usuario. Prueba primero la API actual y, si
// falla, la antigua. Lanza un Error con un mensaje legible en español.
export async function generateImage(prompt, { width = 1024, height = 1024, timeoutMs = 60000 } = {}) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const qs = `width=${width}&height=${height}&seed=${seed}&nologo=true`;
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  const headers = key ? { Authorization: `Bearer ${key}` } : {};

  // 1) API actual con tu clave. 2) Nivel gratuito anónimo (endpoint antiguo,
  // sin clave): así, si la cuenta no tiene saldo (402), sigue funcionando.
  const attempts = [
    { url: `${POLLINATIONS_GEN}/${encodeURIComponent(prompt)}?${qs}`, headers },
    { url: `${POLLINATIONS_LEGACY}/${encodeURIComponent(prompt)}?${qs}`, headers: {} },
  ];

  let lastErr, firstErr;
  for (const { url, headers } of attempts) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer', timeout: timeoutMs, headers });
      const contentType = response.headers['content-type'] || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        throw Object.assign(new Error('La respuesta no es una imagen'), { body: Buffer.from(response.data).toString().slice(0, 200) });
      }
      return { buffer: Buffer.from(response.data), contentType };
    } catch (err) {
      lastErr = err;
      firstErr = firstErr || err;
      const body = err.body || (err.response?.data ? Buffer.from(err.response.data).toString().slice(0, 200) : '');
      console.error(`[imageGen] ${new URL(url).host} → ${err.response?.status || err.code || ''} ${err.message} ${body}`);
    }
  }
  // Si la cuenta no tiene saldo, ese es el mensaje útil aunque el gratuito también falle.
  throw new Error(friendlyError(firstErr?.response?.status === 402 ? firstErr : lastErr));
}

function friendlyError(err) {
  const status = err?.response?.status;
  if (status === 401 || status === 403) return 'Pollinations rechazó la clave (401/403). Revisa POLLINATIONS_API_KEY en el .env (debe empezar por sk_).';
  if (status === 402) return 'Tu cuenta de Pollinations no tiene saldo (402). Revisa tu cuenta en enter.pollinations.ai.';
  if (status === 429 || status === 503) return 'Pollinations está saturado o has llegado al límite (429). Prueba de nuevo en un minuto.';
  if (err?.code === 'ECONNABORTED') return 'Pollinations tardó demasiado en responder. Prueba de nuevo.';
  if (err?.code === 'ENOTFOUND' || err?.code === 'ECONNREFUSED') return 'No se pudo conectar con Pollinations. Revisa tu conexión a internet.';
  return `Error de Pollinations${status ? ` (${status})` : ''}: ${err?.message || 'desconocido'}`;
}
