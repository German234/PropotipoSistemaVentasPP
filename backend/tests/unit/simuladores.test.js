/** Firmador y MH simulados: forma de las respuestas, sello, fecha y modos de X-Simular (ok/rechazo/contingencia). */
const firmador = require('../../src/dte/simuladores/firmador');
const mh = require('../../src/dte/simuladores/mhRecepcion');
const mhAnulacion = require('../../src/dte/simuladores/mhAnulacion');

const COD = 'A1B2C3D4-E5F6-4789-AB12-34567890ABCD';
const reqCon = (valor) => ({ get: (h) => (h === 'X-Simular' ? valor : undefined) });

describe('firmador simulado', () => {
  test('devuelve status OK y un JWS falso de 3 partes base64url con el JSON en el payload', () => {
    const json = { identificacion: { codigoGeneracion: COD } };
    const r = firmador.firmar(json);
    expect(r.status).toBe('OK');
    const partes = r.body.split('.');
    expect(partes).toHaveLength(3);
    partes.forEach((p) => expect(p).toMatch(/^[A-Za-z0-9_-]+$/));
    expect(JSON.parse(Buffer.from(partes[0], 'base64url').toString())).toEqual({ alg: 'RS512', typ: 'JWS' });
    expect(JSON.parse(Buffer.from(partes[1], 'base64url').toString())).toEqual(json);
  });

  test('la firma es aleatoria y el firmador responde OK aun en contingencia (MH es el que falla)', () => {
    const a = firmador.firmar({ x: 1 }, 'contingencia');
    const b = firmador.firmar({ x: 1 }, 'contingencia');
    expect(a.status).toBe('OK');
    expect(a.body.split('.')[2]).not.toBe(b.body.split('.')[2]);
  });
});

describe('MH recepción simulada', () => {
  test('leerModo: por defecto ok; acepta mayúsculas/espacios; valor desconocido → 400 VALIDACION', () => {
    expect(mh.leerModo(reqCon(undefined))).toBe('ok');
    expect(mh.leerModo(reqCon(' Rechazo '))).toBe('rechazo');
    expect(mh.leerModo(reqCon('CONTINGENCIA'))).toBe('contingencia');
    expect(() => mh.leerModo(reqCon('caido'))).toThrow(expect.objectContaining({ codigo: 'VALIDACION', status: 400 }));
  });

  test('generarSello: año + 36 alfanuméricos = 40 caracteres', () => {
    const s = mh.generarSello(new Date(2026, 10, 4));
    expect(s).toHaveLength(40);
    expect(s).toMatch(/^2026[A-Z0-9]{36}$/);
  });

  test('fhProcesamiento con formato dd/MM/yyyy HH:mm:ss', () => {
    expect(mh.fhProcesamiento(new Date(2026, 10, 4, 9, 5, 7))).toBe('04/11/2026 09:05:07');
  });

  test('ok → PROCESADO con sello y la forma completa del contrato', () => {
    const r = mh.recibir({ codigoGeneracion: COD }, 'ok');
    expect(Object.keys(r).sort()).toEqual([
      'ambiente', 'clasificaMsg', 'codigoGeneracion', 'codigoMsg', 'descripcionMsg', 'estado',
      'fhProcesamiento', 'observaciones', 'selloRecibido', 'version', 'versionApp',
    ]);
    expect(r).toMatchObject({ version: 2, ambiente: '00', versionApp: 2, estado: 'PROCESADO', codigoGeneracion: COD, observaciones: [] });
    expect(r.selloRecibido).toMatch(/^\d{4}[A-Z0-9]{36}$/);
    expect(r.fhProcesamiento).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/);
  });

  test('rechazo → RECHAZADO sin sello y con observaciones', () => {
    const r = mh.recibir({ codigoGeneracion: COD }, 'rechazo');
    expect(r.estado).toBe('RECHAZADO');
    expect(r.selloRecibido).toBeNull();
    expect(r.observaciones.length).toBeGreaterThan(0);
    expect(r.codigoMsg).not.toBe('001');
  });

  test('contingencia → MH no responde (null)', () => {
    expect(mh.recibir({ codigoGeneracion: COD }, 'contingencia')).toBeNull();
  });
});

describe('MH anulación simulada (evento de invalidación)', () => {
  test('ok → PROCESADO con sello propio de 40 caracteres', () => {
    const r = mhAnulacion.anular({ codigoGeneracion: COD }, 'ok');
    expect(r.estado).toBe('PROCESADO');
    expect(r.selloRecibido).toMatch(/^\d{4}[A-Z0-9]{36}$/);
    expect(r.ambiente).toBe('00');
  });

  test('rechazo → RECHAZADO sin sello', () => {
    const r = mhAnulacion.anular({ codigoGeneracion: COD }, 'rechazo');
    expect(r.estado).toBe('RECHAZADO');
    expect(r.selloRecibido).toBeNull();
  });

  test('contingencia → null (no existe contingencia para eventos)', () => {
    expect(mhAnulacion.anular({ codigoGeneracion: COD }, 'contingencia')).toBeNull();
  });
});
