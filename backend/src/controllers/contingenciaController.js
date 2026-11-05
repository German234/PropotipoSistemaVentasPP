const service = require('../services/contingenciaService');
const { leerModo } = require('../dte/simuladores/mhRecepcion');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');

/** POST /api/contingencia (ADMIN) — X-Simular aplica al evento. */
const enviar = async (req, res) => ok(res, await service.enviar(req.body || {}, req.usuario, leerModo(req)), 201);

/** GET /api/contingencia */
const listar = async (req, res) => ok(res, await service.listar());

/** GET /api/contingencia/:id */
const obtener = async (req, res) => ok(res, await service.obtener(v.id(req.params.id)));

module.exports = { enviar, listar, obtener };
