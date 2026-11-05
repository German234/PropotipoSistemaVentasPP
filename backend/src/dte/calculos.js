/**
 * Cálculo de líneas y resumen del DTE. Todo monto se redondea a 2 decimales (redondear2).
 *
 * Entrada: lineas = [{ producto: { id, codigo, descripcion, precio (SIN IVA), unidad }, cantidad, descuento }]
 *   - descuento = monto por línea (en la misma base que precioUni: con IVA en 01, sin IVA en 03).
 *
 * 01 Factura: precioUni = precio * 1.13 (IVA incluido); ivaItem = ventaGravada / 1.13 * 0.13;
 *             totalIva = totalGravada / 1.13 * 0.13; resumen.tributos = null.
 * 03 CCF:     precioUni = precio (sin IVA); item.tributos = ["20"];
 *             resumen.tributos = [{ codigo "20", ..., valor = totalGravada * 0.13 }]; total = gravada + IVA.
 */
const { redondear2 } = require('../utils/dinero');
const { AppError } = require('../utils/respuesta');

const IVA = 0.13;
const IVA_PCT = 13;

/** monto * pct% calculado en centavos enteros (2.50 * 1.13 = 2.825 → 2.83; en coma flotante daba 2.8249… → 2.82). */
const porcentaje = (monto, pct) => redondear2((Math.round(monto * 100) * pct) / 10000);
const TRIBUTO_IVA = { codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%' };

/** Líneas comunes: precioUni, montoDescu y ventaGravada. ivaIncluido = true para 01. */
function calcularLineas(lineas, ivaIncluido) {
  return lineas.map((l, i) => {
    const precioUni = ivaIncluido ? porcentaje(l.producto.precio, 100 + IVA_PCT) : redondear2(l.producto.precio);
    const bruto = redondear2(precioUni * l.cantidad);
    const montoDescu = redondear2(l.descuento || 0);
    if (montoDescu > bruto) {
      throw new AppError('VALIDACION', `El descuento (${montoDescu}) supera el monto de la línea (${bruto}) del producto ${l.producto.codigo}`, 400);
    }
    const ventaGravada = redondear2(bruto - montoDescu);
    const ivaItem = ivaIncluido ? redondear2((ventaGravada / (1 + IVA)) * IVA) : porcentaje(ventaGravada, IVA_PCT);
    return {
      numItem: i + 1,
      producto: l.producto,
      cantidad: l.cantidad,
      precioUni,
      montoDescu,
      ventaGravada,
      ivaItem, // en 03 solo se guarda en dte_detalle (el esquema CCF no lleva ivaItem)
    };
  });
}

const suma = (arr, campo) => redondear2(arr.reduce((acc, x) => acc + x[campo], 0));

/** Campos del resumen que comparten 01 y 03 (sin ventas no sujetas/exentas ni descuentos globales). */
function resumenBase(items) {
  const totalGravada = suma(items, 'ventaGravada');
  return {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada,
    subTotalVentas: totalGravada,
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    porcentajeDescuento: 0,
    totalDescu: suma(items, 'montoDescu'),
  };
}

/** 01: precios con IVA, IVA incluido. Devuelve { items, resumen, totales } */
function calcularFactura(lineas) {
  const items = calcularLineas(lineas, true);
  const base = resumenBase(items);
  const subTotal = base.subTotalVentas;
  const totalIva = redondear2((base.totalGravada / (1 + IVA)) * IVA);
  const montoTotalOperacion = subTotal;
  const totalPagar = montoTotalOperacion; // sin retención
  return {
    items,
    resumen: { ...base, tributos: null, subTotal, ivaRete: 0, montoTotalOperacion, totalNoGravado: 0, totalPagar, totalIva, saldoFavor: 0 },
    totales: { subtotal: redondear2(subTotal - totalIva), iva: totalIva, total: totalPagar },
  };
}

/** 03: precios sin IVA, IVA en resumen.tributos. Devuelve { items, resumen, totales } */
function calcularCcf(lineas) {
  const items = calcularLineas(lineas, false);
  const base = resumenBase(items);
  const subTotal = base.subTotalVentas;
  const iva = porcentaje(base.totalGravada, IVA_PCT);
  const montoTotalOperacion = redondear2(subTotal + iva);
  const totalPagar = montoTotalOperacion; // sin percepción ni retención
  return {
    items,
    resumen: {
      ...base,
      tributos: [{ ...TRIBUTO_IVA, valor: iva }],
      subTotal, ivaPerci: 0, ivaRete: 0, montoTotalOperacion, totalNoGravado: 0, totalPagar, saldoFavor: 0,
    },
    totales: { subtotal: subTotal, iva, total: totalPagar },
  };
}

/**
 * 05 Nota de crédito (sobre un 03): precios sin IVA, IVA en tributos (igual que el CCF).
 * lineas = [{ producto, cantidad, precioUni, ventaGravada }] — precioUni y ventaGravada ya vienen
 * del CCF (proporcionales, ver dteService), así un descuento del CCF se acredita en proporción.
 */
function calcularNotaCredito(lineas) {
  const items = lineas.map((l, i) => {
    const ventaGravada = redondear2(l.ventaGravada);
    const montoDescu = Math.max(0, redondear2(l.precioUni * l.cantidad - ventaGravada));
    return {
      numItem: i + 1,
      producto: l.producto,
      cantidad: l.cantidad,
      precioUni: redondear2(l.precioUni),
      montoDescu,
      ventaGravada,
      ivaItem: porcentaje(ventaGravada, IVA_PCT),
    };
  });
  const totalGravada = suma(items, 'ventaGravada');
  const iva = porcentaje(totalGravada, IVA_PCT);
  const montoTotalOperacion = redondear2(totalGravada + iva);
  return {
    items,
    resumen: {
      totalNoSuj: 0,
      totalExenta: 0,
      totalGravada,
      subTotalVentas: totalGravada,
      totalDescu: suma(items, 'montoDescu'),
      tributos: [{ ...TRIBUTO_IVA, valor: iva }],
      montoTotalOperacion,
      ivaPerci: 0,
      totalIva: iva,
      ivaRete: 0,
      totalNoGravado: 0,
      totalPagar: montoTotalOperacion,
    },
    totales: { subtotal: totalGravada, iva, total: montoTotalOperacion },
  };
}

module.exports = { IVA, TRIBUTO_IVA, porcentaje, calcularLineas, calcularFactura, calcularCcf, calcularNotaCredito };
