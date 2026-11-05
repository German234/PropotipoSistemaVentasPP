const path = require('path');
const express = require('express');
const cors = require('cors');
const { noEncontrado, manejadorErrores } = require('./middleware/errores');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ---- Rutas API ----
app.use('/api/health', require('./routes/health'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/emisor', require('./routes/emisor'));
app.use('/api/dte', require('./routes/dte'));
app.use('/api/contingencia', require('./routes/contingencia'));
app.use('/api/bitacora', require('./routes/bitacora'));

// Rutas /api no definidas → 404 con formato estándar
app.use('/api', noEncontrado);

// Frontend estático (mismo origen que la API)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(manejadorErrores);

module.exports = app;
