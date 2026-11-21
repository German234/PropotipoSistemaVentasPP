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

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT} (health: /api/health)`);
  console.log(`CORS permitido para: ${seg.origenesPermitidos().join(', ')}`);
  loteAutomatico.iniciar();
  consultasMh.iniciar();
  console.log(`Cola de consultas a MH: ${consultasMh._estado.activo ? `1 DTE cada ${consultasMh._estado.intervaloSeg} s` : 'desactivada'}`);
  loteAutomatico.obtener()
    .then((p) => console.log(`Lote automático de contingencia: ${p.activo ? `todos los días a las ${p.hora} (próximo: ${p.proximaEjecucion})` : 'desactivado'}`))
    .catch(() => {});
});
