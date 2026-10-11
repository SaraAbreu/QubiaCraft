// Correos de aviso (publicación programada que falla, conexión de Instagram
// a punto de caducar). Se envían desde el buzón de IONOS configurado en el
// .env. Si no está configurado, no se envía nada (y no pasa nada).
import nodemailer from 'nodemailer';

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, PUBLIC_URL } = process.env;
const enabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

const transport = enabled
  ? nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  : null;

const FROM = MAIL_FROM || (SMTP_USER ? `Qubia Craft <${SMTP_USER}>` : '');
const APP_URL = PUBLIC_URL || 'https://q-craft.qubia.es';

export const mailEnabled = enabled;

function layout(title, body) {
  return `<!doctype html><html><body style="margin:0;background:#0a1220;font-family:Segoe UI,Arial,sans-serif;color:#eef1f6">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <p style="font-size:18px;margin:0 0 24px"><span style="color:#eef1f6">Qubia</span> <b style="color:#17c3c6">Craft</b></p>
    <h1 style="font-size:20px;margin:0 0 14px;color:#c69758">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#cdd6e4">${body}</div>
    <p style="margin:28px 0"><a href="${APP_URL}" style="background:#c69758;color:#1a1206;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Abrir Qubia Craft</a></p>
    <p style="font-size:12px;color:#93a4bd">Recibes este aviso porque tienes una cuenta en Qubia Craft.</p>
  </div></body></html>`;
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function sendMail({ to, subject, title, html, text }) {
  if (!enabled || !to) return false;
  try {
    await transport.sendMail({ from: FROM, to, subject, text, html: layout(esc(title), html) });
    console.log(`[mail] Aviso enviado a ${to}: ${subject}`);
    return true;
  } catch (err) {
    console.error('[mail] No se pudo enviar el aviso:', err.message);
    return false;
  }
}

export function notifyPublishFailed(user, post, detail) {
  const when = post.scheduledFor
    ? new Date(post.scheduledFor).toLocaleString('es-ES', { timeZone: process.env.TZ || 'Atlantic/Canary', dateStyle: 'full', timeStyle: 'short' })
    : '';
  const what = post.kind === 'story' ? 'una historia programada' : 'una publicación programada';
  return sendMail({
    to: user.email,
    subject: 'No se pudo publicar en Instagram',
    title: `No se pudo publicar ${what}`,
    text: `Hola${user.name ? ' ' + user.name : ''}: no se pudo publicar ${what}${when ? ' (' + when + ')' : ''}. Motivo: ${detail || 'desconocido'}. Entra en ${APP_URL} para revisarla y volver a publicarla.`,
    html: `<p>Hola${user.name ? ' ' + esc(user.name) : ''}:</p>
      <p>No se pudo publicar ${what}${when ? ` del <b>${esc(when)}</b>` : ''}.</p>
      <p><b>Motivo:</b> ${esc(detail || 'desconocido')}</p>
      <p>Entra en Qubia Craft, ábrela en «Tus publicaciones» y pulsa «Publicar ya» cuando lo hayas revisado.</p>`,
  });
}

export function notifyInstagramExpiring(user, username, expiresAt) {
  const date = new Date(expiresAt).toLocaleDateString('es-ES', { dateStyle: 'long' });
  const expired = new Date(expiresAt) <= new Date();
  return sendMail({
    to: user.email,
    subject: expired ? 'Tu conexión con Instagram ha caducado' : 'Tu conexión con Instagram va a caducar',
    title: expired ? 'Vuelve a conectar tu Instagram' : 'Tu conexión con Instagram caduca pronto',
    text: `La conexión de @${username} con Qubia Craft ${expired ? 'caducó' : 'caduca'} el ${date}. Entra en ${APP_URL} → Perfil de marca → Conectar mi Instagram para renovarla. Mientras tanto, las publicaciones programadas no se podrán publicar.`,
    html: `<p>La conexión de <b>@${esc(username)}</b> con Qubia Craft ${expired ? 'caducó' : 'caduca'} el <b>${esc(date)}</b>.</p>
      <p>Para renovarla: Qubia Craft → <b>Perfil de marca</b> → <b>Conectar mi Instagram</b>. Tarda un minuto.</p>
      <p>Mientras no la renueves, las publicaciones programadas no se podrán publicar.</p>`,
  });
}
