/**
 * Monto en letras para resumen.totalLetras:
 *   numeroALetras(113)     → "CIENTO TRECE 00/100 USD"
 *   numeroALetras(1250.5)  → "MIL DOSCIENTOS CINCUENTA 50/100 USD"
 */
const { redondear2 } = require('../utils/dinero');

const UNIDADES = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE',
  'VEINTE', 'VEINTIUNO', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS',
  'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
const DECENAS = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
const CENTENAS = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS',
  'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

/** 0..999 */
function centenas(n) {
  if (n === 100) return 'CIEN';
  const c = Math.floor(n / 100);
  const r = n % 100;
  let txt = CENTENAS[c];
  if (r) {
    const dec = r < 30 ? UNIDADES[r] : DECENAS[Math.floor(r / 10)] + (r % 10 ? ' Y ' + UNIDADES[r % 10] : '');
    txt = (txt ? txt + ' ' : '') + dec;
  }
  return txt;
}

/** "UNO" → "UN" delante de MIL / MILLÓN (VEINTIUNO → VEINTIÚN). */
const apocopar = (t) => t.replace(/VEINTIUNO$/, 'VEINTIÚN').replace(/UNO$/, 'UN');

/** Entero 0..999 999 999 999 */
function entero(n) {
  if (n === 0) return 'CERO';
  const millones = Math.floor(n / 1e6);
  const miles = Math.floor((n % 1e6) / 1000);
  const resto = n % 1000;
  const partes = [];
  if (millones) {
    partes.push(millones === 1 ? 'UN MILLÓN' : `${apocopar(entero(millones))} MILLONES`);
  }
  if (miles) partes.push(miles === 1 ? 'MIL' : `${apocopar(centenas(miles))} MIL`);
  if (resto) partes.push(centenas(resto));
  return partes.join(' ');
}

function numeroALetras(monto) {
  const m = redondear2(Number(monto) || 0);
  const ent = Math.floor(m);
  const cent = Math.round((m - ent) * 100);
  return `${entero(ent)} ${String(cent).padStart(2, '0')}/100 USD`;
}

module.exports = { numeroALetras };
