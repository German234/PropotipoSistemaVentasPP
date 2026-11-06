/**
 * Lote de contingencia (C2):
 *   - manual: POST /api/contingencia sin dteIds = lote con todos los DTE en CONTINGENCIA en ese momento;
 *   - automático (cierre del día): loteAutomaticoService.ejecutar() con origen AUTOMATICO;
 *   - recepción por lote: evento aceptado → jsonLote con los DTE firmados + codigoLote → DTE PROCESADO;
 *   - GET/PUT /api/contingencia/programacion (hora y activo del lote automático).
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, UUID_MAYUS, SELLO, FH_MH } = require('../helpers/api');
const loteAutomatico = require('../../src/services/loteAutomaticoService');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(async () => { loteAutomatico.detener(); await cerrarBd(); });

const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
const enContingencia = async (n) => {
  const ids = [];
  for (let i = 0; i < n; i += 1) ids.push((await t.emitir('01', { items: [linea('P001', 1)] }, 'contingencia')).body.data.id);
  return ids;
};
const programacion = async () => (await t.admin('get', '/api/contingencia/programacion')).body.data;
const putProgramacion = (body, quien = t.admin) => quien('put', '/api/contingencia/programacion').send(body);

describe('GET/PUT /api/contingencia/programacion', () => {
  afterAll(async () => { await putProgramacion({ activo: true, hora: '23:55' }); });

  test('GET (cualquier rol): activo, hora HH:mm, próxima ejecución y pendientes', async () => {
    const r = await t.vendedor('get', '/api/contingencia/programacion');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ activo: true, hora: expect.stringMatching(/^\d{2}:\d{2}$/), pendientes: 0 });
    expect(r.body.data.proximaEjecucion).toMatch(new RegExp(`T${r.body.data.hora}:00$`));
  });

  test('sin token → 401', async () => {
    const r = await t.request(t.app).get('/api/contingencia/programacion');
    expect(r.status).toBe(401);
  });

  test('PUT VENDEDOR → 403 SIN_PERMISO', async () => {
    const r = await putProgramacion({ hora: '20:00' }, t.vendedor);
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('SIN_PERMISO');
  });

  test.each([
    [{}, 'sin campos'],
    [{ hora: '24:00' }, 'hora fuera de rango'],
    [{ hora: '7:5' }, 'hora sin formato HH:mm'],
    [{ activo: 'si' }, 'activo no booleano'],
  ])('PUT %j → 400 VALIDACION (%s)', async (body) => {
    const r = await putProgramacion(body);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('PUT cambia la hora y recalcula la próxima ejecución; queda en bitácora', async () => {
    const r = await putProgramacion({ hora: '18:30' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ activo: true, hora: '18:30' });
    expect(r.body.data.proximaEjecucion).toMatch(/T18:30:00$/);
    const b = await t.bitacora({ accion: 'ACTUALIZAR' });
    expect(b.some((x) => x.entidad === 'programacion_contingencia' && x.datos.cambios.hora === '18:30')).toBe(true);
  });

  test('PUT activo:false → sin próxima ejecución', async () => {
    const r = await putProgramacion({ activo: false });
    expect(r.body.data).toMatchObject({ activo: false, proximaEjecucion: null });
  });
});

describe('Lote manual (POST /api/contingencia sin dteIds)', () => {
  let ids;
  let ev;

  beforeAll(async () => {
    ids = await enContingencia(3);
    expect((await programacion()).pendientes).toBe(3);
    ev = (await t.admin('post', '/api/contingencia').send({})).body.data;
  });

  test('toma todos los DTE en contingencia del momento, con origen MANUAL', () => {
    expect(ev).toMatchObject({ estado: 'PROCESADO', origen: 'MANUAL', cantidad: 3 });
    expect(ev.dtes.map((d) => d.id)).toEqual(ids);
    expect(ev.jsonEvento).toCumplirEsquemaMh('contingencia');
  });

  test('recepción por lote: jsonLote con los DTE firmados y respuesta MH RECIBIDO con codigoLote', async () => {
    expect(ev.codigoLote).toMatch(UUID_MAYUS);
    expect(ev.lote).toMatchObject({ codigoLote: ev.codigoLote, procesados: 3, rechazados: 0 });
    expect(ev.lote.jsonLote).toMatchObject({ ambiente: '00', version: 2, idEnvio: expect.stringMatching(UUID_MAYUS) });
    expect(ev.lote.jsonLote.nitEmisor).toMatch(/^\d{14}$/);
    expect(ev.lote.respuestaMh).toMatchObject({ estado: 'RECIBIDO', ambiente: '00', idEnvio: ev.lote.idEnvio, codigoLote: ev.codigoLote });
    expect(ev.lote.respuestaMh.fhProcesamiento).toMatch(FH_MH);
    // Los documentos del lote son las firmas (JWS) con las que se emitieron los DTE
    const firmas = await Promise.all(ids.map(async (id) => (await t.detalle(id)).firmador.body));
    expect(ev.lote.jsonLote.documentos).toEqual(firmas);
  });

  test('cada DTE del lote queda PROCESADO con sello y la cola queda vacía', async () => {
    for (const d of ev.dtes) {
      expect(d.estado).toBe('PROCESADO');
      expect(d.selloRecibido).toMatch(SELLO);
    }
    expect((await programacion()).pendientes).toBe(0);
  });

  test('GET /:id y GET / exponen origen, codigoLote y el lote', async () => {
    const det = (await t.admin('get', `/api/contingencia/${ev.id}`)).body.data;
    expect(det).toMatchObject({ origen: 'MANUAL', codigoLote: ev.codigoLote });
    expect(det.lote).toEqual(ev.lote);
    const lista = (await t.admin('get', '/api/contingencia')).body.data;
    expect(lista.find((e) => e.id === ev.id)).toMatchObject({ origen: 'MANUAL', codigoLote: ev.codigoLote });
  });

  test('evento rechazado → sin lote (codigoLote null) y los DTE siguen en contingencia', async () => {
    const [id] = await enContingencia(1);
    const r = (await t.admin('post', '/api/contingencia').set('X-Simular', 'rechazo').send({})).body.data;
    expect(r).toMatchObject({ estado: 'RECHAZADO', codigoLote: null, lote: null });
    expect((await t.detalle(id)).estado).toBe('CONTINGENCIA');
    const det = (await t.admin('get', `/api/contingencia/${r.id}`)).body.data;
    expect(det).toMatchObject({ codigoLote: null, lote: null });
  });
});

describe('Lote automático (cierre del día)', () => {
  beforeAll(async () => {
    // La cola puede traer el DTE del evento rechazado anterior: se vacía con un lote manual
    await t.admin('post', '/api/contingencia').send({});
  });

  test('sin DTE en contingencia → SIN_PENDIENTES (no crea evento) y queda en bitácora', async () => {
    const antes = (await t.admin('get', '/api/contingencia')).body.data.length;
    const r = await loteAutomatico.ejecutar();
    expect(r).toMatchObject({ resultado: 'SIN_PENDIENTES', eventoId: null, cantidad: 0 });
    expect((await t.admin('get', '/api/contingencia')).body.data.length).toBe(antes);
    expect((await programacion()).ultimaEjecucion).toEqual(r);
    const b = await t.bitacora({ accion: 'CONTINGENCIA' });
    expect(b[0].datos).toMatchObject({ origen: 'AUTOMATICO', resultado: 'SIN_PENDIENTES' });
  });

  test('con DTE pendientes → evento AUTOMATICO firmado por un ADMIN y lote enviado', async () => {
    const ids = await enContingencia(2);
    const r = await loteAutomatico.ejecutar();
    expect(r).toMatchObject({ resultado: 'PROCESADO', cantidad: 2, eventoId: expect.any(Number) });
    expect(r.codigoLote).toMatch(UUID_MAYUS);

    const ev = (await t.admin('get', `/api/contingencia/${r.eventoId}`)).body.data;
    expect(ev).toMatchObject({ origen: 'AUTOMATICO', usuario: 'admin', estado: 'PROCESADO', codigoLote: r.codigoLote });
    expect(ev.motivo).toMatch(/cierre del día/i);
    expect(ev.jsonEvento).toCumplirEsquemaMh('contingencia');
    expect(ev.dtes.map((d) => d.id)).toEqual(ids);
    for (const id of ids) expect((await t.detalle(id)).estado).toBe('PROCESADO');
    expect((await programacion()).ultimaEjecucion).toEqual(r);

    const b = await t.bitacora({ accion: 'CONTINGENCIA' });
    expect(b[0].datos).toMatchObject({ origen: 'AUTOMATICO', resultado: 'PROCESADO', cantidad: 2 });
  });

  test('MH rechaza el evento → RECHAZADO, sin lote; los DTE quedan para el siguiente lote', async () => {
    const [id] = await enContingencia(1);
    const r = await loteAutomatico.ejecutar('rechazo');
    expect(r).toMatchObject({ resultado: 'RECHAZADO', codigoLote: null, cantidad: 1 });
    expect((await t.detalle(id)).estado).toBe('CONTINGENCIA');
    expect((await programacion()).pendientes).toBe(1);
  });

  test('MH no responde → SIN_RESPUESTA (no lanza error) y los DTE siguen pendientes', async () => {
    const r = await loteAutomatico.ejecutar('contingencia');
    expect(r).toMatchObject({ resultado: 'SIN_RESPUESTA', eventoId: null });
    expect((await programacion()).pendientes).toBe(1);
  });

  test('el siguiente lote automático recoge lo que quedó pendiente', async () => {
    const r = await loteAutomatico.ejecutar();
    expect(r).toMatchObject({ resultado: 'PROCESADO', cantidad: 1 });
    expect((await programacion()).pendientes).toBe(0);
  });
});
