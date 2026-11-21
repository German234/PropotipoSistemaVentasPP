/**
 * Genera las tablas de evidencia del hito KAN-23 a partir de los RESULTADOS REALES (no a mano):
 *   - docs/kan-23/generado/trazabilidad.md   requisito → prueba(s) → resultado
 *   - docs/kan-23/generado/autorizacion.md   ruta × rol (sin sesión / VENDEDOR / ADMIN) con el resultado de cada prueba
 *   - docs/kan-23/generado/casos-prueba.md   todos los casos (Jest + Playwright) con su estado
 *   - docs/kan-23/generado/cobertura.md      cobertura por archivo
 *
 * Entradas (las produce la ejecución documentada en docs/kan-23/README.md):
 *   docs/kan-23/evidencia/jest-resultados.json        npx jest --runInBand --coverage --json --outputFile=…
 *   docs/kan-23/evidencia/e2e/resultados.json         npm run test:e2e con E2E_OUT=docs/kan-23/evidencia/e2e
 *   docs/kan-23/evidencia/cobertura/coverage-summary.json
 *
 *   node tests/tools/reporteKan23.js          (desde backend/)
 * Sale con código 1 si un requisito no tiene pruebas o alguna falló.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');
const EV = path.join(RAIZ, 'docs', 'kan-23', 'evidencia');
const OUT = path.join(RAIZ, 'docs', 'kan-23', 'generado');

// ---------- casos: Jest + Playwright aplanados a { archivo, nombre, estado } ----------
const jest = JSON.parse(fs.readFileSync(path.join(EV, 'jest-resultados.json'), 'utf8'));
const casos = [];
for (const s of jest.testResults) {
  const archivo = 'tests/' + s.name.split(/[\\/]tests[\\/]/)[1].replace(/\\/g, '/');
  for (const a of s.assertionResults) {
    casos.push({ archivo, nombre: [...a.ancestorTitles, a.title].filter(Boolean).join(' › '), estado: a.status === 'passed' ? 'OK' : a.status.toUpperCase() });
  }
}
const e2e = JSON.parse(fs.readFileSync(path.join(EV, 'e2e', 'resultados.json'), 'utf8'));
(function recorrer(suites, padres) {
  for (const su of suites || []) {
    const titulos = su.file && su.title === su.file ? padres : [...padres, su.title];
    for (const sp of su.specs || []) {
      const ok = sp.ok && sp.tests.every((t) => t.results.every((r) => r.status === 'passed'));
      casos.push({ archivo: 'tests/e2e/' + path.basename(sp.file), nombre: [...titulos, sp.title].join(' › '), estado: ok ? 'OK' : 'FALLA' });
    }
    recorrer(su.suites, titulos);
  }
})(e2e.suites, []);

/** [archivo (subcadena), regex sobre "describe › prueba"] */
const buscar = (sel) => casos.filter((c) => sel.some(([f, re]) => c.archivo.includes(f) && (!re || re.test(c.nombre))));

