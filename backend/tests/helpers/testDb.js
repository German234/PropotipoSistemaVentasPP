/**
 * BD de pruebas: crea BatallonAtlacatl_Test (si no existe), aplica db/01_schema.sql y db/02_seed.sql,
 * y reinicia los datos con el cuerpo de db/03_reset_demo.sql. Usa los scripts reales del repo
 * (cambiando el USE) para que las pruebas corran sobre el mismo esquema que la demo.
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');

const DB_DIR = path.join(__dirname, '..', '..', '..', 'db');

function config(database) {
  return {
    server: process.env.DB_SERVER || process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    },
    pool: { max: 1, min: 0 },
  };
}

/** Lotes de un script .sql: separa por GO y quita USE / PRINT / DBCC CHECKIDENT. */
function lotes(archivo) {
  const texto = fs.readFileSync(path.join(DB_DIR, archivo), 'utf8')
    .replace(/^\s*USE\s+\S+\s*;?\s*$/gim, '')
    .replace(/^\s*PRINT\s.*$/gim, '')
    // RESEED 0 en una tabla sin filas haría que el primer id sea 0; los ids no importan en las pruebas
    .replace(/^\s*DBCC\s+CHECKIDENT.*$/gim, '');
  return texto.split(/^\s*GO\s*$/gim).map((l) => l.trim()).filter(Boolean);
}

async function ejecutarScript(pool, archivo) {
  for (const lote of lotes(archivo)) await pool.request().batch(lote);
}

async function crearBd() {
  const nombre = process.env.DB_NAME;
  if (!/^[A-Za-z0-9_]+$/.test(nombre)) throw new Error(`Nombre de BD de pruebas inválido: ${nombre}`);
  const master = await new sql.ConnectionPool(config('master')).connect();
  try {
    await master.request().batch(`IF DB_ID('${nombre}') IS NULL CREATE DATABASE [${nombre}]`);
  } finally {
    await master.close();
  }
  const pool = await new sql.ConnectionPool(config(nombre)).connect();
  try {
    await ejecutarScript(pool, '01_schema.sql');
    await ejecutarScript(pool, '02_seed.sql');
    await ejecutarScript(pool, '03_reset_demo.sql');
  } finally {
    await pool.close();
  }
}

/** Deja la BD de pruebas como recién sembrada (cada archivo de integración lo llama en beforeAll). */
async function reiniciarBd() {
  const pool = await new sql.ConnectionPool(config(process.env.DB_NAME)).connect();
  try {
    await ejecutarScript(pool, '03_reset_demo.sql');
  } finally {
    await pool.close();
  }
}

module.exports = { crearBd, reiniciarBd };
