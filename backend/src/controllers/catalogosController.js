const catalogos = require('../dte/catalogosMh');
const { ok } = require('../utils/respuesta');

/** GET /api/catalogos — catálogos MH para el formulario de clientes (sin BD: viven en dte/catalogosMh.js). */
const obtener = (req, res) => ok(res, { departamentos: catalogos.departamentos, tiposDocumento: catalogos.tiposDocumento });

module.exports = { obtener };