// ---------- requisitos (fuente: CLAUDE.md, docs/API.md, docs/SEGURIDAD.md, fases del proyecto) ----------
const R = (id, requisito, fuente, sel) => ({ id, requisito, fuente, sel });
const REQUISITOS = [
  // Reglas generales del DTE
  R('RQ-DTE-01', 'codigoGeneracion UUID v4 en MAYÚSCULAS', 'CLAUDE.md', [['dte01', /emisión exitosa/], ['dte03', /emisión exitosa/]]),
  R('RQ-DTE-02', 'numeroControl DTE-{tipo}-{M001P001}-{15 dígitos}, un correlativo por tipo, sin repetidos en concurrencia', 'CLAUDE.md', [['dte01', /correlativo|consecutivo|concurrencia|empezando/i], ['dte03', /01|correlativo|independiente/i]]),
  R('RQ-DTE-03', 'JSON con identificacion…apendice (sin extension) y válido contra schemas-mh', 'CLAUDE.md', [['unit/builders', null]]),
  R('RQ-DTE-04', 'Dinero a 2 decimales (redondeo half-up sin error de coma flotante)', 'CLAUDE.md', [['unit/utilidades', /redondear2/], ['unit/calculos', /porcentaje/]]),
  R('RQ-DTE-05', 'resumen.totalLetras ("CIENTO TRECE 00/100 USD")', 'CLAUDE.md', [['unit/numeroALetras', null]]),
  R('RQ-DTE-06', 'Firmador simulado {status:"OK", body: JWS falso}', 'CLAUDE.md', [['unit/simuladores', /firmador/]]),
  R('RQ-DTE-07', 'Respuesta MH simulada (sello de 40, fhProcesamiento, observaciones)', 'CLAUDE.md', [['unit/simuladores', /MH recepción/]]),
  R('RQ-DTE-08', 'Respuesta estándar {ok,data} / {ok:false,error} y códigos del contrato', 'API.md', [['integration/auth', null], ['unit/middleware', /errores/]]),
  // 01 / 03 / 05
  R('RQ-01-01', '01 Factura: precio con IVA, IVA incluido, receptor opcional, descuento y stock', 'CLAUDE.md', [['dte01', /emisión exitosa|variantes/], ['unit/calculos', /calcularFactura/]]),
  R('RQ-01-02', '01 Factura: errores de validación y stock no consumen correlativo', 'API.md', [['dte01', /errores/]]),
  R('RQ-03-01', '03 CCF: precios sin IVA, tributo 20, 40 × P001 = 113.00', 'CLAUDE.md', [['dte03', /emisión exitosa|variantes/], ['unit/calculos', /calcularCcf/]]),
  R('RQ-03-02', '03 CCF: receptor CONTRIBUYENTE con NIT, NRC y actividad', 'CLAUDE.md', [['dte03', /validaciones del receptor/]]),
  R('RQ-05-01', '05 NC: solo sobre 03 PROCESADO, mismo receptor, documentoRelacionado', 'CLAUDE.md', [['dte05', /reglas del documento relacionado|emisión exitosa/]]),
  R('RQ-05-02', '05 NC: cantidades ≤ pendientes, descuento proporcional, devuelve stock', 'CLAUDE.md', [['dte05', /límites de cantidad/], ['unit/calculos', /calcularNotaCredito/]]),
  // Contingencia
  R('RQ-CON-01', 'X-Simular ok | rechazo | contingencia | timeout (inválido → 400)', 'CLAUDE.md', [['integration/contingencia', /X-Simular/], ['consultaMh', /timeout/]]),
  R('RQ-CON-02', 'Rechazo: RECHAZADO sin sello, no descuenta stock', 'API.md', [['integration/contingencia', /Rechazo/]]),
  R('RQ-CON-03', 'Contingencia: tipoModelo/tipoOperacion 2, firmado así; reintento conserva códigos', 'CLAUDE.md', [['integration/contingencia', /Contingencia/], ['unit/contingencia', /enContingencia/], ['eventoContingencia', /DTE emitido en contingencia/]]),
  R('RQ-CON-04', 'Evento de contingencia v4: aceptado transmite los DTE; rechazado/sin respuesta los deja pendientes', 'CLAUDE.md', [['eventoContingencia', /validaciones|aceptado|rechazado|seleccionados|GET/]]),
  R('RQ-CON-05', 'Lote manual y automático (cierre del día) con recepción por lote', 'Fase C2', [['loteContingencia', null]]),
  R('RQ-CON-06', 'Cola de consultas a MH: un DTE por turno, descubre los sellados por timeout', 'Fase C3', [['consultaMh', /consultar|Cola|Reenvío|PUT/]]),
  R('RQ-CON-07', 'Tareas programadas persistentes tras reinicio, sin duplicados, con registro', 'Fase 5', [['tareasProgramadas', null]]),
  R('RQ-CON-08', 'UI: emisión en contingencia → lote → PROCESADO; reintento desde Transacciones', 'Fase C1/C2', [['e2e/06-contingencia', null]]),
  // Invalidación
  R('RQ-INV-01', 'Invalidación solo de PROCESADO; 03 con NC vigente no se invalida; evento v3 con sello; devuelve stock', 'CLAUDE.md', [['invalidacion', /Factura 01|Nota de crédito|tipos de anulación|rechazando/]]),
  R('RQ-INV-02', 'Invalidar solo ADMIN (S1)', 'Fase S1', [['invalidacion', /autorización/], ['autorizacion', /invalidar/]]),
  R('RQ-INV-03', 'UI: anular desde Transacciones y descargar el PDF real', 'Fase F4/P1', [['e2e/05-invalidacion-pdf', null], ['integration/pdf', null]]),
  // Catálogos y UI de venta
  R('RQ-CAT-01', 'Productos: CRUD solo ADMIN; clientes con catálogos MH y edición', 'API.md / P2 / KAN-34', [['catalogos', /Productos|Clientes/]]),
  R('RQ-CAT-02', 'UI: alta y edición de clientes con validación fiscal', 'KAN-34', [['e2e/03-clientes', null]]),
  R('RQ-UI-01', 'UI: venta y emisión de 01 y 03 desde Nueva venta', 'Fase F3', [['e2e/04-venta-dte', null]]),
  R('RQ-UI-02', 'Listados, detalle de DTE y bitácora', 'API.md', [['integration/consultas', null]]),
  // Seguridad
  R('RQ-SEG-01', 'Toda ruta salvo health/login/logout exige sesión (40 rutas protegidas)', 'CLAUDE.md / SEGURIDAD.md', [['autorizacion', /^Sin sesión/]]),
  R('RQ-SEG-02', 'Token manipulado, sin firma (alg none) o de otro secreto → 401; el rol sale solo del token', 'SEGURIDAD.md', [['autorizacion', /^Token manipulado/], ['unit/middleware', /middleware\/auth ›/]]),
  R('RQ-SEG-03', 'Rutas de solo ADMIN → 403 a VENDEDOR sin efectos (Bearer y cookie+CSRF)', 'SEGURIDAD.md', [['autorizacion', /^VENDEDOR en rutas de solo ADMIN/]]),
  R('RQ-SEG-04', 'Rutas de cualquier rol sin 403 para VENDEDOR; ADMIN autorizado en las suyas', 'SEGURIDAD.md', [['autorizacion', /^Rutas de cualquier rol|^ADMIN en rutas/]]),
  R('RQ-SEG-05', 'Sesión en cookie HttpOnly + CSRF', 'SEGURIDAD.md §4', [['integration/seguridad', /cookie HttpOnly/], ['unit/middleware', /cookie de sesión/]]),
  R('RQ-SEG-06', 'Límite de intentos de login (429)', 'SEGURIDAD.md §3', [['integration/seguridad', /Límite de intentos/]]),
  R('RQ-SEG-07', 'CORS por lista y cabeceras/CSP', 'SEGURIDAD.md §1, §6', [['integration/seguridad', /CORS|Cabeceras/]]),
  R('RQ-SEG-08', 'Errores 500 sin detalles internos; 413', 'SEGURIDAD.md §2', [['integration/seguridad', /Errores sin detalles/], ['unit/middleware', /errores/]]),
  R('RQ-SEG-09', 'Credenciales demo solo en local; JWT_SECRET débil detectado', 'SEGURIDAD.md §5, §8', [['integration/seguridad', /Credenciales/], ['unit/middleware', /config\/seguridad/]]),
  R('RQ-SEG-10', 'UI oculta lo de ADMIN al VENDEDOR y la API lo rechaza', 'Fase F2/S1', [['e2e/02-roles', null]]),
  R('RQ-SEG-11', 'Login, cookie HttpOnly sin JWT en almacenamiento, recarga y logout (UI)', 'SEGURIDAD.md §4', [['e2e/01-login', null]]),
  R('RQ-SEG-12', 'Reset de la demo restaura datos del seed (D1)', 'Fase 4', [['resetDemo', null]]),
  R('RQ-SEG-13', 'Bitácora: solo ADMIN la lee (VENDEDOR → 403, ADMIN → 200) y se siguen registrando las acciones del VENDEDOR', 'KAN-32 / KAN-36',
    [['consultas', /KAN-36/], ['autorizacion', /GET \/api\/bitacora$/], ['e2e/02-roles', /bitácora|ADMIN: ve/]]),
  // Fase 6
  R('RQ-F6-01', 'Usuarios: CRUD solo ADMIN, sin hash, no auto-desactivarse, siempre un ADMIN activo', 'Fase 6', [['fase6', /^Usuarios/], ['e2e/07-fase6', /Usuarios/]]),
  R('RQ-F6-02', 'Borradores por usuario (ajeno → 404), total estimado, se eliminan al emitir', 'Fase 6', [['fase6', /^Borradores/], ['e2e/07-fase6', /Borradores/]]),
  R('RQ-F6-03', 'Correo SIMULADO: enviado:false, bitácora; la UI nunca dice "enviado"', 'Fase 6', [['fase6', /^Correo/], ['e2e/07-fase6', /Correo/]]),
  R('RQ-F6-04', 'Reportes gerenciales con DTE reales (solo ADMIN)', 'Fase 6', [['fase6', /^Reportes/], ['e2e/07-fase6', /Panel gerencial/]]),
  R('RQ-F6-05', 'Configuración: emisor real de solo lectura; firmador identificado como simulado', 'Fase 6', [['e2e/07-fase6', /Configuración/], ['catalogos', /Emisor/]]),
];

