const path = require('path');
const express = require('express');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');
const { corsConfigurado, cabecerasSeguridad } = require('./middleware/seguridad');
const { mostrarCredencialesDemo } = require('./config/seguridad');

const app = express();

app.disable('x-powered-by');
// Detrás de un proxy inverso (TRUST_PROXY=1): req.ip y req.secure salen de X-Forwarded-* (límite de login, cookie Secure)
if (process.env.TRUST_PROXY) app.set('trust proxy', /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);

app.use(cabecerasSeguridad);
app.use(corsConfigurado);
app.use(express.json({ limit: '1mb' }));

// ---- Rutas API ----
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/emisor', require('./routes/emisor'));
app.use('/api/catalogos', require('./routes/catalogos'));
app.use('/api/dte', require('./routes/dte'));
app.use('/api/contingencia', require('./routes/contingencia'));
app.use('/api/bitacora', require('./routes/bitacora'));

// Rutas /api no definidas → 404 con formato estándar
app.use('/api', noEncontrado);

// Catálogos MH compartidos con el frontend (global CATALOGOS_MH; lo usan los mocks)
app.get('/js/catalogos-mh.js', (req, res) => res.type('application/javascript').sendFile(path.join(__dirname, 'dte', 'catalogosMh.js')));

// Los mocks del frontend traen los usuarios de prueba: fuera del entorno académico local se sirve un archivo vacío
app.get('/js/mocks.js', (req, res, next) => {
  if (mostrarCredencialesDemo(req)) return next();
  res.type('application/javascript').send('/* mocks deshabilitados fuera del entorno académico local */\n');
});

// Frontend estático (mismo origen que la API)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(manejadorErrores);

module.exports = app;
