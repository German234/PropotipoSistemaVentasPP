/**
 * Flujo de la Factura (01) de punta a punta: emisión → firmador → MH → BD → stock → consulta → bitácora.
 * Reglas: consumidor final, precios CON IVA, IVA incluido, receptor opcional, numeroControl y UUID.
 */
require('../helpers/schemas');
const { prepararApi, cerrarBd, UUID_MAYUS, SELLO, FH_MH, numeroControlRe } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const item = (codigo, cantidad, descuento = 0) => ({ productoId: t.prod[codigo].id, cantidad, descuento });

describe('01 Factura · emisión exitosa (X-Simular: ok)', () => {
  let r;
  let stockAntes;
  beforeAll(async () => {
    stockAntes = await t.stock('P001');
    r = await t.emitir('01', { clienteId: null, condicionOperacion: 1, items: [item('P001', 2)] }, undefined, t.vendedor);
  });

  test('responde 201 con la respuesta de emisión del contrato', () => {
    expect(r.status).toBe(201);
    expect(r.body.ok).toBe(true);
    expect(Object.keys(r.body.data).sort()).toEqual(
      ['codigoGeneracion', 'estado', 'fechaEmision', 'firmador', 'id', 'numeroControl', 'respuestaMh', 'selloRecibido', 'tipoDte', 'total'].sort()
    );
    expect(r.body.data).toMatchObject({ tipoDte: '01', estado: 'PROCESADO', total: 5.66 });
  });

  test('numeroControl DTE-01-M001P001-{15 dígitos} empezando en 1 y codigoGeneracion UUID v4 en MAYÚSCULAS', () => {
    expect(r.body.data.numeroControl).toBe('DTE-01-M001P001-000000000000001');
    expect(r.body.data.codigoGeneracion).toMatch(UUID_MAYUS);
  });

  test('firmador OK y respuesta MH PROCESADO con sello de 40 caracteres', () => {
    const { firmador, respuestaMh, selloRecibido, codigoGeneracion } = r.body.data;
    expect(firmador.status).toBe('OK');
    expect(firmador.body.split('.')).toHaveLength(3);
    expect(selloRecibido).toMatch(SELLO);
    expect(respuestaMh).toMatchObject({
      version: 2, ambiente: '00', versionApp: 2, estado: 'PROCESADO', codigoGeneracion, selloRecibido, observaciones: [],
    });
    expect(respuestaMh.fhProcesamiento).toMatch(FH_MH);
  });

  test('el payload firmado es el JSON DTE guardado', async () => {
    const d = await t.detalle(r.body.data.id);
    const payload = JSON.parse(Buffer.from(r.body.data.firmador.body.split('.')[1], 'base64url').toString());
    expect(payload).toEqual(d.jsonDte);
  });

  test('jsonDte cumple fe-f-v2.json, sin receptor y con IVA incluido', async () => {
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte).toCumplirEsquemaMh('01');
    expect(d.jsonDte).not.toHaveProperty('extension');
    expect(d.jsonDte.receptor).toBeNull();
    expect(d.jsonDte.identificacion).toMatchObject({ version: 2, ambiente: '00', tipoDte: '01', numeroControl: r.body.data.numeroControl });
    expect(d.jsonDte.cuerpoDocumento[0]).toMatchObject({ precioUni: 2.83, ventaGravada: 5.66, ivaItem: 0.65 });
    expect(d.jsonDte.resumen).toMatchObject({ totalGravada: 5.66, totalIva: 0.65, totalPagar: 5.66, tributos: null, totalLetras: 'CINCO 66/100 USD' });
    expect(d).toMatchObject({ subtotal: 5.01, iva: 0.65, usuario: 'vendedor', cliente: null });
  });

  test('descuenta el stock', async () => {
    expect(await t.stock('P001')).toBe(stockAntes - 2);
  });

  test('registra EMISION en la bitácora', async () => {
    const b = await t.bitacora({ accion: 'EMISION', dteId: r.body.data.id });
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ usuario: 'vendedor', resultado: 'PROCESADO', codigoGeneracion: r.body.data.codigoGeneracion });
    expect(b[0].datos).toMatchObject({ tipoDte: '01', numeroControl: r.body.data.numeroControl, firmador: 'OK' });
  });
});

