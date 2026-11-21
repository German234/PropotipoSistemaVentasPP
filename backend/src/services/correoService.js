/**
 * Fase 6: envío del DTE por correo — SIMULADO. El proyecto no tiene servidor SMTP: no sale ningún correo.
 * La operación solo valida la dirección y el DTE y deja constancia en la bitácora (acción CORREO_SIMULADO).
 * La respuesta lo dice explícitamente (`enviado: false`, `simulado: true`) para que la UI no aparente un envío.
 */
const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');

const MENSAJE = 'Envío simulado: no se envió ningún correo (el prototipo no tiene servidor SMTP). Quedó registrado en la bitácora.';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function enviarSimulado(id, body, usuario) {
  const correo = v.texto(body.correo, 'correo', 100);
  if (!CORREO.test(correo)) v.falla('correo no tiene un formato válido');
  const r = await query(
    `SELECT id, numero_control AS numeroControl, codigo_generacion AS codigoGeneracion, estado
     FROM dbo.dte WHERE id = @id AND estado <> 'BORRADOR'`,
    { id }
  );
  const d = r.recordset[0];
  if (!d) throw new AppError('NO_ENCONTRADO', `DTE ${id} no existe`, 404);
  if (d.estado === 'RECHAZADO') throw new AppError('ESTADO_INVALIDO', 'Un DTE rechazado por MH no se entrega al receptor', 409);
  await registrar(usuario.id, 'CORREO_SIMULADO', 'dte', id, {
    numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, correo, resultado: 'SIMULADO', mensaje: MENSAJE,
  });
  return { dteId: id, numeroControl: d.numeroControl, correo, enviado: false, simulado: true, mensaje: MENSAJE };
}

module.exports = { enviarSimulado };
