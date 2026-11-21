/** Productos, clientes y emisor: CRUD, roles, validaciones y normalización. */
require('../helpers/schemas');
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

  const DIR = { departamento: '06', municipio: '23', distrito: '14', complemento: 'Col. Escalón #1' };

  test('NIT/NRC con guiones se guardan solo con dígitos (201)', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONTRIBUYENTE', nombre: 'Cliente QA', nit: '0614-230100-123-5', nrc: '765-4', codActividad: '46900', descActividad: 'Venta',
      direccion: DIR,
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ nit: '06142301001235', nrc: '7654', activo: true, tipoDocumento: '36', numDocumento: '06142301001235' });
  });

  test('CONSUMIDOR solo requiere nombre', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Ana QA' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ direccion: null, tipoDocumento: null, numDocumento: null });
  });

  test('P2: guarda todos los datos del receptor con códigos MH', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONTRIBUYENTE', nombre: 'Completo QA', nombreComercial: 'Completo', nit: '06142301001236', nrc: '1111',
      codActividad: '46900', descActividad: 'Venta', telefono: '2222-1111', correo: 'qa@correo.com', direccion: DIR,
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ nombreComercial: 'Completo', telefono: '2222-1111', direccion: DIR });
    const g = await t.admin('get', `/api/clientes/${r.body.data.id}`);
    expect(g.body.data.direccion).toEqual(DIR);
  });

  test('P2: CONSUMIDOR con DUI (tipoDocumento 13) y dirección opcional', async () => {
    const r = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONSUMIDOR', nombre: 'DUI QA', tipoDocumento: '13', numDocumento: '01234567-8',
      direccion: { departamento: '05', municipio: '28', distrito: '10', complemento: 'Santa Tecla' },
    });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ tipoDocumento: '13', numDocumento: '012345678', nit: null });
  });

  test.each([
    [{ ...DIR, departamento: '99' }, /departamento/],
    [{ ...DIR, municipio: '05' }, /no pertenece al departamento/],
    [{ ...DIR, distrito: '01' }, /no pertenece al municipio/], // Aguilares es de San Salvador Norte, no Centro
    [{ ...DIR, complemento: '' }, /complemento/],
    ['Col. Escalón', /objeto/],
  ])('P2: dirección inválida %p → 400', async (direccion, msg) => {
    const r = await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Dir QA', direccion });
    expect(r.status).toBe(400);
    expect(r.body.error.mensaje).toMatch(msg);
  });

  test('P2: CONTRIBUYENTE sin dirección → 400; tipoDocumento fuera del CAT-022 → 400', async () => {
    const a = await t.vendedor('post', '/api/clientes').send({
      tipo: 'CONTRIBUYENTE', nombre: 'Sin dir', nit: '06142301001237', nrc: '1', codActividad: '46900', descActividad: 'x',
    });
    expect(a.status).toBe(400);
    expect(a.body.error.mensaje).toMatch(/direccion/);
    const b = await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Doc', tipoDocumento: '99', numDocumento: '1' });
    expect(b.status).toBe(400);
  });

  test('P2: GET /api/catalogos → departamentos/municipios/distritos y tipos de documento', async () => {
    const r = await t.vendedor('get', '/api/catalogos');
    expect(r.status).toBe(200);
    const deps = r.body.data.departamentos;
    expect(deps).toHaveLength(14);
    expect(deps.flatMap((d) => d.municipios)).toHaveLength(44);
    expect(deps.flatMap((d) => d.municipios.flatMap((m) => m.distritos))).toHaveLength(262);
    const ss = deps.find((d) => d.codigo === '06').municipios.find((m) => m.codigo === '23');
    expect(ss.nombre).toBe('San Salvador Centro');
    expect(ss.distritos).toContainEqual({ codigo: '14', nombre: 'San Salvador' });
    expect(r.body.data.tiposDocumento.map((x) => x.codigo)).toEqual(expect.arrayContaining(['36', '13']));
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

describe('Clientes · edición (KAN-34)', () => {
  const DIR_SS = { departamento: '06', municipio: '23', distrito: '14', complemento: 'Col. Escalón #10' };
  const DIR_ST = { departamento: '05', municipio: '28', distrito: '10', complemento: 'Santa Tecla, calle 5' };
  /** Cuerpo completo, tal como lo manda el formulario de la UI al editar un contribuyente. */
  const formContrib = (cambios = {}) => ({
    tipo: 'CONTRIBUYENTE', nombre: 'Editable QA, S.A. de C.V.', nombreComercial: 'Editable', tipoDocumento: null, numDocumento: null,
    nit: '06142301001240', nrc: '2222', codActividad: '46900', descActividad: 'Venta al por mayor',
    telefono: '2222-3333', correo: 'editable@correo.com', direccion: DIR_SS, ...cambios,
  });

  let contrib;
  let consumidor;
  beforeAll(async () => {
    contrib = (await t.vendedor('post', '/api/clientes').send(formContrib())).body.data;
    consumidor = (await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Consumidor Edit QA' })).body.data;
  });

  test('registro de consumidor final y de contribuyente (201)', () => {
    expect(consumidor).toMatchObject({ tipo: 'CONSUMIDOR', nombre: 'Consumidor Edit QA', direccion: null });
    expect(contrib).toMatchObject({ tipo: 'CONTRIBUYENTE', nit: '06142301001240', nrc: '2222', tipoDocumento: '36', direccion: DIR_SS });
  });

  test('VENDEDOR edita un contribuyente: datos fiscales, contacto y dirección (200) y queda en bitácora', async () => {
    const r = await t.vendedor('put', `/api/clientes/${contrib.id}`).send(formContrib({
      nombre: 'Editable QA Renombrada', nombreComercial: 'Editable 2', nit: '0614-230100-124-1', nrc: '333-3',
      codActividad: '47190', descActividad: 'Venta al por menor', telefono: '2222-4444', correo: 'nuevo@correo.com', direccion: DIR_ST,
    }));
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({
      id: contrib.id, nombre: 'Editable QA Renombrada', nombreComercial: 'Editable 2', nit: '06142301001241', numDocumento: '06142301001241',
      nrc: '3333', codActividad: '47190', telefono: '2222-4444', correo: 'nuevo@correo.com', direccion: DIR_ST, activo: true,
    });
    const b = await t.bitacora({ accion: 'ACTUALIZAR', entidad: 'cliente' });
    expect(b.some((x) => x.entidadId === contrib.id && x.usuario === 'vendedor')).toBe(true);
  });

  test('consulta del cliente actualizado: GET /:id y búsqueda por el nuevo NIT', async () => {
    const g = await t.vendedor('get', `/api/clientes/${contrib.id}`);
    expect(g.body.data).toMatchObject({ nombre: 'Editable QA Renombrada', nrc: '3333', direccion: DIR_ST });
    const l = await t.vendedor('get', '/api/clientes').query({ q: '06142301001241' });
    expect(l.body.data.map((c) => c.id)).toEqual([contrib.id]);
  });

  test('consumidor: agregar DUI y dirección; luego quitarlos (null)', async () => {
    const a = await t.vendedor('put', `/api/clientes/${consumidor.id}`).send({ tipoDocumento: '13', numDocumento: '04567890-1', direccion: DIR_SS });
    expect(a.status).toBe(200);
    expect(a.body.data).toMatchObject({ tipoDocumento: '13', numDocumento: '045678901', nit: null, direccion: DIR_SS });
    const b = await t.vendedor('put', `/api/clientes/${consumidor.id}`).send({ tipoDocumento: null, numDocumento: null, direccion: null });
    expect(b.body.data).toMatchObject({ tipoDocumento: null, numDocumento: null, direccion: null });
  });

  test('consumidor → contribuyente: exige los datos fiscales; con ellos pasa a documento NIT', async () => {
    const sin = await t.vendedor('put', `/api/clientes/${consumidor.id}`).send({ tipo: 'CONTRIBUYENTE' });
    expect(sin.status).toBe(400);
    const con = await t.vendedor('put', `/api/clientes/${consumidor.id}`).send(formContrib({ nombre: 'Consumidor Edit QA', nit: '06142301001242' }));
    expect(con.status).toBe(200);
    expect(con.body.data).toMatchObject({ tipo: 'CONTRIBUYENTE', tipoDocumento: '36', numDocumento: '06142301001242' });
  });

  test.each([
    ['NIT con 10 dígitos', { nit: '0614230100' }, /nit/],
    ['NRC con letras', { nrc: '12A' }, /nrc/],
    ['NRC de 9 dígitos', { nrc: '123456789' }, /nrc/],
    ['actividad de 3 dígitos', { codActividad: '469' }, /codActividad/],
    ['sin descripción de actividad', { descActividad: '' }, /descActividad/],
    ['sin dirección', { direccion: null }, /direccion/],
    ['municipio de otro departamento', { direccion: { ...DIR_SS, municipio: '05' } }, /no pertenece al departamento/],
    ['correo inválido', { correo: 'sin-arroba' }, /correo/],
  ])('rechaza datos inválidos al editar (%s) → 400 VALIDACION y no cambia nada', async (_, cambios, msg) => {
    const r = await t.vendedor('put', `/api/clientes/${contrib.id}`).send(formContrib({ nombre: 'NO DEBE GUARDARSE', ...cambios }));
    expect(r.status).toBe(400);
    expect(r.body).toMatchObject({ ok: false, error: { codigo: 'VALIDACION', mensaje: expect.stringMatching(msg) } });
    const g = await t.vendedor('get', `/api/clientes/${contrib.id}`);
    expect(g.body.data).toMatchObject({ nombre: 'Editable QA Renombrada', nit: '06142301001241', nrc: '3333', direccion: DIR_ST });
  });

  test('consumidor: tipo de documento fuera del CAT-022 o DUI mal formado → 400', async () => {
    const otro = (await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Doc QA' })).body.data;
    expect((await t.vendedor('put', `/api/clientes/${otro.id}`).send({ tipoDocumento: '99', numDocumento: '1' })).status).toBe(400);
    expect((await t.vendedor('put', `/api/clientes/${otro.id}`).send({ tipoDocumento: '13', numDocumento: '1234' })).status).toBe(400);
    expect((await t.vendedor('put', `/api/clientes/${otro.id}`).send({ tipoDocumento: '13', numDocumento: null })).status).toBe(400);
  });

  test('PUT a un cliente inexistente → 404', async () => {
    expect((await t.vendedor('put', '/api/clientes/999999').send({ nombre: 'x' })).status).toBe(404);
  });

  test('el cliente editado se asocia a una venta: el CCF lleva los datos nuevos en el receptor', async () => {
    const prod = t.prod.P001.id;
    const r = await t.emitir('03', { clienteId: contrib.id, items: [{ productoId: prod, cantidad: 1 }] }, undefined, t.vendedor);
    expect(r.status).toBe(201);
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte).toCumplirEsquemaMh('03');
    expect(d.jsonDte.receptor).toMatchObject({
      nit: '06142301001241', nrc: '3333', codActividad: '47190', descActividad: 'Venta al por menor',
      nombre: 'Editable QA Renombrada', nombreComercial: 'Editable 2', correo: 'nuevo@correo.com', direccion: DIR_ST,
    });
    expect(d.cliente).toMatchObject({ id: contrib.id, tipo: 'CONTRIBUYENTE' });
  });

  test('un consumidor editado (DUI) aparece como receptor de la Factura 01', async () => {
    const c = (await t.vendedor('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Factura QA' })).body.data;
    await t.vendedor('put', `/api/clientes/${c.id}`).send({ nombre: 'Factura QA Editado', tipoDocumento: '13', numDocumento: '01234567-8', direccion: DIR_SS });
    const r = await t.emitir('01', { clienteId: c.id, items: [{ productoId: t.prod.P002.id, cantidad: 1 }] });
    expect(r.status).toBe(201);
    const d = await t.detalle(r.body.data.id);
    expect(d.jsonDte).toCumplirEsquemaMh('01');
    expect(d.jsonDte.receptor).toMatchObject({ nombre: 'Factura QA Editado', tipoDocumento: '13', numDocumento: '01234567-8', direccion: DIR_SS });
  });
});

describe('Emisor', () => {
  test('GET /api/emisor devuelve los datos del seed con M001/P001', async () => {
    const r = await t.vendedor('get', '/api/emisor');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ nit: '06140101001010', nrc: '100001', codEstable: 'M001', codPuntoVenta: 'P001' });
    expect(r.body.data.direccion).toMatchObject({ departamento: '06', municipio: '23', distrito: '14' });
  });
});
