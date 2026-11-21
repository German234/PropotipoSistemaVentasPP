/**
 * Fase 3 · seguridad: CORS por lista, cabeceras HTTP, sesión en cookie HttpOnly + CSRF, límite de intentos de login,
 * errores 500 sin detalles internos y credenciales de demostración solo en el entorno local.
 */
const { prepararApi, cerrarBd } = require('../helpers/api');
const { limiteIntentosLogin } = require('../../src/middleware/limiteLogin');
const productosService = require('../../src/services/productosService');
const db = require('../../src/config/db');

let t;
const env = { ...process.env };
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);
afterEach(() => {
  process.env = { ...env };
  limiteIntentosLogin._reiniciar();
  jest.restoreAllMocks();
});

const login = (usuario, password, ip) => {
  const r = t.request(t.app).post('/api/auth/login').send({ usuario, password });
  return ip ? r.set('X-Forwarded-For', ip) : r;
};
/** set-cookie → { nombre: { valor, atributos } } */
function cookies(res) {
  const out = {};
  for (const c of res.headers['set-cookie'] || []) {
    const [par, ...attrs] = c.split(';').map((s) => s.trim());
    const i = par.indexOf('=');
    out[par.slice(0, i)] = { valor: decodeURIComponent(par.slice(i + 1)), attrs: attrs.map((a) => a.toLowerCase()) };
  }
  return out;
}

