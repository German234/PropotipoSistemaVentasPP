/**
 * JSON del evento de contingencia según schemas-mh/contingencia-schema-v4.json (version 4).
 * Se envía a MH cuando vuelve a estar disponible, antes de transmitir los DTE emitidos en contingencia.
 * additionalProperties:false en todos los nodos: no agregar campos.
 */
const { AMBIENTE } = require('./comun');

/**
 * @param {object} p
 *   codigoGeneracion, fTransmision, hTransmision  del evento
 *   emisor       emisorService.obtener()
 *   responsable  { nombre, tipoDoc, numeroDoc }
 *   dtes         [{ tipoDte, codigoGeneracion }] en orden (noItem = posición + 1)
 *   motivo       { fInicio, hInicio, fFin, hFin, tipoContingencia, motivoContingencia }
 */
function construir({ codigoGeneracion, fTransmision, hTransmision, emisor, responsable, dtes, motivo }) {
  return {
    identificacion: { version: 4, ambiente: AMBIENTE, codigoGeneracion, fTransmision, hTransmision },
    emisor: {
      nit: emisor.nit,
      nombre: emisor.nombre,
      nombreResponsable: responsable.nombre,
      tipoDocResponsable: responsable.tipoDoc,
      numeroDocResponsable: responsable.numeroDoc,
      tipoEstablecimiento: emisor.tipoEstablecimiento,
      codEstableMH: emisor.codEstable,
      codPuntoVentaMH: emisor.codPuntoVenta,
      telefono: emisor.telefono,
      correo: emisor.correo,
    },
    detalleDTE: dtes.map((d, i) => ({ noItem: i + 1, tipoDoc: d.tipoDte, codigoGeneracion: d.codigoGeneracion })),
    motivo: {
      fInicio: motivo.fInicio,
      fFin: motivo.fFin,
      hInicio: motivo.hInicio,
      hFin: motivo.hFin,
      tipoContingencia: motivo.tipoContingencia,
      motivoContingencia: motivo.motivoContingencia,
    },
  };
}

module.exports = { construir };
