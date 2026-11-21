/**
 * Fase 6: borradores de venta (carrito sin emitir). Cada usuario ve y edita solo los suyos: el de otro usuario
 * responde 404 como si no existiera. No reservan stock ni consumen correlativo; el total es un estimado con los
 * precios vigentes (lo definitivo lo calcula la emisión). Al emitir, el frontend borra el borrador.
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');
const { calcularFactura, calcularCcf } = require('../dte/calculos');

const TIPOS = ['01', '03'];
const MAX_ITEMS = 100;
const fechaIso = (d) => (d ? new Date(d).toISOString().slice(0, 19) : null);

/** Valida { tipoDte, clienteId?, items:[{productoId, cantidad}] } y suma las líneas del mismo producto. */
function normalizar(body) {
  const tipoDte = body.tipoDte;
  if (!TIPOS.includes(tipoDte)) v.falla(`tipoDte debe ser ${TIPOS.join(' o ')}`);
  const clienteId = body.clienteId == null || body.clienteId === '' ? null : v.entero(body.clienteId, 'clienteId', 1);
  if (!Array.isArray(body.items) || body.items.length === 0) v.falla('items debe tener al menos un producto');
  if (body.items.length > MAX_ITEMS) v.falla(`items admite máximo ${MAX_ITEMS} líneas`);
  const porProducto = new Map();
  for (const it of body.items) {
    if (!it || typeof it !== 'object') v.falla('cada ítem debe ser { productoId, cantidad }');
    const productoId = v.entero(it.productoId, 'productoId', 1);
    const cantidad = v.entero(it.cantidad, 'cantidad', 1);
    porProducto.set(productoId, (porProducto.get(productoId) || 0) + cantidad);
  }
  const items = [...porProducto].map(([productoId, cantidad]) => ({ productoId, cantidad }));
  return { tipoDte, clienteId, items };
}

/** Productos por id (activos o no) → Map. */
async function cargarProductos(ids) {
  if (!ids.length) return new Map();
  const params = Object.fromEntries(ids.map((id, i) => [`p${i}`, id]));
  const r = await query(
    `SELECT id, codigo, descripcion, precio, stock, unidad, activo FROM dbo.productos
     WHERE id IN (${ids.map((_, i) => `@p${i}`).join(', ')})`,
    params
  );
  return new Map(r.recordset.map((p) => [p.id, { ...p, precio: Number(p.precio), activo: Boolean(p.activo) }]));
}

/** Los productos deben existir y estar activos; el cliente, existir y estar activo. */
async function validarReferencias({ clienteId, items }) {
  const productos = await cargarProductos(items.map((i) => i.productoId));
  for (const it of items) {
    const p = productos.get(it.productoId);
    if (!p || !p.activo) throw new AppError('NO_ENCONTRADO', `Producto ${it.productoId} no existe o está inactivo`, 404);
  }
  if (clienteId) {
    const r = await query('SELECT id FROM dbo.clientes WHERE id = @id AND activo = 1', { id: clienteId });
    if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Cliente ${clienteId} no existe o está inactivo`, 404);
  }
}

/** Fila SQL + productos → forma del contrato, con total estimado de las líneas disponibles. */
function aBorrador(b, productos) {
  const guardados = JSON.parse(b.items);
  const items = guardados.map((it) => {
    const p = productos.get(it.productoId);
    return {
      productoId: it.productoId,
      cantidad: it.cantidad,
      codigo: p ? p.codigo : null,
      descripcion: p ? p.descripcion : null,
      precio: p ? p.precio : null,
      stock: p ? p.stock : null,
      disponible: Boolean(p && p.activo),
    };
  });
  const lineas = items.filter((i) => i.disponible).map((i) => ({ producto: productos.get(i.productoId), cantidad: i.cantidad, descuento: 0 }));
  const calculo = b.tipoDte === '01' ? calcularFactura : calcularCcf;
  return {
    id: b.id,
    tipoDte: b.tipoDte,
    clienteId: b.clienteId,
    cliente: b.clienteId ? { id: b.clienteId, nombre: b.clienteNombre, tipo: b.clienteTipo } : null,
    usuario: b.usuario,
    items,
    totalEstimado: lineas.length ? calculo(lineas).totales.total : 0,
    creadoEn: fechaIso(b.creadoEn),
    actualizadoEn: fechaIso(b.actualizadoEn),
  };
}

const SELECT = `SELECT b.id, b.tipo_dte AS tipoDte, b.cliente_id AS clienteId, c.nombre AS clienteNombre, c.tipo AS clienteTipo,
                       u.usuario, b.items, b.creado_en AS creadoEn, b.actualizado_en AS actualizadoEn
                FROM dbo.borrador b
                JOIN dbo.usuarios u ON u.id = b.usuario_id
                LEFT JOIN dbo.clientes c ON c.id = b.cliente_id`;

async function armar(filas) {
  const ids = [...new Set(filas.flatMap((b) => JSON.parse(b.items).map((i) => i.productoId)))];
  const productos = await cargarProductos(ids);
  return filas.map((b) => aBorrador(b, productos));
}

/** Borradores del usuario, el más reciente primero. */
async function listar(usuarioId) {
  const r = await query(`${SELECT} WHERE b.usuario_id = @usuarioId ORDER BY b.actualizado_en DESC, b.id DESC`, { usuarioId });
  return armar(r.recordset);
}

async function obtener(id, usuarioId) {
  const r = await query(`${SELECT} WHERE b.id = @id AND b.usuario_id = @usuarioId`, { id, usuarioId });
  if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Borrador ${id} no existe`, 404);
  return (await armar(r.recordset))[0];
}

async function crear(body, usuarioId) {
  const d = normalizar(body);
  await validarReferencias(d);
  const r = await query(
    `INSERT INTO dbo.borrador (usuario_id, tipo_dte, cliente_id, items) OUTPUT inserted.id
     VALUES (@usuarioId, @tipoDte, @clienteId, @items)`,
    { usuarioId, tipoDte: d.tipoDte, clienteId: d.clienteId, items: JSON.stringify(d.items) }
  );
  const id = r.recordset[0].id;
  await registrar(usuarioId, 'CREAR', 'borrador', id, d);
  return obtener(id, usuarioId);
}

/** Reemplaza el contenido completo del borrador (mismo cuerpo que POST). */
async function actualizar(id, body, usuarioId) {
  await obtener(id, usuarioId);
  const d = normalizar(body);
  await validarReferencias(d);
  await query(
    `UPDATE dbo.borrador SET tipo_dte = @tipoDte, cliente_id = @clienteId, items = @items, actualizado_en = SYSDATETIME()
     WHERE id = @id AND usuario_id = @usuarioId`,
    { id, usuarioId, tipoDte: d.tipoDte, clienteId: d.clienteId, items: JSON.stringify(d.items) }
  );
  await registrar(usuarioId, 'ACTUALIZAR', 'borrador', id, d);
  return obtener(id, usuarioId);
}

async function eliminar(id, usuarioId) {
  await obtener(id, usuarioId);
  await query('DELETE FROM dbo.borrador WHERE id = @id AND usuario_id = @usuarioId', { id, usuarioId });
  await registrar(usuarioId, 'ELIMINAR', 'borrador', id, null);
  return { id, eliminado: true };
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
