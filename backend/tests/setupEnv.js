/**
 * Corre antes de cada archivo de prueba: carga backend/.env y apunta DB_NAME a la BD de pruebas.
 * DB_TEST_NAME permite otro nombre; nunca se permite usar la BD de la demo.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const BD_DEMO = 'BatallonAtlacatl';
process.env.DB_NAME = process.env.DB_TEST_NAME || `${BD_DEMO}_Test`;
if (process.env.DB_NAME.toLowerCase() === BD_DEMO.toLowerCase()) {
  throw new Error(`Las pruebas no pueden usar la BD de la demo (${BD_DEMO}). Use DB_TEST_NAME.`);
}
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'secreto-de-pruebas';
