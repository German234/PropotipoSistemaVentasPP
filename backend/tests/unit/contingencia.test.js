/**
 * Contingencia (lógica pura): DTE emitido en contingencia (tipoModelo/tipoOperacion 2, tipoContingencia 1),
 * builder del evento de contingencia (esquema v4) y simulador de MH para el evento.
 */
require('../helpers/schemas');
const calc = require('../../src/dte/calculos');
const comun = require('../../src/dte/builders/comun');
const factura01 = require('../../src/dte/builders/factura01');
const ccf03 = require('../../src/dte/builders/ccf03');
const notaCredito05 = require('../../src/dte/builders/notaCredito05');
const contingencia = require('../../src/dte/builders/contingencia');
const mhContingencia = require('../../src/dte/simuladores/mhContingencia');
const { emisor, P001, contribuyente, base } = require('../fixtures/datos');

const factura = () => factura01.construir({
  ...base('01'), cliente: null, condicionOperacion: 1, calculo: calc.calcularFactura([{ producto: P001, cantidad: 1, descuento: 0 }]),
});
const ccf = () => ccf03.construir({
  ...base('03'), cliente: contribuyente, condicionOperacion: 1, calculo: calc.calcularCcf([{ producto: P001, cantidad: 4, descuento: 0 }]),
});

describe('enContingencia (DTE emitido sin respuesta de MH)', () => {
  test('cambia solo la identificación: modelo diferido 2, operación 2, tipoContingencia 1, motivoContin null', () => {
    const original = factura();
    const j = comun.enContingencia(original);
    expect(j.identificacion).toEqual({
      ...original.identificacion, tipoModelo: 2, tipoOperacion: 2, tipoContingencia: 1, motivoContin: null,
    });
    expect({ ...j, identificacion: null }).toEqual({ ...original, identificacion: null });
    expect(original.identificacion.tipoModelo).toBe(1); // no muta el original
  });

  test('conserva codigoGeneracion y numeroControl', () => {
    const j = comun.enContingencia(factura());
    expect(j.identificacion.codigoGeneracion).toBe(base('01').codigoGeneracion);
    expect(j.identificacion.numeroControl).toBe(base('01').numeroControl);
  });

  test('01, 03 y 05 en contingencia siguen cumpliendo sus esquemas MH', () => {
    expect(comun.enContingencia(factura())).toCumplirEsquemaMh('01');
    const c = ccf();
    expect(comun.enContingencia(c)).toCumplirEsquemaMh('03');
    const nc = notaCredito05.construir({
      ...base('05'), condicionOperacion: 1,
      calculo: calc.calcularNotaCredito([{ producto: P001, cantidad: 1, precioUni: 2.5, ventaGravada: 2.5 }]),
      ccf: { codigoGeneracion: c.identificacion.codigoGeneracion, fecEmi: c.identificacion.fecEmi, receptor: c.receptor },
    });
    expect(comun.enContingencia(nc)).toCumplirEsquemaMh('05');
  });
});

