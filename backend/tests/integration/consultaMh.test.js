/**
 * Cola de consultas a MH (C3):
 *   X-Simular: timeout → MH recibe y sella el DTE pero la respuesta se pierde (el POS lo deja en CONTINGENCIA);
 *   la consulta de DTE descubre si MH lo tiene (ENCONTRADO → PROCESADO con el sello original y el JSON de
 *   modelo previo) o no (NO_ENCONTRADO → contingencia real, sigue en la cola);
 *   la cola consulta UN DTE por turno, en orden round-robin.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, SELLO } = require('../helpers/api');
const consultaMh = require('../../src/services/consultaMhService');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(async () => { consultaMh.detener(); await cerrarBd(); });

const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
const emitir01 = async (simular, codigo = 'P001') => (await t.emitir('01', { items: [linea(codigo, 1)] }, simular)).body.data;
const consultar = (id, simular, quien = t.admin) => {
  const r = quien('post', `/api/dte/${id}/consultar`);
  return (simular ? r.set('X-Simular', simular) : r).send();
};
const cola = async () => (await t.admin('get', '/api/contingencia/consultas')).body.data;
const firmado = (firmador) => JSON.parse(Buffer.from(firmador.body.split('.')[1], 'base64url').toString());
/** Deja la cola vacía (lote manual) para que cada bloque empiece limpio. */
const vaciarCola = () => t.admin('post', '/api/contingencia').send({});

describe('X-Simular: timeout (MH recibió, pero la respuesta no llegó)', () => {
  test('para el POS es una contingencia: CONTINGENCIA, sin sello, JSON en modelo diferido, stock descontado', async () => {
    const antes = await t.stock('P002');
    const e = await emitir01('timeout', 'P002');
    expect(e).toMatchObject({ estado: 'CONTINGENCIA', selloRecibido: null, respuestaMh: null });
    const d = await t.detalle(e.id);
    expect(d.jsonDte.identificacion).toMatchObject({ tipoModelo: 2, tipoOperacion: 2, tipoContingencia: 1 });
    expect(d.consultaMh).toBeNull();
    expect(await t.stock('P002')).toBe(antes - 1);
  });

  test('invalidar con timeout → 503 MH_NO_DISPONIBLE (como contingencia)', async () => {
    const e = await emitir01();
    const r = await t.invalidar(e.id, { motivoAnulacion: 'Prueba' }, 'timeout');
    expect(r.status).toBe(503);
    expect(r.body.error.codigo).toBe('MH_NO_DISPONIBLE');
  });
});

