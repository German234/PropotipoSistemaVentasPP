const service = require('../services/emisorService');
const { ok } = require('../utils/respuesta');

const obtener = async (req, res) => ok(res, await service.obtener());

module.exports = { obtener };
