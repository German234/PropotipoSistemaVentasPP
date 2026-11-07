/**
 * Builders de JSON DTE y del evento de invalidación, validados contra los esquemas oficiales de schemas-mh/.
 * Cubre las reglas de estructura de CLAUDE.md (nodos en null, sin `extension`, documentoRelacionado del 05…).
 */
require('../helpers/schemas');
const calc = require('../../src/dte/calculos');
const factura01 = require('../../src/dte/builders/factura01');
const ccf03 = require('../../src/dte/builders/ccf03');
const notaCredito05 = require('../../src/dte/builders/notaCredito05');
const invalidacion = require('../../src/dte/builders/invalidacion');
const { emisor, P001, P002, P007, contribuyente, consumidor, consumidorLegado, base } = require('../fixtures/datos');

const NODOS = ['identificacion', 'documentoRelacionado', 'emisor', 'receptor', 'otrosDocumentos', 'ventaTercero', 'cuerpoDocumento', 'resumen', 'apendice'];

const factura = (extra = {}) => factura01.construir({
  ...base('01'),
  cliente: null,
  condicionOperacion: 1,
  calculo: calc.calcularFactura([{ producto: P001, cantidad: 2, descuento: 0 }, { producto: P002, cantidad: 10, descuento: 0.5 }]),
  ...extra,
});

const ccf = (extra = {}) => ccf03.construir({
  ...base('03'),
  cliente: contribuyente,
  condicionOperacion: 1,
  calculo: calc.calcularCcf([{ producto: P001, cantidad: 40, descuento: 0 }, { producto: P007, cantidad: 2, descuento: 1 }]),
  ...extra,
});

describe('01 Factura · builder', () => {
  test('sin receptor: cumple fe-f-v2.json y tiene los nodos del DTE (sin extension)', () => {
    const j = factura();
    expect(j).toCumplirEsquemaMh('01');
    expect(Object.keys(j)).toEqual(NODOS);
    expect(j).not.toHaveProperty('extension');
    expect(j.receptor).toBeNull();
    expect(j.documentoRelacionado).toBeNull();
    expect(j.identificacion).toMatchObject({ version: 2, ambiente: '00', tipoDte: '01', tipoModelo: 1, tipoOperacion: 1, tipoMoneda: 'USD' });
    expect(j.resumen.totalLetras).toBe('NUEVE 16/100 USD');
    expect(j.resumen.pagos).toEqual([{ codigo: '01', montoPago: 9.16, referencia: null, plazo: null, periodo: null }]);
  });

  test('con receptor consumidor con DUI y a crédito: cumple el esquema y pagos = null', () => {
    const j = factura({ cliente: consumidor, condicionOperacion: 2 });
    expect(j).toCumplirEsquemaMh('01');
    expect(j.receptor).toMatchObject({ tipoDocumento: '13', numDocumento: '01234567-8', nombre: 'Juan Pérez', telefono: '77778888' });
    expect(j.receptor.direccion).toEqual(consumidor.direccion);
    expect(j.resumen.pagos).toBeNull();
  });

  test('cliente anterior a P2 (dirección solo texto): códigos del emisor + texto como complemento', () => {
    const j = factura({ cliente: consumidorLegado });
    expect(j).toCumplirEsquemaMh('01');
    expect(j.receptor).toMatchObject({ tipoDocumento: null, numDocumento: null });
    expect(j.receptor.direccion).toEqual({ departamento: '06', municipio: '23', distrito: '14', complemento: 'Santa Tecla, La Libertad' });
  });

  test('control negativo: el validador rechaza un nodo `extension` o un numeroControl mal formado', () => {
    expect({ ...factura(), extension: null }).not.toCumplirEsquemaMh('01');
    const j = factura();
    j.identificacion.numeroControl = 'DTE-01-123';
    expect(j).not.toCumplirEsquemaMh('01');
  });

  test('con receptor contribuyente: tipoDocumento 36 + NIT', () => {
    const j = factura({ cliente: contribuyente });
    expect(j).toCumplirEsquemaMh('01');
    expect(j.receptor).toMatchObject({ tipoDocumento: '36', numDocumento: contribuyente.nit });
  });
});

