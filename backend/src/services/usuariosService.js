/**
 * Fase 6: administración de usuarios (solo ADMIN, ver routes/usuarios.js).
 * Reglas: usuario único (3–50: letras, dígitos, . _ -), rol ADMIN|VENDEDOR, contraseña de 8 a 72 caracteres
 * (límite de bcrypt), nadie se desactiva ni se quita el rol ADMIN a sí mismo, y siempre queda al menos un ADMIN
 * activo (comprobado con UPDLOCK dentro de la transacción). La contraseña nunca se devuelve ni va a la bitácora.
 */
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');

const ROLES = ['ADMIN', 'VENDEDOR'];
const COLS = 'id, usuario, nombre, rol, activo, creado_en AS creadoEn';
const fechaIso = (d) => (d ? new Date(d).toISOString().slice(0, 19) : null);
const aUsuario = (u) => ({ ...u, activo: Boolean(u.activo), creadoEn: fechaIso(u.creadoEn) });

/** Por defecto solo activos; incluirInactivos = todos. */
async function listar({ incluirInactivos } = {}) {
  const r = await query(
    `SELECT ${COLS} FROM dbo.usuarios WHERE (@todos = 1 OR activo = 1) ORDER BY usuario`,
    { todos: incluirInactivos ? 1 : 0 }
  );
  return r.recordset.map(aUsuario);
}

async function obtener(id, q = query) {
  const r = await q(`SELECT ${COLS} FROM dbo.usuarios WHERE id = @id`, { id });
  if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Usuario ${id} no existe`, 404);
  return aUsuario(r.recordset[0]);
}

function login(valor) {
  const u = v.texto(valor, 'usuario', 50);
  if (!/^[A-Za-z0-9._-]{3,50}$/.test(u)) v.falla('usuario debe tener de 3 a 50 caracteres: letras, dígitos, punto, guion o guion bajo');
  return u;
}

function rol(valor) {
  if (!ROLES.includes(valor)) v.falla(`rol debe ser ${ROLES.join(' o ')}`);
  return valor;
}

function password(valor) {
  if (typeof valor !== 'string' || valor.length < 8) v.falla('password debe tener al menos 8 caracteres');
  if (Buffer.byteLength(valor, 'utf8') > 72) v.falla('password admite máximo 72 bytes');
  return valor;
}

function duplicado(err, usuario) {
  if (err.number === 2627 || err.number === 2601) {
    throw new AppError('VALIDACION', `Ya existe el usuario ${usuario}`, 400);
  }
  throw err;
}

async function crear(body, actorId) {
  const datos = {
    usuario: login(body.usuario),
    nombre: v.texto(body.nombre, 'nombre', 150),
    rol: rol(body.rol),
  };
  const hash = await bcrypt.hash(password(body.password), 10);
  let r;
  try {
    r = await query(
      `INSERT INTO dbo.usuarios (usuario, nombre, password_hash, rol) OUTPUT inserted.id
       VALUES (@usuario, @nombre, @hash, @rol)`,
      { ...datos, hash }
    );
  } catch (err) { duplicado(err, datos.usuario); }
  const id = r.recordset[0].id;
  await registrar(actorId, 'CREAR', 'usuario', id, datos);
  return obtener(id);
}

/**
 * PUT parcial: { nombre?, rol?, activo?, password? }. El login (`usuario`) no se cambia: la bitácora y los DTE lo
 * muestran como identificador. Un usuario desactivado ya no puede iniciar sesión (su token vigente dura hasta
 * vencer, igual que antes de Fase 6: no hay revocación de JWT en el servidor).
 */
async function actualizar(id, body, actorId) {
  if (body.usuario !== undefined) v.falla('usuario no se puede cambiar');
  const hash = body.password !== undefined ? await bcrypt.hash(password(body.password), 10) : null;
  return withTransaction(async ({ query: q }) => {
    // UPDLOCK sobre los ADMIN activos: dos desactivaciones simultáneas no pueden dejar el sistema sin ADMIN
    await q(`SELECT id FROM dbo.usuarios WITH (UPDLOCK, HOLDLOCK) WHERE rol = 'ADMIN' AND activo = 1`);
    const actual = await obtener(id, q);
    const nuevo = {
      nombre: body.nombre !== undefined ? v.texto(body.nombre, 'nombre', 150) : actual.nombre,
      rol: body.rol !== undefined ? rol(body.rol) : actual.rol,
      activo: body.activo !== undefined ? Boolean(body.activo) : actual.activo,
    };
    if (id === actorId && !nuevo.activo) throw new AppError('VALIDACION', 'No puedes desactivar tu propio usuario', 400);
    if (id === actorId && nuevo.rol !== 'ADMIN') throw new AppError('VALIDACION', 'No puedes quitarte el rol ADMIN', 400);
    if (actual.rol === 'ADMIN' && actual.activo && (nuevo.rol !== 'ADMIN' || !nuevo.activo)) {
      const r = await q(`SELECT COUNT(*) AS n FROM dbo.usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> @id`, { id });
      if (r.recordset[0].n === 0) throw new AppError('ESTADO_INVALIDO', 'Debe quedar al menos un ADMIN activo', 409);
    }
    await q(
      `UPDATE dbo.usuarios SET nombre = @nombre, rol = @rol, activo = @activo,
              password_hash = COALESCE(@hash, password_hash)
       WHERE id = @id`,
      { ...nuevo, hash, id }
    );
    const cambios = { ...body };
    if (cambios.password !== undefined) cambios.password = '(cambiada)';
    const antes = { nombre: actual.nombre, rol: actual.rol, activo: actual.activo };
    await registrar(actorId, 'ACTUALIZAR', 'usuario', id, { antes, cambios }, q);
    return obtener(id, q);
  });
}

module.exports = { ROLES, listar, obtener, crear, actualizar };
