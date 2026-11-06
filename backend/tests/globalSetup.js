/** Prepara la BD de pruebas una vez antes de las pruebas de integración. */
module.exports = async () => {
  require('./setupEnv');
  const { crearBd } = require('./helpers/testDb');
  try {
    await crearBd();
  } catch (err) {
    throw new Error(
      `No se pudo preparar la BD de pruebas ${process.env.DB_NAME}: ${err.message}\n` +
        'Revise SQL Server y las credenciales de backend/.env (el usuario necesita permiso para CREATE DATABASE).'
    );
  }
};