describe('01 Factura · variantes', () => {
  test('con receptor, varias líneas y descuento CON IVA: 9.16 → "NUEVE 16/100 USD"', async () => {
    const r = await t.emitir('01', { clienteId: t.cli.juan.id, items: [item('P001', 2), item('P002', 10, 0.5)] });
    expect(r.status).toBe(201);
    expect(r.body.data.total).toBe(9.16);
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte).toCumplirEsquemaMh('01');
    // P2: Juan tiene DUI (13, con guion en el JSON) y dirección con códigos MH de Antiguo Cuscatlán
    expect(d.jsonDte.receptor).toMatchObject({
      nombre: 'Juan Pérez', tipoDocumento: '13', numDocumento: '01234567-8', telefono: '77778888',
      direccion: { departamento: '05', municipio: '26', distrito: '01', complemento: 'Residencial Las Colinas, casa 4' },
    });
    expect(d.jsonDte.resumen).toMatchObject({ totalDescu: 0.5, totalIva: 1.05, totalLetras: 'NUEVE 16/100 USD' });
    expect(d.cliente).toMatchObject({ id: t.cli.juan.id, tipo: 'CONSUMIDOR' });
  });

  test('a crédito (condicionOperacion 2): pagos = null', async () => {
    const r = await t.emitir('01', { condicionOperacion: 2, items: [item('P003', 1)] });
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.resumen).toMatchObject({ condicionOperacion: 2, pagos: null });
    expect(d.jsonDte).toCumplirEsquemaMh('01');
  });

  test('un mismo producto repetido se suma en una línea', async () => {
    const r = await t.emitir('01', { items: [item('P005', 1), item('P005', 2)] });
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte.cuerpoDocumento).toHaveLength(1);
    expect(d.jsonDte.cuerpoDocumento[0].cantidad).toBe(3);
  });

  test('los números de control son consecutivos por tipo', async () => {
    const lista = (await t.admin('get', '/api/dte').query({ tipo: '01' })).body.data;
    const correlativos = lista.map((d) => Number(d.numeroControl.slice(-15))).sort((a, b) => a - b);
    expect(correlativos).toEqual(correlativos.map((_, i) => i + 1));
    lista.forEach((d) => expect(d.numeroControl).toMatch(numeroControlRe('01')));
  });

  test('concurrencia: 8 emisiones en paralelo obtienen 8 números de control distintos', async () => {
    const rs = await Promise.all(Array.from({ length: 8 }, () => t.emitir('01', { items: [item('P002', 1)] })));
    rs.forEach((x) => expect(x.status).toBe(201));
    const numeros = new Set(rs.map((x) => x.body.data.numeroControl));
    const codigos = new Set(rs.map((x) => x.body.data.codigoGeneracion));
    expect(numeros.size).toBe(8);
    expect(codigos.size).toBe(8);
  });
});

describe('01 Factura · errores', () => {
  test('sin items → 400 VALIDACION', async () => {
    const r = await t.emitir('01', { items: [] });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('cantidad 0 o decimal → 400', async () => {
    expect((await t.emitir('01', { items: [item('P001', 0)] })).status).toBe(400);
    expect((await t.emitir('01', { items: [{ productoId: t.prod.P001.id, cantidad: 1.5 }] })).status).toBe(400);
  });

  test('condicionOperacion fuera de 1/2/3 → 400', async () => {
    expect((await t.emitir('01', { condicionOperacion: 4, items: [item('P001', 1)] })).status).toBe(400);
  });

  test('producto inexistente → 404 NO_ENCONTRADO', async () => {
    const r = await t.emitir('01', { items: [{ productoId: 999999, cantidad: 1 }] });
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  test('cliente inexistente → 404', async () => {
    expect((await t.emitir('01', { clienteId: 999999, items: [item('P001', 1)] })).status).toBe(404);
  });

  test('descuento mayor que la línea → 400', async () => {
    expect((await t.emitir('01', { items: [item('P003', 1, 10)] })).status).toBe(400);
  });

  test('stock insuficiente → 409 STOCK_INSUFICIENTE y no consume correlativo ni stock', async () => {
    const antes = (await t.admin('get', '/api/dte').query({ tipo: '01' })).body.data.length;
    const stock = await t.stock('P007');
    const r = await t.emitir('01', { items: [item('P007', stock + 1)] });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('STOCK_INSUFICIENTE');
    expect(await t.stock('P007')).toBe(stock);
    const despues = (await t.admin('get', '/api/dte').query({ tipo: '01' })).body.data.length;
    expect(despues).toBe(antes);
    const sig = await t.emitir('01', { items: [item('P007', 1)] });
    expect(Number(sig.body.data.numeroControl.slice(-15))).toBe(antes + 1);
  });

  test('stock insuficiente se valida también en contingencia y rechazo', async () => {
    for (const modo of ['contingencia', 'rechazo']) {
      const r = await t.emitir('01', { items: [item('P008', 9999)] }, modo);
      expect(r.status).toBe(409);
    }
  });

  test('producto inactivo → 400', async () => {
    await t.admin('put', `/api/productos/${t.prod.P009.id}`).send({ activo: false });
    const r = await t.emitir('01', { items: [item('P009', 1)] });
    expect(r.status).toBe(400);
    await t.admin('put', `/api/productos/${t.prod.P009.id}`).send({ activo: true });
  });

  test('sin token → 401', async () => {
    const r = await t.request(t.app).post('/api/dte/01').send({ items: [item('P001', 1)] });
    expect(r.status).toBe(401);
  });
});
