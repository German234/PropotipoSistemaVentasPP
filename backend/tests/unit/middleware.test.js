/** Middlewares: autenticación JWT, roles y formato estándar de errores. */
const jwt = require('jsonwebtoken');
const { auth, requireRol } = require('../../src/middleware/auth');
const { noEncontrado, manejadorErrores } = require('../../src/middleware/errores');
const { AppError } = require('../../src/utils/respuesta');

const resFalso = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('middleware/auth', () => {
  const usuario = { id: 1, usuario: 'admin', nombre: 'Administrador', rol: 'ADMIN' };

  test('token válido deja req.usuario', () => {
    const token = jwt.sign(usuario, process.env.JWT_SECRET);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const next = jest.fn();
    auth(req, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.usuario).toEqual(usuario);
  });

  test.each([
    ['sin header', undefined],
    ['esquema distinto de Bearer', 'Basic abc'],
    ['token con otra firma', `Bearer ${jwt.sign(usuario, 'otro-secreto')}`],
    ['token vencido', `Bearer ${jwt.sign({ ...usuario, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET)}`],
  ])('%s → 401 NO_AUTENTICADO', (_, authorization) => {
    const next = jest.fn();
    auth({ headers: { authorization } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ codigo: 'NO_AUTENTICADO', status: 401 });
  });

  test('requireRol permite el rol indicado y bloquea otro con 403 SIN_PERMISO', () => {
    const next = jest.fn();
    requireRol('ADMIN')({ usuario }, {}, next);
    expect(next).toHaveBeenCalledWith();

    const next2 = jest.fn();
    requireRol('ADMIN')({ usuario: { ...usuario, rol: 'VENDEDOR' } }, {}, next2);
    expect(next2.mock.calls[0][0]).toMatchObject({ codigo: 'SIN_PERMISO', status: 403 });
  });
});

describe('middleware/errores', () => {
  test('noEncontrado → 404 NO_ENCONTRADO', () => {
    const next = jest.fn();
    noEncontrado({ method: 'GET', originalUrl: '/api/x' }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ codigo: 'NO_ENCONTRADO', status: 404 });
  });

  test('AppError → { ok:false, error:{codigo,mensaje} } con su status', () => {
    const res = resFalso();
    manejadorErrores(new AppError('STOCK_INSUFICIENTE', 'sin stock', 409), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: { codigo: 'STOCK_INSUFICIENTE', mensaje: 'sin stock' } });
  });

  test('JSON mal formado → 400 VALIDACION', () => {
    const res = resFalso();
    manejadorErrores({ type: 'entity.parse.failed' }, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.codigo).toBe('VALIDACION');
  });

  test('error no controlado → 500 ERROR_INTERNO con mensaje genérico (sin detalles internos) y referencia en el log', () => {
    const res = resFalso();
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const err = new Error("Invalid object name 'dbo.usuarios' — password=secreto");
    manejadorErrores(err, { method: 'GET', originalUrl: '/api/x' }, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: expect.stringMatching(/^Error interno del servidor \(referencia [0-9A-F]{8}\)$/) } });
    expect(JSON.stringify(body)).not.toMatch(/dbo|secreto|Invalid/);
    const ref = body.error.mensaje.match(/[0-9A-F]{8}/)[0];
    expect(log.mock.calls[0][0]).toContain(ref);   // el detalle queda solo en el log, con la misma referencia
    expect(log.mock.calls[0][1]).toBe(err);
    log.mockRestore();
  });

  test('cuerpo demasiado grande → 413 VALIDACION; otros 4xx del parser → status propio sin detalles', () => {
    const res = resFalso();
    manejadorErrores({ type: 'entity.too.large', status: 413, expose: true }, {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(413);
    const res2 = resFalso();
    manejadorErrores({ type: 'charset.unsupported', status: 415, expose: true, message: 'detalle interno' }, {}, res2, jest.fn());
    expect(res2.status).toHaveBeenCalledWith(415);
    expect(res2.json).toHaveBeenCalledWith({ ok: false, error: { codigo: 'VALIDACION', mensaje: 'Petición inválida' } });
  });
});

