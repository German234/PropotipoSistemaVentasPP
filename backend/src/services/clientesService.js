const { query } = require('../config/db');
const { AppError } = require('../utils/respuesta');
const { registrar } = require('../utils/bitacora');
const v = require('../utils/validar');
const catalogos = require('../dte/catalogosMh');

const COLS = `id, tipo, nombre, nombre_comercial AS nombreComercial, tipo_documento AS tipoDocumento,
              num_documento AS numDocumento, nit, nrc, cod_actividad AS codActividad, desc_actividad AS descActividad,
              direccion AS complemento, direccion_departamento AS departamento, direccion_municipio AS municipio,
              direccion_distrito AS distrito, telefono, correo, activo`;
const TIPOS = ['CONSUMIDOR', 'CONTRIBUYENTE'];
const TIPOS_DOC = catalogos.tiposDocumento.map((t) => t.codigo);

/** Fila SQL → forma del contrato (dirección anidada como en el DTE). */
function aCliente(f) {
  const { complemento, departamento, municipio, distrito, ...resto } = f;
  return {
    ...resto,
    direccion: complemento || departamento ? { departamento, municipio, distrito, complemento } : null,
  };
}

/** ?q busca en nombre, nombre comercial, documento, NIT o NRC; ?tipo filtra. Por defecto solo activos. */
async function listar({ q, tipo, incluirInactivos } = {}) {
  if (tipo && !TIPOS.includes(tipo)) v.falla(`tipo debe ser ${TIPOS.join(' o ')}`);
  const r = await query(
    `SELECT ${COLS} FROM dbo.clientes
     WHERE (@todos = 1 OR activo = 1)
       AND (@tipo IS NULL OR tipo = @tipo)
       AND (@q IS NULL OR nombre LIKE @q OR nombre_comercial LIKE @q OR nit LIKE @q OR nrc LIKE @q OR num_documento LIKE @q)
     ORDER BY nombre`,
    { q: q && q.trim() ? `%${q.trim()}%` : null, tipo: tipo || null, todos: incluirInactivos ? 1 : 0 }
  );
  return r.recordset.map(aCliente);
}

async function obtener(id) {
  const r = await query(`SELECT ${COLS} FROM dbo.clientes WHERE id = @id`, { id });
  if (!r.recordset[0]) throw new AppError('NO_ENCONTRADO', `Cliente ${id} no existe`, 404);
  return aCliente(r.recordset[0]);
}

function nrc(valor) {
  const d = String(valor ?? '').replace(/[-\s]/g, '');
  if (!/^\d{1,8}$/.test(d)) v.falla('nrc debe tener de 1 a 8 dígitos');
  return d;
}

/** CAT-019: los códigos de actividad económica tienen 5 dígitos (el esquema MH admite 5–6). */
function codActividad(valor) {
  const d = String(valor ?? '').trim();
  if (!/^\d{5,6}$/.test(d)) v.falla('codActividad debe tener 5 o 6 dígitos (CAT-019)');
  return d;
}

function telefono(valor) {
  const t = v.textoOpc(valor, 'telefono', 30);
  if (t && !/^[0-9+()\-\s]+$/.test(t)) v.falla('telefono solo admite dígitos, espacios, +, - y paréntesis');
  if (t && t.replace(/\D/g, '').length < 8) v.falla('telefono debe tener al menos 8 dígitos');
  return t;
}

/** Número según el tipo de documento (CAT-022): NIT 9/14 dígitos, DUI 9 dígitos, otros texto libre. */
function numDocumento(tipo, valor) {
  if (valor == null || String(valor).trim() === '') v.falla('numDocumento es obligatorio si se indica tipoDocumento');
  if (tipo === '36') return v.digitos(valor, 'numDocumento (NIT)', [9, 14]);
  if (tipo === '13') return v.digitos(valor, 'numDocumento (DUI)', [9]);
  return v.texto(String(valor), 'numDocumento', 20);
}

/**
 * Dirección MH: { departamento (CAT-012), municipio (CAT-013), distrito, complemento }.
 * Los tres códigos se validan contra backend/src/dte/catalogosMh.js y deben estar anidados
 * (el municipio pertenece al departamento y el distrito al municipio).
 */
function direccion(valor) {
  if (valor == null) return null;
  if (typeof valor !== 'object' || Array.isArray(valor)) {
    v.falla('direccion debe ser un objeto { departamento, municipio, distrito, complemento }');
  }
  const cod = (x) => (x == null ? '' : String(x).trim());
  const dep = cod(valor.departamento);
  const mun = cod(valor.municipio);
  const dis = cod(valor.distrito);
  const b = catalogos.buscar(dep, mun, dis);
  if (!b.departamento) v.falla(`direccion.departamento "${dep}" no existe en el catálogo MH (CAT-012)`);
  if (!b.municipio) v.falla(`direccion.municipio "${mun}" no pertenece al departamento ${b.departamento.nombre} (CAT-013)`);
  if (!b.distrito) v.falla(`direccion.distrito "${dis}" no pertenece al municipio ${b.municipio.nombre}`);
  return { departamento: dep, municipio: mun, distrito: dis, complemento: v.texto(valor.complemento, 'direccion.complemento', 200) };
}

