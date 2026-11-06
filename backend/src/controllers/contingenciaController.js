const service = require('../services/contingenciaService');
const programacion = require('../services/loteAutomaticoService');
const consultasMh = require('../services/consultaMhService');
const { leerModo } = require('../dte/simuladores/mhRecepcion');
const { ok } = require('../utils/respuesta');
const v = require('../utils/validar');

/** POST /api/contingencia (ADMIN) — X-Simular aplica al evento. */
const enviar = async (req, res) => ok(res, await service.enviar(req.body || {}, req.usuario, leerModo(req)), 201);

/** GET /api/contingencia */
const listar = async (req, res) => ok(res, await service.listar());

/** GET /api/contingencia/:id */
const obtener = async (req, res) => ok(res, await service.obtener(v.id(req.params.id)));

/** GET /api/contingencia/programacion — lote automático del cierre del día */
const obtenerProgramacion = async (req, res) => ok(res, await programacion.obtener());

/** PUT /api/contingencia/programacion (ADMIN) — { activo?, hora? } */
const actualizarProgramacion = async (req, res) => ok(res, await programacion.actualizar(req.body, req.usuario));

/** GET /api/contingencia/consultas — cola de consultas a MH */
const obtenerConsultas = async (req, res) => ok(res, await consultasMh.obtener());

/** PUT /api/contingencia/consultas (ADMIN) — { activo?, intervaloSeg? } */
const actualizarConsultas = async (req, res) => ok(res, await consultasMh.actualizar(req.body, req.usuario));

module.exports = { enviar, listar, obtener, obtenerProgramacion, actualizarProgramacion, obtenerConsultas, actualizarConsultas };
