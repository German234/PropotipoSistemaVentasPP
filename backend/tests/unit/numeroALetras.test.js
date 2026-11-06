/** resumen.totalLetras: monto en letras "XXX 00/100 USD". */
const { numeroALetras } = require('../../src/dte/numeroALetras');

describe('dte/numeroALetras', () => {
  test.each([
    [113, 'CIENTO TRECE 00/100 USD'],
    [0, 'CERO 00/100 USD'],
    [1, 'UNO 00/100 USD'],
    [5.66, 'CINCO 66/100 USD'],
    [9.16, 'NUEVE 16/100 USD'],
    [16, 'DIECISÉIS 00/100 USD'],
    [21, 'VEINTIUNO 00/100 USD'],
    [45, 'CUARENTA Y CINCO 00/100 USD'],
    [100, 'CIEN 00/100 USD'],
    [101, 'CIENTO UNO 00/100 USD'],
    [500, 'QUINIENTOS 00/100 USD'],
    [1000, 'MIL 00/100 USD'],
    [1250.5, 'MIL DOSCIENTOS CINCUENTA 50/100 USD'],
    [21000, 'VEINTIÚN MIL 00/100 USD'],
    [31000, 'TREINTA Y UN MIL 00/100 USD'],
    [100000, 'CIEN MIL 00/100 USD'],
    [1000000, 'UN MILLÓN 00/100 USD'],
    [2500000.99, 'DOS MILLONES QUINIENTOS MIL 99/100 USD'],
    [1.005, 'UNO 01/100 USD'],
  ])('%p → %s', (monto, letras) => {
    expect(numeroALetras(monto)).toBe(letras);
  });

  test('valores no numéricos se tratan como cero', () => {
    expect(numeroALetras(undefined)).toBe('CERO 00/100 USD');
  });
});