describe('middleware/auth · cookie de sesión y CSRF', () => {
  const usuario = { id: 1, usuario: 'admin', nombre: 'Administrador', rol: 'ADMIN' };
  const token = jwt.sign({ ...usuario, csrf: 'csrf-abc' }, process.env.JWT_SECRET);
  const req = (method, extra = {}) => ({ method, headers: { cookie: `otra=1; pos_token=${token}`, ...extra } });

  test('cookie válida en GET → autenticado sin CSRF', () => {
    const r = req('GET'); const next = jest.fn();
    auth(r, {}, next);
    expect(next).toHaveBeenCalledWith();
    expect(r.usuario).toEqual(usuario);
  });

  test.each([
    ['POST sin X-CSRF-Token', 'POST', {}],
    ['PUT con X-CSRF-Token distinto', 'PUT', { 'x-csrf-token': 'csrf-xyz' }],
  ])('cookie + %s → 403 CSRF_INVALIDO', (_, method, extra) => {
    const next = jest.fn();
    auth(req(method, extra), {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ codigo: 'CSRF_INVALIDO', status: 403 });
  });

  test('cookie + POST con X-CSRF-Token correcto → autenticado', () => {
    const next = jest.fn();
    auth(req('POST', { 'x-csrf-token': 'csrf-abc' }), {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('Bearer no necesita CSRF; un Bearer inválido no cae a la cookie', () => {
    const next = jest.fn();
    auth({ method: 'POST', headers: { authorization: `Bearer ${token}` } }, {}, next);
    expect(next).toHaveBeenCalledWith();
    const next2 = jest.fn();
    auth(req('GET', { authorization: 'Bearer basura' }), {}, next2);
    expect(next2.mock.calls[0][0]).toMatchObject({ codigo: 'NO_AUTENTICADO' });
  });

  test('token firmado con otro algoritmo (none) → 401', () => {
    const sinFirma = jwt.sign(usuario, null, { algorithm: 'none' });
    const next = jest.fn();
    auth({ method: 'GET', headers: { authorization: `Bearer ${sinFirma}` } }, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ codigo: 'NO_AUTENTICADO', status: 401 });
  });
});

describe('config/seguridad', () => {
  const seg = require('../../src/config/seguridad');
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  test('CORS por defecto: solo el servidor local; CORS_ORIGENES lo reemplaza', () => {
    delete process.env.CORS_ORIGENES; process.env.PORT = '3000';
    expect(seg.origenesPermitidos()).toEqual(['http://localhost:3000', 'http://127.0.0.1:3000']);
    process.env.CORS_ORIGENES = 'https://pos.ejemplo.com/ , http://localhost:5173';
    expect(seg.origenesPermitidos()).toEqual(['https://pos.ejemplo.com', 'http://localhost:5173']);
  });

  test('credenciales demo: explícitas con DEMO_CREDENCIALES; por defecto solo localhost fuera de producción', () => {
    delete process.env.DEMO_CREDENCIALES; process.env.NODE_ENV = 'test';
    expect(seg.mostrarCredencialesDemo({ hostname: 'localhost' })).toBe(true);
    expect(seg.mostrarCredencialesDemo({ hostname: 'pos.ejemplo.com' })).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(seg.mostrarCredencialesDemo({ hostname: 'localhost' })).toBe(false);
    process.env.DEMO_CREDENCIALES = '1';
    expect(seg.mostrarCredencialesDemo({ hostname: 'pos.ejemplo.com' })).toBe(true);
    process.env.DEMO_CREDENCIALES = '0'; process.env.NODE_ENV = 'test';
    expect(seg.mostrarCredencialesDemo({ hostname: 'localhost' })).toBe(false);
  });

  test('JWT_SECRET débil: vacío, corto o el de ejemplo', () => {
    expect(seg.jwtSecretDebil('')).toBe(true);
    expect(seg.jwtSecretDebil('corto')).toBe(true);
    expect(seg.jwtSecretDebil('cambiar-por-un-secreto-largo-cambiar-por-uno')).toBe(true);
    expect(seg.jwtSecretDebil('k3J9xQ2mV8pL5tR7wY1zA4bC6dE0fG2hI9')).toBe(false);
  });
});
