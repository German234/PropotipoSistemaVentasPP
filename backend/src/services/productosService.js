const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');

const COLS = 'id, codigo, descripcion, precio, stock, unidad, activo';

/** ?q busca en código o descripción. Por defecto solo activos. */
async function listar({ q, incluirInactivos } = {}) {
  const r = await query(
    `SELECT ${COLS} FROM dbo.productos
     WHERE (@todos = 1 OR activo = 1)
       AND (@q IS NULL OR codigo LIKE @q OR descripcion LIKE @q)
     ORDER BY codigo`,
    { q: q && q.trim() ? `%${q.trim()}%` : null, todos: incluirInactivos ? 1 : 0 }
  );
  return r.recordset;
}

async function obtener(id) {
  const r = await query(`SELECT ${COLS} FROM dbo.productos WHERE id = @id`, { id });
  if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Producto ${id} no existe`, 404);
  return r.recordset[0];
}

/** Valida y normaliza. `base` = valores actuales (para PUT parcial). */
function normalizar(body, base = {}) {
  const d = { ...base, ...body };
  return {
    codigo: v.texto(d.codigo, 'codigo', 25),
    descripcion: v.texto(d.descripcion, 'descripcion', 250),
    precio: v.dinero(d.precio, 'precio'),
    stock: v.entero(d.stock ?? 0, 'stock'),
    unidad: v.entero(d.unidad ?? 59, 'unidad', 1),
    activo: d.activo === undefined ? true : Boolean(d.activo),
  };
}

function duplicado(err, codigo) {
  if (err.number === 2627 || err.number === 2601) {
    throw new AppError('VALIDACION', `Ya existe un producto con código ${codigo}`, 400);
  }
  throw err;
}

async function crear(body, usuarioId) {
  const p = normalizar(body);
  let r;
  try {
    r = await query(
      `INSERT INTO dbo.productos (codigo, descripcion, precio, stock, unidad, activo)
       OUTPUT inserted.id
       VALUES (@codigo, @descripcion, @precio, @stock, @unidad, @activo)`,
      p
    );
  } catch (err) { duplicado(err, p.codigo); }
  const id = r.recordset[0].id;
  await registrar(usuarioId, 'CREAR', 'producto', id, p);
  return obtener(id);
}

async function actualizar(id, body, usuarioId) {
  const actual = await obtener(id);
  const p = normalizar(body, actual);
  try {
    await query(
      `UPDATE dbo.productos SET codigo = @codigo, descripcion = @descripcion, precio = @precio,
              stock = @stock, unidad = @unidad, activo = @activo
       WHERE id = @id`,
      { ...p, id }
    );
  } catch (err) { duplicado(err, p.codigo); }
  await registrar(usuarioId, 'ACTUALIZAR', 'producto', id, { antes: actual, cambios: body });
  return obtener(id);
}

module.exports = { listar, obtener, crear, actualizar };
