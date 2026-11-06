/** Health, login JWT, protección de rutas y roles. */
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

describe('GET /api/health', () => {
  test('sin token responde api/db ok y ambiente 00', async () => {
    const r = await t.request(t.app).get('/api/health');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, data: { api: 'ok', db: 'ok', ambiente: '00' } });
  });
});

describe('POST /api/auth/login', () => {
  test('credenciales correctas → token JWT y usuario con rol', async () => {
    const r = await t.request(t.app).post('/api/auth/login').send({ usuario: 'admin', password: 'admin123' });
    expect(r.status).toBe(200);
    expect(r.body.data.token.split('.')).toHaveLength(3);
    expect(r.body.data.usuario).toEqual({ id: expect.any(Number), nombre: 'Administrador', rol: 'ADMIN' });
  });

  test('contraseña incorrecta → 401 CREDENCIALES y bitácora LOGIN_FALLIDO', async () => {
    const r = await t.request(t.app).post('/api/auth/login').send({ usuario: 'admin', password: 'mala' });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ ok: false, error: { codigo: 'CREDENCIALES', mensaje: expect.any(String) } });
    const b = await t.bitacora({ accion: 'LOGIN_FALLIDO' });
    expect(b.length).toBeGreaterThan(0);
  });

  test('faltan campos → 400 VALIDACION', async () => {
    const r = await t.request(t.app).post('/api/auth/login').send({ usuario: 'admin' });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('JSON mal formado → 400 VALIDACION', async () => {
    const r = await t.request(t.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"usuario":');
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });
});

describe('Rutas protegidas', () => {
  test.each(['/api/productos', '/api/clientes', '/api/emisor', '/api/dte', '/api/bitacora'])(
    'GET %s sin token → 401 NO_AUTENTICADO', async (ruta) => {
      const r = await t.request(t.app).get(ruta);
      expect(r.status).toBe(401);
      expect(r.body.error.codigo).toBe('NO_AUTENTICADO');
    }
  );

  test('token inválido → 401', async () => {
    const r = await t.request(t.app).get('/api/dte').set('Authorization', 'Bearer abc.def.ghi');
    expect(r.status).toBe(401);
  });

  test('ruta /api inexistente → 404 NO_ENCONTRADO con formato estándar', async () => {
    const r = await t.admin('get', '/api/no-existe');
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ ok: false, error: { codigo: 'NO_ENCONTRADO' } });
  });
});
