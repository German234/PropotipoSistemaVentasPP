/**
 * Tareas programadas de contingencia (Fase 5): configuración persistente, candado de ejecución y registro.
 *
 *   dbo.config_tarea    una fila por tarea (LOTE_CONTINGENCIA, CONSULTA_MH). Se crea la primera vez con los valores
 *                       de backend/.env; después manda la BD, así la configuración sobrevive a reinicios.
 *   dbo.ejecucion_tarea una fila por ejecución: disparo, proceso, inicio/fin, resultado, mensaje, detalle y error.
 *
 * Candado: adquirir() marca la tarea "en curso" con un UPDATE atómico condicionado; si otro proceso (u otro turno
 * del mismo) ya la tiene, no se ejecuta (resultado OMITIDA). Vence a los `ttlSeg` por si el proceso murió a mitad.
 * Toda la interacción con Hacienda sigue siendo simulada; aquí solo se coordina cuándo se llama.
 */
const os = require('os');
const crypto = require('crypto');
const { query } = require('../config/db');

const TAREAS = ['LOTE_CONTINGENCIA', 'CONSULTA_MH'];
/** Identidad de este proceso en el candado y en el registro. */
const PROCESO = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`.slice(0, 100);

const fila = (r) => r && {
  activo: Boolean(r.activo),
  hora: r.hora,
  intervaloSeg: r.intervaloSeg,
  enCursoDesde: r.enCursoDesde,
  enCursoPor: r.enCursoPor,
  ultimaEjecucionDia: r.ultimaEjecucionDia ? r.ultimaEjecucionDia.toISOString().slice(0, 10) : null,
};

const COLS = `activo, hora, intervalo_seg AS intervaloSeg, en_curso_desde AS enCursoDesde, en_curso_por AS enCursoPor,
              ultima_ejecucion_dia AS ultimaEjecucionDia`;

/**
 * Configuración de la tarea. Si no existe la fila, la crea con `porDefecto` ({activo, hora?, intervaloSeg?}).
 * UPDLOCK+HOLDLOCK: dos procesos que arrancan a la vez no chocan con la clave primaria.
 */
async function leerConfig(tarea, porDefecto) {
  if (!TAREAS.includes(tarea)) throw new Error(`Tarea desconocida: ${tarea}`);
  await query(
    `INSERT INTO dbo.config_tarea (tarea, activo, hora, intervalo_seg)
     SELECT @tarea, @activo, @hora, @intervalo
     WHERE NOT EXISTS (SELECT 1 FROM dbo.config_tarea WITH (UPDLOCK, HOLDLOCK) WHERE tarea = @tarea)`,
    { tarea, activo: porDefecto.activo, hora: porDefecto.hora || null, intervalo: porDefecto.intervaloSeg || null }
  );
  const r = await query(`SELECT ${COLS} FROM dbo.config_tarea WHERE tarea = @tarea`, { tarea });
  return fila(r.recordset[0]);
}

/** Guarda los cambios ({activo?, hora?, intervaloSeg?}) y devuelve la configuración resultante. */
async function guardarConfig(tarea, cambios, porDefecto, usuarioId) {
  await leerConfig(tarea, porDefecto);
  await query(
    `UPDATE dbo.config_tarea
     SET activo = COALESCE(@activo, activo), hora = COALESCE(@hora, hora), intervalo_seg = COALESCE(@intervalo, intervalo_seg),
         actualizado_por = @usuarioId, actualizado_en = SYSDATETIME()
     WHERE tarea = @tarea`,
    {
      tarea, usuarioId: usuarioId || null,
      activo: cambios.activo === undefined ? null : cambios.activo,
      hora: cambios.hora === undefined ? null : cambios.hora,
      intervalo: cambios.intervaloSeg === undefined ? null : cambios.intervaloSeg,
    }
  );
  return leerConfig(tarea, porDefecto);
}

/**
 * Intenta tomar el candado. `dia` (YYYY-MM-DD, solo el temporizador del lote): además exige que la tarea no se haya
 * ejecutado ya ese día, para que un reinicio u otro proceso no repitan el lote del cierre.
 * @returns {{ ok: true } | { ok: false, motivo: string }}
 */
async function adquirir(tarea, ttlSeg, { dia = null } = {}) {
  const r = await query(
    `UPDATE dbo.config_tarea SET en_curso_desde = SYSDATETIME(), en_curso_por = @proceso
     OUTPUT inserted.tarea
     WHERE tarea = @tarea
       AND (en_curso_desde IS NULL OR en_curso_desde < DATEADD(SECOND, -@ttl, SYSDATETIME()))
       AND (@dia IS NULL OR ultima_ejecucion_dia IS NULL OR ultima_ejecucion_dia < CAST(@dia AS DATE))`,
    { tarea, proceso: PROCESO, ttl: ttlSeg, dia }
  );
  if (r.recordset.length) return { ok: true };
  const c = fila((await query(`SELECT ${COLS} FROM dbo.config_tarea WHERE tarea = @tarea`, { tarea })).recordset[0]);
  if (dia && c && c.ultimaEjecucionDia && c.ultimaEjecucionDia >= dia) {
    return { ok: false, motivo: `El lote automático ya se ejecutó el ${c.ultimaEjecucionDia}` };
  }
  return { ok: false, motivo: `Ya hay una ejecución en curso (proceso ${c && c.enCursoPor}, desde ${c && c.enCursoDesde && c.enCursoDesde.toISOString()})` };
}

/** Suelta el candado (solo si lo tiene este proceso). Con `dia`, marca el lote de ese día como hecho. */
async function liberar(tarea, { dia = null } = {}) {
  await query(
    `UPDATE dbo.config_tarea
     SET en_curso_desde = NULL, en_curso_por = NULL,
         ultima_ejecucion_dia = CASE WHEN @dia IS NULL THEN ultima_ejecucion_dia ELSE CAST(@dia AS DATE) END
     WHERE tarea = @tarea AND en_curso_por = @proceso`,
    { tarea, proceso: PROCESO, dia }
  );
}

/** Inserta una ejecución en dbo.ejecucion_tarea. Nunca lanza (si la BD falla, queda en el log del servidor). */
async function registrarEjecucion({ tarea, disparo, inicio, fin = new Date(), resultado, mensaje, detalle, error }) {
  try {
    const r = await query(
      `INSERT INTO dbo.ejecucion_tarea (tarea, disparo, proceso, inicio, fin, resultado, mensaje, detalle, error)
       OUTPUT inserted.id VALUES (@tarea, @disparo, @proceso, @inicio, @fin, @resultado, @mensaje, @detalle, @error)`,
      {
        tarea, disparo, proceso: PROCESO, inicio, fin, resultado,
        mensaje: mensaje ? String(mensaje).slice(0, 500) : null,
        detalle: detalle === undefined ? null : JSON.stringify(detalle),
        error: error ? String((error && error.stack) || error) : null,
      }
    );
    return r.recordset[0].id;
  } catch (e) {
    console.error(`[${tarea}] no se pudo registrar la ejecución (${resultado}):`, e.message);
    return null;
  }
}

/** `detalle` de la última ejecución real (sin las OMITIDA) o null. Sobrevive a reinicios. */
async function ultimaEjecucion(tarea) {
  const r = await query(
    `SELECT TOP 1 detalle FROM dbo.ejecucion_tarea WHERE tarea = @tarea AND resultado <> 'OMITIDA' ORDER BY id DESC`,
    { tarea }
  );
  return r.recordset[0] && r.recordset[0].detalle ? JSON.parse(r.recordset[0].detalle) : null;
}

/** GET /api/contingencia/ejecuciones — más reciente primero. El texto del error no se expone (solo `conError`). */
async function listarEjecuciones({ tarea, limite } = {}) {
  const r = await query(
    `SELECT TOP (@top) id, tarea, disparo, proceso, inicio, fin, resultado, mensaje, detalle,
            CASE WHEN error IS NULL THEN 0 ELSE 1 END AS conError
     FROM dbo.ejecucion_tarea WHERE (@tarea IS NULL OR tarea = @tarea) ORDER BY id DESC`,
    { tarea: tarea || null, top: limite }
  );
  return r.recordset.map((x) => ({
    id: x.id, tarea: x.tarea, disparo: x.disparo, proceso: x.proceso,
    inicio: x.inicio.toISOString(), fin: x.fin.toISOString(), duracionMs: x.fin - x.inicio,
    resultado: x.resultado, mensaje: x.mensaje, detalle: x.detalle ? JSON.parse(x.detalle) : null, conError: Boolean(x.conError),
  }));
}

/** Fecha local YYYY-MM-DD (el lote del cierre usa la hora local del servidor). */
function hoy(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

module.exports = {
  TAREAS, PROCESO, leerConfig, guardarConfig, adquirir, liberar, registrarEjecucion, ultimaEjecucion, listarEjecuciones, hoy,
};
