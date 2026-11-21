/**
 * Configuración de seguridad leída del entorno (backend/.env). Se lee en cada uso para que
 * las pruebas puedan cambiarla sin recargar módulos. Valores por defecto = entorno académico local.
 */
const LOCALES = ['localhost', '127.0.0.1', '::1', '[::1]'];

const num = (v, def) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : def);

/** CORS_ORIGENES="https://pos.ejemplo.com,http://localhost:5173". Por defecto, solo el propio servidor local. */
function origenesPermitidos() {
  const lista = (process.env.CORS_ORIGENES || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);
  if (lista.length) return lista;
  const port = Number(process.env.PORT) || 3000;
  return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
}

/** Límite de intentos de login (ver middleware/limiteLogin.js). */
function limiteLogin() {
  const max = num(process.env.LOGIN_MAX_INTENTOS, 5);
  return {
    max,                                                      // fallos por usuario + IP
    maxIp: num(process.env.LOGIN_MAX_INTENTOS_IP, max * 4),   // fallos por IP (cualquier usuario)
    ventanaMs: num(process.env.LOGIN_VENTANA_MIN, 15) * 60000,
    bloqueoMs: num(process.env.LOGIN_BLOQUEO_MIN, 15) * 60000,
  };
}

/** Cookie Secure: COOKIE_SECURE=1 (detrás de HTTPS) o si la petición ya llegó por HTTPS. */
const cookieSegura = (req) => process.env.COOKIE_SECURE === '1' || Boolean(req && req.secure);

const esProduccion = () => process.env.NODE_ENV === 'production';

/**
 * ¿Mostrar las credenciales de demostración en el login?
 *   DEMO_CREDENCIALES=1 → sí · =0 → no · sin definir → solo fuera de producción y si se abre desde localhost.
 */
function mostrarCredencialesDemo(req) {
  if (process.env.DEMO_CREDENCIALES === '1') return true;
  if (process.env.DEMO_CREDENCIALES === '0') return false;
  return !esProduccion() && LOCALES.includes(String(req.hostname || '').toLowerCase());
}

/** Usuarios del seed (db/02_seed.sql). Solo se exponen si mostrarCredencialesDemo(). */
const CREDENCIALES_DEMO = [
  { usuario: 'admin', password: 'admin123', rol: 'ADMIN' },
  { usuario: 'vendedor', password: 'vendedor123', rol: 'VENDEDOR' },
];

/** Secreto JWT débil: vacío, corto o el valor de ejemplo de .env.example. */
function jwtSecretDebil(s = process.env.JWT_SECRET) {
  return !s || s.length < 32 || /cambiar/i.test(s);
}

module.exports = {
  origenesPermitidos, limiteLogin, cookieSegura, esProduccion, mostrarCredencialesDemo, CREDENCIALES_DEMO, jwtSecretDebil,
};
