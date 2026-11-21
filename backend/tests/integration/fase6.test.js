/**
 * Fase 6: funcionalidades que antes eran maqueta en la UI.
 *   - /api/usuarios (CRUD, solo ADMIN) · /api/borradores (por usuario) · /api/reportes/resumen (solo ADMIN)
 *   - POST /api/dte/:id/correo: envío SIMULADO (solo bitácora; nunca dice que se envió)
 *   - GET /api/dte agrega `usuario`
 */
const { prepararApi, cerrarBd } = require('../helpers/api');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('Usuarios (solo ADMIN)', () => {
  let nuevo;

  test('lista los usuarios del seed sin exponer el hash', async () => {
    const r = await t.admin('get', '/api/usuarios');
    expect(r.status).toBe(200);
    expect(r.body.data.map((u) => u.usuario)).toEqual(['admin', 'vendedor']);
    expect(r.body.data[0]).toEqual({ id: expect.any(Number), usuario: 'admin', nombre: 'Administrador', rol: 'ADMIN', activo: true, creadoEn: expect.any(String) });
    expect(JSON.stringify(r.body)).not.toMatch(/password|hash/i);
  });

  test('crea un usuario que puede iniciar sesión; bitácora sin la contraseña', async () => {
    const r = await t.admin('post', '/api/usuarios').send({ usuario: 'cajero1', nombre: ' Cajero Uno ', rol: 'VENDEDOR', password: 'cajero1234' });
    expect(r.status).toBe(201);
    nuevo = r.body.data;
    expect(nuevo).toMatchObject({ usuario: 'cajero1', nombre: 'Cajero Uno', rol: 'VENDEDOR', activo: true });
    const login = await t.request(t.app).post('/api/auth/login').send({ usuario: 'cajero1', password: 'cajero1234' });
    expect(login.status).toBe(200);
    expect(login.body.data.usuario.rol).toBe('VENDEDOR');
    const [b] = await t.bitacora({ accion: 'CREAR', entidad: 'usuario' });
    expect(b.entidadId).toBe(nuevo.id);
    expect(JSON.stringify(b.datos)).not.toMatch(/cajero1234/);
  });

  test.each([
    [{ usuario: 'ab', nombre: 'X', rol: 'VENDEDOR', password: '12345678' }, /usuario/],
    [{ usuario: 'con espacio', nombre: 'X', rol: 'VENDEDOR', password: '12345678' }, /usuario/],
    [{ usuario: 'okuser', nombre: '', rol: 'VENDEDOR', password: '12345678' }, /nombre/],
    [{ usuario: 'okuser', nombre: 'X', rol: 'GERENTE', password: '12345678' }, /rol/],
    [{ usuario: 'okuser', nombre: 'X', rol: 'VENDEDOR', password: 'corta' }, /password/],
    [{ usuario: 'cajero1', nombre: 'X', rol: 'VENDEDOR', password: '12345678' }, /Ya existe/],
  ])('crear inválido %# → 400', async (body, msg) => {
    const r = await t.admin('post', '/api/usuarios').send(body);
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ codigo: 'VALIDACION', mensaje: expect.stringMatching(msg) });
  });

  test('edita nombre y rol; el login no se puede cambiar', async () => {
    const r = await t.admin('put', `/api/usuarios/${nuevo.id}`).send({ nombre: 'Cajera Uno', rol: 'ADMIN' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ nombre: 'Cajera Uno', rol: 'ADMIN' });
    const x = await t.admin('put', `/api/usuarios/${nuevo.id}`).send({ usuario: 'otro' });
    expect(x.status).toBe(400);
  });

  test('cambio de contraseña: la vieja deja de servir', async () => {
    expect((await t.admin('put', `/api/usuarios/${nuevo.id}`).send({ password: 'nuevaClave99' })).status).toBe(200);
    const login = (password) => t.request(t.app).post('/api/auth/login').send({ usuario: 'cajero1', password });
    expect((await login('cajero1234')).status).toBe(401);
    expect((await login('nuevaClave99')).status).toBe(200);
    const [b] = await t.bitacora({ accion: 'ACTUALIZAR', entidad: 'usuario' });
    expect(b.datos.cambios.password).toBe('(cambiada)');
  });

  test('desactivado: no inicia sesión ni aparece en la lista por defecto', async () => {
    expect((await t.admin('put', `/api/usuarios/${nuevo.id}`).send({ activo: false })).status).toBe(200);
    expect((await t.request(t.app).post('/api/auth/login').send({ usuario: 'cajero1', password: 'nuevaClave99' })).status).toBe(401);
    expect((await t.admin('get', '/api/usuarios')).body.data.some((u) => u.id === nuevo.id)).toBe(false);
    expect((await t.admin('get', '/api/usuarios?incluirInactivos=1')).body.data.find((u) => u.id === nuevo.id).activo).toBe(false);
  });

  test('nadie se desactiva ni se quita el rol ADMIN a sí mismo', async () => {
    const yo = (await t.admin('get', '/api/auth/sesion')).body.data.usuario.id;
    expect((await t.admin('put', `/api/usuarios/${yo}`).send({ activo: false })).body.error.mensaje).toMatch(/propio/);
    expect((await t.admin('put', `/api/usuarios/${yo}`).send({ rol: 'VENDEDOR' })).body.error.mensaje).toMatch(/ADMIN/);
  });

  test('no se puede dejar el sistema sin ADMIN activo (409)', async () => {
    // segundo ADMIN que intenta degradar al único otro ADMIN activo (admin) después de desactivarse cajero1
    const r2 = await t.admin('post', '/api/usuarios').send({ usuario: 'jefe2', nombre: 'Jefe Dos', rol: 'ADMIN', password: 'jefedos123' });
    const tok = (await t.request(t.app).post('/api/auth/login').send({ usuario: 'jefe2', password: 'jefedos123' })).body.data.token;
    const comoJefe = (m, u) => t.request(t.app)[m](u).set('Authorization', `Bearer ${tok}`);
    const adminId = (await t.admin('get', '/api/usuarios')).body.data.find((u) => u.usuario === 'admin').id;
    // con dos ADMIN activos sí se puede degradar a uno
    expect((await comoJefe('put', `/api/usuarios/${adminId}`).send({ rol: 'VENDEDOR' })).status).toBe(200);
    // ahora jefe2 es el único ADMIN activo: admin (ya VENDEDOR) lo intentaría con su token viejo, que aún dice ADMIN
    const r = await t.admin('put', `/api/usuarios/${r2.body.data.id}`).send({ activo: false });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
    // se restaura admin
    expect((await comoJefe('put', `/api/usuarios/${adminId}`).send({ rol: 'ADMIN' })).status).toBe(200);
  });

  test('404 y VENDEDOR 403', async () => {
    expect((await t.admin('get', '/api/usuarios/999999')).status).toBe(404);
    expect((await t.vendedor('get', '/api/usuarios')).status).toBe(403);
  });
});

