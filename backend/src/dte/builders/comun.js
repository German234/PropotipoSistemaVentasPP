/**
 * Piezas compartidas por los builders (según schemas-mh/fe-f-v2.json y fe-ccf-v4.json).
 * Los esquemas tienen additionalProperties:false: no agregar campos que no existan en ellos
 * (p. ej. emisor.tipoEstablecimiento o un nodo `extension` en la raíz).
 */
const AMBIENTE = '00';
const DISTRITO_DEFECTO = '01';

/** Dirección MH {departamento, municipio, distrito, complemento}. */
const direccion = ({ departamento, municipio, distrito, complemento }) => ({
  departamento,
  municipio,
  distrito: distrito || DISTRITO_DEFECTO,
  complemento,
});

/** emisor del DTE a partir de emisorService.obtener(). */
const emisor = (e) => ({
  nit: e.nit,
  nrc: e.nrc,
  nombre: e.nombre,
  codActividad: e.codActividad,
  descActividad: e.descActividad,
  nombreComercial: e.nombreComercial || null,
  direccion: direccion(e.direccion),
  telefono: e.telefono,
  correo: e.correo,
  codEstable: e.codEstable,
  codPuntoVenta: e.codPuntoVenta,
});

/**
 * La tabla clientes guarda la dirección como texto libre; el MH pide departamento/municipio/distrito.
 * Simulación: se usan los códigos del emisor y el texto del cliente como complemento.
 */
const direccionCliente = (cliente, e) =>
  direccion({ ...e.direccion, distrito: null, complemento: cliente.direccion || 'Sin dirección' });

/** identificacion común (modelo previo, transmisión normal; contingencia = null). */
const identificacion = ({ version, tipoDte, numeroControl, codigoGeneracion, fecEmi, horEmi }) => ({
  version,
  ambiente: AMBIENTE,
  tipoDte,
  numeroControl,
  codigoGeneracion,
  tipoModelo: 1,
  tipoOperacion: 1,
  tipoContingencia: null,
  motivoContin: null,
  fecEmi,
  horEmi,
  tipoMoneda: 'USD',
});

/** Ítem de cuerpoDocumento (campos comunes a 01 y 03). */
const item = (it, extra) => ({
  numItem: it.numItem,
  tipoItem: 1, // 1 = bienes
  numeroDocumento: null,
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
  ...extra,
});

/** Pagos: contado → un pago en efectivo ("01") por el total; crédito/otro → null. */
const pagos = (condicionOperacion, totalPagar) =>
  condicionOperacion === 1 ? [{ codigo: '01', montoPago: totalPagar, referencia: null, plazo: null, periodo: null }] : null;

module.exports = { AMBIENTE, direccion, emisor, direccionCliente, identificacion, item, pagos };
