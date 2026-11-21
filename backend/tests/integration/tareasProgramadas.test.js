/**
 * Fase 5 · tareas programadas de contingencia con configuración persistente.
 *
 * - Reinicio REAL: se levanta `node src/server.js` como proceso hijo (BD de pruebas), se cambia la configuración por la
 *   API, se mata el proceso y se arranca otro con el MISMO .env: debe recuperar lo guardado, no lo del .env.
 * - Temporizador REAL: en un servidor hijo, la cola de consultas (intervalo 10 s) dispara sola y sigue un DTE emitido con
 *   X-Simular: timeout hasta dejarlo PROCESADO con el sello de MH (simulado).
 * - Temporizador del lote: se captura el callback que el servicio programa (reloj inyectado) y se dispara ese callback;
 *   así se prueba lo que hace el temporizador (releer config, ejecutar, marcar el día, reprogramar), no ejecutar().
 * - Sin duplicados: candado en BD entre dos instancias aisladas del servicio (dos "procesos") y dentro de un proceso.
 * - Errores: quedan en dbo.ejecucion_tarea con el detalle, y la API solo muestra un mensaje genérico.
 * Hacienda sigue siendo simulada en todos los casos.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const { prepararApi, cerrarBd } = require('../helpers/api');
const { reiniciarBd } = require('../helpers/testDb');
const { query } = require('../../src/config/db');
const loteAutomatico = require('../../src/services/loteAutomaticoService');
const consultaMh = require('../../src/services/consultaMhService');
const tareas = require('../../src/services/tareasProgramadas');
const contingenciaService = require('../../src/services/contingenciaService');

let t;
const hijos = new Set();
beforeAll(async () => { t = await prepararApi(); });
afterAll(async () => {
  loteAutomatico.detener();
  consultaMh.detener();
  for (const h of hijos) h.proc.kill();
  await cerrarBd();
});

const linea = (codigo, cantidad = 1) => ({ productoId: t.prod[codigo].id, cantidad });
const ejecuciones = async (tarea) =>
  (await query(`SELECT * FROM dbo.ejecucion_tarea WHERE tarea = @tarea ORDER BY id`, { tarea })).recordset;
const config = async (tarea) => (await query(`SELECT * FROM dbo.config_tarea WHERE tarea = @tarea`, { tarea })).recordset[0];

/* ---------- servidor hijo ---------- */
const puertoLibre = () => new Promise((res) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => res(port)); });
});
/** .env de los hijos: igual en cada arranque, para demostrar que manda lo guardado en la BD. */
const ENV_HIJO = {
  CONTINGENCIA_LOTE_ACTIVO: '1', CONTINGENCIA_LOTE_HORA: '04:44', CONSULTA_MH_ACTIVO: '1', CONSULTA_MH_INTERVALO_SEG: '60',
};
async function arrancar(extra = {}) {
  const port = await puertoLibre();
  const proc = spawn(process.execPath, ['src/server.js'], {
    cwd: path.join(__dirname, '..', '..'),
    env: { ...process.env, ...ENV_HIJO, ...extra, PORT: String(port), NODE_ENV: 'test' }, // DB_NAME = BD de pruebas (setupEnv)
  });
  const h = { proc, url: `http://localhost:${port}`, salida: '' };
  hijos.add(h);
  proc.stdout.on('data', (d) => { h.salida += d; });
  proc.stderr.on('data', (d) => { h.salida += d; });
  await new Promise((res, rej) => {
    const fin = Date.now() + 20000;
    (function esperar() {
      if (/Cola de consultas a MH:/.test(h.salida)) return res();
      if (proc.exitCode !== null) return rej(new Error(`el servidor terminó:\n${h.salida}`));
      if (Date.now() > fin) return rej(new Error(`el servidor no arrancó:\n${h.salida}`));
      setTimeout(esperar, 100);
    }());
  });
  const login = await (await fetch(`${h.url}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'admin', password: 'admin123' }),
  })).json();
  h.api = async (metodo, ruta, body, cabeceras = {}) => {
    const r = await fetch(h.url + ruta, {
      method: metodo,
      headers: { Authorization: `Bearer ${login.data.token}`, 'Content-Type': 'application/json', ...cabeceras },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  return h;
}
async function matar(h) {
  if (h.proc.exitCode === null) {
    const salio = new Promise((res) => h.proc.once('exit', res));
    h.proc.kill();
    await salio;
  }
  hijos.delete(h);
}
async function esperarHasta(fn, ms, cada = 500) {
  const fin = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fin) return v;
    await new Promise((r) => setTimeout(r, cada));
  }
}

describe('Persistencia de la configuración tras un reinicio real del servidor', () => {
  test('la primera vez usa el .env; lo que se guarda por la API sobrevive al reinicio aunque el .env diga otra cosa', async () => {
    await reiniciarBd(); // sin filas en config_tarea
    const a = await arrancar();
    expect((await a.api('GET', '/api/contingencia/programacion')).body.data).toMatchObject({ activo: true, hora: '04:44' });
    expect((await a.api('GET', '/api/contingencia/consultas')).body.data).toMatchObject({ activo: true, intervaloSeg: 60 });

    expect((await a.api('PUT', '/api/contingencia/programacion', { hora: '06:15', activo: false })).status).toBe(200);
    expect((await a.api('PUT', '/api/contingencia/consultas', { intervaloSeg: 45, activo: false })).status).toBe(200);
    await matar(a);

    const b = await arrancar(); // mismo .env (04:44, 60 s, activos)
    expect(b.salida).toMatch(/Lote automático de contingencia: desactivado \(configuración guardada\)/);
    expect(b.salida).toMatch(/Cola de consultas a MH: desactivada \(configuración guardada\)/);
    const p = (await b.api('GET', '/api/contingencia/programacion')).body.data;
    expect(p).toMatchObject({ activo: false, hora: '06:15', proximaEjecucion: null });
    expect((await b.api('GET', '/api/contingencia/consultas')).body.data).toMatchObject({ activo: false, intervaloSeg: 45, proximaConsulta: null });

    // reactivar en el servidor nuevo: vuelve a programar con la hora guardada
    const r = (await b.api('PUT', '/api/contingencia/programacion', { activo: true })).body.data;
    expect(r).toMatchObject({ activo: true, hora: '06:15' });
    expect(r.proximaEjecucion).toMatch(/T06:15:00$/);
    const c = (await b.api('PUT', '/api/contingencia/consultas', { activo: true })).body.data;
    expect(c).toMatchObject({ activo: true, intervaloSeg: 45, proximaConsulta: expect.any(String) }); // el temporizador corre en b
    await matar(b);

    const fila = await config('LOTE_CONTINGENCIA');
    expect(fila).toMatchObject({ activo: true, hora: '06:15', en_curso_desde: null });
    expect(fila.actualizado_por).toBe((await query(`SELECT id FROM dbo.usuarios WHERE usuario = 'admin'`)).recordset[0].id);
  }, 60000);

  test('la última ejecución también se recupera tras el reinicio (dbo.ejecucion_tarea)', async () => {
    await t.emitir('01', { items: [linea('P001')] }, 'contingencia');
    const r = await loteAutomatico.ejecutar(); // otro "proceso": este de Jest
    expect(r.resultado).toBe('PROCESADO');
    const s = await arrancar();
    expect((await s.api('GET', '/api/contingencia/programacion')).body.data.ultimaEjecucion).toEqual(r);
    await matar(s);
  }, 40000);

  test('db/03_reset_demo.sql devuelve la configuración a los valores de backend/.env', async () => {
    await t.admin('put', '/api/contingencia/consultas').send({ intervaloSeg: 99 });
    await reiniciarBd();
    t = await prepararApi();
    expect((await t.admin('get', '/api/contingencia/consultas')).body.data.intervaloSeg).toBe(Number(process.env.CONSULTA_MH_INTERVALO_SEG) || 60);
    expect(await ejecuciones('LOTE_CONTINGENCIA')).toHaveLength(0);
  });
});

describe('Temporizador real de la cola de consultas (servidor hijo, intervalo 10 s)', () => {
  test('dispara solo, consulta en MH el DTE que se quedó sin respuesta y lo deja PROCESADO con su sello', async () => {
    const s = await arrancar({ CONSULTA_MH_ACTIVO: '0' });
    const e = await s.api('POST', '/api/dte/01', { items: [linea('P002')] }, { 'X-Simular': 'timeout' });
    expect(e.body.data.estado).toBe('CONTINGENCIA');
    const id = e.body.data.id;

    const cfg = (await s.api('PUT', '/api/contingencia/consultas', { activo: true, intervaloSeg: 10 })).body.data;
    expect(cfg.proximaConsulta).toEqual(expect.any(String));
    const inicio = Date.now();

    const turno = await esperarHasta(async () => {
      const l = (await s.api('GET', '/api/contingencia/ejecuciones?tarea=CONSULTA_MH')).body.data;
      return l.find((x) => x.disparo === 'TEMPORIZADOR' && x.detalle && x.detalle.dteId === id);
    }, 25000);
    expect(turno).toMatchObject({ resultado: 'ENCONTRADO', tarea: 'CONSULTA_MH', conError: false });
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(9000); // no antes del intervalo
    const det = (await s.api('GET', `/api/dte/${id}`)).body.data;
    expect(det.estado).toBe('PROCESADO');
    expect(det.selloRecibido).toMatch(/^\d{4}[A-Z0-9]{36}$/);
    expect(det.consultaMh).toMatchObject({ consultas: 1, resultado: 'ENCONTRADO' });
    expect((await s.api('GET', '/api/contingencia/consultas')).body.data.ultimaConsulta).toMatchObject({ dteId: id, resultado: 'ENCONTRADO' });

    await s.api('PUT', '/api/contingencia/consultas', { activo: false });
    await matar(s);
  }, 60000);
});

describe('Temporizador del lote automático (callback programado)', () => {
  const programados = [];
  beforeAll(() => {
    loteAutomatico._reloj.setTimeout = (fn, ms) => { const h = { fn, ms, unref() {} }; programados.push(h); return h; };
    loteAutomatico._reloj.clearTimeout = () => {};
  });
  afterAll(() => {
    loteAutomatico.detener();
    loteAutomatico._reloj.setTimeout = (fn, ms) => setTimeout(fn, ms);
    loteAutomatico._reloj.clearTimeout = (h) => clearTimeout(h);
  });

  test('programa a la hora guardada; al dispararse ejecuta el lote, marca el día y se reprograma; el 2.º disparo del día se omite', async () => {
    await t.admin('put', '/api/contingencia/programacion').send({ activo: true, hora: '22:10' });
    const [id] = [(await t.emitir('01', { items: [linea('P003')] }, 'contingencia')).body.data.id];

    await loteAutomatico.iniciar();
    const prog = programados[programados.length - 1];
    expect(Math.abs(Date.now() + prog.ms - loteAutomatico.proximaEjecucion('22:10').getTime())).toBeLessThan(2000);

    const antes = programados.length;
    await prog.fn(); // el temporizador vence
    expect((await t.detalle(id)).estado).toBe('PROCESADO');
    const ej = (await ejecuciones('LOTE_CONTINGENCIA')).filter((x) => x.disparo === 'TEMPORIZADOR');
    expect(ej[ej.length - 1]).toMatchObject({ resultado: 'PROCESADO', proceso: tareas.PROCESO });
    expect((await config('LOTE_CONTINGENCIA')).ultima_ejecucion_dia.toISOString().slice(0, 10)).toBe(tareas.hoy());
    expect(programados.length).toBe(antes + 1); // se reprogramó para el día siguiente
    expect(programados[programados.length - 1].ms).toBeGreaterThan(0);

    // mismo día otra vez (p. ej. otro proceso o un reinicio): no repite el lote
    await t.emitir('01', { items: [linea('P003')] }, 'contingencia');
    const eventos = (await t.admin('get', '/api/contingencia')).body.data.length;
    await programados[programados.length - 1].fn();
    const ult = (await ejecuciones('LOTE_CONTINGENCIA')).pop();
    expect(ult).toMatchObject({ disparo: 'TEMPORIZADOR', resultado: 'OMITIDA' });
    expect(ult.mensaje).toMatch(/ya se ejecutó/);
    expect((await t.admin('get', '/api/contingencia')).body.data.length).toBe(eventos);
    // la última ejecución "real" sigue siendo la del lote, no la omitida
    expect((await t.admin('get', '/api/contingencia/programacion')).body.data.ultimaEjecucion.resultado).toBe('PROCESADO');
  });

  test('si se desactiva, no se programa y un disparo pendiente no ejecuta nada', async () => {
    const pendiente = programados[programados.length - 1];
    const n = programados.length;
    await t.admin('put', '/api/contingencia/programacion').send({ activo: false });
    expect(programados.length).toBe(n);
    const antes = (await ejecuciones('LOTE_CONTINGENCIA')).length;
    await pendiente.fn();
    expect((await ejecuciones('LOTE_CONTINGENCIA')).length).toBe(antes);
    await t.admin('put', '/api/contingencia/programacion').send({ activo: true, hora: '23:55' });
  });
});

describe('Temporizador de la cola de consultas (callback programado, en este proceso)', () => {
  const programados = [];
  beforeAll(async () => {
    await t.admin('post', '/api/contingencia').send({}); // cola vacía
    consultaMh._reloj.setTimeout = (fn, ms) => { const h = { fn, ms, unref() {} }; programados.push(h); return h; };
    consultaMh._reloj.clearTimeout = () => {};
  });
  afterAll(async () => {
    consultaMh.detener();
    consultaMh._reloj.setTimeout = (fn, ms) => setTimeout(fn, ms);
    consultaMh._reloj.clearTimeout = (h) => clearTimeout(h);
    await t.admin('put', '/api/contingencia/consultas').send({ activo: true, intervaloSeg: 60 });
  });

  test('programa al intervalo guardado; al vencer consulta un DTE, lo registra como TEMPORIZADOR y se reprograma', async () => {
    await t.admin('put', '/api/contingencia/consultas').send({ activo: true, intervaloSeg: 15 });
    const { id } = (await t.emitir('01', { items: [linea('P005')] }, 'timeout')).body.data;
    await consultaMh.iniciar();
    const prog = programados[programados.length - 1];
    expect(prog.ms).toBe(15000);
    expect((await t.admin('get', '/api/contingencia/consultas')).body.data.proximaConsulta).toEqual(expect.any(String));

    await prog.fn();
    expect((await t.detalle(id)).estado).toBe('PROCESADO');
    expect((await ejecuciones('CONSULTA_MH')).pop()).toMatchObject({ disparo: 'TEMPORIZADOR', resultado: 'ENCONTRADO' });
    expect(programados[programados.length - 1]).not.toBe(prog);
    expect(programados[programados.length - 1].ms).toBe(15000);

    // cola vacía: el turno no hace nada y no se registra
    const n = (await ejecuciones('CONSULTA_MH')).length;
    await programados[programados.length - 1].fn();
    expect((await ejecuciones('CONSULTA_MH')).length).toBe(n);
  });

  test('desactivada: no se programa, sin próxima consulta, y un disparo pendiente no consulta', async () => {
    const pendiente = programados[programados.length - 1];
    const n = programados.length;
    const r = (await t.admin('put', '/api/contingencia/consultas').send({ activo: false })).body.data;
    expect(r.proximaConsulta).toBeNull();
    expect(programados.length).toBe(n);
    await t.emitir('01', { items: [linea('P005')] }, 'contingencia');
    const antes = (await ejecuciones('CONSULTA_MH')).length;
    await pendiente.fn();
    expect((await ejecuciones('CONSULTA_MH')).length).toBe(antes);
  });

  test('un fallo en el turno queda como ERROR (detalle solo en la BD) y suelta el candado', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(require('../../src/dte/simuladores/mhRegistro'), 'buscar').mockRejectedValueOnce(new Error('timeout interno abc123'));
    const r = await consultaMh.consultarSiguiente();
    expect(r).toMatchObject({ resultado: 'ERROR' });
    expect(r.mensaje).not.toMatch(/abc123/);
    expect((await ejecuciones('CONSULTA_MH')).pop().error).toMatch(/timeout interno abc123/);
    expect((await config('CONSULTA_MH')).en_curso_desde).toBeNull();
    jest.restoreAllMocks();
  });

  test('otro proceso con el candado de la cola → OMITIDA', async () => {
    let otro;
    jest.isolateModules(() => { otro = require('../../src/services/tareasProgramadas'); });
    await otro.adquirir('CONSULTA_MH', 120);
    const r = await consultaMh.consultarSiguiente();
    expect(r).toMatchObject({ resultado: 'OMITIDA' });
    expect(r.mensaje).toContain(otro.PROCESO);
    await otro.liberar('CONSULTA_MH');
  });
});

describe('Sin ejecuciones duplicadas', () => {
  // cola vacía al empezar (la prueba anterior deja un DTE pendiente a propósito) y ningún candado colgado entre pruebas
  beforeAll(async () => { await t.admin('post', '/api/contingencia').send({}); });
  afterEach(async () => { await query(`UPDATE dbo.config_tarea SET en_curso_desde = NULL, en_curso_por = NULL`); });

  test('otro proceso con el candado → OMITIDA; al soltarlo, corre; un candado vencido se recupera', async () => {
    let otro;
    jest.isolateModules(() => { otro = require('../../src/services/tareasProgramadas'); }); // otra instancia = otro proceso
    expect(otro.PROCESO).not.toBe(tareas.PROCESO);
    await t.emitir('01', { items: [linea('P004')] }, 'contingencia');

    expect(await otro.adquirir('LOTE_CONTINGENCIA', 600)).toEqual({ ok: true });
    const r1 = await loteAutomatico.ejecutar();
    expect(r1).toMatchObject({ resultado: 'OMITIDA' });
    expect(r1.mensaje).toContain(otro.PROCESO);
    expect((await t.admin('get', '/api/contingencia/programacion')).body.data.pendientes).toBe(1);

    await otro.liberar('LOTE_CONTINGENCIA');
    expect((await loteAutomatico.ejecutar()).resultado).toBe('PROCESADO');

    // proceso muerto a mitad: candado de hace 20 min → vencido (TTL 10 min) → se recupera
    await otro.adquirir('LOTE_CONTINGENCIA', 600);
    await query(`UPDATE dbo.config_tarea SET en_curso_desde = DATEADD(MINUTE, -20, SYSDATETIME()) WHERE tarea = 'LOTE_CONTINGENCIA'`);
    expect((await loteAutomatico.ejecutar()).resultado).toBe('SIN_PENDIENTES');
    expect((await config('LOTE_CONTINGENCIA')).en_curso_desde).toBeNull();
  });

  test('dos instancias del lote a la vez: un solo evento con el DTE', async () => {
    let lote2;
    jest.isolateModules(() => { lote2 = require('../../src/services/loteAutomaticoService'); });
    const { id } = (await t.emitir('01', { items: [linea('P004')] }, 'contingencia')).body.data;
    const r = await Promise.all([loteAutomatico.ejecutar(), lote2.ejecutar()]);
    expect(r.filter((x) => x.resultado === 'PROCESADO')).toHaveLength(1);
    expect(r.map((x) => x.resultado).sort()).toEqual(expect.arrayContaining(['PROCESADO']));
    const eventos = (await query(`SELECT evento_id FROM dbo.evento_contingencia_dte WHERE dte_id = @id`, { id })).recordset;
    expect(eventos).toHaveLength(1);
  });

  test('dentro de un proceso, un turno que se solapa con otro se omite (lote y cola)', async () => {
    await t.emitir('01', { items: [linea('P004')] }, 'contingencia');
    const [a, b] = await Promise.all([loteAutomatico.ejecutar(), loteAutomatico.ejecutar()]);
    expect([a.resultado, b.resultado].sort()).toEqual(['OMITIDA', 'PROCESADO']);

    await t.emitir('01', { items: [linea('P004')] }, 'contingencia');
    const [c, d] = await Promise.all([consultaMh.consultarSiguiente(), consultaMh.consultarSiguiente()]);
    expect([c.resultado, d.resultado].sort()).toEqual(['NO_ENCONTRADO', 'OMITIDA']);
    const omitidas = (await ejecuciones('CONSULTA_MH')).filter((x) => x.resultado === 'OMITIDA');
    expect(omitidas.length).toBeGreaterThan(0);
  });
});

describe('Registro de ejecuciones y errores', () => {
  test('un error queda registrado con su detalle; la API solo muestra un mensaje genérico; el candado se suelta', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(contingenciaService, 'enviar').mockRejectedValueOnce(new Error('Deadlock en tabla secreta_xyz'));
    const r = await loteAutomatico.ejecutar();
    expect(r.resultado).toBe('ERROR');
    expect(r.mensaje).not.toMatch(/xyz/);
    const fila = (await ejecuciones('LOTE_CONTINGENCIA')).pop();
    expect(fila).toMatchObject({ resultado: 'ERROR', disparo: 'DIRECTO' });
    expect(fila.error).toMatch(/Deadlock en tabla secreta_xyz/);
    expect(fila.fin.getTime()).toBeGreaterThanOrEqual(fila.inicio.getTime());

    const api = (await t.vendedor('get', '/api/contingencia/ejecuciones').query({ tarea: 'LOTE_CONTINGENCIA', limite: 1 })).body.data[0];
    expect(api).toMatchObject({ id: fila.id, resultado: 'ERROR', conError: true, duracionMs: expect.any(Number) });
    expect(JSON.stringify(api)).not.toMatch(/xyz/);
    expect((await config('LOTE_CONTINGENCIA')).en_curso_desde).toBeNull();
    expect((await loteAutomatico.ejecutar()).resultado).not.toBe('ERROR'); // el siguiente corre normal
    jest.restoreAllMocks();
  });

  test('GET /api/contingencia/ejecuciones: cualquier rol, filtros validados, sin token 401', async () => {
    const r = await t.vendedor('get', '/api/contingencia/ejecuciones');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data[0]).toEqual(expect.objectContaining({
      id: expect.any(Number), tarea: expect.any(String), disparo: expect.any(String), inicio: expect.any(String), resultado: expect.any(String),
    }));
    expect(r.body.data[0]).not.toHaveProperty('error');
    expect((await t.admin('get', '/api/contingencia/ejecuciones').query({ tarea: 'OTRA' })).status).toBe(400);
    expect((await t.admin('get', '/api/contingencia/ejecuciones').query({ limite: 0 })).status).toBe(400);
    expect((await t.request(t.app).get('/api/contingencia/ejecuciones')).status).toBe(401);
  });
});
