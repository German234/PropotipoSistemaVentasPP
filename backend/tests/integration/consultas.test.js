/** GET /api/dte (filtros), GET /api/dte/:id y GET /api/bitacora. */
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
const ids = {};
const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeAll(async () => {
  t = await prepararApi();
  const linea = (codigo, cantidad) => ({ productoId: t.prod[codigo].id, cantidad });
  ids.f1 = (await t.emitir('01', { items: [linea('P001', 1)] })).body.data.id;
  ids.f2 = (await t.emitir('01', { clienteId: t.cli.juan.id, items: [linea('P002', 1)] }, 'rechazo')).body.data.id;
  ids.f3 = (await t.emitir('01', { items: [linea('P003', 1)] }, 'contingencia')).body.data.id;
  ids.c1 = (await t.emitir('03', { clienteId: t.cli.roble.id, items: [linea('P001', 10)] })).body.data.id;
  ids.n1 = (await t.emitir('05', { dteRelacionadoId: ids.c1, items: [linea('P001', 2)] })).body.data.id;
  await t.invalidar(ids.f1, { motivo: 'Consulta' });
});
afterAll(cerrarBd);

describe('GET /api/dte', () => {
  test('lista todos, el más reciente primero, con la forma del contrato', async () => {
    const r = await t.vendedor('get', '/api/dte');
    expect(r.status).toBe(200);
    expect(r.body.data.map((d) => d.id)).toEqual([ids.n1, ids.c1, ids.f3, ids.f2, ids.f1]);
    expect(Object.keys(r.body.data[0]).sort()).toEqual([
      'clienteId', 'codigoGeneracion', 'dteRelacionadoId', 'estado', 'fechaEmision', 'id', 'numeroControl', 'receptor',
      'selloRecibido', 'tipoDte', 'total',
    ]);
    expect(r.body.data.find((d) => d.id === ids.f3).receptor).toBe('Consumidor final');
    expect(r.body.data.find((d) => d.id === ids.n1).dteRelacionadoId).toBe(ids.c1);
  });

  test.each([
    [{ tipo: '01' }, () => [ids.f3, ids.f2, ids.f1]],
    [{ tipo: '05' }, () => [ids.n1]],
    [{ estado: 'INVALIDADO' }, () => [ids.f1]],
    [{ estado: 'RECHAZADO' }, () => [ids.f2]],
    [{ estado: 'CONTINGENCIA' }, () => [ids.f3]],
    [{ tipo: '03', estado: 'PROCESADO' }, () => [ids.c1]],
  ])('filtro %p', async (query, esperado) => {
    const r = await t.admin('get', '/api/dte').query(query);
    expect(r.body.data.map((d) => d.id)).toEqual(esperado());
  });

  test('filtro clienteId', async () => {
    const r = await t.admin('get', '/api/dte').query({ clienteId: t.cli.roble.id });
    expect(r.body.data.map((d) => d.id).sort()).toEqual([ids.c1, ids.n1].sort());
  });

  test('filtro de fechas inclusivo (hoy) y fuera de rango', async () => {
    expect((await t.admin('get', '/api/dte').query({ desde: hoy(), hasta: hoy() })).body.data).toHaveLength(5);
    expect((await t.admin('get', '/api/dte').query({ hasta: '2000-01-01' })).body.data).toHaveLength(0);
  });

  test.each([{ tipo: '99' }, { estado: 'BORRADO' }, { desde: '04/11/2026' }])('filtro inválido %p → 400', async (query) => {
    const r = await t.admin('get', '/api/dte').query(query);
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });
});

describe('GET /api/dte/:id', () => {
  test('detalle con jsonDte, items, firmador/respuestaMh parseados y usuario', async () => {
    const d = await t.detalle(ids.c1);
    expect(d).toMatchObject({ id: ids.c1, tipoDte: '03', estado: 'PROCESADO', usuario: 'admin', condicionOperacion: 1 });
    expect(typeof d.firmador).toBe('object');
    expect(typeof d.respuestaMh).toBe('object');
    expect(d.cliente).toMatchObject({ id: t.cli.roble.id, tipo: 'CONTRIBUYENTE' });
    expect(d.items[0]).toMatchObject({ codigo: 'P001', cantidad: 10, acreditada: 2, pendiente: 8 });
    expect(d.notasCredito).toHaveLength(1);
    expect(d.invalidacion).toBeNull();
  });

  test('inexistente → 404; id inválido → 400', async () => {
    expect((await t.admin('get', '/api/dte/999999')).status).toBe(404);
    expect((await t.admin('get', '/api/dte/abc')).status).toBe(400);
  });
});

describe('GET /api/bitacora', () => {
  test('registra cada operación con la acción y el resultado', async () => {
    const b = await t.bitacora({});
    const acciones = new Set(b.map((x) => x.accion));
    ['LOGIN', 'EMISION', 'INVALIDACION'].forEach((a) => expect(acciones).toContain(a));
    const emisiones = b.filter((x) => x.accion === 'EMISION').map((x) => x.resultado).sort();
    expect(emisiones).toEqual(['CONTINGENCIA', 'PROCESADO', 'PROCESADO', 'PROCESADO', 'RECHAZADO']);
  });

  test('filtros accion, usuario, dteId y limite', async () => {
    expect((await t.bitacora({ accion: 'LOGIN', usuario: 'vendedor' })).every((x) => x.usuario === 'vendedor' && x.accion === 'LOGIN')).toBe(true);
    const porDte = await t.bitacora({ dteId: ids.f1 });
    expect(porDte.map((x) => x.accion).sort()).toEqual(['EMISION', 'INVALIDACION']);
    expect(await t.bitacora({ limite: 2 })).toHaveLength(2);
  });

  test('limite fuera de 1–1000 → 400', async () => {
    expect((await t.admin('get', '/api/bitacora').query({ limite: 5000 })).status).toBe(400);
  });
});
