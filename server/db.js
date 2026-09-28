// Base de datos de Qubia Craft.
// - Producción: PostgreSQL real (variable DATABASE_URL, p. ej. la de Railway).
// - Local (sin DATABASE_URL): PGlite, un Postgres embebido que guarda los
//   datos en server/data/pglite. No hay que instalar nada aparte.
// Mismo SQL en los dos casos.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_DIR = path.join(__dir, 'data', 'pglite');

let impl = null;

export async function initDb() {
  if (impl) return;
  if (process.env.DATABASE_URL) {
    const { default: pg } = await import('pg');
    // int8 (COUNT, BIGINT) → número de JS
    pg.types.setTypeParser(20, v => (v === null ? null : Number(v)));
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });
    impl = { query: (text, params) => pool.query(text, params), kind: 'postgres' };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    fs.mkdirSync(LOCAL_DIR, { recursive: true });
    const db = new PGlite(LOCAL_DIR);
    await db.waitReady;
    impl = { query: (text, params) => db.query(text, params), kind: 'pglite' };
  }
  await migrate();
  console.log(`[db] ${impl.kind === 'postgres' ? 'PostgreSQL (DATABASE_URL)' : 'PGlite local (server/data/pglite)'} listo`);
}

export async function query(text, params = []) {
  if (!impl) throw new Error('La base de datos no está inicializada');
  const res = await impl.query(text, params);
  return res.rows;
}

export async function one(text, params = []) {
  const rows = await query(text, params);
  return rows[0] || null;
}

async function migrate() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS profiles (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS voices (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL DEFAULT '{"examples":[],"patterns":null}'::jsonb
    )`,
    `CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      caption TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      image_files JSONB NOT NULL DEFAULT '[]'::jsonb,
      scheduled_for TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      published_late BOOLEAN NOT NULL DEFAULT false,
      error_detail TEXT,
      ig_media_id TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS posts_user_created ON posts (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS posts_due ON posts (status, scheduled_for)`,
    `CREATE TABLE IF NOT EXISTS instagram_connections (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
  ];
  for (const sql of statements) await impl.query(sql, []);
}
