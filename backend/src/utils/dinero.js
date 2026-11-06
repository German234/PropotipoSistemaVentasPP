/**
 * Redondeo a 2 decimales (half-up) sin el error de coma flotante:
 * Math.round(1.005 * 100) / 100 = 1 (mal); redondear2(1.005) = 1.01 (bien).
 * Usar en TODO cálculo de dinero que se persista o devuelva.
 * Valores < 0.005 redondean a 0: además evita que un residuo de coma flotante en notación
 * exponencial (p. ej. 4.4e-16) se convierta en NaN al concatenar 'e2'.
 */
function redondear2(n) {
  const abs = Math.abs(n);
  if (abs < 0.005) return 0;
  const signo = n < 0 ? -1 : 1;
  return signo * Number(Math.round(Number(abs + 'e2')) + 'e-2');
}

module.exports = { redondear2 };
