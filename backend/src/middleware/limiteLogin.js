/**
 * Límite de intentos de inicio de sesión (en memoria; se reinicia con el servidor; suficiente para una sola instancia).
 *
 * Cuenta solo los intentos FALLIDOS (respuesta 401) en una ventana deslizante:
 *   - por usuario + IP (LOGIN_MAX_INTENTOS, 5 por defecto): frena la fuerza bruta contra una cuenta sin dejar que un
 *     atacante bloquee a ese usuario desde otra IP;
 *   - por IP (LOGIN_MAX_INTENTOS_IP, 4× el anterior): frena probar muchas cuentas desde la misma IP.
 * Al llegar al máximo, la clave queda bloqueada LOGIN_BLOQUEO_MIN minutos → 429 DEMASIADOS_INTENTOS con Retry-After,
 * aunque la contraseña sea correcta. Un login correcto borra el contador de su usuario + IP.
 */
const { AppError } = require('../utils/respuesta');
const { limiteLogin } = require('../config/seguridad');

const registros = new Map(); // clave → { fallos: [timestamps], bloqueadoHasta }

function limpiar(ahora, cfg) {
  if (registros.size < 1000) return;
  for (const [k, r] of registros) {
    if (r.bloqueadoHasta <= ahora && !r.fallos.some((t) => ahora - t < cfg.ventanaMs)) registros.delete(k);
  }
}

function claves(req) {
  const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'desconocida';
  const usuario = String((req.body && req.body.usuario) || '').trim().toLowerCase().slice(0, 50);
  return { usuarioIp: `u:${usuario}|${ip}`, ip: `ip:${ip}` };
}

function bloqueoRestante(clave, ahora) {
  const r = registros.get(clave);
  return r && r.bloqueadoHasta > ahora ? r.bloqueadoHasta - ahora : 0;
}

function anotarFallo(clave, max, ahora, cfg) {
  const r = registros.get(clave) || { fallos: [], bloqueadoHasta: 0 };
  r.fallos = r.fallos.filter((t) => ahora - t < cfg.ventanaMs);
  r.fallos.push(ahora);
  if (r.fallos.length >= max) { r.bloqueadoHasta = ahora + cfg.bloqueoMs; r.fallos = []; }
  registros.set(clave, r);
}

function limiteIntentosLogin(req, res, next) {
  const cfg = limiteLogin();
  const ahora = Date.now();
  limpiar(ahora, cfg);
  const k = claves(req);
  const espera = Math.max(bloqueoRestante(k.usuarioIp, ahora), bloqueoRestante(k.ip, ahora));
  if (espera > 0) {
    const seg = Math.ceil(espera / 1000);
    res.set('Retry-After', String(seg));
    return next(new AppError('DEMASIADOS_INTENTOS',
      `Demasiados intentos fallidos de inicio de sesión. Intente de nuevo en ${Math.ceil(seg / 60)} min.`, 429));
  }
  res.on('finish', () => {
    if (res.statusCode === 401) {
      anotarFallo(k.usuarioIp, cfg.max, Date.now(), cfg);
      anotarFallo(k.ip, cfg.maxIp, Date.now(), cfg);
    } else if (res.statusCode === 200) {
      registros.delete(k.usuarioIp);
    }
  });
  next();
}

/** Solo pruebas. */
limiteIntentosLogin._reiniciar = () => registros.clear();

module.exports = { limiteIntentosLogin };
