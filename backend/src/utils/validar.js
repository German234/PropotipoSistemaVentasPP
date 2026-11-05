const { AppError } = require('./respuesta');
const { redondear2 } = require('./dinero');

const falla = (mensaje) => { throw new AppError('VALIDACION', mensaje, 400); };

/** Texto obligatorio (recortado). */
function texto(valor, campo, max = 250) {
  if (typeof valor !== 'string' || !valor.trim()) falla(`${campo} es obligatorio`);
  const t = valor.trim();
  if (t.length > max) falla(`${campo} admite máximo ${max} caracteres`);
  return t;
}

/** Texto opcional: '' / undefined / null → null. */
function textoOpc(valor, campo, max = 250) {
  if (valor == null || (typeof valor === 'string' && !valor.trim())) return null;
  return texto(String(valor), campo, max);
}

/** Número >= min, redondeado a 2 decimales. */
function dinero(valor, campo, min = 0) {
  const n = Number(valor);
  if (valor === '' || valor == null || !Number.isFinite(n) || n < min) falla(`${campo} debe ser un número >= ${min}`);
  return redondear2(n);
}

/** Entero >= min. */
function entero(valor, campo, min = 0) {
  const n = Number(valor);
  if (valor === '' || valor == null || !Number.isInteger(n) || n < min) falla(`${campo} debe ser un entero >= ${min}`);
  return n;
}

/** Solo dígitos (quita guiones/espacios) y valida longitudes permitidas. */
function digitos(valor, campo, longitudes) {
  const d = String(valor ?? '').replace(/[-\s]/g, '');
  if (!/^\d+$/.test(d) || !longitudes.includes(d.length)) {
    falla(`${campo} debe tener ${longitudes.join(' o ')} dígitos`);
  }
  return d;
}

/** Entero positivo de req.params. */
function id(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < 1) falla('id inválido');
  return n;
}

module.exports = { falla, texto, textoOpc, dinero, entero, digitos, id };
