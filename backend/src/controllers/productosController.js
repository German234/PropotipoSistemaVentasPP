const service = require('../services/productosService');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');

const listar = async (req, res) =>
  ok(res, await service.listar({ q: req.query.q, incluirInactivos: req.query.incluirInactivos === '1' }));

const obtener = async (req, res) => ok(res, await service.obtener(v.id(req.params.id)));

const crear = async (req, res) => ok(res, await service.crear(req.body || {}, req.usuario.id), 201);

const actualizar = async (req, res) =>
  ok(res, await service.actualizar(v.id(req.params.id), req.body || {}, req.usuario.id));

module.exports = { listar, obtener, crear, actualizar };
