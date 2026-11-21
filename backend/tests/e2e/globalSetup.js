/** Deja la BD de pruebas recién sembrada antes de las pruebas e2e. Nunca toca la BD de la demo. */
module.exports = async () => {
  require('../setupEnv'); // fuerza DB_NAME = BatallonAtlacatl_Test y aborta si fuera la BD de la demo
  if (/^BatallonAtlacatl$/i.test(process.env.DB_NAME)) throw new Error('e2e: no se permite la BD de la demo');
  const { crearBd } = require('../helpers/testDb');
  await crearBd();
};
