const service = require('../services/dteService');
const consultas = require('../services/dteConsultasService');
const { leerModo } = require('../dte/simuladores/mhRecepcion');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');

/** El modo de MH (ok | rechazo | contingencia) sale del header X-Simular. */

/** POST /api/dte/01 y /api/dte/03 */
const emitir = (tipo) => async (req, res) =>
  ok(res, await service.emitir(tipo, req.body || {}, req.usuario, leerModo(req)), 201);

/** POST /api/dte/05 */
const emitir05 = async (req, res) =>
  ok(res, await service.emitirNotaCredito(req.body || {}, req.usuario, leerModo(req)), 201);

/** POST /api/dte/:id/reintentar */
const reintentar = async (req, res) =>
  ok(res, await service.reintentar(v.id(req.params.id), req.usuario, leerModo(req)));

/** POST /api/dte/:id/invalidar */
const invalidar = async (req, res) =>
  ok(res, await service.invalidar(v.id(req.params.id), req.body || {}, req.usuario, leerModo(req)));

/** GET /api/dte?tipo=&estado=&desde=&hasta=&clienteId= */
const listar = async (req, res) => {
  const { tipo, estado, desde, hasta, clienteId } = req.query;
  ok(res, await consultas.listar({ tipo, estado, desde, hasta, clienteId }));
};

/** GET /api/dte/:id */
const obtener = async (req, res) => ok(res, await consultas.obtener(v.id(req.params.id)));

module.exports = { emitir01: emitir('01'), emitir03: emitir('03'), emitir05, reintentar, invalidar, listar, obtener };
