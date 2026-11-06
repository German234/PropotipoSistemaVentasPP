/** GET /api/bitacora: más reciente primero, con filtros opcionales. */
const { query } = require('../config/db');
const v = require('../utils/validar');

const fechaIso = (d) => (d ? new Date(d).toISOString().slice(0, 19) : null);
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** detalle guardado como JSON → objeto; si es texto plano, queda igual. */
function leerDetalle(txt) {
  if (txt == null) return null;
  try { return JSON.parse(txt); } catch (_) { return txt; }
}

/**
 * Filtros: accion, entidad, dteId, usuario (login), desde/hasta (YYYY-MM-DD), limite (1..1000, defecto 200).
 * En entradas de DTE se exponen dteId, codigoGeneracion y resultado; `detalle` es el mensaje (texto)
 * y `datos` el detalle completo (objeto) tal como se registró.
 */
async function listar({ accion, entidad, dteId, usuario, desde, hasta, limite } = {}) {
  for (const [campo, valor] of [['desde', desde], ['hasta', hasta]]) {
    if (valor && !FECHA.test(valor)) v.falla(`${campo} debe tener formato YYYY-MM-DD`);
  }
  const top = limite ? v.entero(limite, 'limite', 1) : 200;
  if (top > 1000) v.falla('limite máximo 1000');
  const r = await query(
    `SELECT TOP (@top) b.id, b.fecha, u.usuario, b.accion, b.entidad, b.entidad_id AS entidadId, b.detalle
     FROM dbo.bitacora b
     LEFT JOIN dbo.usuarios u ON u.id = b.usuario_id
     WHERE (@accion IS NULL OR b.accion = @accion)
       AND (@entidad IS NULL OR b.entidad = @entidad)
       AND (@dteId IS NULL OR (b.entidad = 'dte' AND b.entidad_id = @dteId))
       AND (@usuario IS NULL OR u.usuario = @usuario)
       AND (@desde IS NULL OR b.fecha >= CAST(@desde AS DATE))
       AND (@hasta IS NULL OR b.fecha < DATEADD(DAY, 1, CAST(@hasta AS DATE)))
     ORDER BY b.id DESC`,
    {
      top,
      accion: accion || null,
      entidad: entidad || null,
      dteId: dteId ? v.entero(dteId, 'dteId', 1) : null,
      usuario: usuario || null,
      desde: desde || null,
      hasta: hasta || null,
    }
  );
  return r.recordset.map((b) => {
    const datos = leerDetalle(b.detalle);
    const esDte = b.entidad === 'dte';
    const obj = datos && typeof datos === 'object' ? datos : {};
    return {
      id: b.id,
      fecha: fechaIso(b.fecha),
      usuario: b.usuario,
      accion: b.accion,
      entidad: b.entidad,
      entidadId: b.entidadId,
      dteId: esDte ? b.entidadId : null,
      codigoGeneracion: esDte ? obj.codigoGeneracion || null : null,
      resultado: obj.resultado || null,
      detalle: typeof datos === 'string' ? datos : obj.mensaje || null,
      datos,
    };
  });
}

module.exports = { listar };
