/**
 * Redondeo a 2 decimales (half-up) sin el error de coma flotante:
 * Math.round(1.005 * 100) / 100 = 1 (mal); redondear2(1.005) = 1.01 (bien).
 * Usar en TODO cálculo de dinero que se persista o devuelva.
 */
function redondear2(n) {
  const signo = n < 0 ? -1 : 1;
  return signo * Number(Math.round(Number(Math.abs(n) + 'e2')) + 'e-2');
}

module.exports = { redondear2 };
