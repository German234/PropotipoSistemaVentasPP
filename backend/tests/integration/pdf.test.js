/** GET /api/dte/:id/pdf — representación gráfica del DTE. */
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
const ids = {};
const OUT = process.env.PDF_OUT; // opcional: carpeta donde guardar los PDF generados para revisarlos

/** supertest no junta binarios por defecto: los leemos como Buffer. */
const binario = (req) =>
  req.buffer(true).parse((res, cb) => {
    const partes = [];
    res.on('data', (c) => partes.push(c));
    res.on('end', () => cb(null, Buffer.concat(partes)));
  });

beforeAll(async () => {
  t = await prepararApi();
  const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
  ids.f1 = (await t.emitir('01', { items: [linea('P001', 2), linea('P002', 1)] })).body.data.id;
  ids.f2 = (await t.emitir('01', { items: [linea('P003', 1)] }, 'contingencia')).body.data.id;
  ids.c1 = (await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P001', 5)] })).body.data.id;
  ids.n1 = (await t.emitir('05', { dteRelacionadoId: ids.c1, items: [linea('P001', 2)] })).body.data.id;
});
afterAll(cerrarBd);

describe('GET /api/dte/:id/pdf', () => {
  test.each(['f1', 'f2', 'c1', 'n1'])('%s → application/pdf descargable', async (k) => {
    const r = await binario(t.vendedor('get', `/api/dte/${ids[k]}/pdf`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/application\/pdf/);
    expect(r.headers['content-disposition']).toMatch(/attachment; filename="DTE-\d{2}-.+\.pdf"/);
    expect(r.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect(r.body.length).toBeGreaterThan(3000);
    if (OUT) require('fs').writeFileSync(require('path').join(OUT, `${k}.pdf`), r.body);
  });

  test('sin token → 401', async () => {
    const r = await require('supertest')(require('../../src/app')).get(`/api/dte/${ids.f1}/pdf`);
    expect(r.status).toBe(401);
  });

  test('inexistente → 404 JSON estándar', async () => {
    const r = await t.admin('get', '/api/dte/999999/pdf');
    expect(r.status).toBe(404);
    expect(r.body).toEqual({ ok: false, error: expect.objectContaining({ codigo: 'NO_ENCONTRADO' }) });
  });
});