describe('POST /api/dte/:id/consultar', () => {
  test('DTE que MH sí recibió → ENCONTRADO: PROCESADO con sello, JSON y firma de modelo previo, stock igual', async () => {
    const e = await emitir01('timeout', 'P003');
    const stock = await t.stock('P003');
    const r = await consultar(e.id, undefined, t.vendedor); // cualquier rol
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ dteId: e.id, resultado: 'ENCONTRADO', estado: 'PROCESADO', consultas: 1, origen: 'MANUAL' });
    expect(r.body.data.selloRecibido).toMatch(SELLO);
    expect(r.body.data.respuestaMh).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: e.codigoGeneracion });

    const d = await t.detalle(e.id);
    expect(d).toMatchObject({ estado: 'PROCESADO', selloRecibido: r.body.data.selloRecibido });
    expect(d.jsonDte.identificacion).toMatchObject({ tipoModelo: 1, tipoOperacion: 1, tipoContingencia: null });
    expect(d.jsonDte).toCumplirEsquemaMh('01');
    expect(firmado(d.firmador)).toEqual(d.jsonDte);
    expect(d.consultaMh).toMatchObject({ consultas: 1, resultado: 'ENCONTRADO' });
    expect(await t.stock('P003')).toBe(stock);

    const b = await t.bitacora({ accion: 'CONSULTA_MH', dteId: e.id });
    expect(b[0]).toMatchObject({ resultado: 'PROCESADO' });
    expect(b[0].datos).toMatchObject({ origen: 'MANUAL' });
  });

  test('contingencia real → NO_ENCONTRADO: sigue en CONTINGENCIA y cuenta la consulta', async () => {
    const e = await emitir01('contingencia');
    const r1 = (await consultar(e.id)).body.data;
    expect(r1).toMatchObject({ resultado: 'NO_ENCONTRADO', estado: 'CONTINGENCIA', selloRecibido: null, consultas: 1 });
    expect(r1.respuestaMh).toMatchObject({ estado: null, codigoMsg: '004' });
    const r2 = (await consultar(e.id)).body.data;
    expect(r2.consultas).toBe(2);
    const d = await t.detalle(e.id);
    expect(d.estado).toBe('CONTINGENCIA');
    expect(d.consultaMh).toMatchObject({ consultas: 2, resultado: 'NO_ENCONTRADO' });
  });

  test('MH tampoco responde a la consulta (X-Simular contingencia/timeout) → SIN_RESPUESTA, aunque MH lo tenga', async () => {
    const e = await emitir01('timeout');
    for (const modo of ['contingencia', 'timeout']) {
      const r = (await consultar(e.id, modo)).body.data;
      expect(r).toMatchObject({ resultado: 'SIN_RESPUESTA', estado: 'CONTINGENCIA', respuestaMh: null });
    }
    expect((await consultar(e.id)).body.data.resultado).toBe('ENCONTRADO');
  });

  test('DTE que no está en CONTINGENCIA → 409; inexistente → 404; X-Simular inválido → 400; sin token → 401', async () => {
    const e = await emitir01();
    expect((await consultar(e.id)).status).toBe(409);
    expect((await consultar(999999)).status).toBe(404);
    expect((await consultar(e.id, 'raro')).status).toBe(400);
    expect((await t.request(t.app).post(`/api/dte/${e.id}/consultar`)).status).toBe(401);
  });
});

describe('Reenvío de un DTE que MH ya tenía', () => {
  test('reintentar → PROCESADO con el sello ORIGINAL (MH no lo duplica) y JSON de modelo previo', async () => {
    const e = await emitir01('timeout');
    const r = (await t.reintentar(e.id)).body.data;
    expect(r.estado).toBe('PROCESADO');
    expect(r.respuestaMh.observaciones[0]).toMatch(/ya había recibido/);
    // la consulta (si se hubiera hecho) habría devuelto el mismo sello: comparar con lo que MH guardó
    const d = await t.detalle(e.id);
    expect(d.selloRecibido).toBe(r.selloRecibido);
    expect(d.jsonDte.identificacion.tipoModelo).toBe(1);
    expect(firmado(r.firmador)).toEqual(d.jsonDte);
  });

  test('reintentar con timeout otra vez → sigue en CONTINGENCIA; luego la consulta lo encuentra', async () => {
    const e = await emitir01('contingencia');
    expect((await t.reintentar(e.id, 'timeout')).body.data.estado).toBe('CONTINGENCIA');
    const c = (await consultar(e.id)).body.data;
    expect(c).toMatchObject({ resultado: 'ENCONTRADO', estado: 'PROCESADO' });
    // MH recibió el JSON en contingencia (el del reintento): es el que queda
    expect((await t.detalle(e.id)).jsonDte.identificacion.tipoModelo).toBe(2);
  });

  test('lote de contingencia con un DTE que MH ya tenía → PROCESADO con su sello original', async () => {
    await vaciarCola();
    const tenido = await emitir01('timeout');
    const real = await emitir01('contingencia');
    const ev = (await t.admin('post', '/api/contingencia').send({})).body.data;
    expect(ev.estado).toBe('PROCESADO');
    expect(ev.dtes.map((d) => d.estado)).toEqual(['PROCESADO', 'PROCESADO']);
    expect((await t.detalle(tenido.id)).jsonDte.identificacion.tipoModelo).toBe(1);
    expect((await t.detalle(real.id)).jsonDte.identificacion.tipoModelo).toBe(2);
  });
});

