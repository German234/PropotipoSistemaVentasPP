/**
 * Representación gráfica (PDF) de un DTE, con la plantilla del prototipo (frontend/js/pdf-data.js):
 * encabezado con logo y título, metadatos + QR de consulta MH, recuadros EMISOR/RECEPTOR,
 * tabla de ítems, tabla de totales, valor en letras / observaciones, responsables y franja inferior.
 *
 * generar(dte) recibe el resultado de dteConsultasService.obtener(id) y resuelve con un Buffer PDF.
 * Todo sale del JSON del DTE guardado (jsonDte), así el PDF coincide con lo que se "transmitió".
 */
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const catalogos = require('./catalogosMh');

const C = {
  navy: '#0e2a47',
  teal: '#14a3a0',
  orange: '#f5a623',
  ink: '#1c2b3a',
  gris: '#5b6673',
  borde: '#a9b1bb',
  fondo: '#eef1f5',
  linea: '#d9dee6',
  rojo: '#c0392b',
};

const NOMBRE_TIPO = { '01': 'FACTURA', '03': 'COMPROBANTE DE CRÉDITO FISCAL', '05': 'NOTA DE CRÉDITO' };
const CONDICION = { 1: 'Contado', 2: 'A crédito', 3: 'Otro' };
const UNIDAD = { 59: 'Unidad', 99: 'Otra' };

const ND = 'N/D';
const val = (v) => (v === null || v === undefined || v === '' ? ND : String(v));
const money = (n) => '$' + Number(n || 0).toFixed(2);

/** 06140101001010 → 0614-010100-101-0 */
const fmtNit = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 4)}-${d.slice(4, 10)}-${d.slice(10, 13)}-${d.slice(13)}`;
  if (d.length === 9) return `${d.slice(0, 8)}-${d.slice(8)}`; // DUI
  return val(n);
};
/** 1000017 → 100001-7 */
const fmtNrc = (n) => {
  const d = String(n || '').replace(/\D/g, '');
  return d.length > 1 ? `${d.slice(0, -1)}-${d.slice(-1)}` : val(n);
};
const fmtTel = (t) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : val(t);
};
/** "Complemento, Distrito de X, Municipio, Departamento" con los nombres del catálogo MH. */
const dir = (d) => (d && d.complemento ? catalogos.textoDireccion(d) : ND);

/** URL de consulta pública del MH (la que llevan los DTE reales en el QR). */
const urlConsulta = (j) =>
  `https://admin.factura.gob.sv/consultaPublica?ambiente=${j.identificacion.ambiente}` +
  `&codGen=${j.identificacion.codigoGeneracion}&fechaEmi=${j.identificacion.fecEmi}`;

/** Filas de totales según el tipo (01: IVA incluido; 03/05: IVA 13 % en tributos). */
function filasTotales(tipo, r) {
  const iva = (r.tributos || []).reduce((s, t) => s + Number(t.valor || 0), 0);
  const filas = [['Sumatoria de ventas:', r.subTotalVentas]];
  if (tipo !== '05') {
    filas.push(
      ['Monto global Desc., Rebajas y otros a ventas no sujetas:', r.descuNoSuj],
      ['Monto global Desc., Rebajas y otros a ventas exentas:', r.descuExenta],
      ['Monto global de Desc., Rebajas y otros a ventas gravadas:', r.descuGravada]
    );
  } else {
    filas.push(['Total descuentos:', r.totalDescu]);
  }
  if (tipo === '01') {
    filas.push(['Sub-Total:', r.subTotal], ['IVA incluido en ventas gravadas:', r.totalIva]);
  } else {
    filas.push(['Impuesto al Valor Agregado 13%:', iva]);
    if (r.subTotal !== undefined) filas.push(['Sub-Total:', r.subTotal]);
  }
  filas.push(
    ['IVA Percibido:', r.ivaPerci1 ?? r.ivaPerci ?? 0],
    ['IVA Retenido:', r.ivaRete1 ?? r.ivaRete ?? 0],
    ['Retención Renta:', r.reteRenta ?? 0],
    ['Monto Total de la Operación:', r.montoTotalOperacion],
    ['Total Otros montos no afectos:', r.totalNoGravado ?? 0],
    ['Total a pagar:', r.totalPagar ?? r.montoTotalOperacion]
  );
  return filas;
}

