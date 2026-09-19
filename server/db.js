import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  console.error('Manca DATABASE_URL: e\' la stringa di connessione del database Supabase.')
  process.exit(1)
}

// In locale il database gira senza SSL, su Supabase invece serve.
const inLocale = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(process.env.DATABASE_URL)

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: inLocale ? false : { rejectUnauthorized: false },
  max: 8,
  idleTimeoutMillis: 30_000
})

export async function q (testo, valori = []) {
  const res = await db.query(testo, valori)
  return res.rows
}

export async function uno (testo, valori = []) {
  const righe = await q(testo, valori)
  return righe[0] ?? null
}
