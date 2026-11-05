/**
 * JSON completo de la Nota de Crédito (05) según schemas-mh/fe-nc-v4.json (version 4).
 * Diferencias con el CCF que impone el esquema (additionalProperties:false):
 *   - sin otrosDocumentos; emisor sin codEstable/codPuntoVenta;
 *   - receptor con tipoDocumento "36" + numDocumento (NIT);
 *   - cada ítem lleva numeroDocumento (= codigoGeneracion del CCF), ivaPerci, totalIva, ivaRete (sin psv);
 *   - resumen sin descuentos desglosados, subTotal ni pagos; con totalIva y codigoRetencionMH.
 */
const c = require('./comun');
const { numeroALetras } = require('../numeroALetras');

const emisor = (e) => {
  const { codEstable, codPuntoVenta, ...resto } = c.emisor(e); // eslint-disable-line no-unused-vars
  return resto;
};

/** "Mismo receptor": se copia del JSON del CCF (no de la tabla clientes, que pudo cambiar). */
const receptor = (r) => ({
  tipoDocumento: '36',
  numDocumento: r.nit,
  nrc: r.nrc,
  nombre: r.nombre,
  codActividad: r.codActividad,
  descActividad: r.descActividad,
  nombreComercial: r.nombreComercial || null,
  direccion: r.direccion,
  telefono: r.telefono || null,
  correo: r.correo || null,
});

/**
 * @param {object} p { numeroControl, codigoGeneracion, fecEmi, horEmi, emisor, condicionOperacion, calculo, ccf }
 *   ccf = { codigoGeneracion, fecEmi, receptor } del CCF relacionado (receptor = jsonDte.receptor del 03);
 *   calculo = calculos.calcularNotaCredito()
 */
function construir({ numeroControl, codigoGeneracion, fecEmi, horEmi, emisor: e, condicionOperacion, calculo, ccf }) {
  const r = calculo.resumen;
  return {
    identificacion: {
      ...c.identificacion({ version: 4, tipoDte: '05', numeroControl, codigoGeneracion, fecEmi, horEmi }),
      fusion: null,
    },
    documentoRelacionado: [
      { tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: ccf.codigoGeneracion, fechaEmision: ccf.fecEmi },
    ],
    emisor: emisor(e),
    receptor: receptor(ccf.receptor),
    ventaTercero: null,
    cuerpoDocumento: calculo.items.map((it) => ({
      numItem: it.numItem,
      tipoItem: 1,
      numeroDocumento: ccf.codigoGeneracion,
      cantidad: it.cantidad,
      codigo: it.producto.codigo,
      codTributo: null,
      uniMedida: it.producto.unidad,
      descripcion: it.producto.descripcion,
      precioUni: it.precioUni,
      montoDescu: it.montoDescu,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada: it.ventaGravada,
      tributos: ['20'],
      noGravado: 0,
      ivaPerci: 0,
      totalIva: it.ivaItem,
      ivaRete: 0,
    })),
    resumen: {
      totalNoSuj: r.totalNoSuj,
      totalExenta: r.totalExenta,
      totalGravada: r.totalGravada,
      subTotalVentas: r.subTotalVentas,
      totalDescu: r.totalDescu,
      tributos: r.tributos,
      montoTotalOperacion: r.montoTotalOperacion,
      ivaPerci: r.ivaPerci,
      totalIva: r.totalIva,
      ivaRete: r.ivaRete,
      totalNoGravado: r.totalNoGravado,
      totalPagar: r.totalPagar,
      totalLetras: numeroALetras(r.totalPagar),
      condicionOperacion,
      observaciones: null,
      codigoRetencionMH: null,
    },
    apendice: null,
  };
}

module.exports = { construir };