describe('Borradores (por usuario)', () => {
  let b;

  test('crea con total estimado (01: precio con IVA) y suma líneas repetidas', async () => {
    const r = await t.vendedor('post', '/api/borradores').send({
      tipoDte: '01', items: [{ productoId: t.prod.P001.id, cantidad: 1 }, { productoId: t.prod.P001.id, cantidad: 1 }],
    });
    expect(r.status).toBe(201);
    b = r.body.data;
    expect(b).toMatchObject({ tipoDte: '01', clienteId: null, cliente: null, usuario: 'vendedor', totalEstimado: 5.66 });
    expect(b.items).toEqual([expect.objectContaining({ productoId: t.prod.P001.id, cantidad: 2, codigo: 'P001', disponible: true })]);
  });

  test('actualiza a CCF con cliente: total sin IVA + 13 %', async () => {
    const r = await t.vendedor('put', `/api/borradores/${b.id}`).send({
      tipoDte: '03', clienteId: t.cli.roble.id, items: [{ productoId: t.prod.P001.id, cantidad: 40 }],
    });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ tipoDte: '03', cliente: { id: t.cli.roble.id, tipo: 'CONTRIBUYENTE' }, totalEstimado: 113 });
  });

  test('cada usuario ve solo los suyos (el de otro → 404)', async () => {
    expect((await t.vendedor('get', '/api/borradores')).body.data.map((x) => x.id)).toEqual([b.id]);
    expect((await t.admin('get', '/api/borradores')).body.data).toEqual([]);
    expect((await t.admin('get', `/api/borradores/${b.id}`)).status).toBe(404);
    expect((await t.admin('delete', `/api/borradores/${b.id}`)).status).toBe(404);
  });

  test.each([
    [{ tipoDte: '05', items: [{ productoId: 1, cantidad: 1 }] }, 400],
    [{ tipoDte: '01', items: [] }, 400],
    [{ tipoDte: '01', items: [{ productoId: 1, cantidad: 0 }] }, 400],
    [{ tipoDte: '01', items: [{ productoId: 999999, cantidad: 1 }] }, 404],
    [{ tipoDte: '01', clienteId: 999999, items: [{ productoId: 1, cantidad: 1 }] }, 404],
  ])('inválido %# → %i', async (body, status) => {
    expect((await t.vendedor('post', '/api/borradores').send(body)).status).toBe(status);
  });

  test('un producto desactivado después queda no disponible y fuera del estimado', async () => {
    const p = (await t.admin('post', '/api/productos').send({ codigo: 'BORR1', descripcion: 'Temporal', precio: 10, stock: 5 })).body.data;
    const r = await t.vendedor('post', '/api/borradores').send({ tipoDte: '03', items: [{ productoId: p.id, cantidad: 1 }, { productoId: t.prod.P002.id, cantidad: 2 }] });
    expect(r.body.data.totalEstimado).toBe(12.09); // (10 + 0.70) × 1.13 → 10.70 + 1.39
    await t.admin('put', `/api/productos/${p.id}`).send({ activo: false });
    const x = (await t.vendedor('get', `/api/borradores/${r.body.data.id}`)).body.data;
    expect(x.items.find((i) => i.productoId === p.id).disponible).toBe(false);
    expect(x.totalEstimado).toBe(0.79); // solo 2 × 0.35 + IVA
  });

  test('eliminar; bitácora CREAR/ACTUALIZAR/ELIMINAR', async () => {
    const r = await t.vendedor('delete', `/api/borradores/${b.id}`);
    expect(r.body).toEqual({ ok: true, data: { id: b.id, eliminado: true } });
    expect((await t.vendedor('get', `/api/borradores/${b.id}`)).status).toBe(404);
    const acciones = (await t.bitacora({ entidad: 'borrador' })).map((x) => x.accion);
    expect(acciones).toEqual(expect.arrayContaining(['CREAR', 'ACTUALIZAR', 'ELIMINAR']));
  });
});

