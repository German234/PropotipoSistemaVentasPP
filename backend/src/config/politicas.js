/**
 * Políticas de autorización por operación sensible (roles que pueden ejecutarla).
 *
 * PENDIENTE DE VALIDACIÓN (Product Owner): invalidar un DTE anula un documento ya sellado por MH
 * y revierte inventario. Propuesta inicial: solo ADMIN. Si negocio decide habilitar otro rol
 * (p. ej. un supervisor o el propio VENDEDOR), basta con agregarlo aquí.
 */
const ROLES_INVALIDAR = ['ADMIN'];

module.exports = { ROLES_INVALIDAR };
