// Acceso a datos por usuario. Todas las consultas de publicaciones filtran
// por user_id: un usuario nunca ve ni toca lo de otro.
import { query, one } from '../db.js';

const iso = d => (d ? new Date(d).toISOString() : null);

// ─── Usuarios ───────────────────────────────────────────────────────────────
export async function createUser({ email, passwordHash, name }) {
  return one(
    `INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)
     RETURNING id, email, name, created_at`,
    [email, passwordHash, name || null]
  );
}
export const findUserByEmail = email => one(`SELECT * FROM users WHERE email = $1`, [email]);
export const findUserById = id => one(`SELECT id, email, name, created_at FROM users WHERE id = $1`, [id]);
export async function countUsers() {
  const r = await one(`SELECT COUNT(*)::int AS n FROM users`);
  return r.n;
}

// ─── Perfil de marca y voz aprendida ────────────────────────────────────────
export async function getProfile(userId) {
  const r = await one(`SELECT data FROM profiles WHERE user_id = $1`, [userId]);
  return r?.data || {};
}
export async function saveProfile(userId, data) {
  await query(
    `INSERT INTO profiles (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [userId, JSON.stringify(data || {})]
  );
}
export async function getVoice(userId) {
  const r = await one(`SELECT data FROM voices WHERE user_id = $1`, [userId]);
  return r?.data || { examples: [], patterns: null };
}
export async function saveVoice(userId, data) {
  await query(
    `INSERT INTO voices (user_id, data) VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data`,
    [userId, JSON.stringify(data)]
  );
}

// ─── Publicaciones ──────────────────────────────────────────────────────────
const POST_FIELDS = {
  caption: 'caption',
  status: 'status',
  imageFiles: 'image_files',
  scheduledFor: 'scheduled_for',
  publishedAt: 'published_at',
  publishedLate: 'published_late',
  errorDetail: 'error_detail',
  igMediaId: 'ig_media_id',
};

// Fila de la BD → objeto de trabajo del servidor.
function toPost(r) {
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    createdAt: iso(r.created_at),
    caption: r.caption,
    status: r.status,
    imageFiles: Array.isArray(r.image_files) ? r.image_files : [],
    scheduledFor: iso(r.scheduled_for),
    publishedAt: iso(r.published_at),
    publishedLate: !!r.published_late,
    errorDetail: r.error_detail,
    igMediaId: r.ig_media_id,
  };
}

export async function createPost(userId, { caption, status = 'pending', imageFiles = [], createdAt, scheduledFor, publishedAt, publishedLate, errorDetail, igMediaId }) {
  return toPost(await one(
    `INSERT INTO posts (user_id, caption, status, image_files, created_at, scheduled_for, published_at, published_late, error_detail, ig_media_id)
     VALUES ($1, $2, $3, $4::jsonb, COALESCE($5::timestamptz, now()), $6, $7, $8, $9, $10) RETURNING *`,
    [userId, caption || '', status, JSON.stringify(imageFiles), createdAt || null, scheduledFor || null,
     publishedAt || null, !!publishedLate, errorDetail || null, igMediaId || null]
  ));
}

export async function listPosts(userId) {
  const rows = await query(`SELECT * FROM posts WHERE user_id = $1 ORDER BY created_at DESC, id DESC`, [userId]);
  return rows.map(toPost);
}

export async function getPost(userId, id) {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) return null;
  return toPost(await one(`SELECT * FROM posts WHERE id = $1 AND user_id = $2`, [n, userId]));
}

// Actualiza solo los campos presentes en `patch` (undefined = no tocar).
export async function updatePost(userId, id, patch) {
  const sets = [];
  const params = [id, userId];
  for (const [key, col] of Object.entries(POST_FIELDS)) {
    if (patch[key] === undefined) continue;
    let v = patch[key];
    if (key === 'imageFiles') { params.push(JSON.stringify(v)); sets.push(`${col} = $${params.length}::jsonb`); continue; }
    params.push(v);
    sets.push(`${col} = $${params.length}`);
  }
  if (!sets.length) return getPost(userId, id);
  return toPost(await one(
    `UPDATE posts SET ${sets.join(', ')} WHERE id = $1 AND user_id = $2 RETURNING *`,
    params
  ));
}

// Cambia el estado solo si sigue siendo uno de `from` (evita carreras con el
// programador o con otra pestaña). Devuelve la publicación o null.
export async function transitionPost(userId, id, from, patch) {
  const post = await one(
    `UPDATE posts SET status = $3 WHERE id = $1 AND user_id = $2 AND status = ANY($4::text[]) RETURNING id`,
    [id, userId, patch.status, from]
  );
  if (!post) return null;
  return updatePost(userId, id, patch);
}

export async function deletePost(userId, id) {
  return toPost(await one(`DELETE FROM posts WHERE id = $1 AND user_id = $2 RETURNING *`, [id, userId]));
}

// Programador: reclama de forma atómica las publicaciones vencidas.
export async function claimDuePosts(lateMs) {
  const rows = await query(
    `UPDATE posts
       SET status = 'publishing',
           published_late = (now() - scheduled_for) > ($1::int * interval '1 millisecond')
     WHERE status = 'scheduled' AND scheduled_for <= now()
     RETURNING *`,
    [lateMs]
  );
  return rows.map(toPost);
}

// Si el servidor se cayó en mitad de una publicación, no se reintenta a
// ciegas (podría duplicar el post): se marca como error.
export async function recoverInterrupted() {
  const rows = await query(
    `UPDATE posts SET status = 'error',
       error_detail = 'El servidor se detuvo durante la publicación. Revisa Instagram antes de reintentar.'
     WHERE status = 'publishing' RETURNING id`
  );
  return rows.length;
}

export async function countScheduled() {
  const r = await one(`SELECT COUNT(*)::int AS n FROM posts WHERE status = 'scheduled'`);
  return r.n;
}

// ─── Conexiones de Instagram (una por usuario) ──────────────────────────────
export async function getIgConnection(userId) {
  const r = await one(`SELECT data FROM instagram_connections WHERE user_id = $1`, [userId]);
  return r?.data || null;
}
export async function saveIgConnection(userId, conn) {
  await query(
    `INSERT INTO instagram_connections (user_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (user_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [userId, JSON.stringify(conn)]
  );
}
export async function deleteIgConnection(userId) {
  await query(`DELETE FROM instagram_connections WHERE user_id = $1`, [userId]);
}
export async function allIgConnections() {
  return query(`SELECT user_id, data FROM instagram_connections`);
}