// ---------- escritura ----------
fs.mkdirSync(OUT, { recursive: true });
const ahora = new Date().toISOString().slice(0, 19).replace('T', ' ');
const cab = (t) => `# ${t}\n\n> Generado por \`backend/tests/tools/reporteKan23.js\` el ${ahora} UTC desde \`docs/kan-23/evidencia/\`. No editar a mano.\n\n`;
const esc = (s) => String(s).replace(/\|/g, '\\|');
let problemas = 0;

// trazabilidad
let t = cab('Matriz de trazabilidad: requisito → prueba → resultado');
t += '| ID | Requisito | Fuente | Pruebas (archivo: casos) | Resultado |\n|---|---|---|---|---|\n';
for (const r of REQUISITOS) {
  const c = buscar(r.sel);
  const porArchivo = {};
  c.forEach((x) => { porArchivo[x.archivo] = porArchivo[x.archivo] || [0, 0]; porArchivo[x.archivo][1]++; if (x.estado === 'OK') porArchivo[x.archivo][0]++; });
  const ok = c.filter((x) => x.estado === 'OK').length;
  const res = c.length === 0 ? '⚠️ SIN PRUEBA' : ok === c.length ? `✅ ${ok}/${c.length}` : `❌ ${ok}/${c.length}`;
  if (c.length === 0 || ok !== c.length) problemas++;
  t += `| ${r.id} | ${esc(r.requisito)} | ${esc(r.fuente)} | ${Object.entries(porArchivo).map(([f, [o, n]]) => `\`${f.replace('tests/', '')}\`: ${o}/${n}`).join('<br>')} | ${res} |\n`;
}
const cubiertos = REQUISITOS.filter((r) => { const c = buscar(r.sel); return c.length && c.every((x) => x.estado === 'OK'); }).length;
t += `\n**${cubiertos} de ${REQUISITOS.length} requisitos con todas sus pruebas aprobadas.** Un caso puede respaldar más de un requisito.\n`;
fs.writeFileSync(path.join(OUT, 'trazabilidad.md'), t);

// autorización ruta × rol
const norm = (s) => s.replace(/\$\{[^}]+\}/g, ':id').replace(/\/999999$/, '/:id');
const az = casos.filter((c) => c.archivo.includes('autorizacion'));
const rutas = new Map();
const celda = (ruta) => { if (!rutas.has(ruta)) rutas.set(ruta, { sin: [], vend: [], admin: [], soloAdmin: false }); return rutas.get(ruta); };
for (const c of az) {
  const m = c.nombre.match(/((?:GET|POST|PUT|DELETE) \S+)$/);
  if (!m) continue;
  const ruta = norm(m[1]);
  const x = celda(ruta);
  if (/^Sin sesión/.test(c.nombre)) x.sin.push(c.estado);
  else if (/^VENDEDOR en rutas de solo ADMIN/.test(c.nombre)) { x.vend.push(c.estado); x.soloAdmin = true; }
  else if (/^Rutas de cualquier rol/.test(c.nombre)) x.vend.push(c.estado);
  else if (/^ADMIN en rutas/.test(c.nombre)) x.admin.push(c.estado);
}
const r1 = (arr, txt) => (arr.length ? (arr.every((e) => e === 'OK') ? `✅ ${txt}` : `❌ ${txt}`) : '—');
let a = cab('Pruebas de autorización por rol (ruta × rol)');
a += 'Fuente: `tests/integration/autorizacion.test.js`. "403 sin efectos" = la prueba compara productos, DTE, contingencia, configuración, usuarios y bitácora antes y después de los intentos denegados; se prueba por `Authorization: Bearer` y por cookie de sesión + `X-CSRF-Token` válido.\n\n';
a += '| Ruta | Política | Sin sesión | VENDEDOR | ADMIN |\n|---|---|---|---|---|\n';
const orden = [...rutas.entries()].sort((p, q) => (q[1].soloAdmin - p[1].soloAdmin) || p[0].localeCompare(q[0]));
for (const [ruta, x] of orden) {
  if (!x.sin.length && !x.vend.length) continue;
  a += `| \`${ruta}\` | ${x.soloAdmin ? '**Solo ADMIN**' : 'Cualquier rol'} | ${r1(x.sin, '401')} | ${x.soloAdmin ? r1(x.vend, `403 sin efectos (${x.vend.length} vías)`) : r1(x.vend, 'permitido')} | ${x.soloAdmin ? r1(x.admin, 'permitido') : '✅ permitido (resto de suites)'} |\n`;
}
const extra = az.filter((c) => !/((?:GET|POST|PUT|DELETE) \S+)$/.test(c.nombre));
a += `\nControles transversales:\n\n${extra.map((c) => `- ${c.estado === 'OK' ? '✅' : '❌'} ${esc(c.nombre)}`).join('\n')}\n`;
const nRutas = orden.filter(([, x]) => x.sin.length).length;
a += `\n**${nRutas} rutas protegidas en la matriz; ${az.filter((c) => c.estado === 'OK').length}/${az.length} casos aprobados.**\n`;
fs.writeFileSync(path.join(OUT, 'autorizacion.md'), a);
if (az.some((c) => c.estado !== 'OK')) problemas++;

