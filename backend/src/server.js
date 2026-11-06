require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}
const app = require('./app');
const loteAutomatico = require('./services/loteAutomaticoService');
const consultasMh = require('./services/consultaMhService');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT} (health: /api/health)`);
  loteAutomatico.iniciar();
  consultasMh.iniciar();
  console.log(`Cola de consultas a MH: ${consultasMh._estado.activo ? `1 DTE cada ${consultasMh._estado.intervaloSeg} s` : 'desactivada'}`);
  loteAutomatico.obtener()
    .then((p) => console.log(`Lote automático de contingencia: ${p.activo ? `todos los días a las ${p.hora} (próximo: ${p.proximaEjecucion})` : 'desactivado'}`))
    .catch(() => {});
});