describe('Evento de contingencia · builder', () => {
  const evento = (motivoContingencia = 'El servicio de recepción de MH no respondió') => contingencia.construir({
    codigoGeneracion: '9C1D2E3F-A4B5-4C6D-8E7F-112233445566', fTransmision: '2026-11-05', hTransmision: '10:41:31', emisor,
    responsable: { nombre: 'Administrador', tipoDoc: '13', numeroDoc: '000000000' },
    dtes: [
      { tipoDte: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4789-AB12-34567890ABCD' },
      { tipoDte: '03', codigoGeneracion: 'B1B2C3D4-E5F6-4789-AB12-34567890ABCD' },
    ],
    motivo: { fInicio: '2026-11-05', hInicio: '10:12:08', fFin: '2026-11-05', hFin: '10:41:31', tipoContingencia: 1, motivoContingencia },
  });

  test('cumple contingencia-schema-v4.json', () => {
    expect(evento()).toCumplirEsquemaMh('contingencia');
    expect(evento(null)).toCumplirEsquemaMh('contingencia');
  });

  test('estructura: identificacion v4, emisor con responsable, detalleDTE numerado y motivo', () => {
    const j = evento();
    expect(Object.keys(j)).toEqual(['identificacion', 'emisor', 'detalleDTE', 'motivo']);
    expect(j.identificacion).toMatchObject({ version: 4, ambiente: '00' });
    expect(j.emisor).toMatchObject({
      nit: emisor.nit, nombreResponsable: 'Administrador', tipoDocResponsable: '13', numeroDocResponsable: '000000000',
      tipoEstablecimiento: '02', codEstableMH: 'M001', codPuntoVentaMH: 'P001',
    });
    expect(j.detalleDTE).toEqual([
      { noItem: 1, tipoDoc: '01', codigoGeneracion: 'A1B2C3D4-E5F6-4789-AB12-34567890ABCD' },
      { noItem: 2, tipoDoc: '03', codigoGeneracion: 'B1B2C3D4-E5F6-4789-AB12-34567890ABCD' },
    ]);
    expect(j.motivo).toMatchObject({ tipoContingencia: 1, fInicio: '2026-11-05', hFin: '10:41:31' });
  });
});

describe('MH simulado · recepción del evento de contingencia', () => {
  const COD = '9C1D2E3F-A4B5-4C6D-8E7F-112233445566';

  test('ok → PROCESADO con sello de 40 caracteres', () => {
    const r = mhContingencia.recibirEvento({ codigoGeneracion: COD }, 'ok');
    expect(r).toMatchObject({ version: 2, ambiente: '00', estado: 'PROCESADO', codigoGeneracion: COD, observaciones: [] });
    expect(r.selloRecibido).toMatch(/^\d{4}[A-Z0-9]{36}$/);
  });

  test('rechazo → RECHAZADO sin sello', () => {
    const r = mhContingencia.recibirEvento({ codigoGeneracion: COD }, 'rechazo');
    expect(r.estado).toBe('RECHAZADO');
    expect(r.selloRecibido).toBeNull();
    expect(r.observaciones.length).toBeGreaterThan(0);
  });

  test('contingencia → MH sigue sin responder (null)', () => {
    expect(mhContingencia.recibirEvento({ codigoGeneracion: COD }, 'contingencia')).toBeNull();
  });
});

describe('MH simulado · recepción por lote', () => {
  test('RECIBIDO con el idEnvio del lote y un codigoLote UUID en mayúsculas', () => {
    const r = mhContingencia.recibirLote({ idEnvio: 'ABCDEF12-3456-4789-ABCD-1234567890AB' });
    expect(r).toMatchObject({ version: 2, ambiente: '00', estado: 'RECIBIDO', idEnvio: 'ABCDEF12-3456-4789-ABCD-1234567890AB' });
    expect(r.codigoLote).toMatch(/^[A-F0-9]{8}-[A-F0-9]{4}-4[A-F0-9]{3}-[89AB][A-F0-9]{3}-[A-F0-9]{12}$/);
    expect(r.fhProcesamiento).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  });
});

describe('Lote automático · próxima ejecución', () => {
  const { proximaEjecucion } = require('../../src/services/loteAutomaticoService');

  test('si la hora aún no pasa hoy → hoy a esa hora', () => {
    const p = proximaEjecucion('23:55', new Date(2026, 10, 6, 10, 0, 0));
    expect(p).toEqual(new Date(2026, 10, 6, 23, 55, 0));
  });

  test('si ya pasó (o es exactamente esa hora) → mañana', () => {
    expect(proximaEjecucion('08:00', new Date(2026, 10, 6, 10, 0, 0))).toEqual(new Date(2026, 10, 7, 8, 0, 0));
    expect(proximaEjecucion('10:00', new Date(2026, 10, 6, 10, 0, 0))).toEqual(new Date(2026, 10, 7, 10, 0, 0));
  });

  test('cruza fin de mes', () => {
    expect(proximaEjecucion('00:05', new Date(2026, 10, 30, 23, 0, 0))).toEqual(new Date(2026, 11, 1, 0, 5, 0));
  });
});

describe('Lote automático · temporizador', () => {
  const svc = require('../../src/services/loteAutomaticoService');
  let spy;
  beforeEach(() => { spy = jest.spyOn(global, 'setTimeout'); });
  afterEach(() => { svc.detener(); spy.mockRestore(); });

  test('iniciar() programa el lote para la próxima hora configurada; detener() lo cancela', () => {
    Object.assign(svc._estado, { activo: true, hora: '23:55' });
    svc.iniciar();
    const espera = spy.mock.calls[spy.mock.calls.length - 1][1];
    expect(espera).toBeGreaterThan(0);
    expect(espera).toBeLessThanOrEqual(24 * 3600 * 1000);
    expect(Math.abs(Date.now() + espera - svc.proximaEjecucion('23:55').getTime())).toBeLessThan(1000);
    expect(svc._estado.timer).not.toBeNull();
    svc.detener();
    expect(svc._estado.timer).toBeNull();
  });

  test('desactivado → no programa nada', () => {
    Object.assign(svc._estado, { activo: false });
    svc.iniciar();
    expect(spy).not.toHaveBeenCalled();
    expect(svc._estado.timer).toBeNull();
    svc._estado.activo = true;
  });
});

describe('MH simulado · modo timeout y consulta de DTE', () => {
  const mh = require('../../src/dte/simuladores/mhRecepcion');
  const mhConsulta = require('../../src/dte/simuladores/mhConsulta');
  const mhAnulacion = require('../../src/dte/simuladores/mhAnulacion');
  const COD = 'A1B2C3D4-E5F6-4789-AB12-34567890ABCD';

  test('timeout es un modo válido y, para el POS, no hay respuesta (recepción, anulación y evento)', () => {
    expect(mh.MODOS).toContain('timeout');
    expect(mh.sinRespuesta('timeout')).toBe(true);
    expect(mh.sinRespuesta('contingencia')).toBe(true);
    expect(mh.sinRespuesta('ok')).toBe(false);
    expect(mh.recibir({ codigoGeneracion: COD }, 'timeout')).toBeNull();
    expect(mhAnulacion.anular({ codigoGeneracion: COD }, 'timeout')).toBeNull();
    expect(mhContingencia.recibirEvento({ codigoGeneracion: COD }, 'timeout')).toBeNull();
  });

  test('consulta: MH tiene el documento → su respuesta PROCESADO original (mismo sello)', () => {
    const respuestaMh = mh.recibir({ codigoGeneracion: COD }, 'ok');
    const r = mhConsulta.consultar({ respuestaMh }, COD);
    expect(r).toMatchObject({ estado: 'PROCESADO', codigoGeneracion: COD, selloRecibido: respuestaMh.selloRecibido });
    expect(r.descripcionMsg).toMatch(/ENCONTRADO/);
  });

  test('consulta: MH no lo tiene → estado null, código 004 NO ENCONTRADO', () => {
    const r = mhConsulta.consultar(null, COD);
    expect(r).toMatchObject({ estado: null, selloRecibido: null, codigoMsg: '004', codigoGeneracion: COD });
  });

  test('consulta con MH caído (contingencia o timeout) → null', () => {
    expect(mhConsulta.consultar(null, COD, 'contingencia')).toBeNull();
    expect(mhConsulta.consultar({ respuestaMh: {} }, COD, 'timeout')).toBeNull();
  });
});

describe('Cola de consultas · temporizador', () => {
  const svc = require('../../src/services/consultaMhService');
  let spy;
  beforeEach(() => { spy = jest.spyOn(global, 'setTimeout'); });
  afterEach(() => { svc.detener(); spy.mockRestore(); });

  test('iniciar() programa el siguiente turno a intervaloSeg; detener() lo cancela', () => {
    Object.assign(svc._estado, { activo: true, intervaloSeg: 45 });
    svc.iniciar();
    expect(spy.mock.calls[spy.mock.calls.length - 1][1]).toBe(45000);
    expect(svc._estado.proxima).toBeInstanceOf(Date);
    svc.detener();
    expect(svc._estado.timer).toBeNull();
    expect(svc._estado.proxima).toBeNull();
  });

  test('desactivada → no programa nada', () => {
    Object.assign(svc._estado, { activo: false });
    svc.iniciar();
    expect(spy).not.toHaveBeenCalled();
    svc._estado.activo = true;
  });
});
