/**
 * db/03_reset_demo.sql deja los datos como recién sembrados (lo usan la demo y cada archivo de integración).
 * Regresión (Fase 4): desde KAN-34 los clientes se editan en la UI y el reset solo los reactivaba; un cliente del
 * seed editado o renombrado quedaba distinto o desaparecía, y una prueba que editaba a Juan Pérez rompía otra.
 */
const { prepararApi, cerrarBd } = require('../helpers/api');
const { reiniciarBd } = require('../helpers/testDb');

let t;
beforeAll(async () => { t = await prepararApi(); });
afterAll(cerrarBd);

const porNombre = async (nombre) =>
  (await t.admin('get', '/api/clientes').query({ q: nombre, incluirInactivos: 1 })).body.data.find((c) => c.nombre === nombre);

test('restaura los datos de los clientes del seed editados, renombrados o desactivados, y borra los nuevos', async () => {
  const juanSeed = await porNombre('Juan Pérez');
  const robleSeed = await porNombre('Distribuidora El Roble, S.A. de C.V.');

  await t.admin('put', `/api/clientes/${juanSeed.id}`).send({
    telefono: '7777-0000', correo: 'otro@correo.com', tipoDocumento: null, numDocumento: null, direccion: null,
  });
  await t.admin('put', `/api/clientes/${robleSeed.id}`).send({ nombre: 'Roble Renombrado', nrc: '999' });
  await t.admin('put', `/api/clientes/${t.cli.libreria.id}`).send({ activo: false });
  await t.admin('post', '/api/clientes').send({ tipo: 'CONSUMIDOR', nombre: 'Cliente Temporal QA' });

  await reiniciarBd();

  const { id: _a, ...juan } = await porNombre('Juan Pérez');           // eslint-disable-line no-unused-vars
  const { id: _b, ...juanEsperado } = juanSeed;                        // eslint-disable-line no-unused-vars
  expect(juan).toEqual(juanEsperado);
  const roble = await porNombre('Distribuidora El Roble, S.A. de C.V.');
  const { id: _c, ...robleEsperado } = robleSeed;                      // eslint-disable-line no-unused-vars
  expect({ ...roble, id: undefined }).toEqual({ ...robleEsperado, id: undefined });
  expect(await porNombre('Roble Renombrado')).toBeUndefined();
  expect((await porNombre('Librería Cuscatlán, S.A. de C.V.')).activo).toBe(true);
  expect(await porNombre('Cliente Temporal QA')).toBeUndefined();
  expect((await t.admin('get', '/api/clientes').query({ incluirInactivos: 1 })).body.data).toHaveLength(4);
});
