/**
 * JSON completo de la Factura (01) según schemas-mh/fe-f-v2.json (version 2).
 * Consumidor final: precios con IVA; receptor opcional (null si no hay cliente).
 */
const c = require('./comun');
const { numeroALetras } = require('../numeroALetras');

/** Receptor 01: tipoDocumento 36 (NIT) si el cliente tiene NIT; si no, sin documento. */
function receptor(cliente, emisor) {
  if (!cliente) return null;
  return {
    tipoDocumento: cliente.nit ? '36' : null,
    numDocumento: cliente.nit || null,
    nrc: cliente.nrc || null,
    nombre: cliente.nombre,
    codActividad: cliente.codActividad || null,
    descActividad: cliente.descActividad || null,
    direccion: cliente.direccion ? c.direccionCliente(cliente, emisor) : null,
    telefono: null,
    correo: cliente.correo || null,
  };
}

/**
 * @param {object} p { numeroControl, codigoGeneracion, fecEmi, horEmi, emisor, cliente, condicionOperacion, calculo }
 *   calculo = resultado de calculos.calcularFactura()
 */
function construir({ numeroControl, codigoGeneracion, fecEmi, horEmi, emisor, cliente, condicionOperacion, calculo }) {
  const r = calculo.resumen;
  return {
    identificacion: c.identificacion({ version: 2, tipoDte: '01', numeroControl, codigoGeneracion, fecEmi, horEmi }),
    documentoRelacionado: null,
    emisor: c.emisor(emisor),
    receptor: receptor(cliente, emisor),
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: calculo.items.map((it) =>
      c.item(it, { tributos: null, psv: 0, noGravado: 0, ivaItem: it.ivaItem })
    ),
    resumen: {
      totalNoSuj: r.totalNoSuj,
      totalExenta: r.totalExenta,
      totalGravada: r.totalGravada,
      subTotalVentas: r.subTotalVentas,
      descuNoSuj: r.descuNoSuj,
      descuExenta: r.descuExenta,
      descuGravada: r.descuGravada,
      porcentajeDescuento: r.porcentajeDescuento,
      totalDescu: r.totalDescu,
      tributos: null,
      subTotal: r.subTotal,
      ivaRete: r.ivaRete,
      montoTotalOperacion: r.montoTotalOperacion,
      totalNoGravado: r.totalNoGravado,
      totalPagar: r.totalPagar,
      totalLetras: numeroALetras(r.totalPagar),
      totalIva: r.totalIva,
      saldoFavor: r.saldoFavor,
      condicionOperacion,
      pagos: c.pagos(condicionOperacion, r.totalPagar),
      numPagoElectronico: null,
      observaciones: null,
    },
    apendice: null,
  };
}

module.exports = { construir };
