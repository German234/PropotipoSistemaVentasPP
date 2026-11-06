const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');

/** Emisor único (id = 1) con la forma del contrato (dirección anidada). B3 lo reutiliza para armar el DTE. */
async function obtener() {
  const r = await query(`SELECT * FROM dbo.emisor WHERE id = 1`);
  const e = r.recordset[0];
  if (!e) throw new AppError('NO_ENCONTRADO', 'No hay emisor configurado (ejecute db/02_seed.sql)', 404);
  return {
    nit: e.nit,
    nrc: e.nrc,
    nombre: e.nombre,
    codActividad: e.cod_actividad,
    descActividad: e.desc_actividad,
    nombreComercial: e.nombre_comercial,
    tipoEstablecimiento: e.tipo_establecimiento,
    direccion: {
      departamento: e.direccion_departamento,
      municipio: e.direccion_municipio,
      complemento: e.direccion_complemento,
    },
    telefono: e.telefono,
    correo: e.correo,
    codEstable: e.cod_estable_mh,
    codPuntoVenta: e.cod_punto_venta_mh,
  };
}

module.exports = { obtener };
