/**
 * Cliente de pruebas sobre la app Express (supertest, sin levantar el puerto).
 *   const t = await prepararApi();          // reinicia la BD y hace login admin + vendedor
 *   await t.emitir('01', body, 'rechazo');  // POST /api/dte/01 con X-Simular
 *   await t.stock('P001');                  // stock actual por código
 */
const request = require('supertest');
const app = require('../../src/app');
const { getPool } = require('../../src/config/db');
const { reiniciarBd } = require('./testDb');

const UUID_MAYUS = /^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/;
const SELLO = /^\d{4}[A-Z0-9]{36}$/;
const FH_MH = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
const numeroControlRe = (tipo) => new RegExp(`^DTE-${tipo}-M001P001-\\d{15}$`);

/** Ids del seed (db/02_seed.sql) tras el reinicio. */
const CLIENTES = { juan: 'Juan Pérez', roble: 'Distribuidora El Roble, S.A. de C.V.', libreria: 'Librería Cuscatlán, S.A. de C.V.' };

async function login(usuario, password) {
  const r = await request(app).post('/api/auth/login').send({ usuario, password });
  if (r.status !== 200) throw new Error(`Login ${usuario} falló: ${JSON.stringify(r.body)}`);
  return r.body.data.token;
}

async function prepararApi() {
  await reiniciarBd();
  const tokenAdmin = await login('admin', 'admin123');
  const tokenVendedor = await login('vendedor', 'vendedor123');

  const conToken = (token) => (metodo, url) => request(app)[metodo](url).set('Authorization', `Bearer ${token}`);
  const admin = conToken(tokenAdmin);
  const vendedor = conToken(tokenVendedor);

  const productos = (await admin('get', '/api/productos')).body.data;
  const clientes = (await admin('get', '/api/clientes')).body.data;
  const prod = Object.fromEntries(productos.map((p) => [p.codigo, p]));
  const cli = Object.fromEntries(Object.entries(CLIENTES).map(([k, nombre]) => [k, clientes.find((c) => c.nombre === nombre)]));

  const conSimular = (req, simular) => (simular ? req.set('X-Simular', simular) : req);

  return {
    app,
    request,
    admin,
    vendedor,
    tokenAdmin,
    tokenVendedor,
    prod,
    cli,
    emitir: (tipo, body, simular, quien = admin) => conSimular(quien('post', `/api/dte/${tipo}`), simular).send(body),
    reintentar: (id, simular) => conSimular(admin('post', `/api/dte/${id}/reintentar`), simular).send(),
    invalidar: (id, body, simular) => conSimular(admin('post', `/api/dte/${id}/invalidar`), simular).send(body),
    detalle: async (id) => (await admin('get', `/api/dte/${id}`)).body.data,
    stock: async (codigo) => (await admin('get', `/api/productos/${prod[codigo].id}`)).body.data.stock,
    bitacora: async (query) => (await admin('get', '/api/bitacora').query(query)).body.data,
  };
}

/** Cierra el pool de mssql al final de cada archivo para que Jest termine limpio. */
async function cerrarBd() {
  try { await (await getPool()).close(); } catch (_) { /* sin conexión */ }
}

module.exports = { prepararApi, cerrarBd, UUID_MAYUS, SELLO, FH_MH, numeroControlRe };