async function generar(dte) {
  const j = dte.jsonDte;
  const id = j.identificacion;
  const em = j.emisor || {};
  const re = j.receptor;
  const r = j.resumen || {};
  const qr = await QRCode.toBuffer(urlConsulta(j), { margin: 0, width: 220, errorCorrectionLevel: 'M' });

  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: 28, bottom: 28, left: 28, right: 28 },
    bufferPages: true,
    info: { Title: `DTE ${dte.numeroControl}`, Author: em.nombre || '', Subject: NOMBRE_TIPO[dte.tipoDte] || 'DTE' },
  });
  const chunks = [];
  doc.on('data', (b) => chunks.push(b));
  const fin = new Promise((res, rej) => { doc.on('end', () => res(Buffer.concat(chunks))); doc.on('error', rej); });

  const W = doc.page.width;   // 612
  const H = doc.page.height;  // 792
  const L = 28;
  const R = W - 28;
  const ANCHO = R - L;
  const LIMITE = H - 70;       // espacio reservado para la franja inferior

  const B = 'Helvetica-Bold';
  const N = 'Helvetica';
  const txt = (s, x, y, o = {}) => doc.font(o.font || N).fontSize(o.size || 7.5).fillColor(o.color || C.ink).text(s, x, y, { lineBreak: false, ...o });

  /* ---------- encabezado ---------- */
  doc.circle(L + 16, 46, 16).fill(C.navy);
  doc.save().lineWidth(2).strokeColor('#ffffff').lineJoin('round')
    .moveTo(L + 6, 51).lineTo(L + 12, 42).lineTo(L + 18, 50).lineTo(L + 26, 41).stroke().restore();
  doc.circle(L + 28, 33, 3.2).fill(C.orange);

  const marca = String(em.nombreComercial || em.nombre || 'Emisor').trim().split(/\s+/);
  const p1 = marca[0];
  const p2 = marca.slice(1).join(' ');
  doc.font(B).fontSize(18).fillColor(C.navy).text(p1, L + 40, 32, { lineBreak: false, continued: !!p2 });
  if (p2) doc.fillColor(C.teal).text('  ' + p2, { lineBreak: false });
  txt('Sistema de Ventas y Facturación Electrónica', L + 41, 53, { size: 6, color: C.gris });

  const xt = 270;
  txt('DOCUMENTO TRIBUTARIO ELECTRÓNICO', xt, 30, { font: B, size: 11, width: R - xt, align: 'center' });
  txt(NOMBRE_TIPO[dte.tipoDte] || `DTE ${dte.tipoDte}`, xt, 46, { font: B, size: 11, width: R - xt, align: 'center' });
  doc.rect(L, 64, ANCHO, 2).fill(C.navy);

  /* ---------- metadatos + QR ---------- */
  let y = 78;
  const meta = [
    ['Código de Generación:', id.codigoGeneracion],
    ['Número de Control:', id.numeroControl],
    ['Sello de recibido:', dte.selloRecibido || `Sin sello (${dte.estado})`],
  ];
  meta.forEach(([k, v]) => {
    txt(k, L, y, { font: B });
    txt(v, L, y + 9);
    y += 21;
  });

  doc.image(qr, W / 2 - 26, 84, { width: 52, height: 52 });
  txt('Consulta MH', W / 2 - 40, 144, { font: B, size: 6, width: 80, align: 'center' });

  const derecha = [
    ['Modelo de Facturación:', id.tipoModelo === 2 ? 'Modelo Facturación diferido' : 'Modelo Facturación previo'],
    ['Tipo de Transmisión:', id.tipoOperacion === 2 ? 'Transmisión por contingencia' : 'Transmisión normal'],
    ['Fecha y Hora de Generación:', `${id.fecEmi} ${id.horEmi}`],
  ];
  y = 78;
  derecha.forEach(([k, v]) => {
    txt(k, R - 200, y, { font: B, width: 200, align: 'right' });
    txt(v, R - 200, y + 10, { width: 200, align: 'right' });
    y += 33;
  });

  /* ---------- EMISOR / RECEPTOR ---------- */
  const yBox = 172;
  const hBox = 176;            // deja espacio para 2 líneas de dirección
  const wBox = (ANCHO - 10) / 2;
  const caja = (x, titulo, campos) => {
    doc.roundedRect(x, yBox, wBox, hBox, 8).lineWidth(1.2).strokeColor(C.borde).stroke();
    txt(titulo, x, yBox + 9, { font: B, size: 9, width: wBox, align: 'center' });
    let yy = yBox + 27;
    campos.forEach(([k, v], i) => {
      txt(k, x + 11, yy, { font: B, size: 7 });
      if (i === campos.length - 1) {
        // Dirección (último campo): hasta 2 líneas dentro del recuadro
        doc.font(N).fontSize(7).fillColor(C.ink).text(v, x + 11, yy + 8, { width: wBox - 22, height: 18, ellipsis: true });
      } else {
        txt(v, x + 11, yy + 8, { size: 7, width: wBox - 22, ellipsis: true });
      }
      yy += 17.5;
    });
  };
  caja(L, 'EMISOR', [
    ['Nombre o razón social:', val(em.nombre)],
    ['NIT:', fmtNit(em.nit)],
    ['NRC:', fmtNrc(em.nrc)],
    ['Actividad Económica:', val(em.descActividad)],
    ['Correo electrónico:', val(em.correo)],
    ['Nombre Comercial:', val(em.nombreComercial)],
    ['Teléfono:', fmtTel(em.telefono)],
    ['Dirección:', dir(em.direccion)],
  ]);
  caja(L + wBox + 10, 'RECEPTOR', re ? [
    ['Nombre o razón social:', val(re.nombre)],
    [re.nit || re.tipoDocumento === '36' ? 'NIT:' : 'Documento:', re.nit || re.numDocumento ? fmtNit(re.nit || re.numDocumento) : ND],
    ['NRC:', re.nrc ? fmtNrc(re.nrc) : ND],
    ['Actividad Económica:', val(re.descActividad)],
    ['Correo electrónico:', val(re.correo)],
    ['Nombre Comercial:', val(re.nombreComercial || re.nombre)],
    ['Teléfono:', re.telefono ? fmtTel(re.telefono) : ND],
    ['Dirección:', dir(re.direccion)],
  ] : [
    ['Nombre o razón social:', 'CONSUMIDOR FINAL'],
    ['NIT:', ND], ['NRC:', ND], ['Actividad Económica:', ND], ['Correo electrónico:', ND],
    ['Nombre Comercial:', ND], ['Teléfono:', ND], ['Dirección:', ND],
  ]);

  /* ---------- ítems ---------- */
  // [titulo, ancho, alineación]
  const cols = [
    ['No.', 24, 'center'], ['Código', 50, 'center'], ['Cant', 28, 'center'], ['Unidad', 36, 'left'],
    ['Descripción', 176, 'left'], ['Precio\nUnitario', 48, 'right'], ['Descuento', 46, 'right'],
    ['Ventas\nNo\nSuj.', 40, 'right'], ['Ventas\nExentas', 48, 'right'], ['Ventas\nGravadas', ANCHO - 496, 'right'],
  ];
  const cabecera = (yy) => {
    doc.rect(L, yy, ANCHO, 26).fill(C.fondo);
    let x = L;
    cols.forEach(([t, w, a]) => {
      const lineas = t.split('\n').length;
      doc.font(B).fontSize(5.6).fillColor(C.ink)
        .text(t, x + 3, yy + 13 - lineas * 3.4, { width: w - 6, align: a === 'left' && t === 'Descripción' ? 'center' : a === 'right' ? 'center' : a });
      x += w;
    });
    return yy + 30;
  };
  y = cabecera(yBox + hBox + 12);

  (j.cuerpoDocumento || []).forEach((it) => {
    const desc = String(it.descripcion || '');
    doc.font(N).fontSize(6.5);
    const hDesc = doc.heightOfString(desc, { width: cols[4][1] - 6 });
    const h = Math.max(14, hDesc + 6);
    if (y + h > LIMITE) { doc.addPage(); y = cabecera(40); }
    const celdas = [
      it.numItem, it.codigo || '', Number(it.cantidad).toFixed(1), UNIDAD[it.uniMedida] || it.uniMedida, desc,
      money(it.precioUni), money(it.montoDescu), money(it.ventaNoSuj), money(it.ventaExenta), money(it.ventaGravada),
    ];
    let x = L;
    cols.forEach(([, w, a], i) => {
      doc.font(N).fontSize(6.5).fillColor(C.ink)
        .text(String(celdas[i]), x + 3, y + 3, { width: w - 6, align: a, lineBreak: i === 4 });
      x += w;
    });
    y += h;
  });

  /* ---------- totales ---------- */
  const filas = filasTotales(dte.tipoDte, r);
  const xT = L + 186;
  const wEt = 248;
  const wVal = 70;
  const hFila = 14;
  if (y + filas.length * hFila > LIMITE) { doc.addPage(); y = 40; }
  doc.moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(C.linea).stroke();
  filas.forEach(([k, v], i) => {
    const ultimo = i === filas.length - 1;
    if (i % 2 === 0 || ultimo) doc.rect(xT, y, wEt + wVal, hFila).fill(C.fondo);
    doc.rect(xT, y, wEt + wVal, hFila).lineWidth(0.4).strokeColor(C.linea).stroke();
    doc.moveTo(xT + wEt, y).lineTo(xT + wEt, y + hFila).stroke();
    txt(k, xT, y + 4.5, { font: ultimo ? B : N, size: 6, width: wEt - 6, align: 'right' });
    txt(money(v), xT + wEt, y + 4.5, { font: ultimo ? B : N, size: 6, width: wVal - 8, align: 'right' });
    y += hFila;
  });

  /* ---------- valor en letras / observaciones ---------- */
  const obs = [];
  if (j.documentoRelacionado && j.documentoRelacionado.length) {
    obs.push('Documento relacionado: ' + j.documentoRelacionado.map((d) => `${d.numeroDocumento} (${d.fechaEmision})`).join(', '));
  }
  if (r.observaciones) obs.push(r.observaciones);
  if (dte.estado !== 'PROCESADO') obs.push(`Estado del documento: ${dte.estado}.`);
  obs.push('Documento demostrativo para prototipo académico - sin valor fiscal.');
  const textoObs = obs.join(' ');

  doc.font(N).fontSize(7);
  const hObs = Math.max(10, doc.heightOfString(textoObs, { width: ANCHO - 120 }));
  const hLetras = 48 + hObs;
  y += 12;
  if (y + hLetras + 52 > LIMITE) { doc.addPage(); y = 40; }
  doc.roundedRect(L, y, ANCHO, hLetras, 7).fill(C.fondo);
  txt('Valor en letras:', L + 18, y + 14, { font: B, size: 7 });
  txt(val(r.totalLetras), L + 102, y + 14, { size: 7, width: 230, ellipsis: true });
  txt('Condición de la operación:', L + 378, y + 14, { font: B, size: 7 });
  txt(CONDICION[r.condicionOperacion] || val(r.condicionOperacion), L + 478, y + 14, { size: 7 });
  doc.moveTo(L + 16, y + 28).lineTo(R - 16, y + 28).lineWidth(0.6).strokeColor('#ffffff').stroke();
  txt('Observaciones:', L + 18, y + 36, { font: B, size: 7 });
  doc.font('Helvetica-Oblique').fontSize(7).fillColor(C.gris).text(textoObs, L + 102, y + 36, { width: ANCHO - 120 });
  y += hLetras + 8;

  /* ---------- responsables ---------- */
  doc.roundedRect(L + 2, y, ANCHO - 4, 44, 7).fill(C.fondo);
  txt('Responsable por parte del Emisor:', L + 30, y + 10, { font: B, size: 7 });
  txt('No. documento:', L + 430, y + 10, { font: B, size: 7 });
  doc.moveTo(L + 26, y + 22).lineTo(R - 26, y + 22).lineWidth(0.6).strokeColor('#ffffff').stroke();
  txt('Responsable por parte del Receptor:', L + 30, y + 29, { font: B, size: 7 });
  txt('No. documento:', L + 430, y + 29, { font: B, size: 7 });

  /* ---------- sello de agua (no procesado) ---------- */
  const marcaAgua = { INVALIDADO: 'INVALIDADO', RECHAZADO: 'RECHAZADO', CONTINGENCIA: 'CONTINGENCIA' }[dte.estado];

  /* ---------- pie en todas las páginas ---------- */
  const rango = doc.bufferedPageRange();
  for (let p = 0; p < rango.count; p++) {
    doc.switchToPage(rango.start + p);
    doc.page.margins.bottom = 0; // el pie va debajo del margen: que PDFKit no abra otra página
    if (marcaAgua) {
      doc.save().rotate(-35, { origin: [W / 2, H / 2] }).opacity(0.12)
        .font(B).fontSize(72).fillColor(C.rojo)
        .text(marcaAgua, 0, H / 2 - 36, { width: W, align: 'center', lineBreak: false }).restore();
      doc.opacity(1);
    }
    txt(`Página ${p + 1} de ${rango.count}`, R - 100, H - 64, { font: B, size: 7, width: 100, align: 'right' });
    doc.rect(0, H - 34, W, 34).fill(C.navy);
    txt('Representación gráfica de DTE - Sistema de Ventas y Facturación Electrónica (DTE) - MVP', 0, H - 20,
      { size: 6.5, color: '#ffffff', width: W, align: 'center' });
  }

  doc.end();
  return fin;
}

module.exports = { generar, urlConsulta, fmtNit, fmtNrc };
