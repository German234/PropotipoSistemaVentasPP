/**
 * Matriz de autorización (Fase 4): cada ruta protegida × {sin token, token manipulado, VENDEDOR, ADMIN}.
 * - Todas las rutas salvo health/login/logout → 401 sin token.
 * - Las rutas de solo ADMIN → 403 SIN_PERMISO para VENDEDOR, sin efectos, por Bearer y por cookie (+CSRF).
 * - Las demás rutas no deben responder 403 a ningún rol autenticado.
 */
const jwt = require('jsonwebtoken');
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
let dteId;
let clienteId; // cliente propio: la prueba no modifica los clientes del seed
let usuarioId; // usuario propio (Fase 6): la prueba no modifica los usuarios del seed
let borradorId;
beforeAll(async () => {
  t = await prepararApi();
  dteId = (await t.emitir('01', { items: [{ productoId: t.prod.P001.id, cantidad: 1 }] })).body.data.id;
  clienteId = (await t.admin('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Autz Cliente QA' })).body.data.id;
  usuarioId = (await t.admin('post', '/api/usuarios').send({ usuario: 'autz.qa', nombre: 'Autz QA', rol: 'VENDEDOR', password: 'autzqa1234' })).body.data.id;
  borradorId = (await t.vendedor('post', '/api/borradores').send({ tipoDte: '01', items: [{ productoId: t.prod.P001.id, cantidad: 1 }] })).body.data.id;
});
afterAll(cerrarBd);

const ID = () => dteId;
/** [método, ruta, cuerpo] — ruta puede ser función (necesita el id creado en beforeAll). */
const SOLO_ADMIN = [
  ['post', '/api/productos', { codigo: 'AUTZ1', descripcion: 'x', precio: 1, stock: 1 }],
  ['put', () => `/api/productos/${t.prod.P001.id}`, { precio: 0.01 }],
  ['post', () => `/api/dte/${ID()}/invalidar`, { tipoAnulacion: 2, motivo: 'Prueba de autorización' }],
  ['post', '/api/contingencia', { motivo: 'Prueba de autorización' }],
  ['put', '/api/contingencia/programacion', { activo: false, hora: '01:00' }],
  ['put', '/api/contingencia/consultas', { activo: false, intervaloSeg: 999 }],
  ['get', '/api/usuarios'],
  ['get', () => `/api/usuarios/${usuarioId}`],
  ['post', '/api/usuarios', { usuario: 'autz.nuevo', nombre: 'Autz Nuevo', rol: 'VENDEDOR', password: 'autznuevo1' }],
  ['put', () => `/api/usuarios/${usuarioId}`, { nombre: 'Autz QA editado' }],
  ['get', '/api/reportes/resumen'],
  ['get', '/api/bitacora'], // KAN-36: la bitácora de auditoría solo la lee ADMIN
];
const CUALQUIER_ROL = [
  ['get', '/api/auth/sesion'],
  ['get', '/api/productos'],
  ['get', () => `/api/productos/${t.prod.P001.id}`],
  ['get', '/api/clientes'],
  ['get', () => `/api/clientes/${clienteId}`],
  ['post', '/api/clientes', { tipo: 'CONSUMIDOR', nombre: 'Autz QA' }],
  ['put', () => `/api/clientes/${clienteId}`, { telefono: '7777-8888' }],
  ['get', '/api/emisor'],
  ['get', '/api/catalogos'],
  ['get', '/api/dte'],
  ['post', '/api/dte/01', { items: [{ productoId: 1, cantidad: 1 }] }],
  ['post', '/api/dte/03', { items: [] }],
  ['post', '/api/dte/05', { items: [] }],
  ['get', () => `/api/dte/${ID()}`],
  ['get', () => `/api/dte/${ID()}/pdf`],
  ['post', () => `/api/dte/${ID()}/reintentar`],
  ['post', () => `/api/dte/${ID()}/consultar`],
  ['get', '/api/contingencia'],
  ['get', '/api/contingencia/programacion'],
  ['get', '/api/contingencia/consultas'],
  ['get', '/api/contingencia/ejecuciones'],
  ['get', '/api/contingencia/999999'],
  ['get', '/api/borradores'],
  ['post', '/api/borradores', { tipoDte: '01', items: [{ productoId: 1, cantidad: 1 }] }],
  ['get', () => `/api/borradores/${borradorId}`],
  ['put', () => `/api/borradores/${borradorId}`, { tipoDte: '01', items: [{ productoId: 1, cantidad: 2 }] }],
  ['delete', () => `/api/borradores/${borradorId}`],
  ['post', () => `/api/dte/${ID()}/correo`, { correo: 'autz@correo.com' }],
];
const ruta = (r) => (typeof r === 'function' ? r() : r);
const nombre = ([m, r]) => `${m.toUpperCase()} ${typeof r === 'function' ? r.toString().match(/`(.+)`/)[1] : r}`;

describe('Sin sesión → 401 en todas las rutas protegidas', () => {
  test.each([...SOLO_ADMIN, ...CUALQUIER_ROL].map((x) => [nombre(x), x]))('%s', async (_, [m, r, body]) => {
    const res = await t.request(t.app)[m](ruta(r)).send(body);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: { codigo: 'NO_AUTENTICADO' } });
  });

  test('las únicas rutas públicas son health, login y logout', async () => {
    expect((await t.request(t.app).get('/api/health')).status).toBe(200);
    expect((await t.request(t.app).post('/api/auth/logout')).status).toBe(200);
    expect((await t.request(t.app).post('/api/auth/login').send({})).status).toBe(400);
  });
});

