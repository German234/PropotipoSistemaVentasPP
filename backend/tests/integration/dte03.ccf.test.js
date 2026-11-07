/**
 * Flujo del Comprobante de Crédito Fiscal (03): cliente CONTRIBUYENTE obligatorio, precios SIN IVA,
 * IVA en resumen.tributos (código 20). Ej. del contrato: 40 × P001 → 100 + 13 = 113.00.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, UUID_MAYUS, SELLO } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const item = (codigo, cantidad, descuento = 0) => ({ productoId: t.prod[codigo].id, cantidad, descuento });

describe('03 CCF · emisión exitosa', () => {
  let r;
  let d;
  beforeAll(async () => {
    r = await t.emitir('03', { clienteId: t.cli.roble.id, condicionOperacion: 1, items: [item('P001', 40)] });
    d = await t.detalle(r.body.data.id);
  });

  test('201 PROCESADO, total 113.00, número de control del tipo 03', () => {
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ tipoDte: '03', estado: 'PROCESADO', total: 113, numeroControl: 'DTE-03-M001P001-000000000000001' });
    expect(r.body.data.codigoGeneracion).toMatch(UUID_MAYUS);
    expect(r.body.data.selloRecibido).toMatch(SELLO);
  });

  test('jsonDte cumple fe-ccf-v4.json (version 4, sin extension)', () => {
    expect(d.jsonDte).toCumplirEsquemaMh('03');
    expect(d.jsonDte.identificacion).toMatchObject({ version: 4, tipoDte: '03', ambiente: '00' });
    expect(d.jsonDte).not.toHaveProperty('extension');
  });

  test('precios SIN IVA y tributo 20 de 13 % en el resumen', () => {
    expect(d.jsonDte.cuerpoDocumento[0]).toMatchObject({ precioUni: 2.5, ventaGravada: 100, tributos: ['20'] });
    expect(d.jsonDte.resumen.tributos).toEqual([{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 13 }]);
    expect(d.jsonDte.resumen).toMatchObject({ subTotal: 100, montoTotalOperacion: 113, totalPagar: 113, totalLetras: 'CIENTO TRECE 00/100 USD' });
    expect(d).toMatchObject({ subtotal: 100, iva: 13, total: 113 });
  });

  test('receptor con NIT, NRC y actividad del contribuyente', () => {
    expect(d.jsonDte.receptor).toMatchObject({
      nit: t.cli.roble.nit, nrc: t.cli.roble.nrc, codActividad: t.cli.roble.codActividad, nombre: t.cli.roble.nombre,
    });
  });

  test('P2: nombre comercial, teléfono y dirección con los códigos MH del cliente', () => {
    expect(d.jsonDte.receptor).toMatchObject({
      nombreComercial: 'El Roble', telefono: '22605000',
      direccion: { departamento: '06', municipio: '23', distrito: '14', complemento: 'Colonia Escalón, Paseo General Escalón #3500' },
    });
    expect(d.jsonDte.emisor.direccion).toMatchObject({ departamento: '06', municipio: '23', distrito: '14' });
  });

  test('items con acreditada 0 y pendiente = cantidad (para la NC)', () => {
    expect(d.items[0]).toMatchObject({ cantidad: 40, acreditada: 0, pendiente: 40, ivaItem: 13 });
    expect(d.notasCredito).toEqual([]);
  });

  test('descuenta stock (100 − 40)', async () => {
    expect(await t.stock('P001')).toBe(60);
  });
});

describe('03 CCF · validaciones del receptor', () => {
  test('sin clienteId → 400 VALIDACION', async () => {
    const r = await t.emitir('03', { items: [item('P001', 1)] });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('cliente CONSUMIDOR → 400 "debe ser CONTRIBUYENTE"', async () => {
    const r = await t.emitir('03', { clienteId: t.cli.juan.id, items: [item('P001', 1)] });
    expect(r.status).toBe(400);
    expect(r.body.error.mensaje).toMatch(/CONTRIBUYENTE/);
  });

  test('cliente inexistente → 404', async () => {
    expect((await t.emitir('03', { clienteId: 999999, items: [item('P001', 1)] })).status).toBe(404);
  });

  test('cliente inactivo → 400', async () => {
    await t.admin('put', `/api/clientes/${t.cli.libreria.id}`).send({ activo: false });
    const r = await t.emitir('03', { clienteId: t.cli.libreria.id, items: [item('P001', 1)] });
    expect(r.status).toBe(400);
    await t.admin('put', `/api/clientes/${t.cli.libreria.id}`).send({ activo: true });
  });
});

describe('03 CCF · variantes', () => {
  test('descuento SIN IVA: 2 × 18.50 − 7 = 30 + 3.90 = 33.90', async () => {
    const r = await t.emitir('03', { clienteId: t.cli.libreria.id, items: [item('P007', 2, 7)] });
    expect(r.status).toBe(201);
    expect(r.body.data.total).toBe(33.9);
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte).toCumplirEsquemaMh('03');
    expect(d.jsonDte.resumen).toMatchObject({ totalDescu: 7, totalLetras: 'TREINTA Y TRES 90/100 USD' });
  });

  test('a crédito: pagos = null y sigue cumpliendo el esquema', async () => {
    const r = await t.emitir('03', { clienteId: t.cli.roble.id, condicionOperacion: 2, items: [item('P004', 3)] });
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.resumen.pagos).toBeNull();
    expect(d.jsonDte).toCumplirEsquemaMh('03');
  });

  test('el correlativo del 03 es independiente del 01', async () => {
    await t.emitir('01', { items: [item('P002', 1)] });
    const r = await t.emitir('03', { clienteId: t.cli.roble.id, items: [item('P002', 1)] });
    expect(r.body.data.numeroControl).toBe('DTE-03-M001P001-000000000000004');
  });
});
