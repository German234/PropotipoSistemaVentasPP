const db = require('../config/db');

/**
 * Registra una acción en la bitácora.
 *   registrar(req.usuario.id, 'CREAR', 'producto', 5, { codigo: 'P011' })
 * `detalle` puede ser texto u objeto (se guarda como JSON).
 * `q` opcional: el query de withTransaction para registrar dentro de la misma transacción
 * (si se pasa, un fallo hace rollback; sin él, un fallo solo se reporta en consola).
 */
async function registrar(usuarioId, accion, entidad, entidadId, detalle, q) {
  const texto = detalle == null ? null : typeof detalle === 'string' ? detalle : JSON.stringify(detalle);
  const sqlText = `INSERT INTO dbo.bitacora (usuario_id, accion, entidad, entidad_id, detalle)
                   VALUES (@usuarioId, @accion, @entidad, @entidadId, @detalle)`;
  const params = { usuarioId: usuarioId ?? null, accion, entidad: entidad ?? null, entidadId: entidadId ?? null, detalle: texto };
  if (q) return q(sqlText, params);
  try {
    await db.query(sqlText, params);
  } catch (err) {
    console.error('No se pudo registrar en bitácora:', err.message);
  }
}

module.exports = { registrar };