/**
 * Valida y normaliza. `base` = valores actuales (para PUT parcial).
 * CONTRIBUYENTE: nit, nrc, codActividad, descActividad y dirección completa obligatorios (los exige el CCF);
 *   su documento es siempre NIT (tipoDocumento "36").
 * CONSUMIDOR: todo opcional salvo nombre; documento con tipoDocumento + numDocumento
 *   (compatibilidad: `nit` solo equivale a tipoDocumento "36").
 */
function normalizar(body, base = {}) {
  const d = { ...base, ...body };
  if (!TIPOS.includes(d.tipo)) v.falla(`tipo debe ser ${TIPOS.join(' o ')}`);
  if ('nit' in body && !('tipoDocumento' in body)) {
    d.tipoDocumento = body.nit ? '36' : null;
    d.numDocumento = body.nit;
  }

  const c = {
    tipo: d.tipo,
    nombre: v.texto(d.nombre, 'nombre', 250),
    nombreComercial: v.textoOpc(d.nombreComercial, 'nombreComercial', 150),
    telefono: telefono(d.telefono),
    correo: v.textoOpc(d.correo, 'correo', 100),
    activo: d.activo === undefined ? true : Boolean(d.activo),
  };
  if (c.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.correo)) v.falla('correo no es válido');

  // Dirección: una dirección antigua sin códigos (anterior a P2) se conserva si el PUT no la toca.
  const dirLegada = !('direccion' in body) && base.direccion && !base.direccion.departamento;
  const dir = dirLegada ? base.direccion : direccion(d.direccion);

  if (c.tipo === 'CONTRIBUYENTE') {
    if (!d.nit) v.falla('nit es obligatorio para CONTRIBUYENTE');
    if (!d.nrc) v.falla('nrc es obligatorio para CONTRIBUYENTE');
    if (!dir) v.falla('direccion (departamento, municipio, distrito y complemento) es obligatoria para CONTRIBUYENTE');
    c.nit = v.digitos(d.nit, 'nit', [9, 14]);
    c.tipoDocumento = '36';
    c.numDocumento = c.nit;
    c.nrc = nrc(d.nrc);
    c.codActividad = codActividad(d.codActividad);
    c.descActividad = v.texto(d.descActividad, 'descActividad', 150);
  } else {
    const tipoDoc = d.tipoDocumento ? String(d.tipoDocumento) : null;
    if (tipoDoc && !TIPOS_DOC.includes(tipoDoc)) v.falla(`tipoDocumento debe ser uno de ${TIPOS_DOC.join(', ')} (CAT-022)`);
    c.tipoDocumento = tipoDoc;
    c.numDocumento = tipoDoc ? numDocumento(tipoDoc, d.numDocumento) : null;
    c.nit = tipoDoc === '36' ? c.numDocumento : null;
    c.nrc = d.nrc ? nrc(d.nrc) : null;
    c.codActividad = d.codActividad ? codActividad(d.codActividad) : null;
    c.descActividad = v.textoOpc(d.descActividad, 'descActividad', 150);
  }
  c.direccion = dir;
  return c;
}

/** Parámetros SQL (dirección aplanada en columnas). */
const params = (c) => ({
  ...c,
  direccion: c.direccion ? c.direccion.complemento : null,
  departamento: c.direccion ? c.direccion.departamento : null,
  municipio: c.direccion ? c.direccion.municipio : null,
  distrito: c.direccion ? c.direccion.distrito : null,
});

async function crear(body, usuarioId) {
  const c = normalizar(body);
  const r = await query(
    `INSERT INTO dbo.clientes (tipo, nombre, nombre_comercial, tipo_documento, num_documento, nit, nrc,
                               cod_actividad, desc_actividad, direccion, direccion_departamento, direccion_municipio,
                               direccion_distrito, telefono, correo, activo)
     OUTPUT inserted.id
     VALUES (@tipo, @nombre, @nombreComercial, @tipoDocumento, @numDocumento, @nit, @nrc,
             @codActividad, @descActividad, @direccion, @departamento, @municipio,
             @distrito, @telefono, @correo, @activo)`,
    params(c)
  );
  const id = r.recordset[0].id;
  await registrar(usuarioId, 'CREAR', 'cliente', id, c);
  return obtener(id);
}

async function actualizar(id, body, usuarioId) {
  const actual = await obtener(id);
  const c = normalizar(body, actual);
  await query(
    `UPDATE dbo.clientes SET tipo = @tipo, nombre = @nombre, nombre_comercial = @nombreComercial,
            tipo_documento = @tipoDocumento, num_documento = @numDocumento, nit = @nit, nrc = @nrc,
            cod_actividad = @codActividad, desc_actividad = @descActividad,
            direccion = @direccion, direccion_departamento = @departamento, direccion_municipio = @municipio,
            direccion_distrito = @distrito, telefono = @telefono, correo = @correo, activo = @activo
     WHERE id = @id`,
    { ...params(c), id }
  );
  await registrar(usuarioId, 'ACTUALIZAR', 'cliente', id, { antes: actual, cambios: body });
  return obtener(id);
}

module.exports = { listar, obtener, crear, actualizar, normalizar, COLS, aCliente };
