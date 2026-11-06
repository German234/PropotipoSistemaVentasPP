/**
 * Invalidación: solo sobre DTE PROCESADO; un 03 con NC vigente no se invalida; evento según el esquema v3;
 * respuesta con sello propio; DTE → INVALIDADO y se devuelve el stock.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, UUID_MAYUS, SELLO } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
const MOTIVO = { tipoAnulacion: 2, motivo: 'Error en la información del documento' };

describe('Invalidar una Factura 01', () => {
  let f;
  let r;
  let stock;
  beforeAll(async () => {
    stock = await t.stock('P001');
    f = (await t.emitir('01', { clienteId: t.cli.juan.id, items: [linea('P001', 4)] })).body.data;
    r = await t.invalidar(f.id, MOTIVO);
  });

  test('200 con DTE INVALIDADO, evento PROCESADO y sello propio', () => {
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ id: f.id, estado: 'INVALIDADO', estadoEvento: 'PROCESADO' });
    expect(r.body.data.codigoGeneracionEvento).toMatch(UUID_MAYUS);
    expect(r.body.data.codigoGeneracionEvento).not.toBe(f.codigoGeneracion);
    expect(r.body.data.selloRecibido).toMatch(SELLO);
    expect(r.body.data.selloRecibido).not.toBe(f.selloRecibido);
    expect(r.body.data.firmador.status).toBe('OK');
    expect(r.body.data.respuestaMh).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: r.body.data.codigoGeneracionEvento });
  });

  test('jsonEvento cumple invalidacion-schema-v3.json y referencia al DTE', () => {
    const ev = r.body.data.jsonEvento;
    expect(ev).toCumplirEsquemaMh('invalidacion');
    expect(Object.keys(ev)).toEqual(['identificacion', 'emisor', 'documento', 'motivo']);
    expect(ev.identificacion).toMatchObject({ version: 3, ambiente: '00', codigoGeneracion: r.body.data.codigoGeneracionEvento });
    expect(ev.documento).toMatchObject({
      tipoDte: '01', codigoGeneracion: f.codigoGeneracion, selloRecibido: f.selloRecibido, numeroControl: f.numeroControl,
      codigoGeneracionR: null, nombre: 'Juan Pérez',
    });
    expect(ev.documento).not.toHaveProperty('montoIva');
    expect(ev.motivo).toMatchObject({
      tipoAnulacion: 2, motivoAnulacion: MOTIVO.motivo, nombreResponsable: 'Administrador', tipDocResponsable: '13',
    });
  });

  test('devuelve el stock', async () => {
    expect(await t.stock('P001')).toBe(stock);
  });

  test('GET /api/dte/:id muestra el evento de invalidación', async () => {
    const d = await t.detalle(f.id);
    expect(d.estado).toBe('INVALIDADO');
    expect(d.invalidacion).toMatchObject({ estado: 'PROCESADO', tipoAnulacion: 2, motivo: MOTIVO.motivo, usuario: 'admin' });
    expect(d.invalidacion.selloRecibido).toMatch(SELLO);
  });

  test('bitácora INVALIDACION PROCESADO', async () => {
    const b = await t.bitacora({ accion: 'INVALIDACION', dteId: f.id });
    expect(b[0]).toMatchObject({ resultado: 'PROCESADO' });
    expect(b[0].datos).toMatchObject({ codigoGeneracion: f.codigoGeneracion, codigoGeneracionEvento: r.body.data.codigoGeneracionEvento });
  });

  test('invalidar otra vez → 409 ESTADO_INVALIDO', async () => {
    const x = await t.invalidar(f.id, MOTIVO);
    expect(x.status).toBe(409);
    expect(x.body.error.codigo).toBe('ESTADO_INVALIDO');
  });
});

describe('Invalidación con MH rechazando o sin responder', () => {
  let f;
  beforeAll(async () => {
    f = (await t.emitir('01', { items: [linea('P002', 2)] })).body.data;
  });

  test('evento rechazado → ok:true, estadoEvento RECHAZADO, DTE sigue PROCESADO y stock sin cambios', async () => {
    const stock = await t.stock('P002');
    const r = await t.invalidar(f.id, MOTIVO, 'rechazo');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ estado: 'PROCESADO', estadoEvento: 'RECHAZADO', selloRecibido: null });
    expect(await t.stock('P002')).toBe(stock);
    expect((await t.detalle(f.id)).invalidacion).toMatchObject({ estado: 'RECHAZADO' });
  });

  test('MH no responde → 503 MH_NO_DISPONIBLE; DTE sigue PROCESADO; bitácora SIN_RESPUESTA', async () => {
    const r = await t.invalidar(f.id, MOTIVO, 'contingencia');
    expect(r.status).toBe(503);
    expect(r.body).toMatchObject({ ok: false, error: { codigo: 'MH_NO_DISPONIBLE' } });
    expect((await t.detalle(f.id)).estado).toBe('PROCESADO');
    const b = await t.bitacora({ accion: 'INVALIDACION', dteId: f.id });
    expect(b.map((x) => x.resultado)).toContain('SIN_RESPUESTA');
  });

  test('luego se puede reintentar la invalidación con éxito', async () => {
    const r = await t.invalidar(f.id, MOTIVO);
    expect(r.body.data).toMatchObject({ estado: 'INVALIDADO', estadoEvento: 'PROCESADO' });
  });
});

describe('Invalidar un CCF con Nota de crédito', () => {
  let ccf;
  let nc;
  beforeAll(async () => {
    ccf = (await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P006', 10)] })).body.data;
    nc = (await t.emitir('05', { dteRelacionadoId: ccf.id, items: [linea('P006', 3)] })).body.data;
  });

  test('CCF con NC vigente → 409 ESTADO_INVALIDO', async () => {
    const r = await t.invalidar(ccf.id, MOTIVO);
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
  });

  test('invalidar la NC: el evento cumple el esquema (tipoDte 05) y vuelve a sacar el stock', async () => {
    const stock = await t.stock('P006');
    const r = await t.invalidar(nc.id, MOTIVO);
    expect(r.body.data.estado).toBe('INVALIDADO');
    expect(r.body.data.jsonEvento).toCumplirEsquemaMh('invalidacion');
    expect(r.body.data.jsonEvento.documento).toMatchObject({ tipoDte: '05', tipoDocumento: '36', numDocumento: t.cli.roble.nit });
    expect(await t.stock('P006')).toBe(stock - 3);
  });

  test('sin NC vigente el CCF se invalida y devuelve su stock', async () => {
    const stock = await t.stock('P006');
    const r = await t.invalidar(ccf.id, MOTIVO);
    expect(r.status).toBe(200);
    expect(r.body.data.estado).toBe('INVALIDADO');
    expect(r.body.data.jsonEvento).toCumplirEsquemaMh('invalidacion');
    expect(r.body.data.jsonEvento.documento).toMatchObject({ tipoDte: '03', numDocumento: t.cli.roble.nit });
    expect(await t.stock('P006')).toBe(stock + 10);
  });

  test('no se puede emitir una NC sobre un CCF INVALIDADO (409)', async () => {
    expect((await t.emitir('05', { dteRelacionadoId: ccf.id, items: [linea('P006', 1)] })).status).toBe(409);
  });
});

describe('Invalidación · tipos de anulación y validaciones', () => {
  let f;
  beforeAll(async () => { f = (await t.emitir('01', { items: [linea('P005', 1)] })).body.data; });

  test('sin motivo → 400', async () => {
    expect((await t.invalidar(f.id, { tipoAnulacion: 2 })).status).toBe(400);
  });

  test('motivo de más de 200 caracteres → 400', async () => {
    expect((await t.invalidar(f.id, { motivo: 'x'.repeat(201) })).status).toBe(400);
  });

  test('tipoAnulacion fuera de 1/2/3 → 400', async () => {
    expect((await t.invalidar(f.id, { tipoAnulacion: 4, motivo: 'x' })).status).toBe(400);
  });

  test('tipoAnulacion 1 sin codigoGeneracionR → 400', async () => {
    expect((await t.invalidar(f.id, { tipoAnulacion: 1, motivo: 'Reemplazo' })).status).toBe(400);
  });

  test('tipoAnulacion 2 con codigoGeneracionR → 400', async () => {
    const otro = (await t.emitir('01', { items: [linea('P005', 1)] })).body.data;
    expect((await t.invalidar(f.id, { tipoAnulacion: 2, motivo: 'x', codigoGeneracionR: otro.codigoGeneracion })).status).toBe(400);
  });

  test('tipoAnulacion 1 con codigoGeneracionR de otro DTE PROCESADO → 200 y lo refleja en el evento', async () => {
    const reemplazo = (await t.emitir('01', { items: [linea('P005', 1)] })).body.data;
    const r = await t.invalidar(f.id, {
      tipoAnulacion: 1, motivo: 'Se reemplaza por otro documento', codigoGeneracionR: reemplazo.codigoGeneracion,
      nombreSolicita: 'Juan Pérez', tipDocSolicita: '13', numDocSolicita: '012345678',
    });
    expect(r.status).toBe(200);
    expect(r.body.data.jsonEvento).toCumplirEsquemaMh('invalidacion');
    expect(r.body.data.jsonEvento.documento.codigoGeneracionR).toBe(reemplazo.codigoGeneracion);
    expect(r.body.data.jsonEvento.motivo).toMatchObject({ tipoAnulacion: 1, nombreSolicita: 'Juan Pérez', numDocSolicita: '012345678' });
  });

  test('DTE inexistente → 404', async () => {
    expect((await t.invalidar(999999, MOTIVO)).status).toBe(404);
  });

  test('VENDEDOR también puede invalidar (cualquier rol autenticado)', async () => {
    const g = (await t.emitir('01', { items: [linea('P005', 1)] })).body.data;
    const r = await t.vendedor('post', `/api/dte/${g.id}/invalidar`).send(MOTIVO);
    expect(r.status).toBe(200);
    expect(r.body.data.jsonEvento.motivo.nombreResponsable).toBe('Vendedor de Turno');
  });
});