describe('Cola: un DTE por turno (consultarSiguiente)', () => {
  let a; let b; let c;
  beforeAll(async () => {
    await vaciarCola();
    a = await emitir01('contingencia');
    b = await emitir01('timeout');
    c = await emitir01('contingencia');
  });

  test('GET /api/contingencia/consultas: cola en orden (nunca consultados primero, por id)', async () => {
    const r = await cola();
    expect(r).toMatchObject({ activo: true, intervaloSeg: expect.any(Number) });
    expect(r.cola.map((x) => x.id)).toEqual([a.id, b.id, c.id]);
    expect(r.cola[0]).toMatchObject({ posicion: 1, consultas: 0, ultimaConsulta: null, resultado: null });
  });

  test('cada turno consulta solo UN documento, en orden round-robin', async () => {
    const t1 = await consultaMh.consultarSiguiente();
    expect(t1).toMatchObject({ dteId: a.id, resultado: 'NO_ENCONTRADO', origen: 'AUTOMATICO' });
    let r = await cola();
    expect(r.cola.map((x) => [x.id, x.consultas])).toEqual([[b.id, 0], [c.id, 0], [a.id, 1]]);

    const t2 = await consultaMh.consultarSiguiente();
    expect(t2).toMatchObject({ dteId: b.id, resultado: 'ENCONTRADO', estado: 'PROCESADO' });
    expect((await t.detalle(b.id)).estado).toBe('PROCESADO');

    const t3 = await consultaMh.consultarSiguiente();
    expect(t3).toMatchObject({ dteId: c.id, resultado: 'NO_ENCONTRADO' });
    // b salió de la cola; a vuelve a tocar antes que c (su consulta es más antigua)
    r = await cola();
    expect(r.cola.map((x) => x.id)).toEqual([a.id, c.id]);
    expect(r.ultimaConsulta).toMatchObject({ dteId: c.id, resultado: 'NO_ENCONTRADO' });

    const t4 = await consultaMh.consultarSiguiente();
    expect(t4.dteId).toBe(a.id);
    expect((await t.detalle(a.id)).consultaMh.consultas).toBe(2);
  });

  test('los turnos automáticos sin novedad no llenan la bitácora; el ENCONTRADO sí queda', async () => {
    const b1 = await t.bitacora({ accion: 'CONSULTA_MH', dteId: a.id });
    expect(b1).toHaveLength(0);
    const b2 = await t.bitacora({ accion: 'CONSULTA_MH', dteId: b.id });
    expect(b2[0].datos).toMatchObject({ origen: 'AUTOMATICO', resultado: 'PROCESADO' });
  });

  test('MH sin respuesta en un turno → SIN_RESPUESTA y el DTE pasa al final de la cola', async () => {
    const primero = (await cola()).cola[0].id;
    const r = await consultaMh.consultarSiguiente('contingencia');
    expect(r).toMatchObject({ dteId: primero, resultado: 'SIN_RESPUESTA' });
    const r2 = await cola();
    expect(r2.cola[r2.cola.length - 1].id).toBe(primero);
  });

  test('sin DTE en contingencia → el turno no hace nada (null)', async () => {
    await vaciarCola();
    expect(await consultaMh.consultarSiguiente()).toBeNull();
    expect((await cola()).cola).toEqual([]);
  });
});

describe('PUT /api/contingencia/consultas', () => {
  afterAll(async () => { await t.admin('put', '/api/contingencia/consultas').send({ activo: true, intervaloSeg: 60 }); });

  test('VENDEDOR → 403; GET cualquier rol', async () => {
    expect((await t.vendedor('put', '/api/contingencia/consultas').send({ intervaloSeg: 30 })).status).toBe(403);
    expect((await t.vendedor('get', '/api/contingencia/consultas')).status).toBe(200);
  });

  test.each([
    [{}], [{ intervaloSeg: 5 }], [{ intervaloSeg: 3601 }], [{ intervaloSeg: 12.5 }], [{ intervaloSeg: '30' }], [{ activo: 1 }],
  ])('%j → 400 VALIDACION', async (body) => {
    const r = await t.admin('put', '/api/contingencia/consultas').send(body);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('cambia intervalo y activo; queda en bitácora', async () => {
    const r = await t.admin('put', '/api/contingencia/consultas').send({ intervaloSeg: 15, activo: false });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ intervaloSeg: 15, activo: false, proximaConsulta: null });
    const b = await t.bitacora({ accion: 'ACTUALIZAR' });
    expect(b.some((x) => x.entidad === 'consultas_mh' && x.datos.cambios.intervaloSeg === 15)).toBe(true);
  });
});
