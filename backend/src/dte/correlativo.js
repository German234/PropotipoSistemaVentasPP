/**
 * Número de control: DTE-{tipo}-{codEstable 4}{codPuntoVenta 4}-{correlativo 15 dígitos}
 *   p. ej. DTE-01-M001P001-000000000000001
 * Un correlativo por tipo (tabla dbo.correlativos). Se incrementa DENTRO de la transacción de emisión
 * con UPDLOCK: otra emisión concurrente del mismo tipo espera hasta el commit/rollback, así no hay
 * números repetidos ni huecos por rollback.
 */
const { sql } = require('../config/db');
const { AppError } = require('../utils/respuesta');

/**
 * @param {string} tipo   '01' | '03' | '05'
 * @param {sql.Transaction} tx  transacción activa (la de withTransaction)
 * @param {{codEstable: string, codPuntoVenta: string}} emisor
 */
async function siguienteNumeroControl(tipo, tx, { codEstable, codPuntoVenta }) {
  const r = await new sql.Request(tx)
    .input('tipo', sql.Char(2), tipo)
    .query(`UPDATE dbo.correlativos WITH (UPDLOCK, ROWLOCK)
            SET ultimo = ultimo + 1
            OUTPUT inserted.ultimo
            WHERE tipo_dte = @tipo`);
  const fila = r.recordset[0];
  if (!fila) throw new AppError('ERROR_INTERNO', `No existe correlativo para el tipo ${tipo} (ejecute db/02_seed.sql)`, 500);
  const correlativo = String(fila.ultimo).padStart(15, '0');
  return `DTE-${tipo}-${codEstable}${codPuntoVenta}-${correlativo}`;
}

module.exports = { siguienteNumeroControl };
