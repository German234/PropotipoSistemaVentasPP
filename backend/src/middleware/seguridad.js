/** CORS con lista de orígenes y cabeceras HTTP de seguridad (sin dependencias extra). */
const cors = require('cors');
const { origenesPermitidos } = require('../config/seguridad');

/**
 * CORS: solo los orígenes de CORS_ORIGENES (por defecto http://localhost:PORT y http://127.0.0.1:PORT).
 * Peticiones sin Origin (mismo origen, curl, Postman) pasan igual: CORS lo aplica el navegador.
 * Un origen no permitido no recibe Access-Control-Allow-Origin y el navegador bloquea la respuesta.
 */
const corsConfigurado = cors({
  origin(origin, cb) { cb(null, !origin || origenesPermitidos().includes(origin)); },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Simular', 'X-CSRF-Token'],
  maxAge: 600,
});

/**
 * CSP. El frontend usa ~100 manejadores inline (onclick="..."): `script-src-attr 'unsafe-inline'` los permite
 * mientras `script-src 'self'` bloquea cualquier <script> inline o externo inyectado. Quitar 'unsafe-inline'
 * de script-src-attr exige migrar los onclick a addEventListener (pendiente). Estilos inline también se usan.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function cabecerasSeguridad(req, res, next) {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  });
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  // Las respuestas de la API (datos fiscales, sesión) no se guardan en cachés intermedias ni del navegador
  if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
  next();
}

module.exports = { corsConfigurado, cabecerasSeguridad, CSP };
