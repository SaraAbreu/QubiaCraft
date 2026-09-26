import axios from 'axios';

// Pollinations.AI: generación de imágenes por IA gratuita y sin API key.
// Documentación: https://pollinations.ai — el endpoint devuelve la imagen
// directamente al pedir la URL con el prompt codificado.
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

// Construye un prompt enriquecido con el estilo visual de marca y del
// módulo/vertical activo, para que la imagen generada encaje con el resto
// del contenido del negocio.
export function buildImagePrompt(description, profile = {}, vertical) {
  const parts = [description.trim()];

  if (profile?.sector) parts.push(`negocio del sector ${profile.sector}`);
  if (vertical?.label) parts.push(`estilo visual apropiado para ${vertical.label.toLowerCase()}`);
  if (profile?.tono) parts.push(`tono visual ${profile.tono.toLowerCase()}`);

  parts.push('fotografía profesional, alta calidad, iluminación natural, apta para publicar en Instagram');
  return parts.filter(Boolean).join(', ');
}

// Descarga la imagen generada como buffer binario (jpeg) para poder
// tratarla igual que una imagen subida por el usuario (compresión, base64
// hacia Groq Vision, guardado en historial, etc.)
export async function generateImage(prompt, { width = 1024, height = 1024, timeoutMs = 45000 } = {}) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: timeoutMs,
  });

  const contentType = response.headers['content-type'] || 'image/jpeg';
  return { buffer: Buffer.from(response.data), contentType };
}
