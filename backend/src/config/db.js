const sql = require('mssql');

const config = {
  server: process.env.DB_SERVER || process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  database: process.env.DB_NAME || 'BatallonAtlacatl',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise = null;

/** Pool único (lazy). Si la conexión falla, se reintenta en la siguiente llamada. */
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config).connect().catch((err) => {
      poolPromise = null;
      throw err;
    });
  }
  return poolPromise;
}

/** Ejecuta una consulta parametrizada sobre un pool o una transacción. params: { nombre: valor } */
async function ejecutar(origen, texto, params = {}) {
  const req = new sql.Request(origen);
  for (const [nombre, valor] of Object.entries(params)) req.input(nombre, valor);
  return req.query(texto);
}

/** query('SELECT ... WHERE id = @id', { id: 1 }) → resultado de mssql (recordset, rowsAffected...) */
async function query(texto, params) {
  return ejecutar(await getPool(), texto, params);
}

/**
 * Ejecuta fn dentro de una transacción. fn recibe ({ tx, query }) donde query usa la transacción.
 * Commit si fn termina bien, rollback si lanza.
 *   await withTransaction(async ({ query }) => { await query('UPDATE ...', {...}); });
 */
async function withTransaction(fn) {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const resultado = await fn({ tx, query: (texto, params) => ejecutar(tx, texto, params) });
    await tx.commit();
    return resultado;
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* ya abortada */ }
    throw err;
  }
}

module.exports = { sql, getPool, query, withTransaction };
