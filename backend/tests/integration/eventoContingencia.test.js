/**
 * Evento de contingencia (POST/GET /api/contingencia, esquema MH v4):
 *   DTE emitidos sin respuesta de MH → JSON con tipoModelo/tipoOperacion 2 → se reportan en un evento;
 *   evento PROCESADO → sus DTE se transmiten y quedan PROCESADO con sello;
 *   evento RECHAZADO → los DTE siguen en CONTINGENCIA; MH sin respuesta → 503 y bitácora SIN_RESPUESTA.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, UUID_MAYUS, SELLO } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
const enviarEvento = (body, simular, quien) => {
  const req = (quien || t.admin)('post', '/api/contingencia');
  return (simular ? req.set('X-Simular', simular) : req).send(body);
};
const firmado = (firmador) => JSON.parse(Buffer.from(firmador.body.split('.')[1], 'base64url').toString());

describe('DTE emitido en contingencia', () => {
  test.each([
    ['01', () => ({ items: [linea('P001', 1)] })],
    ['03', () => ({ clienteId: t.cli.roble.id, items: [linea('P001', 2)] })],
  ])('%s: JSON con tipoModelo 2, tipoOperacion 2, tipoContingencia 1, firmado así y válido contra el esquema', async (tipo, body) => {
    const r = await t.emitir(tipo, body(), 'contingencia');
    expect(r.body.data.estado).toBe('CONTINGENCIA');
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.identificacion).toMatchObject({ tipoModelo: 2, tipoOperacion: 2, tipoContingencia: 1, motivoContin: null });
    expect(d.jsonDte).toCumplirEsquemaMh(tipo);
    expect(firmado(r.body.data.firmador)).toEqual(d.jsonDte);
    expect(d.eventoContingencia).toBeNull();
  });

  test('05: NC en contingencia también pasa a modelo diferido y cumple el esquema', async () => {
    const c = await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P002', 10)] });
    const r = await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P002', 3)] }, 'contingencia');
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.identificacion).toMatchObject({ tipoModelo: 2, tipoOperacion: 2, tipoContingencia: 1 });
    expect(d.jsonDte).toCumplirEsquemaMh('05');
  });

  test('un DTE procesado normalmente sigue con tipoModelo 1 y tipoOperacion 1', async () => {
    const r = await t.emitir('01', { items: [linea('P001', 1)] });
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.identificacion).toMatchObject({ tipoModelo: 1, tipoOperacion: 1, tipoContingencia: null });
  });
});

describe('POST /api/contingencia · validaciones', () => {
  test('VENDEDOR → 403 SIN_PERMISO', async () => {
    const r = await enviarEvento({}, undefined, t.vendedor);
    expect(r.status).toBe(403);
    expect(r.body.error.codigo).toBe('SIN_PERMISO');
  });

  test('DTE que no está en CONTINGENCIA → 409 ESTADO_INVALIDO', async () => {
    const f = await t.emitir('01', { items: [linea('P003', 1)] });
    const r = await enviarEvento({ dteIds: [f.body.data.id] });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
  });

  test('DTE inexistente → 404', async () => {
    expect((await enviarEvento({ dteIds: [999999] })).status).toBe(404);
  });

  test('dteIds vacío o no numérico → 400', async () => {
    expect((await enviarEvento({ dteIds: [] })).status).toBe(400);
    expect((await enviarEvento({ dteIds: ['x'] })).status).toBe(400);
  });

  test('motivo de más de 500 caracteres → 400', async () => {
    expect((await enviarEvento({ motivo: 'x'.repeat(501) })).status).toBe(400);
  });

  test('X-Simular inválido → 400', async () => {
    expect((await enviarEvento({}, 'caido')).status).toBe(400);
  });
});

describe('Evento sin respuesta de MH y evento rechazado', () => {
  let f;
  beforeAll(async () => {
    f = (await t.emitir('01', { items: [linea('P004', 1)] }, 'contingencia')).body.data;
  });

  test('MH no responde → 503 MH_NO_DISPONIBLE, no se guarda el evento, DTE sigue en CONTINGENCIA, bitácora SIN_RESPUESTA', async () => {
    const antes = (await t.admin('get', '/api/contingencia')).body.data.length;
    const r = await enviarEvento({ dteIds: [f.id] }, 'contingencia');
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, error: { codigo: 'MH_NO_DISPONIBLE' } });
    expect((await t.admin('get', '/api/contingencia')).body.data).toHaveLength(antes);
    expect((await t.detalle(f.id)).estado).toBe('CONTINGENCIA');
    const b = await t.bitacora({ accion: 'CONTINGENCIA' });
    expect(b[0]).toMatchObject({ entidad: 'evento_contingencia', resultado: 'SIN_RESPUESTA' });
    expect(b[0].datos.dteIds).toEqual([f.id]);
  });

  test('evento rechazado → 201 ok:true, estado RECHAZADO sin sello; los DTE siguen en CONTINGENCIA', async () => {
    const stock = await t.stock('P004');
    const r = await enviarEvento({ dteIds: [f.id], motivo: 'Prueba de rechazo' }, 'rechazo');
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ estado: 'RECHAZADO', selloRecibido: null, cantidad: 1 });
    expect(r.body.data.dtes).toEqual([expect.objectContaining({ id: f.id, estado: 'CONTINGENCIA', selloRecibido: null })]);
    expect(r.body.data.jsonEvento).toCumplirEsquemaMh('contingencia');
    expect(await t.stock('P004')).toBe(stock);
    const d = await t.detalle(f.id);
    expect(d.estado).toBe('CONTINGENCIA');
    expect(d.eventoContingencia).toMatchObject({ estado: 'RECHAZADO', codigoGeneracion: r.body.data.codigoGeneracion });
  });
});

describe('Evento aceptado: transmite todos los DTE en contingencia', () => {
  let r;
  let pendientes;
  beforeAll(async () => {
    pendientes = (await t.admin('get', '/api/dte').query({ estado: 'CONTINGENCIA' })).body.data;
    r = await enviarEvento({ motivo: 'El servicio de recepción de MH no respondió' });
  });

  test('sin dteIds incluye todos los DTE en CONTINGENCIA (01, 03 y 05)', () => {
    expect(pendientes.length).toBeGreaterThanOrEqual(4);
    expect(r.status).toBe(201);
    expect(r.body.data.cantidad).toBe(pendientes.length);
    expect(r.body.data.dtes.map((d) => d.id).sort((a, b) => a - b)).toEqual(pendientes.map((d) => d.id).sort((a, b) => a - b));
    expect(new Set(r.body.data.dtes.map((d) => d.tipoDte))).toEqual(new Set(['01', '03', '05']));
  });

  test('evento PROCESADO con sello propio y código de generación UUID en mayúsculas', () => {
    expect(r.body.data).toMatchObject({ estado: 'PROCESADO', tipoContingencia: 1, usuario: 'admin', motivo: 'El servicio de recepción de MH no respondió' });
    expect(r.body.data.codigoGeneracion).toMatch(UUID_MAYUS);
    expect(r.body.data.selloRecibido).toMatch(SELLO);
    expect(r.body.data.respuestaMh).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: r.body.data.codigoGeneracion });
  });

  test('jsonEvento cumple contingencia-schema-v4.json y lista cada DTE en detalleDTE', () => {
    const ev = r.body.data.jsonEvento;
    expect(ev).toCumplirEsquemaMh('contingencia');
    expect(ev.identificacion).toMatchObject({ version: 4, ambiente: '00', codigoGeneracion: r.body.data.codigoGeneracion });
    expect(ev.detalleDTE).toHaveLength(pendientes.length);
    ev.detalleDTE.forEach((x, i) => expect(x.noItem).toBe(i + 1));
    expect(ev.detalleDTE.map((x) => x.codigoGeneracion).sort()).toEqual(pendientes.map((d) => d.codigoGeneracion).sort());
    expect(ev.motivo).toMatchObject({ tipoContingencia: 1, motivoContingencia: 'El servicio de recepción de MH no respondió' });
    expect(`${ev.motivo.fInicio}T${ev.motivo.hInicio}` <= `${ev.motivo.fFin}T${ev.motivo.hFin}`).toBe(true);
    expect(firmado(r.body.data.firmador)).toEqual(ev);
  });

  test('cada DTE quedó PROCESADO con su sello, conservando codigoGeneracion y numeroControl', async () => {
    for (const p of pendientes) {
      const d = await t.detalle(p.id);
      expect(d).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: p.codigoGeneracion, numeroControl: p.numeroControl });
      expect(d.selloRecibido).toMatch(SELLO);
      expect(d.eventoContingencia).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: r.body.data.codigoGeneracion });
    }
    expect((await t.admin('get', '/api/dte').query({ estado: 'CONTINGENCIA' })).body.data).toHaveLength(0);
  });

  test('bitácora: CONTINGENCIA PROCESADO y un REINTENTO por DTE con el código del evento', async () => {
    const ev = await t.bitacora({ accion: 'CONTINGENCIA' });
    expect(ev[0]).toMatchObject({ resultado: 'PROCESADO', entidadId: r.body.data.id });
    for (const p of pendientes) {
      const re = await t.bitacora({ accion: 'REINTENTO', dteId: p.id });
      expect(re[0]).toMatchObject({ resultado: 'PROCESADO' });
      expect(re[0].datos.codigoGeneracionEvento).toBe(r.body.data.codigoGeneracion);
    }
  });

  test('sin DTE en contingencia → 409 ESTADO_INVALIDO', async () => {
    const x = await enviarEvento({});
    expect(x.status).toBe(409);
    expect(x.body.error.codigo).toBe('ESTADO_INVALIDO');
  });

  test('los DTE transmitidos ya se pueden invalidar', async () => {
    const f = pendientes.find((d) => d.tipoDte === '01');
    const x = await t.invalidar(f.id, { motivo: 'Tras evento de contingencia' });
    expect(x.body.data.estado).toBe('INVALIDADO');
  });
});

describe('Evento con dteIds seleccionados', () => {
  test('solo transmite los indicados (ids repetidos se cuentan una vez)', async () => {
    const a = (await t.emitir('01', { items: [linea('P005', 1)] }, 'contingencia')).body.data;
    const b = (await t.emitir('01', { items: [linea('P005', 1)] }, 'contingencia')).body.data;
    const r = await enviarEvento({ dteIds: [a.id, a.id] });
    expect(r.status).toBe(201);
    expect(r.body.data.cantidad).toBe(1);
    expect((await t.detalle(a.id)).estado).toBe('PROCESADO');
    expect((await t.detalle(b.id)).estado).toBe('CONTINGENCIA');
  });
});

describe('GET /api/contingencia', () => {
  test('lista los eventos guardados (procesados y rechazados), más reciente primero', async () => {
    const r = await t.vendedor('get', '/api/contingencia');
    expect(r.status).toBe(200);
    expect(r.body.data.map((e) => e.estado)).toEqual(['PROCESADO', 'PROCESADO', 'RECHAZADO']);
    expect(r.body.data[0]).toEqual(expect.objectContaining({
      id: expect.any(Number), codigoGeneracion: expect.stringMatching(UUID_MAYUS), tipoContingencia: 1, usuario: 'admin', cantidad: 1,
    }));
  });

  test('GET /:id devuelve el evento con jsonEvento, firmador, respuestaMh y el estado actual de sus DTE', async () => {
    const [ultimo, , rechazado] = (await t.admin('get', '/api/contingencia')).body.data;
    const r = await t.vendedor('get', `/api/contingencia/${ultimo.id}`);
    expect(r.status).toBe(200);
    expect(r.body.data.jsonEvento).toCumplirEsquemaMh('contingencia');
    expect(r.body.data.firmador.status).toBe('OK');
    expect(r.body.data.dtes[0].estado).toBe('PROCESADO');
    // el DTE del evento rechazado cambió después (otro evento lo procesó): se muestra su estado actual, no CONTINGENCIA
    const rr = (await t.admin('get', `/api/contingencia/${rechazado.id}`)).body.data;
    expect(rr.estado).toBe('RECHAZADO');
    const actual = await t.detalle(rr.dtes[0].id);
    expect(rr.dtes[0].estado).toBe(actual.estado);
    expect(rr.dtes[0].estado).not.toBe('CONTINGENCIA');
  });

  test('evento inexistente → 404; id inválido → 400', async () => {
    expect((await t.admin('get', '/api/contingencia/999999')).status).toBe(404);
    expect((await t.admin('get', '/api/contingencia/abc')).status).toBe(400);
  });

  test('sin token → 401', async () => {
    expect((await t.request(t.app).get('/api/contingencia')).status).toBe(401);
  });
});