describe('03 CCF · builder', () => {
  test('cumple fe-ccf-v4.json con receptor CONTRIBUYENTE y tributo 20', () => {
    const j = ccf();
    expect(j).toCumplirEsquemaMh('03');
    expect(Object.keys(j)).toEqual(NODOS);
    expect(j.identificacion).toMatchObject({ version: 4, tipoDte: '03' });
    expect(j.receptor).toMatchObject({ nit: contribuyente.nit, nrc: contribuyente.nrc, codActividad: '46900', nombreComercial: 'El Roble', telefono: '22605000' });
    expect(j.receptor.direccion).toEqual(contribuyente.direccion);
    expect(j.cuerpoDocumento.every((it) => JSON.stringify(it.tributos) === '["20"]')).toBe(true);
    expect(j.resumen.tributos[0]).toMatchObject({ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%' });
  });

  test('montos: 40 × 2.50 + (2 × 18.50 − 1) = 136 + IVA 17.68 = 153.68', () => {
    const r = ccf().resumen;
    expect(r.totalGravada).toBe(136);
    expect(r.tributos[0].valor).toBe(17.68);
    expect(r.totalPagar).toBe(153.68);
    expect(r.totalLetras).toBe('CIENTO CINCUENTA Y TRES 68/100 USD');
  });
});

describe('05 Nota de crédito · builder', () => {
  const ccfJson = ccf();
  const nc = () => notaCredito05.construir({
    ...base('05'),
    codigoGeneracion: 'B1B2C3D4-E5F6-4789-AB12-34567890ABCD',
    condicionOperacion: 1,
    calculo: calc.calcularNotaCredito([{ producto: P001, cantidad: 5, precioUni: 2.5, ventaGravada: 12.5 }]),
    ccf: { codigoGeneracion: ccfJson.identificacion.codigoGeneracion, fecEmi: ccfJson.identificacion.fecEmi, receptor: ccfJson.receptor },
  });

  test('cumple fe-nc-v4.json', () => {
    expect(nc()).toCumplirEsquemaMh('05');
  });

  test('documentoRelacionado apunta al CCF (tipo 03, generación 2, codigoGeneracion y fecha)', () => {
    expect(nc().documentoRelacionado).toEqual([{
      tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: ccfJson.identificacion.codigoGeneracion, fechaEmision: '2026-11-04',
    }]);
  });

  test('mismo receptor que el CCF y cada ítem referencia al CCF', () => {
    const j = nc();
    expect(j.receptor).toMatchObject({ tipoDocumento: '36', numDocumento: contribuyente.nit, nrc: contribuyente.nrc, nombre: contribuyente.nombre });
    expect(j.cuerpoDocumento[0].numeroDocumento).toBe(ccfJson.identificacion.codigoGeneracion);
    expect(j.resumen).toMatchObject({ totalIva: 1.63, totalPagar: 14.13, totalLetras: 'CATORCE 13/100 USD' });
  });
});

describe('Evento de invalidación · builder', () => {
  const motivo = {
    tipoAnulacion: 2, motivoAnulacion: 'Error en la información del documento', codigoGeneracionR: null,
    nombreResponsable: 'Administrador', tipDocResponsable: '13', numDocResponsable: '000000000',
    nombreSolicita: 'Administrador', tipDocSolicita: '13', numDocSolicita: '000000000',
  };
  const evento = (json, tipoDte) => invalidacion.construir({
    codigoGeneracion: 'F0E1D2C3-B4A5-4697-8877-665544332211', fecEmi: '2026-11-05', horEmi: '10:00:00', emisor,
    dte: {
      tipoDte, codigoGeneracion: json.identificacion.codigoGeneracion, selloRecibido: `2026${'A'.repeat(36)}`,
      numeroControl: json.identificacion.numeroControl, fecEmi: json.identificacion.fecEmi, json,
    },
    motivo,
  });

  test('de una factura sin receptor: cumple invalidacion-schema-v3.json, receptor en null y sin montoIva', () => {
    const j = evento(factura(), '01');
    expect(j).toCumplirEsquemaMh('invalidacion');
    expect(j.identificacion).toMatchObject({ version: 3, ambiente: '00', fusion: null });
    expect(j.documento).toMatchObject({ tipoDte: '01', codigoGeneracionR: null, tipoDocumento: null, numDocumento: null, nombre: null });
    expect(j.documento).not.toHaveProperty('montoIva');
    expect(j.motivo).toMatchObject({ tipoAnulacion: 2, motivoAnulacion: motivo.motivoAnulacion });
  });

  test('de un CCF: documento con tipoDocumento 36 + NIT del receptor', () => {
    const j = evento(ccf(), '03');
    expect(j).toCumplirEsquemaMh('invalidacion');
    expect(j.documento).toMatchObject({ tipoDte: '03', tipoDocumento: '36', numDocumento: contribuyente.nit, nombre: contribuyente.nombre });
  });
});
