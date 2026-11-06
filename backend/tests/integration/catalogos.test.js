/** Productos, clientes y emisor: CRUD, roles, validaciones y normalización. */
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

describe('Productos', () => {
  test('GET lista los 10 productos del seed con la forma del contrato', async () => {
    const r = await t.vendedor('get', '/api/productos');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(10);
    expect(r.body.data[0]).toEqual({
      id: expect.any(Number), codigo: 'P001', descripcion: expect.any(String), precio: 2.5, stock: 100, unidad: 59, activo: true,
    });
  });

  test('?q busca por código o descripción', async () => {
    const r = await t.admin('get', '/api/productos').query({ q: 'mochila' });
    expect(r.body.data.map((p) => p.codigo)).toEqual(['P008']);
  });

  test('ADMIN crea (201) y el precio se redondea a 2 decimales', async () => {
    const r = await t.admin('post', '/api/productos').send({ codigo: 'T001', descripcion: 'Regla 30 cm', precio: 1.005, stock: 10 });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ codigo: 'T001', precio: 1.01, stock: 10, unidad: 59, activo: true });
  });

  test('código repetido → 400 VALIDACION', async () => {
    const r = await t.admin('post', '/api/productos').send({ codigo: 'P001', descripcion: 'x', precio: 1, stock: 1 });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('precio negativo → 400 VALIDACION', async () => {
    const r = await t.admin('post', '/api/productos').send({ codigo: 'T002', descripcion: 'x', precio: -1, stock: 1 });
    expect(r.status).toBe(400);
  });

  test('VENDEDOR no puede crear ni editar → 403 SIN_PERMISO', async () => {
    const c = await t.vendedor('post', '/api/productos').send({ codigo: 'T003', descripcion: 'x', precio: 1, stock: 1 });
    expect(c.status).toBe(403);
    expect(c.body.error.codigo).toBe('SIN_PERMISO');
    const u = await t.vendedor('put', `/api/productos/${t.prod.P001.id}`).send({ precio: 1 });
    expect(u.status).toBe(403);
  });

  test('PUT parcial y borrado lógico: inactivo no aparece por defecto', async () => {
    const id = t.prod.P010.id;
    const u = await t.admin('put', `/api/productos/${id}`).send({ activo: false });
    expect(u.status).toBe(200);
    expect(u.body.data).toMatchObject({ codigo: 'P010', precio: 6.9, activo: false });
    const lista = (await t.admin('get', '/api/productos')).body.data;
    expect(lista.find((p) => p.id === id)).toBeUndefined();
    const todos = (await t.admin('get', '/api/productos').query({ incluirInactivos: 1 })).body.data;
    expect(todos.find((p) => p.id === id)).toBeDefined();
  });

  test('GET /:id inexistente → 404', async () => {
    const r = await t.admin('get', '/api/productos/999999');
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
  });
});

describe('Clientes', () => {
  test('CONTRIBUYENTE exige NIT, NRC y actividad → 400', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({ tipo: 'CONTRIBUYENTE', nombre: 'Sin NRC', nit: '06142301001234' });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('VALIDACION');
  });

  test('NIT con formato inválido → 400', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONTRIBUYENTE', nombre: 'NIT corto', nit: '123', nrc: '1', codActividad: '46900', descActividad: 'x',
    });
    expect(r.status).toBe(400);
  });

  test('NIT/NRC con guiones se guardan solo con dígitos (201)', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONTRIBUYENTE', nombre: 'Cliente QA', nit: '0614-230100-123-5', nrc: '765-4', codActividad: '46900', descActividad: 'Venta',
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ nit: '06142301001235', nrc: '7654', activo: true });
  });

  test('CONSUMIDOR solo requiere nombre', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Ana QA' });
    expect(r.status).toBe(201);
  });

  test('?tipo filtra por tipo', async () => {
    const r = await t.admin('get', '/api/clientes').query({ tipo: 'CONTRIBUYENTE' });
    expect(r.body.data.length).toBeGreaterThanOrEqual(2);
    expect(r.body.data.every((c) => c.tipo === 'CONTRIBUYENTE')).toBe(true);
  });

  test('PUT revalida el registro completo: quitar el NRC a un CONTRIBUYENTE → 400', async () => {
    const r = await t.admin('put', `/api/clientes/${t.cli.libreria.id}`).send({ nrc: null });
    expect(r.status).toBe(400);
  });
});

describe('Emisor', () => {
  test('GET /api/emisor devuelve los datos del seed con M001/P001', async () => {
    const r = await t.vendedor('get', '/api/emisor');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ nit: '06140101001010', nrc: '100001', codEstable: 'M001', codPuntoVenta: 'P001' });
    expect(r.body.data.direccion).toMatchObject({ departamento: '06', municipio: '14' });
  });
});
