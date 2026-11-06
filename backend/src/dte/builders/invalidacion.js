/**
 * JSON del evento de invalidación según schemas-mh/invalidacion-schema-v3.json (version 3).
 * El esquema (additionalProperties:false) pide en `documento` los datos del receptor
 * (tipoDocumento, numDocumento, nombre, telefono, correo) y NO admite montoIva;
 * la identificación usa fecEmi/horEmi (no fecAnula/horAnula) y `fusion`.
 */
const { AMBIENTE } = require('./comun');

/** Receptor del DTE original → campos de `documento` (null si la factura no tuvo receptor). */
function receptorDoc(dteJson) {
  const r = dteJson.receptor;
  if (!r) return { tipoDocumento: null, numDocumento: null, nombre: null, telefono: null, correo: null };
  return {
    tipoDocumento: r.tipoDocumento !== undefined ? r.tipoDocumento : '36', // 03 usa `nit` en lugar de tipo/num
    numDocumento: r.numDocumento !== undefined ? r.numDocumento : r.nit,
    nombre: r.nombre || null,
    telefono: r.telefono || null,
    correo: r.correo || null,
  };
}

/**
 * @param {object} p
 *   codigoGeneracion, fecEmi, horEmi  del evento
 *   emisor        emisorService.obtener()
 *   dte           { tipoDte, codigoGeneracion, selloRecibido, numeroControl, fecEmi, json (DTE parseado) }
 *   motivo        { tipoAnulacion, motivoAnulacion, codigoGeneracionR, nombreResponsable, tipDocResponsable,
 *                   numDocResponsable, nombreSolicita, tipDocSolicita, numDocSolicita }
 */
function construir({ codigoGeneracion, fecEmi, horEmi, emisor, dte, motivo }) {
  return {
    identificacion: { version: 3, ambiente: AMBIENTE, codigoGeneracion, fecEmi, horEmi, fusion: null },
    emisor: {
      nit: emisor.nit,
      nombre: emisor.nombre,
      codEstableMH: emisor.codEstable,
      codEstable: emisor.codEstable,
      codPuntoVentaMH: emisor.codPuntoVenta,
      codPuntoVenta: emisor.codPuntoVenta,
      telefono: emisor.telefono,
      correo: emisor.correo,
    },
    documento: {
      tipoDte: dte.tipoDte,
      codigoGeneracion: dte.codigoGeneracion,
      selloRecibido: dte.selloRecibido,
      numeroControl: dte.numeroControl,
      fecEmi: dte.fecEmi,
      codigoGeneracionR: motivo.codigoGeneracionR || null,
      ...receptorDoc(dte.json),
    },
    motivo: {
      tipoAnulacion: motivo.tipoAnulacion,
      motivoAnulacion: motivo.motivoAnulacion,
      nombreResponsable: motivo.nombreResponsable,
      tipDocResponsable: motivo.tipDocResponsable,
      numDocResponsable: motivo.numDocResponsable,
      nombreSolicita: motivo.nombreSolicita,
      tipDocSolicita: motivo.tipDocSolicita,
      numDocSolicita: motivo.numDocSolicita,
    },
  };
}

module.exports = { construir };