// casos de prueba
const porArch = new Map();
casos.forEach((c) => { if (!porArch.has(c.archivo)) porArch.set(c.archivo, []); porArch.get(c.archivo).push(c); });
let cp = cab('Casos de prueba y resultados');
const tot = casos.length, okT = casos.filter((c) => c.estado === 'OK').length;
cp += `**${okT}/${tot} casos aprobados** (Jest ${jest.numPassedTests}/${jest.numTotalTests} en ${jest.numTotalTestSuites} suites; Playwright ${casos.filter((c) => c.archivo.includes('e2e/') && c.estado === 'OK').length}/${casos.filter((c) => c.archivo.includes('e2e/')).length}).\n\n`;
cp += '| Archivo | Tipo | Casos | Aprobados |\n|---|---|---|---|\n';
for (const [f, l] of [...porArch].sort()) {
  const tipo = f.includes('/unit/') ? 'Unitaria' : f.includes('/e2e/') ? 'E2E (navegador)' : 'Integración (API + BD)';
  cp += `| \`${f}\` | ${tipo} | ${l.length} | ${l.filter((c) => c.estado === 'OK').length} |\n`;
}
cp += '\n## Detalle\n';
for (const [f, l] of [...porArch].sort()) {
  cp += `\n### \`${f}\`\n\n| # | Caso | Resultado |\n|---|---|---|\n`;
  l.forEach((c, i) => { cp += `| ${i + 1} | ${esc(c.nombre)} | ${c.estado === 'OK' ? '✅' : '❌ ' + c.estado} |\n`; });
}
fs.writeFileSync(path.join(OUT, 'casos-prueba.md'), cp);

