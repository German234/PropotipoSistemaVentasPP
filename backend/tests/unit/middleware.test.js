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

  test('error no controlado → 500 ERROR_INTERNO', () => {
    const res = resFalso();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    manejadorErrores(new Error('boom'), {}, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'boom' } });
    console.error.mockRestore();
  });
});