describe('Token manipulado → 401', () => {
  test('VENDEDOR que cambia su rol a ADMIN en el payload (firma inválida) no pasa', async () => {
    const [h, p, s] = t.tokenVendedor.split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
    const falso = [h, Buffer.from(JSON.stringify({ ...payload, rol: 'ADMIN' })).toString('base64url'), s].join('.');
    const r = await t.request(t.app).post('/api/productos').set('Authorization', `Bearer ${falso}`).send(SOLO_ADMIN[0][2]);
    expect(r.status).toBe(401);
  });

  test('token sin firma (alg none) con rol ADMIN → 401', async () => {
    const none = jwt.sign({ id: 1, usuario: 'admin', nombre: 'x', rol: 'ADMIN' }, null, { algorithm: 'none' });
    expect((await t.request(t.app).get('/api/bitacora').set('Authorization', `Bearer ${none}`)).status).toBe(401);
  });

  test('token firmado con otro secreto → 401', async () => {
    const otro = jwt.sign({ id: 1, usuario: 'admin', nombre: 'x', rol: 'ADMIN' }, 'otro-secreto');
    expect((await t.request(t.app).get('/api/dte').set('Authorization', `Bearer ${otro}`)).status).toBe(401);
  });

  test('el rol enviado en el cuerpo se ignora: solo cuenta el del token', async () => {
    const r = await t.vendedor('post', '/api/productos').send({ ...SOLO_ADMIN[0][2], rol: 'ADMIN' });
    expect(r.status).toBe(403);
  });
});

describe('VENDEDOR en rutas de solo ADMIN → 403 SIN_PERMISO sin efectos', () => {
  /** Estado observable que ninguna de estas rutas debe cambiar si responde 403. */
  async function estado() {
    const g = async (u) => (await t.admin('get', u)).body.data;
    return {
      productos: await g('/api/productos?incluirInactivos=1'),
      dte: (await g(`/api/dte/${ID()}`)).estado,
      contingencia: (await g('/api/contingencia')).length,
      programacion: (({ activo, hora }) => ({ activo, hora }))(await g('/api/contingencia/programacion')),
      consultas: (({ activo, intervaloSeg }) => ({ activo, intervaloSeg }))(await g('/api/contingencia/consultas')),
      bitacora: (await g('/api/bitacora?limite=1000')).length,
      usuarios: await g('/api/usuarios?incluirInactivos=1'),
    };
  }
  let antes;
  let ultimaBitacora; // solo cuenta lo registrado después de la foto (el beforeAll del archivo crea un borrador como VENDEDOR)
  beforeAll(async () => {
    antes = await estado();
    ultimaBitacora = Math.max(0, ...(await t.admin('get', '/api/bitacora?limite=1000')).body.data.map((x) => x.id));
  });

  test.each(SOLO_ADMIN.map((x) => [nombre(x), x]))('Bearer · %s', async (_, [m, r, body]) => {
    const res = await t.vendedor(m, ruta(r)).send(body);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, error: { codigo: 'SIN_PERMISO', mensaje: expect.stringMatching(/ADMIN/) } });
  });

  test.each(SOLO_ADMIN.map((x) => [nombre(x), x]))('cookie + CSRF válido · %s', async (_, [m, r, body]) => {
    const login = await t.request(t.app).post('/api/auth/login').send({ usuario: 'vendedor', password: 'vendedor123' });
    const ck = Object.fromEntries(login.headers['set-cookie'].map((c) => c.split(';')[0].split('=')));
    const res = await t.request(t.app)[m](ruta(r))
      .set('Cookie', `pos_token=${ck.pos_token}; pos_csrf=${ck.pos_csrf}`).set('X-CSRF-Token', ck.pos_csrf).send(body);
    expect(res.status).toBe(403);
    expect(res.body.error.codigo).toBe('SIN_PERMISO');
  });

  test('ningún intento denegado cambió productos, DTE, contingencia, configuración ni bitácora', async () => {
    const despues = await estado();
    // los logins por cookie sí escriben LOGIN en la bitácora: se descuentan
    const logins = (await t.admin('get', '/api/bitacora').query({ accion: 'LOGIN', limite: 1000 })).body.data.length;
    expect({ ...despues, bitacora: undefined }).toEqual({ ...antes, bitacora: undefined });
    expect(despues.bitacora - antes.bitacora).toBeLessThanOrEqual(logins);
    const noLogin = (await t.admin('get', '/api/bitacora?limite=1000')).body.data.filter((b) => b.accion !== 'LOGIN' && b.id > ultimaBitacora);
    expect(noLogin.some((b) => b.usuario === 'vendedor' && b.accion !== 'LOGIN_FALLIDO')).toBe(false);
  });
});

describe('Rutas de cualquier rol: ningún usuario autenticado recibe 403', () => {
  test.each(CUALQUIER_ROL.map((x) => [nombre(x), x]))('VENDEDOR · %s', async (_, [m, r, body]) => {
    const res = await t.vendedor(m, ruta(r)).send(body);
    expect([401, 403]).not.toContain(res.status);
  });
});

describe('ADMIN en rutas de solo ADMIN: autorizado (la operación se ejecuta)', () => {
  test.each(SOLO_ADMIN.map((x) => [nombre(x), x]))('%s', async (_, [m, r, body]) => {
    const res = await t.admin(m, ruta(r)).send(body);
    expect([401, 403]).not.toContain(res.status);
    // contingencia sin DTE pendientes responde 409 (regla de negocio, no de permisos); el resto 2xx
    expect(res.status === 409 ? res.body.error.codigo : 'OK').not.toBe('SIN_PERMISO');
  });
});
