const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');

const COLS = `id, tipo, nombre, nit, nrc, cod_actividad AS codActividad, desc_actividad AS descActividad,
              direccion, correo, activo`;
const TIPOS = ['CONSUMIDOR', 'CONTRIBUYENTE'];

/** ?q busca en nombre, NIT o NRC; ?tipo filtra. Por defecto solo activos. */
async function listar({ q, tipo, incluirInactivos } = {}) {
  if (tipo && !TIPOS.includes(tipo)) v.falla(`tipo debe ser ${TIPOS.join(' o ')}`);
  const r = await query(
    `SELECT ${COLS} FROM dbo.clientes
     WHERE (@todos = 1 OR activo = 1)
       AND (@tipo IS NULL OR tipo = @tipo)
       AND (@q IS NULL OR nombre LIKE @q OR nit LIKE @q OR nrc LIKE @q)
     ORDER BY nombre`,
    { q: q && q.trim() ? `%${q.trim()}%` : null, tipo: tipo || null, todos: incluirInactivos ? 1 : 0 }
  );
  return r.recordset;
}

async function obtener(id) {
  const r = await query(`SELECT ${COLS} FROM dbo.clientes WHERE id = @id`, { id });
  if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Cliente ${id} no existe`, 404);
  return r.recordset[0];
}

function nrc(valor) {
  const d = String(valor ?? '').replace(/[-\s]/g, '');
  if (!/^\d{1,8}$/.test(d)) v.falla('nrc debe tener de 1 a 8 dígitos');
  return d;
}

function codActividad(valor) {
  const d = String(valor ?? '').trim();
  if (!/^\d{2,6}$/.test(d)) v.falla('codActividad debe tener de 2 a 6 dígitos');
  return d;
}

/**
 * Valida y normaliza. `base` = valores actuales (para PUT parcial).
 * CONTRIBUYENTE: nit, nrc, codActividad y descActividad obligatorios (los exige el CCF y la BD).
 * CONSUMIDOR: todos opcionales; si trae nit se valida el formato.
 */
function normalizar(body, base = {}) {
  const d = { ...base, ...body };
  if (!TIPOS.includes(d.tipo)) v.falla(`tipo debe ser ${TIPOS.join(' o ')}`);
  const c = {
    tipo: d.tipo,
    nombre: v.texto(d.nombre, 'nombre', 250),
    direccion: v.textoOpc(d.direccion, 'direccion', 200),
    correo: v.textoOpc(d.correo, 'correo', 100),
    activo: d.activo === undefined ? true : Boolean(d.activo),
  };
  if (c.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.correo)) v.falla('correo no es válido');

  if (c.tipo === 'CONTRIBUYENTE') {
    if (!d.nit) v.falla('nit es obligatorio para CONTRIBUYENTE');
    if (!d.nrc) v.falla('nrc es obligatorio para CONTRIBUYENTE');
    c.nit = v.digitos(d.nit, 'nit', [9, 14]);
    c.nrc = nrc(d.nrc);
    c.codActividad = codActividad(d.codActividad);
    c.descActividad = v.texto(d.descActividad, 'descActividad', 150);
  } else {
    c.nit = d.nit ? v.digitos(d.nit, 'nit', [9, 14]) : null;
    c.nrc = d.nrc ? nrc(d.nrc) : null;
    c.codActividad = d.codActividad ? codActividad(d.codActividad) : null;
    c.descActividad = v.textoOpc(d.descActividad, 'descActividad', 150);
  }
  return c;
}

async function crear(body, usuarioId) {
  const c = normalizar(body);
  const r = await query(
    `INSERT INTO dbo.clientes (tipo, nombre, nit, nrc, cod_actividad, desc_actividad, direccion, correo, activo)
     OUTPUT inserted.id
     VALUES (@tipo, @nombre, @nit, @nrc, @codActividad, @descActividad, @direccion, @correo, @activo)`,
    c
  );
  const id = r.recordset[0].id;
  await registrar(usuarioId, 'CREAR', 'cliente', id, c);
  return obtener(id);
}

async function actualizar(id, body, usuarioId) {
  const actual = await obtener(id);
  const c = normalizar(body, actual);
  await query(
    `UPDATE dbo.clientes SET tipo = @tipo, nombre = @nombre, nit = @nit, nrc = @nrc,
            cod_actividad = @codActividad, desc_actividad = @descActividad,
            direccion = @direccion, correo = @correo, activo = @activo
     WHERE id = @id`,
    { ...c, id }
  );
  await registrar(usuarioId, 'ACTUALIZAR', 'cliente', id, { antes: actual, cambios: body });
  return obtener(id);
}

module.exports = { listar, obtener, crear, actualizar };
