const service = require('../services/bitacoraService');
const { ok } = require('../utils/respuesta');

/** GET /api/bitacora?accion=&entidad=&dteId=&usuario=&desde=&hasta=&limite= */
const listar = async (req, res) => {
  const { accion, entidad, dteId, usuario, desde, hasta, limite } = req.query;
  ok(res, await service.listar({ accion, entidad, dteId, usuario, desde, hasta, limite }));
};

module.exports = { listar };
