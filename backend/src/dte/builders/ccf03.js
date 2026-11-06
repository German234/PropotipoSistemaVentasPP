/**
 * JSON completo del Comprobante de Crédito Fiscal (03) según schemas-mh/fe-ccf-v4.json (version 4).
 * Receptor CONTRIBUYENTE obligatorio; precios sin IVA; IVA en resumen.tributos (código "20").
 */
const c = require('./comun');
const { numeroALetras } = require('../numeroALetras');

/** Receptor 03: NIT, NRC y actividad obligatorios (validados antes en dteService). */
const receptor = (cliente, emisor) => ({
  nit: cliente.nit,
  nrc: cliente.nrc,
  nombre: cliente.nombre,
  codActividad: cliente.codActividad,
  descActividad: cliente.descActividad,
  nombreComercial: null,
  direccion: c.direccionCliente(cliente, emisor),
  telefono: null,
  correo: cliente.correo || null,
});

/**
 * @param {object} p { numeroControl, codigoGeneracion, fecEmi, horEmi, emisor, cliente, condicionOperacion, calculo }
 *   calculo = resultado de calculos.calcularCcf()
 */
function construir({ numeroControl, codigoGeneracion, fecEmi, horEmi, emisor, cliente, condicionOperacion, calculo }) {
  const r = calculo.resumen;
  return {
    identificacion: c.identificacion({ version: 4, tipoDte: '03', numeroControl, codigoGeneracion, fecEmi, horEmi }),
    documentoRelacionado: null,
    emisor: c.emisor(emisor),
    receptor: receptor(cliente, emisor),
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento: calculo.items.map((it) => c.item(it, { tributos: ['20'], psv: 0, noGravado: 0 })),
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
      tributos: r.tributos,
      subTotal: r.subTotal,
      ivaPerci: r.ivaPerci,
      ivaRete: r.ivaRete,
      montoTotalOperacion: r.montoTotalOperacion,
      totalNoGravado: r.totalNoGravado,
      totalPagar: r.totalPagar,
      totalLetras: numeroALetras(r.totalPagar),
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