describe('Correo (envío SIMULADO)', () => {
  let dte;
  beforeAll(async () => {
    dte = (await t.emitir('01', { items: [{ productoId: t.prod.P001.id, cantidad: 1 }] })).body.data;
  });

  test('responde enviado:false / simulado:true y deja constancia en bitácora', async () => {
    const r = await t.vendedor('post', `/api/dte/${dte.id}/correo`).send({ correo: 'cliente@correo.com' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ dteId: dte.id, numeroControl: dte.numeroControl, correo: 'cliente@correo.com', enviado: false, simulado: true });
    expect(r.body.data.mensaje).toMatch(/no se envió ningún correo/);
    const [b] = await t.bitacora({ accion: 'CORREO_SIMULADO' });
    expect(b).toMatchObject({ dteId: dte.id, usuario: 'vendedor', resultado: 'SIMULADO', codigoGeneracion: dte.codigoGeneracion });
  });

  test('correo inválido 400, DTE inexistente 404, rechazado 409', async () => {
    expect((await t.admin('post', `/api/dte/${dte.id}/correo`).send({ correo: 'no-es-correo' })).status).toBe(400);
    expect((await t.admin('post', `/api/dte/${dte.id}/correo`).send({})).status).toBe(400);
    expect((await t.admin('post', '/api/dte/999999/correo').send({ correo: 'a@b.com' })).status).toBe(404);
    const rech = (await t.emitir('01', { items: [{ productoId: t.prod.P001.id, cantidad: 1 }] }, 'rechazo')).body.data;
    const r = await t.admin('post', `/api/dte/${rech.id}/correo`).send({ correo: 'a@b.com' });
    expect(r.status).toBe(409);
    expect(r.body.error.codigo).toBe('ESTADO_INVALIDO');
  });
});