describe('CORS con orígenes permitidos', () => {
  test('origen local por defecto → Access-Control-Allow-Origin y credenciales', async () => {
    delete process.env.CORS_ORIGENES; process.env.PORT = '3000';
    const r = await t.request(t.app).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(r.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(r.headers['access-control-allow-credentials']).toBe('true');
  });

  test('origen no permitido → sin cabeceras CORS (el navegador bloquea la respuesta)', async () => {
    const r = await t.request(t.app).get('/api/health').set('Origin', 'https://atacante.example');
    expect(r.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('preflight de un origen configurado en CORS_ORIGENES permite X-CSRF-Token', async () => {
    process.env.CORS_ORIGENES = 'https://pos.ejemplo.com';
    const r = await t.request(t.app).options('/api/productos')
      .set('Origin', 'https://pos.ejemplo.com').set('Access-Control-Request-Method', 'POST');
    expect(r.status).toBe(204);
    expect(r.headers['access-control-allow-origin']).toBe('https://pos.ejemplo.com');
    expect(r.headers['access-control-allow-headers']).toMatch(/X-CSRF-Token/);
  });

  test('peticiones sin Origin (mismo origen, curl) siguen funcionando', async () => {
    expect((await t.request(t.app).get('/api/health')).status).toBe(200);
  });
});

describe('Cabeceras HTTP de seguridad', () => {
  test('la página y la API llevan CSP, nosniff, anti-framing y referrer; sin X-Powered-By', async () => {
    for (const ruta of ['/', '/api/health']) {
      const r = await t.request(t.app).get(ruta);
      expect(r.headers['content-security-policy']).toMatch(/default-src 'self'/);
      expect(r.headers['content-security-policy']).toMatch(/script-src 'self';/);
      expect(r.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
      expect(r.headers['x-content-type-options']).toBe('nosniff');
      expect(r.headers['x-frame-options']).toBe('DENY');
      expect(r.headers['referrer-policy']).toBe('no-referrer');
      expect(r.headers['x-powered-by']).toBeUndefined();
    }
  });

  test('la API responde Cache-Control: no-store', async () => {
    expect((await t.admin('get', '/api/productos')).headers['cache-control']).toBe('no-store');
  });
});

describe('Sesión del navegador: cookie HttpOnly + CSRF', () => {
  let c;
  beforeAll(async () => { c = cookies(await login('vendedor', 'vendedor123')); });
  const conCookie = (metodo, url) => t.request(t.app)[metodo](url).set('Cookie', `pos_token=${c.pos_token.valor}; pos_csrf=${c.pos_csrf.valor}`);

  test('login pone pos_token HttpOnly + SameSite=Strict y pos_csrf legible', () => {
    expect(c.pos_token.attrs).toEqual(expect.arrayContaining(['httponly', 'samesite=strict', 'path=/']));
    expect(c.pos_csrf.attrs).toEqual(expect.arrayContaining(['samesite=strict']));
    expect(c.pos_csrf.attrs).not.toContain('httponly');
    expect(c.pos_token.attrs).not.toContain('secure'); // HTTP local; con COOKIE_SECURE=1 se agrega
  });

  test('COOKIE_SECURE=1 → cookies con atributo Secure', async () => {
    process.env.COOKIE_SECURE = '1';
    const s = cookies(await login('vendedor', 'vendedor123'));
    expect(s.pos_token.attrs).toContain('secure');
  });

  test('GET /api/auth/sesion con la cookie devuelve el usuario; sin cookie → 401', async () => {
    const r = await conCookie('get', '/api/auth/sesion');
    expect(r.body).toEqual({ ok: true, data: { usuario: { id: expect.any(Number), nombre: 'Vendedor de Turno', rol: 'VENDEDOR' } } });
    expect((await t.request(t.app).get('/api/auth/sesion')).status).toBe(401);
  });

  test('cookie + POST sin X-CSRF-Token → 403 CSRF_INVALIDO y no crea nada', async () => {
    const r = await conCookie('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'CSRF QA' });
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ ok: false, error: { codigo: 'CSRF_INVALIDO' } });
    const l = await t.admin('get', '/api/clientes').query({ q: 'CSRF QA' });
    expect(l.body.data).toHaveLength(0);
  });

  test('cookie + POST con un X-CSRF-Token ajeno → 403', async () => {
    const r = await conCookie('post', '/api/clientes').set('X-CSRF-Token', 'otro').send({ tipo: 'CONSUMIDOR', nombre: 'CSRF QA' });
    expect(r.status).toBe(403);
  });

  test('cookie + POST con el X-CSRF-Token correcto → 201', async () => {
    const r = await conCookie('post', '/api/clientes').set('X-CSRF-Token', c.pos_csrf.valor).send({ tipo: 'CONSUMIDOR', nombre: 'CSRF OK QA' });
    expect(r.status).toBe(201);
  });

  test('Bearer sigue funcionando sin CSRF (clientes de API y pruebas)', async () => {
    expect((await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Bearer QA' })).status).toBe(201);
  });

  test('POST /api/auth/logout borra ambas cookies', async () => {
    const r = await conCookie('post', '/api/auth/logout');
    expect(r.status).toBe(200);
    const b = cookies(r);
    expect(b.pos_token.valor).toBe('');
    expect(b.pos_csrf.valor).toBe('');
    expect(b.pos_token.attrs.some((a) => a.startsWith('expires=thu, 01 jan 1970'))).toBe(true);
  });
});

describe('Límite de intentos de inicio de sesión', () => {
  beforeEach(() => { process.env.TRUST_PROXY = ''; });

  test('5 fallos → el 6.º intento responde 429 DEMASIADOS_INTENTOS con Retry-After, aunque la clave sea correcta', async () => {
    for (let i = 0; i < 5; i++) expect((await login('admin', 'mala')).status).toBe(401);
    const r = await login('admin', 'admin123');
    expect(r.status).toBe(429);
    expect(r.body).toEqual({ ok: false, error: { codigo: 'DEMASIADOS_INTENTOS', mensaje: expect.stringMatching(/Intente de nuevo/) } });
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(800);
    expect(r.headers['set-cookie']).toBeUndefined();
  });

  test('el bloqueo es por usuario: otro usuario desde la misma IP puede entrar', async () => {
    for (let i = 0; i < 5; i++) await login('admin', 'mala');
    expect((await login('vendedor', 'vendedor123')).status).toBe(200);
  });

  test('un login correcto reinicia el contador del usuario', async () => {
    for (let i = 0; i < 4; i++) await login('admin', 'mala');
    expect((await login('admin', 'admin123')).status).toBe(200);
    for (let i = 0; i < 4; i++) expect((await login('admin', 'mala')).status).toBe(401);
    expect((await login('admin', 'admin123')).status).toBe(200);
  });

  test('límite por IP: probar muchos usuarios distintos desde la misma IP también se bloquea', async () => {
    process.env.LOGIN_MAX_INTENTOS_IP = '6';
    for (let i = 0; i < 6; i++) expect((await login(`usuario${i}`, 'x')).status).toBe(401);
    expect((await login('vendedor', 'vendedor123')).status).toBe(429);
  });

  test('la validación (400) no cuenta como intento fallido', async () => {
    for (let i = 0; i < 6; i++) expect((await t.request(t.app).post('/api/auth/login').send({ usuario: 'admin' })).status).toBe(400);
    expect((await login('admin', 'admin123')).status).toBe(200);
  });

  test('LOGIN_MAX_INTENTOS configurable', async () => {
    process.env.LOGIN_MAX_INTENTOS = '2';
    await login('admin', 'mala'); await login('admin', 'mala');
    expect((await login('admin', 'admin123')).status).toBe(429);
  });
});

describe('Errores sin detalles internos', () => {
  test('excepción no controlada (p. ej. SQL) → 500 genérico, sin el mensaje original', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(productosService, 'listar').mockRejectedValue(new Error("Login failed for user 'sa' (SQL Server 10.0.0.5)"));
    const r = await t.admin('get', '/api/productos');
    expect(r.status).toBe(500);
    expect(r.body.error).toEqual({ codigo: 'ERROR_INTERNO', mensaje: expect.stringMatching(/^Error interno del servidor \(referencia [0-9A-F]{8}\)$/) });
    expect(JSON.stringify(r.body)).not.toMatch(/sa'|SQL|10\.0\.0\.5/);
  });

  test('health con la BD caída → 503 DB_NO_DISPONIBLE sin el error del driver', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(db, 'query').mockRejectedValueOnce(new Error('Failed to connect to localhost:1433 - password=xyz'));
    const r = await t.request(t.app).get('/api/health');
    expect(r.status).toBe(503);
    expect(r.body.error).toEqual({ codigo: 'DB_NO_DISPONIBLE', mensaje: 'No se pudo conectar a la base de datos' });
  });

  test('cuerpo de más de 1 MB → 413 con formato estándar', async () => {
    const r = await t.admin('post', '/api/clientes').send({ nombre: 'x'.repeat(1100000) });
    expect(r.status).toBe(413);
    expect(r.body.ok).toBe(false);
  });
});

describe('Credenciales de demostración', () => {
  test('entorno local (localhost, no producción) → /api/health las devuelve y se sirven los mocks', async () => {
    delete process.env.DEMO_CREDENCIALES;
    const r = await t.request(t.app).get('/api/health');
    expect(r.body.data.demo.credenciales.map((x) => x.usuario)).toEqual(['admin', 'vendedor']);
    expect((await t.request(t.app).get('/js/mocks.js')).text).toMatch(/admin123/);
  });

  test.each([
    ['DEMO_CREDENCIALES=0', { DEMO_CREDENCIALES: '0' }, '127.0.0.1'],
    ['NODE_ENV=production', { NODE_ENV: 'production' }, 'localhost'],
    ['dominio distinto de localhost', {}, 'pos.ejemplo.com'],
  ])('%s → demo null, mocks vacíos y la página no trae credenciales', async (_, vars, host) => {
    delete process.env.DEMO_CREDENCIALES;
    Object.assign(process.env, vars);
    const h = await t.request(t.app).get('/api/health').set('Host', host);
    expect(h.body.data.demo).toBeNull();
    const m = await t.request(t.app).get('/js/mocks.js').set('Host', host);
    expect(m.text).not.toMatch(/admin123/);
    const p = await t.request(t.app).get('/').set('Host', host);
    expect(p.text).not.toMatch(/admin123|vendedor123/);
  });
});
