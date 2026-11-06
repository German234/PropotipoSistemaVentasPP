/** Cálculos de líneas y resumen de 01 (IVA incluido), 03 (IVA aparte) y 05 (sobre el CCF). */
const calc = require('../../src/dte/calculos');
const { P001, P002, P007 } = require('../fixtures/datos');

describe('dte/calculos · porcentaje', () => {
  test('calcula en centavos: 2.50 × 113 % = 2.83 (no 2.82)', () => {
    expect(calc.porcentaje(2.5, 113)).toBe(2.83);
    expect(calc.porcentaje(100, 13)).toBe(13);
  });
});

describe('01 Factura · calcularFactura', () => {
  test('precio CON IVA (precio × 1.13) e IVA incluido', () => {
    const r = calc.calcularFactura([{ producto: P001, cantidad: 2, descuento: 0 }]);
    const [it] = r.items;
    expect(it.precioUni).toBe(2.83);
    expect(it.ventaGravada).toBe(5.66);
    expect(it.ivaItem).toBe(0.65); // 5.66 / 1.13 × 0.13
    expect(r.resumen.totalGravada).toBe(5.66);
    expect(r.resumen.totalIva).toBe(0.65);
    expect(r.resumen.tributos).toBeNull();
    expect(r.resumen.totalPagar).toBe(5.66);
    expect(r.resumen.montoTotalOperacion).toBe(5.66);
    expect(r.totales).toEqual({ subtotal: 5.01, iva: 0.65, total: 5.66 });
  });

  test('descuento por línea en base CON IVA y varias líneas', () => {
    const r = calc.calcularFactura([
      { producto: P001, cantidad: 2, descuento: 0 },
      { producto: P002, cantidad: 10, descuento: 0.5 },
    ]);
    expect(r.items[1].precioUni).toBe(0.4); // 0.35 × 1.13 = 0.3955 → 0.40
    expect(r.items[1].montoDescu).toBe(0.5);
    expect(r.items[1].ventaGravada).toBe(3.5);
    expect(r.resumen.totalGravada).toBe(9.16);
    expect(r.resumen.totalDescu).toBe(0.5);
    expect(r.resumen.totalIva).toBe(1.05);
    expect(r.items.map((i) => i.numItem)).toEqual([1, 2]);
  });

  test('IVA = gravado / 1.13 × 0.13 con redondeo a 2 decimales', () => {
    const r = calc.calcularFactura([{ producto: P007, cantidad: 3, descuento: 0 }]);
    const gravado = r.resumen.totalGravada;
    expect(r.resumen.totalIva).toBe(Math.round((gravado / 1.13) * 0.13 * 100) / 100);
    expect(Number.isInteger(Math.round(r.resumen.totalIva * 100))).toBe(true);
  });

  test('descuento mayor que la línea → VALIDACION', () => {
    expect(() => calc.calcularFactura([{ producto: P001, cantidad: 1, descuento: 5 }]))
      .toThrow(expect.objectContaining({ codigo: 'VALIDACION', status: 400 }));
  });
});

describe('03 CCF · calcularCcf', () => {
  test('precio SIN IVA y tributo 20 = 13 %: 40 × 2.50 → 100 + 13 = 113', () => {
    const r = calc.calcularCcf([{ producto: P001, cantidad: 40, descuento: 0 }]);
    expect(r.items[0].precioUni).toBe(2.5);
    expect(r.items[0].ventaGravada).toBe(100);
    expect(r.resumen.tributos).toEqual([{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 13 }]);
    expect(r.resumen.subTotal).toBe(100);
    expect(r.resumen.montoTotalOperacion).toBe(113);
    expect(r.resumen.totalPagar).toBe(113);
    expect(r.totales).toEqual({ subtotal: 100, iva: 13, total: 113 });
  });

  test('descuento en base SIN IVA', () => {
    const r = calc.calcularCcf([{ producto: P007, cantidad: 2, descuento: 7 }]);
    expect(r.items[0].ventaGravada).toBe(30);
    expect(r.resumen.tributos[0].valor).toBe(3.9);
    expect(r.resumen.totalPagar).toBe(33.9);
  });
});

describe('05 Nota de crédito · calcularNotaCredito', () => {
  test('usa precio y venta gravada del CCF; IVA 13 % en tributos y totalIva', () => {
    const r = calc.calcularNotaCredito([{ producto: P001, cantidad: 5, precioUni: 2.5, ventaGravada: 12.5 }]);
    expect(r.items[0]).toMatchObject({ cantidad: 5, precioUni: 2.5, ventaGravada: 12.5, montoDescu: 0, ivaItem: 1.63 });
    expect(r.resumen.tributos[0]).toEqual({ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: 1.63 });
    expect(r.resumen.totalIva).toBe(1.63);
    expect(r.resumen.totalPagar).toBe(14.13);
  });

  test('regresión: 3 de 10 × 1.10 (11 × 3 / 10 = 3.3000000000000003) → montoDescu 0, no NaN', () => {
    const P006 = { id: 6, codigo: 'P006', descripcion: 'Marcador', precio: 1.1, unidad: 59 };
    const r = calc.calcularNotaCredito([{ producto: P006, cantidad: 3, precioUni: 1.1, ventaGravada: (11 * 3) / 10 }]);
    expect(r.items[0].montoDescu).toBe(0);
    expect(r.items[0].ventaGravada).toBe(3.3);
    expect(r.resumen.totalDescu).toBe(0);
  });

  test('un descuento proporcional del CCF aparece como montoDescu', () => {
    const r = calc.calcularNotaCredito([{ producto: P007, cantidad: 1, precioUni: 18.5, ventaGravada: 15 }]);
    expect(r.items[0].montoDescu).toBe(3.5);
    expect(r.resumen.totalDescu).toBe(3.5);
  });
});
