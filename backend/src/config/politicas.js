/**
 * Políticas de autorización por operación sensible (roles que pueden ejecutarla).
 *
 * PENDIENTE DE VALIDACIÓN (Product Owner): invalidar un DTE anula un documento ya sellado por MH
 * y revierte inventario. Propuesta inicial: solo ADMIN. Si negocio decide habilitar otro rol
 * (p. ej. un supervisor o el propio VENDEDOR), basta con agregarlo aquí.
 */
const ROLES_INVALIDAR = ['ADMIN'];

/**
 * KAN-36 / KAN-32: leer la bitácora de auditoría (GET /api/bitacora). Solo ADMIN, igual que en la UI, donde la
 * bitácora vive en Administración. Restringe solo la LECTURA: las acciones de cualquier rol se siguen
 * registrando (utils/bitacora.js no depende de esta política).
 */
const ROLES_LEER_BITACORA = ['ADMIN'];

module.exports = { ROLES_INVALIDAR, ROLES_LEER_BITACORA };
