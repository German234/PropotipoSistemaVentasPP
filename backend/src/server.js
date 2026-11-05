require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en backend/.env');
  process.exit(1);
}
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT} (health: /api/health)`);
});