describe('Reportes gerenciales (solo ADMIN)', () => {
  test('GET /api/dte incluye el usuario que emitió', async () => {
    const [d] = (await t.admin('get', '/api/dte')).body.data;
    expect(d.usuario).toEqual(expect.any(String));
  });

  test('totales coherentes con los DTE del período', async () => {
    const r = await t.admin('get', '/api/reportes/resumen').query({ desde: hoy(), hasta: hoy() });
    expect(r.status).toBe(200);
    const dtes = (await t.admin('get', '/api/dte').query({ desde: hoy(), hasta: hoy() })).body.data;
    const vig = dtes.filter((d) => ['PROCESADO', 'CONTINGENCIA'].includes(d.estado));
    const suma = (arr) => Math.round(arr.reduce((a, d) => a + d.total * 100, 0)) / 100;
    const ventas = vig.filter((d) => d.tipoDte !== '05');
    const { totales, porDia, porTipo, porVendedor, porEstado, periodo } = r.body.data;
    expect(periodo).toEqual({ desde: hoy(), hasta: hoy(), tipo: null });
    expect(totales.ventasBrutas).toBe(suma(ventas));
    expect(totales.documentos).toBe(ventas.length);
    expect(totales.notasCredito).toBe(suma(vig.filter((d) => d.tipoDte === '05')));
    expect(porEstado.RECHAZADO).toBe(dtes.filter((d) => d.estado === 'RECHAZADO').length);
    expect(porDia).toEqual([{ fecha: hoy(), documentos: ventas.length, total: suma(ventas) }]);
    expect(porTipo.map((x) => x.tipoDte)).toEqual(['01', '03', '05']);
    expect(porVendedor.reduce((a, x) => a + x.documentos, 0)).toBe(ventas.length);
    expect(totales.ticketPromedio).toBe(Math.round((totales.ventasBrutas / totales.documentos) * 100) / 100);
  });

  test('CCF + NC: ventas netas descuentan la nota de crédito; filtro por tipo', async () => {
    const antes = (await t.admin('get', '/api/reportes/resumen')).body.data.totales;
    const ccf = (await t.emitir('03', { clienteId: t.cli.roble.id, items: [{ productoId: t.prod.P001.id, cantidad: 40 }] })).body.data;
    await t.emitir('05', { dteRelacionadoId: ccf.id, items: [{ productoId: t.prod.P001.id, cantidad: 4 }] });
    const d = (await t.admin('get', '/api/reportes/resumen')).body.data.totales;
    expect(Math.round((d.ventasBrutas - antes.ventasBrutas) * 100) / 100).toBe(113);
    expect(Math.round((d.notasCredito - antes.notasCredito) * 100) / 100).toBe(11.3);
    expect(d.ventasNetas).toBe(Math.round((d.ventasBrutas - d.notasCredito) * 100) / 100);
    const solo03 = (await t.admin('get', '/api/reportes/resumen?tipo=03')).body.data;
    expect(solo03.porTipo).toEqual([expect.objectContaining({ tipoDte: '03' })]);
    expect(solo03.totales.notasCredito).toBe(0);
  });

  test('período sin datos: días en cero', async () => {
    const r = (await t.admin('get', '/api/reportes/resumen?desde=2020-02-27&hasta=2020-03-01')).body.data;
    expect(r.porDia.map((x) => x.fecha)).toEqual(['2020-02-27', '2020-02-28', '2020-02-29', '2020-03-01']);
    expect(r.totales).toEqual({ ventasBrutas: 0, notasCredito: 0, ventasNetas: 0, iva: 0, documentos: 0, ticketPromedio: 0 });
    expect(r.porVendedor).toEqual([]);
  });

  test.each([
    ['desde=2026-13-01'], ['desde=2026-02-30'], ['desde=2026-03-02&hasta=2026-03-01'], ['desde=2020-01-01&hasta=2026-01-01'], ['tipo=07'],
  ])('%s → 400', async (qs) => {
    expect((await t.admin('get', `/api/reportes/resumen?${qs}`)).status).toBe(400);
  });

  test('VENDEDOR → 403', async () => {
    expect((await t.vendedor('get', '/api/reportes/resumen')).status).toBe(403);
  });
});
