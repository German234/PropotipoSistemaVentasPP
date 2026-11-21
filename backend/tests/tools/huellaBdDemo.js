/**
 * Huella de SOLO LECTURA de la BD de la demo, para demostrar que las pruebas no la modifican.
 *
 *   node tests/tools/huellaBdDemo.js > antes.json
 *   ...correr pruebas...
 *   node tests/tools/huellaBdDemo.js --comparar antes.json     (sale con código 1 si algo cambió)
 *
 * Por cada tabla de usuario: filas y SHA-256 de todo su contenido (SELECT * ORDER BY 1 FOR JSON PATH).
 * Usa backend/.env pero fuerza DB_DEMO_NAME (por defecto BatallonAtlacatl). Solo ejecuta SELECT.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const sql = require('mssql');

const BD = process.env.DB_DEMO_NAME || 'BatallonAtlacatl';

async function huella() {
  const pool = await new sql.ConnectionPool({
    server: process.env.DB_SERVER || process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    database: BD,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: { encrypt: process.env.DB_ENCRYPT === 'true', trustServerCertificate: process.env.DB_TRUST_CERT !== 'false' },
  }).connect();
  try {
    const tablas = (await pool.request().query(
      `SELECT s.name AS esquema, t.name AS tabla FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
       WHERE t.is_ms_shipped = 0 ORDER BY s.name, t.name`
    )).recordset;
    const out = { bd: BD, fecha: new Date().toISOString(), tablas: {} };
    for (const { esquema, tabla } of tablas) {
      const nombre = `[${esquema}].[${tabla}]`;
      const filas = (await pool.request().query(`SELECT COUNT(*) AS n FROM ${nombre}`)).recordset[0].n;
      const r = await pool.request().query(`SELECT * FROM ${nombre} ORDER BY 1 FOR JSON PATH, INCLUDE_NULL_VALUES`);
      const json = r.recordset.map((x) => Object.values(x)[0]).join('');
      out.tablas[`${esquema}.${tabla}`] = { filas, sha256: crypto.createHash('sha256').update(json).digest('hex') };
    }
    return out;
  } finally {
    await pool.close();
  }
}

(async () => {
  const actual = await huella();
  const i = process.argv.indexOf('--comparar');
  if (i === -1) { console.log(JSON.stringify(actual, null, 2)); return; }
  const antes = JSON.parse(fs.readFileSync(process.argv[i + 1], 'utf8').replace(/^﻿/, ''));
  const nombres = [...new Set([...Object.keys(antes.tablas), ...Object.keys(actual.tablas)])].sort();
  let cambios = 0;
  for (const n of nombres) {
    const a = antes.tablas[n]; const b = actual.tablas[n];
    const igual = a && b && a.filas === b.filas && a.sha256 === b.sha256;
    if (!igual) cambios++;
    console.log(`${igual ? 'IGUAL ' : 'CAMBIO'}  ${n.padEnd(40)} filas ${a ? a.filas : '-'} → ${b ? b.filas : '-'}`);
  }
  console.log(`\nBD ${BD}: ${nombres.length} tablas, ${cambios} con cambios (antes ${antes.fecha}, ahora ${actual.fecha})`);
  process.exit(cambios ? 1 : 0);
})().catch((e) => { console.error('No se pudo leer la BD de la demo:', e.message); process.exit(2); });
