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
 * Dirección MH del receptor. El cliente guarda departamento/municipio/distrito con códigos del catálogo MH
 * (dte/catalogosMh.js, validados en clientesService). Clientes anteriores a P2 (solo texto, sin códigos):
 * se usan los códigos del emisor y su texto como complemento.
 */
const direccionCliente = (cliente, e) => {
  const d = cliente.direccion;
  if (d && typeof d === 'object' && d.departamento) return direccion(d);
  const texto = (d && typeof d === 'object' ? d.complemento : d) || 'Sin dirección';
  return direccion({ ...e.direccion, complemento: texto });
};

/** Número de documento como lo pide MH: DUI (13) con guion ########-#; el resto tal cual. */
const numDocumento = (tipo, num) =>
  tipo === '13' && /^[0-9]{9}$/.test(num || '') ? `${num.slice(0, 8)}-${num.slice(8)}` : num || null;

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

/** CAT-005 tipo de contingencia. El simulador solo produce la 1: MH no responde. */
const TIPO_CONTINGENCIA_MH = 1;

/**
 * DTE que MH no recibió → se emite en contingencia: modelo diferido (2), transmisión en contingencia (2),
 * tipoContingencia 1 y motivoContin null (solo se exige con el tipo 5). Mismo codigoGeneracion/numeroControl.
 */
const enContingencia = (json, tipoContingencia = TIPO_CONTINGENCIA_MH) => ({
  ...json,
  identificacion: { ...json.identificacion, tipoModelo: 2, tipoOperacion: 2, tipoContingencia, motivoContin: null },
});

module.exports = {
  AMBIENTE, TIPO_CONTINGENCIA_MH, direccion, emisor, direccionCliente, numDocumento, identificacion, item, pagos, enContingencia,
};
