/**
 * Flujo de la Nota de crédito (05): solo sobre un 03 PROCESADO, mismo receptor, documentoRelacionado,
 * cantidades ≤ pendientes y devolución de stock.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, numeroControlRe } = require('../helpers/api');

let t;
let ccf; // CCF PROCESADO: 40 × P001 + 2 × P007 con descuento 1.00
beforeAll(async () => {
  t = await prepararApi();
  const r = await t.emitir('03', {
    clienteId: t.cli.roble.id,
    items: [{ productoId: t.prod.P001.id, cantidad: 40 }, { productoId: t.prod.P007.id, cantidad: 2, descuento: 1 }],
  });
  ccf = await t.detalle(r.body.data.id);
});
afterAll(cerrarBd);

const nc = (items, extra = {}, simular) => t.emitir('05', { dteRelacionadoId: ccf.id, items, ...extra }, simular);
const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });

describe('05 NC · emisión exitosa sobre un CCF', () => {
  let r;
  let d;
  let stockAntes;
  beforeAll(async () => {
    stockAntes = await t.stock('P001');
    r = await nc([linea('P001', 5)]);
    d = await t.detalle(r.body.data.id);
  });

  test('201 PROCESADO con número de control del tipo 05', () => {
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ tipoDte: '05', estado: 'PROCESADO', total: 14.13 });
    expect(r.body.data.numeroControl).toMatch(numeroControlRe('05'));
    expect(r.body.data.numeroControl).toBe('DTE-05-M001P001-000000000000001');
  });

  test('jsonDte cumple fe-nc-v4.json', () => {
    expect(d.jsonDte).toCumplirEsquemaMh('05');
    expect(d.jsonDte.identificacion).toMatchObject({ version: 4, tipoDte: '05' });
  });

  test('documentoRelacionado = [{03, generación 2, codigoGeneracion del CCF, fecha}]', () => {
    expect(d.jsonDte.documentoRelacionado).toEqual([{
      tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: ccf.codigoGeneracion, fechaEmision: ccf.jsonDte.identificacion.fecEmi,
    }]);
    expect(d.dteRelacionadoId).toBe(ccf.id);
    expect(d.dteRelacionado).toMatchObject({ id: ccf.id, tipoDte: '03', codigoGeneracion: ccf.codigoGeneracion });
  });

  test('mismo receptor que el CCF', () => {
    expect(d.jsonDte.receptor).toMatchObject({
      tipoDocumento: '36', numDocumento: ccf.jsonDte.receptor.nit, nrc: ccf.jsonDte.receptor.nrc, nombre: ccf.jsonDte.receptor.nombre,
    });
  });

  test('montos: 5 × 2.50 = 12.50 + IVA 1.63 = 14.13', () => {
    expect(d.jsonDte.cuerpoDocumento[0]).toMatchObject({ precioUni: 2.5, ventaGravada: 12.5, numeroDocumento: ccf.codigoGeneracion });
    expect(d.jsonDte.resumen).toMatchObject({ totalIva: 1.63, totalPagar: 14.13, totalLetras: 'CATORCE 13/100 USD' });
    expect(d.jsonDte.resumen.tributos[0]).toMatchObject({ codigo: '20', valor: 1.63 });
  });

  test('devuelve el stock', async () => {
    expect(await t.stock('P001')).toBe(stockAntes + 5);
  });

  test('el CCF muestra acreditada/pendiente y la NC en notasCredito', async () => {
    const c = await t.detalle(ccf.id);
    expect(c.items.find((i) => i.codigo === 'P001')).toMatchObject({ cantidad: 40, acreditada: 5, pendiente: 35 });
    expect(c.notasCredito).toEqual([expect.objectContaining({ id: r.body.data.id, estado: 'PROCESADO' })]);
  });
});

describe('05 NC · límites de cantidad y descuento proporcional', () => {
  test('cantidad mayor a la pendiente → 400 VALIDACION', async () => {
    const r = await nc([linea('P001', 36)]);
    expect(r.status).toBe(400);
    expect(r.body.error.mensaje).toMatch(/pendiente/i);
  });

  test('descuento del CCF se acredita en proporción y la última acreditación toma el resto exacto', async () => {
    // CCF: 2 × 18.50 − 1 = 36.00 gravado → 1 unidad = 18.00 cada vez
    const a = await t.detalle((await nc([linea('P007', 1)])).body.data.id);
    const b = await t.detalle((await nc([linea('P007', 1)])).body.data.id);
    expect(a.jsonDte.cuerpoDocumento[0].ventaGravada + b.jsonDte.cuerpoDocumento[0].ventaGravada).toBe(36);
    expect(a.jsonDte).toCumplirEsquemaMh('05');
    const c = await t.detalle(ccf.id);
    expect(c.items.find((i) => i.codigo === 'P007').pendiente).toBe(0);
  });

  test('sin pendiente → 400', async () => {
    expect((await nc([linea('P007', 1)])).status).toBe(400);
  });

  test('una NC RECHAZADA no cuenta como acreditada ni devuelve stock', async () => {
    const stock = await t.stock('P001');
    const r = await nc([linea('P001', 10)], {}, 'rechazo');
    expect(r.status).toBe(201);
    expect(r.body.data.estado).toBe('RECHAZADO');
    expect(await t.stock('P001')).toBe(stock);
    const c = await t.detalle(ccf.id);
    expect(c.items.find((i) => i.codigo === 'P001').pendiente).toBe(35);
  });

  test('una NC en CONTINGENCIA sí cuenta como acreditada (reserva lo pendiente) y devuelve stock', async () => {
    const stock = await t.stock('P001');
    const r = await nc([linea('P001', 10)], {}, 'contingencia');
    expect(r.body.data.estado).toBe('CONTINGENCIA');
    expect(await t.stock('P001')).toBe(stock + 10);
    const c = await t.detalle(ccf.id);
    expect(c.items.find((i) => i.codigo === 'P001').pendiente).toBe(25);
  });
});

describe('05 NC · reglas del documento relacionado', () => {
  test('producto que no está en el CCF → 400', async () => {
    expect((await nc([linea('P002', 1)])).status).toBe(400);
  });

  test('clienteId distinto del receptor del CCF → 400', async () => {
    expect((await nc([linea('P001', 1)], { clienteId: t.cli.libreria.id })).status).toBe(400);
  });

  test('clienteId igual al del CCF → 201', async () => {
    expect((await nc([linea('P001', 1)], { clienteId: t.cli.roble.id })).status).toBe(201);
  });

  test('sobre una Factura 01 → 400 VALIDACION', async () => {
    const f = await t.emitir('01', { items: [linea('P001', 1)] });
    const r = await t.emitir('05', { dteRelacionadoId: f.body.data.id, items: [linea('P001', 1)] });
    expect(r.status).toBe(400);
  });

  test('sobre un CCF RECHAZADO → 409 ESTADO_INVALIDO', async () => {
    const c = await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P001', 1)] }, 'rechazo');
    const r = await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P001', 1)] });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
  });

  test('sobre un CCF en CONTINGENCIA → 409 ESTADO_INVALIDO', async () => {
    const c = await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P001', 1)] }, 'contingencia');
    const r = await t.emitir('05', { dteRelacionadoId: c.body.data.id, items: [linea('P001', 1)] });
    expect(r.status).toBe(409);
  });

  test('CCF inexistente → 404', async () => {
    expect((await t.emitir('05', { dteRelacionadoId: 999999, items: [linea('P001', 1)] })).status).toBe(404);
  });

  test('sin dteRelacionadoId → 400', async () => {
    expect((await t.emitir('05', { items: [linea('P001', 1)] })).status).toBe(400);
  });
});