// cobertura
const cov = JSON.parse(fs.readFileSync(path.join(EV, 'cobertura', 'coverage-summary.json'), 'utf8'));
let cv = cab('Cobertura de código del backend (Jest)');
const T = cov.total;
cv += `Alcance: \`backend/src/**/*.js\` salvo \`server.js\` (arranque). El frontend no se instrumenta: se verifica con las pruebas e2e.\n\n`;
cv += '| Métrica | % | Cubiertas / total |\n|---|---|---|\n';
for (const k of ['statements', 'branches', 'functions', 'lines']) {
  cv += `| ${{ statements: 'Sentencias', branches: 'Ramas', functions: 'Funciones', lines: 'Líneas' }[k]} | **${T[k].pct} %** | ${T[k].covered} / ${T[k].total} |\n`;
}
cv += '\n## Por archivo (ordenado por ramas)\n\n| Archivo | Sentencias | Ramas | Funciones | Líneas |\n|---|---|---|---|---|\n';
Object.entries(cov).filter(([k]) => k !== 'total')
  .map(([k, v]) => [k.split(/[\\/]backend[\\/]/)[1].replace(/\\/g, '/'), v])
  .sort((p, q) => p[1].branches.pct - q[1].branches.pct || p[0].localeCompare(q[0]))
  .forEach(([f, v]) => { cv += `| \`${f}\` | ${v.statements.pct} | ${v.branches.pct} | ${v.functions.pct} | ${v.lines.pct} |\n`; });
fs.writeFileSync(path.join(OUT, 'cobertura.md'), cv);

console.log(`Casos: ${okT}/${tot}. Requisitos con pruebas aprobadas: ${cubiertos}/${REQUISITOS.length}. Rutas en la matriz de autorización: ${nRutas}.`);
for (const r of REQUISITOS) { const c = buscar(r.sel); if (!c.length) console.log('SIN PRUEBA:', r.id); }
process.exit(problemas ? 1 : 0);
