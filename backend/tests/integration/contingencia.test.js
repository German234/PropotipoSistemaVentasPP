/**
 * Contingencia, rechazo y reintento (X-Simular). Reglas:
 *   - rechazo      → RECHAZADO, sin sello, ok:true, guardado, consume correlativo, NO descuenta stock.
 *   - contingencia → CONTINGENCIA, sin sello, respuestaMh null, SÍ descuenta stock, se puede reintentar.
 *   - reintentar   → solo desde CONTINGENCIA; mismo codigoGeneracion/numeroControl/firma;
 *                    ok → PROCESADO con sello · contingencia → sigue igual · rechazo → RECHAZADO y revierte stock.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, SELLO } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });

describe('X-Simular', () => {
  test('valor inválido → 400 VALIDACION y no se emite nada', async () => {
    const r = await t.emitir('01', { items: [linea('P001', 1)] }, 'caido');
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
    expect((await t.admin('get', '/api/dte')).body.data).toHaveLength(0);
  });

  test('acepta mayúsculas (OK)', async () => {
    const r = await t.emitir('01', { items: [linea('P001', 1)] }, 'OK');
    expect(r.body.data.estado).toBe('PROCESADO');
  });
});

describe('Rechazo de MH en la emisión', () => {
  let r;
  let stock;
  beforeAll(async () => {
    stock = await t.stock('P002');
    r = await t.emitir('01', { items: [linea('P002', 4)] }, 'rechazo');
  });

  test('ok:true (201) con estado RECHAZADO, sin sello y con observaciones', () => {
    expect(r.status).toBe(201);
    expect(r.body.ok).toBe(true);
    expect(r.body.data).toMatchObject({ estado: 'RECHAZADO', selloRecibido: null });
    expect(r.body.data.respuestaMh).toMatchObject({ estado: 'RECHAZADO', selloRecibido: null });
    expect(r.body.data.respuestaMh.observaciones.length).toBeGreaterThan(0);
  });

  test('no descuenta stock', async () => {
    expect(await t.stock('P002')).toBe(stock);
  });

  test('queda registrado y consume correlativo', async () => {
    const d = await t.detalle(r.body.data.id);
    expect(d.estado).toBe('RECHAZADO');
    expect(d.numeroControl).toBe('DTE-01-M001P001-000000000000002');
    const sig = await t.emitir('01', { items: [linea('P002', 1)] });
    expect(sig.body.data.numeroControl).toBe('DTE-01-M001P001-000000000000003');
  });

  test('bitácora EMISION con resultado RECHAZADO', async () => {
    const b = await t.bitacora({ accion: 'EMISION', dteId: r.body.data.id });
    expect(b[0].resultado).toBe('RECHAZADO');
  });

  test('un DTE RECHAZADO no se puede reintentar ni invalidar (409)', async () => {
    expect((await t.reintentar(r.body.data.id)).status).toBe(409);
    const inv = await t.invalidar(r.body.data.id, { motivo: 'x' });
    expect(inv.status).toBe(409);
    expect(inv.body.error.codigo).toBe('ESTADO_INVALIDO');
  });
});

describe('Contingencia (MH no responde) y reintento exitoso', () => {
  let r;
  let stock;
  beforeAll(async () => {
    stock = await t.stock('P004');
    r = await t.emitir('01', { clienteId: t.cli.juan.id, items: [linea('P004', 3)] }, 'contingencia');
  });

  test('estado CONTINGENCIA, sin sello, respuestaMh null, firmado OK', () => {
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ estado: 'CONTINGENCIA', selloRecibido: null, respuestaMh: null });
    expect(r.body.data.firmador.status).toBe('OK');
  });

  test('descuenta stock (la venta ocurrió)', async () => {
    expect(await t.stock('P004')).toBe(stock - 3);
  });

  test('el JSON del DTE en contingencia cumple el esquema', async () => {
    expect((await t.detalle(r.body.data.id)).jsonDte).toCumplirEsquemaMh('01');
  });

  test('no se puede invalidar mientras está en CONTINGENCIA (409)', async () => {
    expect((await t.invalidar(r.body.data.id, { motivo: 'x' })).status).toBe(409);
  });

  test('reintento con MH aún caído → sigue en CONTINGENCIA, stock sin cambios', async () => {
    const x = await t.reintentar(r.body.data.id, 'contingencia');
    expect(x.status).toBe(200);
    expect(x.body.data).toMatchObject({ estado: 'CONTINGENCIA', selloRecibido: null, respuestaMh: null });
    expect(await t.stock('P004')).toBe(stock - 3);
  });

  test('reintento ok → PROCESADO con sello; conserva codigoGeneracion, numeroControl y firma', async () => {
    const x = await t.reintentar(r.body.data.id);
    expect(x.status).toBe(200);
    expect(x.body.data).toMatchObject({
      id: r.body.data.id,
      estado: 'PROCESADO',
      codigoGeneracion: r.body.data.codigoGeneracion,
      numeroControl: r.body.data.numeroControl,
      firmador: r.body.data.firmador,
    });
    expect(x.body.data.selloRecibido).toMatch(SELLO);
    expect(x.body.data.respuestaMh).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: r.body.data.codigoGeneracion });
    expect(await t.stock('P004')).toBe(stock - 3);
  });

  test('reintentar un DTE PROCESADO → 409 ESTADO_INVALIDO', async () => {
    const x = await t.reintentar(r.body.data.id);
    expect(x.status).toBe(409);
    expect(x.body.error.codigo).toBe('ESTADO_INVALIDO');
  });

  test('bitácora: EMISION CONTINGENCIA y dos REINTENTO (CONTINGENCIA, PROCESADO)', async () => {
    const em = await t.bitacora({ accion: 'EMISION', dteId: r.body.data.id });
    expect(em[0].resultado).toBe('CONTINGENCIA');
    const re = await t.bitacora({ accion: 'REINTENTO', dteId: r.body.data.id });
    expect(re.map((b) => b.resultado).sort()).toEqual(['CONTINGENCIA', 'PROCESADO']);
  });

  test('una vez PROCESADO ya se puede invalidar', async () => {
    const x = await t.invalidar(r.body.data.id, { motivo: 'Prueba tras contingencia' });
    expect(x.status).toBe(200);
    expect(x.body.data.estado).toBe('INVALIDADO');
    expect(await t.stock('P004')).toBe(stock);
  });
});

describe('Contingencia → reintento rechazado', () => {
  test('pasa a RECHAZADO y revierte el stock descontado en contingencia', async () => {
    const stock = await t.stock('P006');
    const r = await t.emitir('01', { items: [linea('P006', 5)] }, 'contingencia');
    expect(await t.stock('P006')).toBe(stock - 5);
    const x = await t.reintentar(r.body.data.id, 'rechazo');
    expect(x.status).toBe(200);
    expect(x.body.data).toMatchObject({ estado: 'RECHAZADO', selloRecibido: null });
    expect(await t.stock('P006')).toBe(stock);
  });
});

describe('Contingencia en CCF (03) y NC (05)', () => {
  test('03 en contingencia → reintento ok → admite NC', async () => {
    const c = await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P001', 10)] }, 'contingencia');
    expect(c.body.data.estado).toBe('CONTINGENCIA');
    expect((await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P001', 1)] })).status).toBe(409);
    const x = await t.reintentar(c.body.data.id);
    expect(x.body.data.estado).toBe('PROCESADO');
    const nc = await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P001', 2)] });
    expect(nc.status).toBe(201);
    expect(nc.body.data.estado).toBe('PROCESADO');
  });

  test('05 en contingencia → reintento rechazado → vuelve a sacar el stock devuelto', async () => {
    const c = await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P003', 20)] });
    const stock = await t.stock('P003');
    const nc = await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P003', 5)] }, 'contingencia');
    expect(nc.body.data.estado).toBe('CONTINGENCIA');
    expect(await t.stock('P003')).toBe(stock + 5);
    await t.reintentar(nc.body.data.id, 'rechazo');
    expect(await t.stock('P003')).toBe(stock);
    const ccf = await t.detalle(c.body.data.id);
    expect(ccf.items[0].pendiente).toBe(20);
  });
});

describe('Reintento · errores', () => {
  test('DTE inexistente → 404', async () => {
    expect((await t.reintentar(999999)).status).toBe(404);
  });

  test('id inválido → 400', async () => {
    expect((await t.reintentar('abc')).status).toBe(400);
  });
});
