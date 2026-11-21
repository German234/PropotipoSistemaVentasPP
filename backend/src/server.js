require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const seg = require('./config/seguridad');
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}
if (seg.jwtSecretDebil()) {
  const msg = 'JWT_SECRET es débil (menos de 32 caracteres o el valor de ejemplo). Genere uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"';
  if (seg.esProduccion()) { console.error(msg); process.exit(1); }
  console.warn('AVISO: ' + msg);
}
const app = require('./app');
const loteAutomatico = require('./services/loteAutomaticoService');
const consultasMh = require('./services/consultaMhService');

const PORT = Number(process.env.PORT) || 3000;

const server = app.listen(PORT, async () => {
  console.log(`API escuchando en http://localhost:${PORT} (health: /api/health)`);
  console.log(`CORS permitido para: ${seg.origenesPermitidos().join(', ')}`);
  // Fase 5: la configuración de las tareas se recupera de SQL Server (dbo.config_tarea); .env solo la primera vez.
  // Si la BD no responde, cada tarea reintenta leerla cada 60 s.
  const [lote, cola] = await Promise.all([loteAutomatico.iniciar(), consultasMh.iniciar()]);
  console.log(lote
    ? `Lote automático de contingencia: ${lote.activo ? `todos los días a las ${lote.hora}` : 'desactivado'} (configuración guardada)`
    : 'Lote automático de contingencia: no se pudo leer la configuración (¿BD caída o falta aplicar db/01_schema.sql?); reintenta cada 60 s');
  console.log(cola
    ? `Cola de consultas a MH: ${cola.activo ? `1 DTE cada ${cola.intervaloSeg} s` : 'desactivada'} (configuración guardada)`
    : 'Cola de consultas a MH: no se pudo leer la configuración (¿BD caída o falta aplicar db/01_schema.sql?); reintenta cada 60 s');
});

/** Apagado ordenado: detiene los temporizadores para no empezar un lote o turno a medias. */
function apagar(senal) {
  console.log(`${senal}: deteniendo tareas programadas y servidor`);
  loteAutomatico.detener();
  consultasMh.detener();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
