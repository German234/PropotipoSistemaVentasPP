/**
 * Fase 6: reportes gerenciales (GET /api/reportes/resumen, solo ADMIN), calculados con los DTE reales.
 * Definiciones:
 *   - Vigente = estado PROCESADO o CONTINGENCIA (venta válida; la de contingencia está pendiente de transmitir).
 *     RECHAZADO e INVALIDADO no suman montos, solo aparecen en `porEstado`.
 *   - ventasBrutas = total de 01 + 03 vigentes; notasCredito = total de 05 vigentes; ventasNetas = la resta.
 *   - documentos y ticketPromedio cuentan solo 01 + 03 vigentes.
 *   - `tipo` (01|03|05) filtra todo el reporte; fechas por día de emisión (hora local del servidor).
 * Sumas en centavos enteros para no arrastrar error de coma flotante.
 */
const { query } = require('../config/db');
const v = require('../utils/validar');

const TIPOS = ['01', '03', '05'];
const ESTADOS = ['PROCESADO', 'CONTINGENCIA', 'RECHAZADO', 'INVALIDADO'];
const VIGENTES = ['PROCESADO', 'CONTINGENCIA'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const cent = (n) => Math.round(Number(n) * 100);
const dol = (c) => c / 100;

function fecha(valor, campo) {
  if (!FECHA.test(valor)) v.falla(`${campo} debe tener formato YYYY-MM-DD`);
  const d = new Date(`${valor}T00:00:00`);
  if (Number.isNaN(d.getTime()) || ymd(d) !== valor) v.falla(`${campo} no es una fecha válida`);
  return d;
}

/** Período: por defecto del día 1 del mes actual a hoy. */
function periodo({ desde, hasta }) {
  const hoy = new Date();
  const d = desde ? fecha(desde, 'desde') : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const h = hasta ? fecha(hasta, 'hasta') : new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  if (d > h) v.falla('desde no puede ser posterior a hasta');
  const dias = Math.round((h - d) / 86400000) + 1;
  if (dias > MAX_DIAS) v.falla(`el período admite máximo ${MAX_DIAS} días`);
  return { desde: ymd(d), hasta: ymd(h), dias, inicio: d };
}

async function resumen({ desde, hasta, tipo } = {}) {
  if (tipo && !TIPOS.includes(tipo)) v.falla(`tipo debe ser ${TIPOS.join(', ')}`);
  const p = periodo({ desde, hasta });
  const r = await query(
    `SELECT CONVERT(CHAR(10), CAST(d.fecha_emision AS DATE), 23) AS dia, d.tipo_dte AS tipoDte, d.estado,
            u.usuario, u.nombre, COUNT(*) AS n, SUM(d.total) AS total, SUM(d.iva) AS iva
     FROM dbo.dte d JOIN dbo.usuarios u ON u.id = d.usuario_id
     WHERE d.estado <> 'BORRADOR'
       AND d.fecha_emision >= CAST(@desde AS DATE) AND d.fecha_emision < DATEADD(DAY, 1, CAST(@hasta AS DATE))
       AND (@tipo IS NULL OR d.tipo_dte = @tipo)
     GROUP BY CAST(d.fecha_emision AS DATE), d.tipo_dte, d.estado, u.usuario, u.nombre`,
    { desde: p.desde, hasta: p.hasta, tipo: tipo || null }
  );

  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0]));
  const dias = new Map();
  for (let i = 0; i < p.dias; i++) {
    const d = new Date(p.inicio.getFullYear(), p.inicio.getMonth(), p.inicio.getDate() + i);
    dias.set(ymd(d), { fecha: ymd(d), documentos: 0, total: 0 });
  }
  const tipos = new Map((tipo ? [tipo] : TIPOS).map((t) => [t, { tipoDte: t, documentos: 0, total: 0 }]));
  const vendedores = new Map();
  let ventas = 0; let nc = 0; let iva = 0; let documentos = 0;

  for (const f of r.recordset) {
    porEstado[f.estado] = (porEstado[f.estado] || 0) + f.n;
    if (!VIGENTES.includes(f.estado)) continue;
    const c = cent(f.total);
    const venta = f.tipoDte !== '05';
    const t = tipos.get(f.tipoDte);
    t.documentos += f.n; t.total += c;
    if (!vendedores.has(f.usuario)) vendedores.set(f.usuario, { usuario: f.usuario, nombre: f.nombre, documentos: 0, total: 0, notasCredito: 0 });
    const vd = vendedores.get(f.usuario);
    if (venta) {
      ventas += c; iva += cent(f.iva); documentos += f.n;
      const dia = dias.get(f.dia);
      if (dia) { dia.documentos += f.n; dia.total += c; }
      vd.documentos += f.n; vd.total += c;
    } else {
      nc += c; iva -= cent(f.iva);
      vd.notasCredito += c;
    }
  }

  return {
    periodo: { desde: p.desde, hasta: p.hasta, tipo: tipo || null },
    totales: {
      ventasBrutas: dol(ventas),
      notasCredito: dol(nc),
      ventasNetas: dol(ventas - nc),
      iva: dol(iva),
      documentos,
      ticketPromedio: documentos ? dol(Math.round(ventas / documentos)) : 0,
    },
    porEstado,
    porDia: [...dias.values()].map((d) => ({ ...d, total: dol(d.total) })),
    porTipo: [...tipos.values()].map((t) => ({ ...t, total: dol(t.total) })),
    porVendedor: [...vendedores.values()]
      .map((x) => ({ ...x, total: dol(x.total), notasCredito: dol(x.notasCredito) }))
      .sort((a, b) => b.total - a.total || a.usuario.localeCompare(b.usuario)),
  };
}

module.exports = { resumen };
