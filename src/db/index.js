import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL es obligatorio.');

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false },
});

/**
 * Ejecuta una consulta SQL en el pool.
 * @param {string} text
 * @param {unknown[]} [params]
 */
export async function query(text, params) {
  return pool.query(text, params);
}

/**
 * Lee el schema.sql y lo aplica contra la base de datos.
 * Se llama una sola vez al arrancar el servidor.
 */
export async function initDatabase() {
  // El schema está en la raíz de Backend/
  const schema = readFileSync(join(__dirname, '../../schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✅ Esquema de base de datos verificado/creado.');
}
