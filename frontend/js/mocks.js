/* mocks.js — backend simulado EN MEMORIA para el frontend (API_CONFIG.USE_MOCK = true).
 * Responde con EXACTAMENTE la forma de docs/API.md: { status, body: {ok,data} | {ok:false,error:{codigo,mensaje}} }.
 * Incluye firmador (JWS falso) y respuestaMh simulados, X-Simular ok|rechazo|contingencia,
 * correlativos por tipo, stock, NC con pendientes, invalidación, reintento y bitácora.
 * Datos iniciales = db/02_seed.sql. Se reinicia al recargar la página.
 * Solo expone el global MockApi (IIFE) para no chocar con los globales de app.js.
 */
var MockApi = (function () {
  'use strict';

  /* ---------- utilidades ---------- */
  function r2(n) { return Number(Math.round(Number(n) + 'e2') + 'e-2'); }
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + dos(d.getMonth() + 1) + '-' + dos(d.getDate()); }
  function hms(d) { return dos(d.getHours()) + ':' + dos(d.getMinutes()) + ':' + dos(d.getSeconds()); }
  function isoLocal(d) { return ymd(d) + 'T' + hms(d); }
  function fhProcesamiento(d) { return dos(d.getDate()) + '/' + dos(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + hms(d); }
  function clone(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  var ALFANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function rnd(n, chars) { var s = ''; for (var i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)]; return s; }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    }).toUpperCase();
  }
  function sello(d) { return String(d.getFullYear()) + rnd(36, ALFANUM); }
  function b64url(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  function Err(codigo, mensaje, status) { this.codigo = codigo; this.mensaje = mensaje; this.status = status; }
  function falla(codigo, mensaje, status) { throw new Err(codigo, mensaje, status); }
  var STATUS = { NO_AUTENTICADO: 401, CREDENCIALES: 401, VALIDACION: 400, SIN_PERMISO: 403, NO_ENCONTRADO: 404,
    ESTADO_INVALIDO: 409, STOCK_INSUFICIENTE: 409, DB_NO_DISPONIBLE: 503, MH_NO_DISPONIBLE: 503, ERROR_INTERNO: 500 };
  function err(codigo, mensaje) { falla(codigo, mensaje, STATUS[codigo] || 400); }

  /* ---------- número a letras: "CIENTO TRECE 00/100 USD" ---------- */
  var UNI = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE',
    'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  var DEC = ['', '', 'VEINTI', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  var CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function tres(x) {
    if (x === 100) return 'CIEN';
    var c = Math.floor(x / 100), d = x % 100, s = c ? CEN[c] + ' ' : '';
    if (d <= 20) s += UNI[d];
    else if (d < 30) s += 'VEINTI' + UNI[d % 10];
    else s += DEC[Math.floor(d / 10)] + (d % 10 ? ' Y ' + UNI[d % 10] : '');
    return s.trim();
  }
  function enteroLetras(n) {
    if (n === 0) return 'CERO';
    var mill = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000, s = '';
    if (mill) s += (mill === 1 ? 'UN MILLÓN' : tres(mill) + ' MILLONES') + ' ';
    if (miles) s += (miles === 1 ? 'MIL' : tres(miles) + ' MIL') + ' ';
    if (resto) s += tres(resto);
    return s.trim();
  }
  function numeroALetras(m) {
    var cents = Math.round(r2(m) * 100), ent = Math.floor(cents / 100), c = cents % 100;
    return enteroLetras(ent) + ' ' + dos(c) + '/100 USD';
  }

  /* ---------- estado (seed de db/02_seed.sql) ---------- */
  var db = {
    usuarios: [
      { id: 1, usuario: 'admin', password: 'admin123', nombre: 'Administrador', rol: 'ADMIN' },
      { id: 2, usuario: 'vendedor', password: 'vendedor123', nombre: 'Vendedor de Turno', rol: 'VENDEDOR' }
    ],
    emisor: {
      nit: '06140101001010', nrc: '100001', nombre: 'Batallón Atlacatl, S.A. de C.V.',
      codActividad: '47190', descActividad: 'Venta al por menor en comercios no especializados',
      nombreComercial: 'Tienda Atlacatl', tipoEstablecimiento: '02',
      direccion: { departamento: '06', municipio: '14', complemento: 'Calle Principal #1, San Salvador' },
      telefono: '22220000', correo: 'facturas@atlacatl.com.sv', codEstable: 'M001', codPuntoVenta: 'P001'
    },
    productos: [
      ['P001', 'Cuaderno universitario 100 hojas', 2.50, 100], ['P002', 'Lapicero azul', 0.35, 500],
      ['P003', 'Lápiz grafito HB', 0.25, 400], ['P004', 'Resma papel bond carta', 4.75, 60],
      ['P005', 'Folder manila carta', 0.15, 300], ['P006', 'Marcador permanente negro', 1.10, 150],
      ['P007', 'Calculadora científica', 18.50, 25], ['P008', 'Mochila escolar', 22.00, 30],
      ['P009', 'Corrector líquido', 1.25, 120], ['P010', 'Engrapadora metálica', 6.90, 40]
    ].map(function (p, i) { return { id: i + 1, codigo: p[0], descripcion: p[1], precio: p[2], stock: p[3], unidad: 59, activo: true }; }),
    clientes: [
      { id: 1, tipo: 'CONSUMIDOR', nombre: 'Juan Pérez', nit: null, nrc: null, codActividad: null, descActividad: null,
        direccion: 'Antiguo Cuscatlán, La Libertad', correo: 'juan.perez@correo.com', activo: true },
      { id: 2, tipo: 'CONSUMIDOR', nombre: 'María López', nit: null, nrc: null, codActividad: null, descActividad: null,
        direccion: 'Santa Tecla, La Libertad', correo: 'maria.lopez@correo.com', activo: true },
      { id: 3, tipo: 'CONTRIBUYENTE', nombre: 'Distribuidora El Roble, S.A. de C.V.', nit: '06142301001234', nrc: '1234567',
        codActividad: '46900', descActividad: 'Venta al por mayor de otros productos',
        direccion: 'Colonia Escalón, San Salvador', correo: 'compras@elroble.com.sv', activo: true },
      { id: 4, tipo: 'CONTRIBUYENTE', nombre: 'Librería Cuscatlán, S.A. de C.V.', nit: '06140512991021', nrc: '2345678',
        codActividad: '47610', descActividad: 'Venta al por menor de libros, periódicos y artículos de papelería',
        direccion: 'Centro de Gobierno, San Salvador', correo: 'admin@libreriacuscatlan.com.sv', activo: true }
    ],
    correlativos: { '01': 0, '03': 0, '05': 0 },
    dte: [],          // registro interno (ver guardarDte)
    eventos: [],      // invalidaciones
    eventosCont: [],  // eventos de contingencia
    bitacora: [],
    seq: { producto: 10, cliente: 4, dte: 0, evento: 0, eventoCont: 0, bitacora: 0 }
  };

  /* ---------- auth (token falso: base64url del payload) ---------- */
  function emitirToken(u) {
    var payload = { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, exp: Date.now() + 8 * 3600 * 1000 };
    return b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify(payload)) + '.mock';
  }
  function leerToken(headers) {
    var h = headers['Authorization'] || headers['authorization'] || '';
    var m = /^Bearer\s+(.+)$/.exec(h);
    if (!m) err('NO_AUTENTICADO', 'Falta el token de autenticación');
    try {
      var p = m[1].split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      var u = JSON.parse(decodeURIComponent(escape(atob(p))));
      if (!u.exp || u.exp < Date.now()) throw 0;
      return u;
    } catch (e) { err('NO_AUTENTICADO', 'Token inválido o expirado'); }
  }
  function requireAdmin(u) { if (u.rol !== 'ADMIN') err('SIN_PERMISO', 'El rol ' + u.rol + ' no permite esta operación'); }

  function bitacora(usuario, accion, entidad, entidadId, detalle, datos, extra) {
    extra = extra || {};
    db.bitacora.push({
      id: ++db.seq.bitacora, fecha: isoLocal(new Date()), usuario: usuario, accion: accion, entidad: entidad,
      entidadId: entidadId, dteId: entidad === 'dte' ? entidadId : null,
      codigoGeneracion: extra.codigoGeneracion || null, resultado: extra.resultado || null,
      detalle: detalle, datos: datos
    });
  }

  /* ---------- validación ---------- */
  function texto(v, campo, max) {
    if (typeof v !== 'string' || !v.trim()) err('VALIDACION', 'El campo ' + campo + ' es obligatorio');
    if (max && v.trim().length > max) err('VALIDACION', 'El campo ' + campo + ' admite máximo ' + max + ' caracteres');
    return v.trim();
  }
  function textoOpc(v) { return v == null || String(v).trim() === '' ? null : String(v).trim(); }
  function dinero(v, campo) { var n = Number(v); if (v === null || v === '' || isNaN(n) || n < 0) err('VALIDACION', 'El campo ' + campo + ' debe ser un monto ≥ 0'); return r2(n); }
  function entero(v, campo, min) { var n = Number(v); if (!Number.isInteger(n) || n < (min == null ? 0 : min)) err('VALIDACION', 'El campo ' + campo + ' debe ser un entero ≥ ' + (min == null ? 0 : min)); return n; }
  function digitos(v) { return v == null ? null : String(v).replace(/[^0-9]/g, '') || null; }
  function porId(lista, id, nombre) {
    var x = lista.filter(function (e) { return e.id === Number(id); })[0];
    if (!x) err('NO_ENCONTRADO', nombre + ' ' + id + ' no existe');
    return x;
  }
  function modoSimular(headers) {
    var m = String(headers['X-Simular'] || headers['x-simular'] || 'ok').trim().toLowerCase();
    if (['ok', 'rechazo', 'contingencia'].indexOf(m) === -1) err('VALIDACION', 'X-Simular debe ser ok | rechazo | contingencia');
    return m;
  }

  /* ---------- catálogos ---------- */
  function listarProductos(q) {
    var t = (q.q || '').toLowerCase();
    return db.productos.filter(function (p) {
      return (q.incluirInactivos == 1 || p.activo) &&
        (!t || p.codigo.toLowerCase().indexOf(t) !== -1 || p.descripcion.toLowerCase().indexOf(t) !== -1);
    }).map(clone);
  }
  function validarProducto(p, idActual) {
    p.codigo = texto(p.codigo, 'codigo', 25);
    p.descripcion = texto(p.descripcion, 'descripcion', 200);
    p.precio = dinero(p.precio, 'precio');
    p.stock = entero(p.stock == null ? 0 : p.stock, 'stock');
    p.unidad = entero(p.unidad == null ? 59 : p.unidad, 'unidad', 1);
    p.activo = p.activo !== false;
    if (db.productos.some(function (x) { return x.codigo === p.codigo && x.id !== idActual; })) err('VALIDACION', 'Ya existe un producto con el código ' + p.codigo);
    return p;
  }
  function validarCliente(c) {
    if (['CONSUMIDOR', 'CONTRIBUYENTE'].indexOf(c.tipo) === -1) err('VALIDACION', 'tipo debe ser CONSUMIDOR o CONTRIBUYENTE');
    c.nombre = texto(c.nombre, 'nombre', 250);
    c.nit = digitos(c.nit); c.nrc = digitos(c.nrc); c.codActividad = digitos(c.codActividad);
    c.descActividad = textoOpc(c.descActividad); c.direccion = textoOpc(c.direccion); c.correo = textoOpc(c.correo);
    c.activo = c.activo !== false;
    if (c.tipo === 'CONTRIBUYENTE') {
      if (!c.nit || !/^(\d{9}|\d{14})$/.test(c.nit)) err('VALIDACION', 'El NIT debe tener 9 o 14 dígitos');
      if (!c.nrc || !/^\d{1,8}$/.test(c.nrc)) err('VALIDACION', 'El NRC debe tener de 1 a 8 dígitos');
      if (!c.codActividad || !/^\d{2,6}$/.test(c.codActividad)) err('VALIDACION', 'codActividad debe tener de 2 a 6 dígitos');
      if (!c.descActividad) err('VALIDACION', 'El campo descActividad es obligatorio');
    }
    return c;
  }
  function clienteOut(c) { return clone(c); }

  /* ---------- DTE: piezas ---------- */
  function siguienteNumeroControl(tipo) {
    var n = ++db.correlativos[tipo];
    return 'DTE-' + tipo + '-' + db.emisor.codEstable + db.emisor.codPuntoVenta + '-' + ('000000000000000' + n).slice(-15);
  }
  function direccionMh(dir) { return { departamento: dir.departamento, municipio: dir.municipio, distrito: '01', complemento: dir.complemento }; }
  function emisorDte(conEstable) {
    var e = db.emisor, o = { nit: e.nit, nrc: e.nrc, nombre: e.nombre, codActividad: e.codActividad, descActividad: e.descActividad,
      nombreComercial: e.nombreComercial, direccion: direccionMh(e.direccion), telefono: e.telefono, correo: e.correo };
    if (conEstable) { o.codEstable = e.codEstable; o.codPuntoVenta = e.codPuntoVenta; }
    return o;
  }
  function dirCliente(c) { return direccionMh({ departamento: db.emisor.direccion.departamento, municipio: db.emisor.direccion.municipio, complemento: c.direccion || 'Sin dirección' }); }
  function firmar(json) {
    var bytes = ''; for (var i = 0; i < 64; i++) bytes += String.fromCharCode(Math.floor(Math.random() * 256));
    var firma = btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return { status: 'OK', body: b64url(JSON.stringify({ alg: 'RS512', typ: 'JWS' })) + '.' + b64url(JSON.stringify(json)) + '.' + firma };
  }
  function respuestaMh(codigoGeneracion, modo, evento) {
    if (modo === 'contingencia') return null;
    var ahora = new Date(), rech = modo === 'rechazo';
    return {
      version: 2, ambiente: '00', versionApp: 2, estado: rech ? 'RECHAZADO' : 'PROCESADO', codigoGeneracion: codigoGeneracion,
      selloRecibido: rech ? null : sello(ahora), fhProcesamiento: fhProcesamiento(ahora),
      clasificaMsg: rech ? '98' : '10', codigoMsg: rech ? '096' : '001',
      descripcionMsg: evento === 'contingencia' ? (rech ? 'EVENTO DE CONTINGENCIA RECHAZADO (SIMULADO)' : 'EVENTO DE CONTINGENCIA RECIBIDO')
        : evento ? (rech ? 'EVENTO DE INVALIDACIÓN RECHAZADO (SIMULADO)' : 'EVENTO DE INVALIDACIÓN RECIBIDO')
        : (rech ? 'DOCUMENTO RECHAZADO (SIMULADO)' : 'RECIBIDO'),
      observaciones: rech ? ['Rechazo forzado con X-Simular: rechazo'] : []
    };
  }
  function pagos(cond, total) { return cond === 1 ? [{ codigo: '01', montoPago: total, referencia: null, plazo: null, periodo: null }] : null; }
  function ajustarStock(productoId, delta) {
    var p = porId(db.productos, productoId, 'Producto');
    if (p.stock + delta < 0) err('STOCK_INSUFICIENTE', 'Stock insuficiente para ' + p.codigo + ' (disponible ' + p.stock + ')');
    p.stock += delta;
  }
  function moverStock(d, signo) { d.items.forEach(function (it) { ajustarStock(it.productoId, signo * it.cantidad); }); }

  /* ---------- emisión 01 / 03 ---------- */
  function leerItems(items) {
    if (!Array.isArray(items) || !items.length) err('VALIDACION', 'items debe tener al menos un producto');
    var acum = {};
    items.forEach(function (it) {
      var id = entero(it.productoId, 'productoId', 1), cant = entero(it.cantidad, 'cantidad', 1);
      var desc = it.descuento == null ? 0 : dinero(it.descuento, 'descuento');
      if (!acum[id]) acum[id] = { productoId: id, cantidad: 0, descuento: 0 };
      acum[id].cantidad += cant; acum[id].descuento = r2(acum[id].descuento + desc);
    });
    return Object.keys(acum).map(function (k) {
      var a = acum[k], p = porId(db.productos, a.productoId, 'Producto');
      if (!p.activo) err('VALIDACION', 'El producto ' + p.codigo + ' está inactivo');
      if (p.stock < a.cantidad) err('STOCK_INSUFICIENTE', 'Stock insuficiente para ' + p.codigo + ' (disponible ' + p.stock + ', solicitado ' + a.cantidad + ')');
      a.producto = p; return a;
    });
  }

  function emitir(tipo, body, u, modo) {
    var cond = body.condicionOperacion == null ? 1 : Number(body.condicionOperacion);
    if ([1, 2, 3].indexOf(cond) === -1) err('VALIDACION', 'condicionOperacion debe ser 1, 2 o 3');
    var cliente = null;
    if (body.clienteId != null) {
      cliente = porId(db.clientes, body.clienteId, 'Cliente');
      if (!cliente.activo) err('VALIDACION', 'El cliente está inactivo');
    }
    if (tipo === '03') {
      if (!cliente) err('VALIDACION', 'El CCF requiere clienteId');
      if (cliente.tipo !== 'CONTRIBUYENTE' || !cliente.nit || !cliente.nrc || !cliente.codActividad) err('VALIDACION', 'El cliente debe ser CONTRIBUYENTE');
    }
    var lineas = leerItems(body.items);
    var items = lineas.map(function (l, i) {
      var precioUni = tipo === '01' ? Math.round(Math.round(l.producto.precio * 100) * 113 / 100) / 100 : l.producto.precio;
      var bruto = r2(precioUni * l.cantidad);
      if (l.descuento > bruto) err('VALIDACION', 'El descuento de ' + l.producto.codigo + ' es mayor que la línea');
      var vg = r2(bruto - l.descuento);
      return { numItem: i + 1, productoId: l.productoId, codigo: l.producto.codigo, descripcion: l.producto.descripcion,
        cantidad: l.cantidad, unidad: l.producto.unidad, precioUni: precioUni, descuento: l.descuento, ventaGravada: vg,
        ivaItem: tipo === '01' ? r2(vg / 1.13 * 0.13) : r2(vg * 0.13) };
    });
    var gravada = r2(items.reduce(function (s, it) { return s + it.ventaGravada; }, 0));
    var totalDescu = r2(items.reduce(function (s, it) { return s + it.descuento; }, 0));
    var iva, total, subtotal;
    if (tipo === '01') { iva = r2(gravada / 1.13 * 0.13); total = gravada; subtotal = r2(total - iva); }
    else { iva = r2(gravada * 0.13); total = r2(gravada + iva); subtotal = gravada; }

    var ahora = new Date(), codGen = uuid(), numCtrl = siguienteNumeroControl(tipo);
    var receptor = null;
    if (tipo === '01' && cliente) {
      receptor = { tipoDocumento: cliente.nit ? '36' : null, numDocumento: cliente.nit || null, nrc: null, nombre: cliente.nombre,
        codActividad: null, descActividad: null, direccion: dirCliente(cliente), telefono: null, correo: cliente.correo };
    } else if (tipo === '03') {
      receptor = { nit: cliente.nit, nrc: cliente.nrc, nombre: cliente.nombre, codActividad: cliente.codActividad,
        descActividad: cliente.descActividad, nombreComercial: null, direccion: dirCliente(cliente), telefono: null, correo: cliente.correo };
    }
    var cuerpo = items.map(function (it) {
      var o = { numItem: it.numItem, tipoItem: 1, numeroDocumento: null, cantidad: it.cantidad, codigo: it.codigo, codTributo: null,
        uniMedida: it.unidad, descripcion: it.descripcion, precioUni: it.precioUni, montoDescu: it.descuento,
        ventaNoSuj: 0, ventaExenta: 0, ventaGravada: it.ventaGravada, tributos: tipo === '03' ? ['20'] : null, psv: 0, noGravado: 0 };
      if (tipo === '01') o.ivaItem = it.ivaItem;
      return o;
    });
    var resumen = { totalNoSuj: 0, totalExenta: 0, totalGravada: gravada, subTotalVentas: gravada, descuNoSuj: 0, descuExenta: 0,
      descuGravada: 0, porcentajeDescuento: 0, totalDescu: totalDescu,
      tributos: tipo === '03' ? [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: iva }] : null,
      subTotal: gravada };
    if (tipo === '03') resumen.ivaPerci = 0;
    resumen.ivaRete = 0;
    resumen.montoTotalOperacion = total; resumen.totalNoGravado = 0; resumen.totalPagar = total;
    resumen.totalLetras = numeroALetras(total);
    if (tipo === '01') resumen.totalIva = iva;
    resumen.saldoFavor = 0; resumen.condicionOperacion = cond; resumen.pagos = pagos(cond, total);
    resumen.numPagoElectronico = null; resumen.observaciones = null;

    var jsonDte = {
      identificacion: { version: tipo === '01' ? 2 : 4, ambiente: '00', tipoDte: tipo, numeroControl: numCtrl, codigoGeneracion: codGen,
        tipoModelo: 1, tipoOperacion: 1, tipoContingencia: null, motivoContin: null, fecEmi: ymd(ahora), horEmi: hms(ahora), tipoMoneda: 'USD' },
      documentoRelacionado: null, emisor: emisorDte(true), receptor: receptor, otrosDocumentos: null, ventaTercero: null,
      cuerpoDocumento: cuerpo, resumen: resumen, apendice: null
    };
    return guardarDte({ tipo: tipo, jsonDte: jsonDte, items: items, total: total, subtotal: subtotal, iva: iva, cond: cond,
      cliente: cliente, usuario: u.usuario, ahora: ahora, dteRelacionadoId: null }, modo);
  }

  /* ---------- emisión 05 ---------- */
  function pendientes(ccf) {
    var ncs = db.dte.filter(function (d) { return d.dteRelacionadoId === ccf.id && (d.estado === 'PROCESADO' || d.estado === 'CONTINGENCIA'); });
    return ccf.items.map(function (it) {
      var acr = 0, vgAcr = 0;
      ncs.forEach(function (nc) { nc.items.forEach(function (x) { if (x.productoId === it.productoId) { acr += x.cantidad; vgAcr = r2(vgAcr + x.ventaGravada); } }); });
      return { item: it, acreditada: acr, pendiente: it.cantidad - acr, vgAcreditada: vgAcr };
    });
  }
  function emitirNotaCredito(body, u, modo) {
    var ccf = porId(db.dte, entero(body.dteRelacionadoId, 'dteRelacionadoId', 1), 'DTE');
    if (ccf.tipoDte !== '03') err('VALIDACION', 'La nota de crédito solo aplica sobre un CCF (03)');
    if (ccf.estado !== 'PROCESADO') err('ESTADO_INVALIDO', 'El CCF debe estar PROCESADO (estado actual: ' + ccf.estado + ')');
    if (body.clienteId != null && Number(body.clienteId) !== ccf.clienteId) err('VALIDACION', 'El cliente debe ser el mismo del CCF');
    if (!Array.isArray(body.items) || !body.items.length) err('VALIDACION', 'items debe tener al menos un producto');
    var pend = pendientes(ccf), acum = {};
    body.items.forEach(function (it) {
      var id = entero(it.productoId, 'productoId', 1);
      acum[id] = (acum[id] || 0) + entero(it.cantidad, 'cantidad', 1);
    });
    var items = Object.keys(acum).map(function (k, i) {
      var id = Number(k), p = pend.filter(function (x) { return x.item.productoId === id; })[0];
      if (!p) err('VALIDACION', 'El producto ' + id + ' no está en el CCF');
      if (acum[k] > p.pendiente) err('VALIDACION', 'Cantidad a acreditar (' + acum[k] + ') mayor a la pendiente (' + p.pendiente + ') para el producto ' + p.item.codigo);
      var vg = acum[k] === p.pendiente ? r2(p.item.ventaGravada - p.vgAcreditada) : r2(p.item.ventaGravada * acum[k] / p.item.cantidad);
      return { numItem: i + 1, productoId: id, codigo: p.item.codigo, descripcion: p.item.descripcion, cantidad: acum[k],
        unidad: p.item.unidad, precioUni: p.item.precioUni, descuento: 0, ventaGravada: vg, ivaItem: r2(vg * 0.13) };
    });
    var gravada = r2(items.reduce(function (s, it) { return s + it.ventaGravada; }, 0));
    var iva = r2(gravada * 0.13), total = r2(gravada + iva), ahora = new Date();
    var codGen = uuid(), numCtrl = siguienteNumeroControl('05');
    var rc = ccf.jsonDte.receptor;
    var jsonDte = {
      identificacion: { version: 4, ambiente: '00', tipoDte: '05', numeroControl: numCtrl, codigoGeneracion: codGen, tipoModelo: 1,
        tipoOperacion: 1, tipoContingencia: null, motivoContin: null, fecEmi: ymd(ahora), horEmi: hms(ahora), tipoMoneda: 'USD', fusion: null },
      documentoRelacionado: [{ tipoDocumento: '03', tipoGeneracion: 2, numeroDocumento: ccf.codigoGeneracion, fechaEmision: ccf.jsonDte.identificacion.fecEmi }],
      emisor: emisorDte(false),
      receptor: { tipoDocumento: '36', numDocumento: rc.nit, nrc: rc.nrc, nombre: rc.nombre, codActividad: rc.codActividad,
        descActividad: rc.descActividad, nombreComercial: rc.nombreComercial, direccion: rc.direccion, telefono: rc.telefono, correo: rc.correo },
      ventaTercero: null,
      cuerpoDocumento: items.map(function (it) {
        return { numItem: it.numItem, tipoItem: 1, numeroDocumento: ccf.codigoGeneracion, cantidad: it.cantidad, codigo: it.codigo,
          codTributo: null, uniMedida: it.unidad, descripcion: it.descripcion, precioUni: it.precioUni, montoDescu: 0,
          ventaNoSuj: 0, ventaExenta: 0, ventaGravada: it.ventaGravada, tributos: ['20'], noGravado: 0, ivaPerci: 0, totalIva: r2(it.ventaGravada * 0.13), ivaRete: 0 };
      }),
      resumen: { totalNoSuj: 0, totalExenta: 0, totalGravada: gravada, subTotalVentas: gravada, totalDescu: 0,
        tributos: [{ codigo: '20', descripcion: 'Impuesto al Valor Agregado 13%', valor: iva }], montoTotalOperacion: total,
        ivaPerci: 0, totalIva: iva, ivaRete: 0, totalNoGravado: 0, totalPagar: total, totalLetras: numeroALetras(total),
        condicionOperacion: ccf.condicionOperacion, observaciones: null, codigoRetencionMH: null },
      apendice: null
    };
    var cliente = db.clientes.filter(function (c) { return c.id === ccf.clienteId; })[0] || null;
    return guardarDte({ tipo: '05', jsonDte: jsonDte, items: items, total: total, subtotal: gravada, iva: iva, cond: ccf.condicionOperacion,
      cliente: cliente, usuario: u.usuario, ahora: ahora, dteRelacionadoId: ccf.id }, modo);
  }

  /* ---------- guardar + respuesta de emisión ---------- */
  function guardarDte(x, modo) {
    var mh = respuestaMh(x.jsonDte.identificacion.codigoGeneracion, modo);
    if (!mh) {  // MH no respondió: el DTE se emite en contingencia (modelo diferido) antes de firmarse
      var idf = x.jsonDte.identificacion;
      idf.tipoModelo = 2; idf.tipoOperacion = 2; idf.tipoContingencia = 1; idf.motivoContin = null;
    }
    var firmador = firmar(x.jsonDte), estado = mh ? mh.estado : 'CONTINGENCIA';
    var d = {
      id: ++db.seq.dte, tipoDte: x.tipo, numeroControl: x.jsonDte.identificacion.numeroControl,
      codigoGeneracion: x.jsonDte.identificacion.codigoGeneracion, selloRecibido: mh ? mh.selloRecibido : null, estado: estado,
      fechaEmision: isoLocal(x.ahora), total: x.total, subtotal: x.subtotal, iva: x.iva, condicionOperacion: x.cond,
      usuario: x.usuario, clienteId: x.cliente ? x.cliente.id : null, cliente: x.cliente,
      dteRelacionadoId: x.dteRelacionadoId, jsonDte: x.jsonDte, items: x.items, firmador: firmador, respuestaMh: mh
    };
    // venta (01/03) descuenta; NC (05) devuelve. RECHAZADO no mueve stock.
    if (estado !== 'RECHAZADO') moverStock(d, x.tipo === '05' ? 1 : -1);
    db.dte.push(d);
    bitacora(x.usuario, 'EMISION', 'dte', d.id, 'DTE-' + d.tipoDte + ' enviado a MH (simulado): ' + (mh ? mh.descripcionMsg : 'SIN RESPUESTA (CONTINGENCIA)'),
      { tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, resultado: estado, firmador: 'OK',
        mensaje: mh ? mh.descripcionMsg : 'MH no respondió' }, { codigoGeneracion: d.codigoGeneracion, resultado: estado });
    return emisionOut(d);
  }
  function emisionOut(d) {
    return { id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
      selloRecibido: d.selloRecibido, estado: d.estado, fechaEmision: d.fechaEmision, total: d.total,
      firmador: clone(d.firmador), respuestaMh: clone(d.respuestaMh) };
  }

  /* ---------- reintentar / invalidar ---------- */
  function transmitir(d, u, modo, codEvento) {
    var mh = respuestaMh(d.codigoGeneracion, modo);
    if (mh) {
      d.respuestaMh = mh; d.estado = mh.estado; d.selloRecibido = mh.selloRecibido;
      if (mh.estado === 'RECHAZADO') moverStock(d, d.tipoDte === '05' ? -1 : 1);
    }
    var via = codEvento ? 'Transmisión por evento de contingencia DTE-' : 'Reintento DTE-';
    var datos = { tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, resultado: d.estado,
      mensaje: via + d.tipoDte + (mh ? ' a MH (simulado): ' + mh.descripcionMsg : ': MH sigue sin responder (simulado)') };
    if (codEvento) datos.codigoGeneracionEvento = codEvento;
    bitacora(u.usuario, 'REINTENTO', 'dte', d.id, datos.mensaje, datos, { codigoGeneracion: d.codigoGeneracion, resultado: d.estado });
  }
  function reintentar(id, u, modo) {
    var d = porId(db.dte, id, 'DTE');
    if (d.estado !== 'CONTINGENCIA') err('ESTADO_INVALIDO', 'Solo se puede reintentar un DTE en CONTINGENCIA (estado actual: ' + d.estado + ')');
    transmitir(d, u, modo);
    return emisionOut(d);
  }

  /* ---------- evento de contingencia (contingencia-schema-v4) ---------- */
  function contDteOut(d) {
    return { id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
      estado: d.estado, selloRecibido: d.selloRecibido, fechaEmision: d.fechaEmision, total: d.total };
  }
  function eventoContOut(ev, completo) {
    var o = { id: ev.id, codigoGeneracion: ev.codigoGeneracion, estado: ev.estado, selloRecibido: ev.selloRecibido, fecha: ev.fecha,
      fInicio: ev.fInicio, fFin: ev.fFin, tipoContingencia: 1, motivo: ev.motivo, usuario: ev.usuario, cantidad: ev.dteIds.length };
    if (completo) {
      o.dtes = ev.dteIds.map(function (id) { return contDteOut(porId(db.dte, id, 'DTE')); });
      o.jsonEvento = clone(ev.jsonEvento); o.firmador = clone(ev.firmador); o.respuestaMh = clone(ev.respuestaMh);
    }
    return o;
  }
  function enviarContingencia(body, u, modo) {
    requireAdmin(u);
    var lista;
    if (body.dteIds != null) {
      if (!Array.isArray(body.dteIds) || !body.dteIds.length) err('VALIDACION', 'dteIds debe ser una lista con al menos un id');
      var ids = body.dteIds.map(function (x, i) { return entero(x, 'dteIds[' + i + ']', 1); })
        .filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
      if (ids.length > 1000) err('VALIDACION', 'Un evento de contingencia admite máximo 1000 DTE');
      lista = ids.map(function (id) {
        var d = porId(db.dte, id, 'DTE');
        if (d.estado !== 'CONTINGENCIA') err('ESTADO_INVALIDO', 'Solo se reportan DTE en CONTINGENCIA; ' + d.numeroControl + ' está en ' + d.estado);
        return d;
      });
    } else {
      lista = db.dte.filter(function (d) { return d.estado === 'CONTINGENCIA'; }).slice(0, 1000);
      if (!lista.length) err('ESTADO_INVALIDO', 'No hay DTE en CONTINGENCIA para reportar');
    }
    var motivo = textoOpc(body.motivo);
    if (motivo && motivo.length > 500) err('VALIDACION', 'motivo admite máximo 500 caracteres');
    var ahora = new Date(), cod = uuid(), e = db.emisor;
    var inicio = lista.map(function (d) { return d.fechaEmision; }).sort()[0], fin = isoLocal(ahora);
    var jsonEvento = {
      identificacion: { version: 4, ambiente: '00', codigoGeneracion: cod, fTransmision: ymd(ahora), hTransmision: hms(ahora) },
      emisor: { nit: e.nit, nombre: e.nombre, nombreResponsable: u.nombre, tipoDocResponsable: '13', numeroDocResponsable: '000000000',
        tipoEstablecimiento: e.tipoEstablecimiento, codEstableMH: e.codEstable, codPuntoVentaMH: e.codPuntoVenta, telefono: e.telefono, correo: e.correo },
      detalleDTE: lista.map(function (d, i) { return { noItem: i + 1, tipoDoc: d.tipoDte, codigoGeneracion: d.codigoGeneracion }; }),
      motivo: { fInicio: inicio.slice(0, 10), fFin: ymd(ahora), hInicio: inicio.slice(11, 19), hFin: hms(ahora), tipoContingencia: 1, motivoContingencia: motivo }
    };
    var firmador = firmar(jsonEvento), mh = respuestaMh(cod, modo, 'contingencia');
    var resumen = { codigoGeneracionEvento: cod, cantidad: lista.length, dteIds: lista.map(function (d) { return d.id; }) };
    if (!mh) {
      bitacora(u.usuario, 'CONTINGENCIA', 'evento_contingencia', null, 'MH no respondió al evento de contingencia (simulado)',
        Object.assign({}, resumen, { resultado: 'SIN_RESPUESTA', mensaje: 'MH no respondió al evento de contingencia (simulado)' }), { resultado: 'SIN_RESPUESTA' });
      err('MH_NO_DISPONIBLE', 'MH no respondió al evento de contingencia (simulado). Los DTE siguen en contingencia; intente de nuevo.');
    }
    var ev = { id: ++db.seq.eventoCont, codigoGeneracion: cod, estado: mh.estado, selloRecibido: mh.selloRecibido, fecha: fin,
      fInicio: inicio, fFin: fin, motivo: motivo, usuario: u.usuario, dteIds: resumen.dteIds, jsonEvento: jsonEvento, firmador: firmador, respuestaMh: mh };
    db.eventosCont.push(ev);
    var msg = 'Evento de contingencia con ' + lista.length + ' DTE (simulado): ' + mh.descripcionMsg;
    bitacora(u.usuario, 'CONTINGENCIA', 'evento_contingencia', ev.id, msg, Object.assign({}, resumen, { resultado: mh.estado, mensaje: msg }), { resultado: mh.estado });
    if (mh.estado === 'PROCESADO') lista.forEach(function (d) { transmitir(d, u, 'ok', cod); });
    return { status: 201, data: eventoContOut(ev, true) };
  }

  function invalidar(id, body, u, modo) {
    var d = porId(db.dte, id, 'DTE');
    if (d.estado !== 'PROCESADO') err('ESTADO_INVALIDO', 'Solo se puede invalidar un DTE PROCESADO (estado actual: ' + d.estado + ')');
    if (d.tipoDte === '03' && db.dte.some(function (n) { return n.dteRelacionadoId === d.id && (n.estado === 'PROCESADO' || n.estado === 'CONTINGENCIA'); }))
      err('ESTADO_INVALIDO', 'El CCF tiene notas de crédito vigentes; invalídelas primero');
    var tipoAnul = body.tipoAnulacion == null ? 2 : Number(body.tipoAnulacion);
    if ([1, 2, 3].indexOf(tipoAnul) === -1) err('VALIDACION', 'tipoAnulacion debe ser 1, 2 o 3');
    var motivo = texto(body.motivo, 'motivo', 200);
    var codR = textoOpc(body.codigoGeneracionR);
    if (tipoAnul === 2 && codR) err('VALIDACION', 'Con tipoAnulacion 2 no se envía codigoGeneracionR');
    if (tipoAnul !== 2) {
      var r = db.dte.filter(function (x) { return x.codigoGeneracion === (codR || '').toUpperCase(); })[0];
      if (!r || r.estado !== 'PROCESADO' || r.id === d.id) err('VALIDACION', 'codigoGeneracionR debe ser otro DTE PROCESADO');
      codR = r.codigoGeneracion;
    }
    var ahora = new Date(), codEv = uuid(), e = db.emisor, rc = d.jsonDte.receptor;
    var jsonEvento = {
      identificacion: { version: 3, ambiente: '00', codigoGeneracion: codEv, fecEmi: ymd(ahora), horEmi: hms(ahora), fusion: null },
      emisor: { nit: e.nit, nombre: e.nombre, codEstableMH: e.codEstable, codEstable: e.codEstable, codPuntoVentaMH: e.codPuntoVenta,
        codPuntoVenta: e.codPuntoVenta, telefono: e.telefono, correo: e.correo },
      documento: { tipoDte: d.tipoDte, codigoGeneracion: d.codigoGeneracion, selloRecibido: d.selloRecibido, numeroControl: d.numeroControl,
        fecEmi: d.jsonDte.identificacion.fecEmi, codigoGeneracionR: codR,
        tipoDocumento: rc ? (rc.tipoDocumento || (rc.nit ? '36' : null)) : null, numDocumento: rc ? (rc.numDocumento || rc.nit || null) : null,
        nombre: rc ? rc.nombre : null, telefono: rc ? rc.telefono : null, correo: rc ? rc.correo : null },
      motivo: { tipoAnulacion: tipoAnul, motivoAnulacion: motivo, nombreResponsable: u.nombre, tipDocResponsable: '13', numDocResponsable: '000000000',
        nombreSolicita: textoOpc(body.nombreSolicita) || u.nombre, tipDocSolicita: textoOpc(body.tipDocSolicita) || '13',
        numDocSolicita: textoOpc(body.numDocSolicita) || '000000000' }
    };
    var firmador = firmar(jsonEvento), mh = respuestaMh(codEv, modo, true);
    if (!mh) {
      bitacora(u.usuario, 'INVALIDACION', 'dte', d.id, 'Invalidación DTE-' + d.tipoDte + ': MH no respondió',
        { tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, codigoGeneracionEvento: codEv, resultado: 'SIN_RESPUESTA', mensaje: 'MH no respondió al evento de invalidación (simulado)' },
        { codigoGeneracion: d.codigoGeneracion, resultado: 'SIN_RESPUESTA' });
      err('MH_NO_DISPONIBLE', 'MH (simulado) no respondió al evento de invalidación; intente de nuevo');
    }
    if (mh.estado === 'PROCESADO') { moverStock(d, d.tipoDte === '05' ? -1 : 1); d.estado = 'INVALIDADO'; }
    var ev = { id: ++db.seq.evento, dteId: d.id, codigoGeneracion: codEv, estado: mh.estado, tipoAnulacion: tipoAnul, motivo: motivo,
      fecha: isoLocal(ahora), usuario: u.usuario, selloRecibido: mh.selloRecibido, jsonEvento: jsonEvento, firmador: firmador, respuestaMh: mh };
    db.eventos.push(ev);
    bitacora(u.usuario, 'INVALIDACION', 'dte', d.id, 'Invalidación DTE-' + d.tipoDte + ': ' + mh.descripcionMsg,
      { tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion, codigoGeneracionEvento: codEv, resultado: mh.estado,
        mensaje: 'Evento de invalidación de DTE-' + d.tipoDte + ' (simulado): ' + mh.descripcionMsg }, { codigoGeneracion: d.codigoGeneracion, resultado: mh.estado });
    return { id: d.id, estado: d.estado, estadoEvento: mh.estado, codigoGeneracionEvento: codEv, selloRecibido: mh.selloRecibido,
      jsonEvento: clone(jsonEvento), firmador: clone(firmador), respuestaMh: clone(mh) };
  }

  /* ---------- consultas ---------- */
  function receptorTexto(d) { return d.cliente ? d.cliente.nombre : 'Consumidor final'; }
  function listarDte(q) {
    if (q.tipo && ['01', '03', '05'].indexOf(q.tipo) === -1) err('VALIDACION', 'tipo inválido');
    if (q.estado && ['PROCESADO', 'RECHAZADO', 'CONTINGENCIA', 'INVALIDADO'].indexOf(q.estado) === -1) err('VALIDACION', 'estado inválido');
    return db.dte.filter(function (d) {
      var f = d.fechaEmision.slice(0, 10);
      return (!q.tipo || d.tipoDte === q.tipo) && (!q.estado || d.estado === q.estado) && (!q.desde || f >= q.desde) &&
        (!q.hasta || f <= q.hasta) && (!q.clienteId || d.clienteId === Number(q.clienteId));
    }).slice().reverse().map(function (d) {
      return { id: d.id, tipoDte: d.tipoDte, numeroControl: d.numeroControl, codigoGeneracion: d.codigoGeneracion,
        selloRecibido: d.selloRecibido, estado: d.estado, fechaEmision: d.fechaEmision, receptor: receptorTexto(d),
        clienteId: d.clienteId, total: d.total, dteRelacionadoId: d.dteRelacionadoId };
    });
  }
  function obtenerDte(id) {
    var d = porId(db.dte, id, 'DTE'), o = emisionOut(d);
    o.subtotal = d.subtotal; o.iva = d.iva; o.condicionOperacion = d.condicionOperacion; o.usuario = d.usuario;
    o.cliente = d.cliente ? { id: d.cliente.id, nombre: d.cliente.nombre, tipo: d.cliente.tipo } : null;
    o.jsonDte = clone(d.jsonDte);
    var pend = d.tipoDte === '03' ? pendientes(d) : null;
    o.items = d.items.map(function (it, i) {
      var x = { numItem: it.numItem, productoId: it.productoId, codigo: it.codigo, descripcion: it.descripcion, cantidad: it.cantidad,
        unidad: it.unidad, precioUni: it.precioUni, descuento: it.descuento, ventaGravada: it.ventaGravada, ivaItem: it.ivaItem };
      if (pend) { x.acreditada = pend[i].acreditada; x.pendiente = pend[i].pendiente; }
      return x;
    });
    o.dteRelacionadoId = d.dteRelacionadoId;
    var rel = d.dteRelacionadoId ? porId(db.dte, d.dteRelacionadoId, 'DTE') : null;
    o.dteRelacionado = rel ? { id: rel.id, tipoDte: rel.tipoDte, numeroControl: rel.numeroControl, codigoGeneracion: rel.codigoGeneracion, estado: rel.estado } : null;
    o.notasCredito = d.tipoDte === '03' ? db.dte.filter(function (n) { return n.dteRelacionadoId === d.id; }).map(function (n) {
      return { id: n.id, numeroControl: n.numeroControl, codigoGeneracion: n.codigoGeneracion, estado: n.estado, fechaEmision: n.fechaEmision, total: n.total };
    }) : [];
    var evs = db.eventos.filter(function (e) { return e.dteId === d.id; }), ev = evs[evs.length - 1];
    o.invalidacion = ev ? { id: ev.id, codigoGeneracion: ev.codigoGeneracion, estado: ev.estado, tipoAnulacion: ev.tipoAnulacion, motivo: ev.motivo,
      fecha: ev.fecha, usuario: ev.usuario, selloRecibido: ev.selloRecibido, jsonEvento: clone(ev.jsonEvento), firmador: clone(ev.firmador),
      respuestaMh: clone(ev.respuestaMh) } : null;
    var ecs = db.eventosCont.filter(function (x) { return x.dteIds.indexOf(d.id) !== -1; }), ec = ecs[ecs.length - 1];
    o.eventoContingencia = ec ? { id: ec.id, codigoGeneracion: ec.codigoGeneracion, estado: ec.estado, selloRecibido: ec.selloRecibido, fecha: ec.fecha } : null;
    return o;
  }
  function listarBitacora(q) {
    var lim = q.limite == null ? 200 : Number(q.limite);
    if (!Number.isInteger(lim) || lim < 1 || lim > 1000) err('VALIDACION', 'limite debe estar entre 1 y 1000');
    return db.bitacora.filter(function (b) {
      var f = b.fecha.slice(0, 10);
      return (!q.accion || b.accion === q.accion) && (!q.entidad || b.entidad === q.entidad) && (!q.dteId || b.dteId === Number(q.dteId)) &&
        (!q.usuario || b.usuario === q.usuario) && (!q.desde || f >= q.desde) && (!q.hasta || f <= q.hasta);
    }).slice().reverse().slice(0, lim).map(clone);
  }

  /* ---------- router ---------- */
  function route(method, path, query, body, headers) {
    var m, u;
    if (method === 'GET' && path === '/health') return { api: 'ok', db: 'ok', ambiente: '00', fecha: new Date().toISOString() };
    if (method === 'POST' && path === '/auth/login') {
      if (!body.usuario || !body.password) err('VALIDACION', 'usuario y password son obligatorios');
      var us = db.usuarios.filter(function (x) { return x.usuario === body.usuario && x.password === body.password; })[0];
      if (!us) { bitacora(body.usuario, 'LOGIN_FALLIDO', 'usuario', null, 'Intento de inicio de sesión fallido', null); err('CREDENCIALES', 'Usuario o contraseña incorrectos'); }
      bitacora(us.usuario, 'LOGIN', 'usuario', us.id, 'Inicio de sesión', null);
      return { token: emitirToken(us), usuario: { id: us.id, nombre: us.nombre, rol: us.rol } };
    }
    u = leerToken(headers);

    if (path === '/productos' && method === 'GET') return listarProductos(query);
    if (path === '/productos' && method === 'POST') {
      requireAdmin(u);
      var np = validarProducto(clone(body), null); np.id = ++db.seq.producto; db.productos.push(np);
      bitacora(u.usuario, 'CREAR', 'producto', np.id, 'Producto ' + np.codigo + ' creado', np);
      return { status: 201, data: clone(np) };
    }
    if ((m = /^\/productos\/(\d+)$/.exec(path))) {
      var p = porId(db.productos, m[1], 'Producto');
      if (method === 'GET') return clone(p);
      if (method === 'PUT') {
        requireAdmin(u);
        var mp = validarProducto(Object.assign(clone(p), body, { id: p.id }), p.id); Object.assign(p, mp);
        bitacora(u.usuario, 'ACTUALIZAR', 'producto', p.id, 'Producto ' + p.codigo + ' actualizado', body);
        return clone(p);
      }
    }
    if (path === '/clientes' && method === 'GET') {
      var t = (query.q || '').toLowerCase();
      return db.clientes.filter(function (c) {
        return (query.incluirInactivos == 1 || c.activo) && (!query.tipo || c.tipo === query.tipo) &&
          (!t || c.nombre.toLowerCase().indexOf(t) !== -1 || (c.nit || '').indexOf(t) !== -1 || (c.nrc || '').indexOf(t) !== -1);
      }).map(clienteOut);
    }
    if (path === '/clientes' && method === 'POST') {
      var nc = validarCliente(clone(body)); nc.id = ++db.seq.cliente; db.clientes.push(nc);
      bitacora(u.usuario, 'CREAR', 'cliente', nc.id, 'Cliente creado', nc);
      return { status: 201, data: clienteOut(nc) };
    }
    if ((m = /^\/clientes\/(\d+)$/.exec(path))) {
      var c = porId(db.clientes, m[1], 'Cliente');
      if (method === 'GET') return clienteOut(c);
      if (method === 'PUT') {
        var mc = validarCliente(Object.assign(clone(c), body, { id: c.id })); Object.assign(c, mc);
        bitacora(u.usuario, 'ACTUALIZAR', 'cliente', c.id, 'Cliente actualizado', body);
        return clienteOut(c);
      }
    }
    if (path === '/emisor' && method === 'GET') return clone(db.emisor);

    if (method === 'POST' && (m = /^\/dte\/(01|03|05)$/.exec(path))) {
      var modo = modoSimular(headers);
      return { status: 201, data: m[1] === '05' ? emitirNotaCredito(body, u, modo) : emitir(m[1], body, u, modo) };
    }
    if (method === 'POST' && (m = /^\/dte\/(\d+)\/reintentar$/.exec(path))) return reintentar(m[1], u, modoSimular(headers));
    if (method === 'POST' && (m = /^\/dte\/(\d+)\/invalidar$/.exec(path))) return invalidar(m[1], body, u, modoSimular(headers));
    if (method === 'GET' && path === '/dte') return listarDte(query);
    if (method === 'GET' && (m = /^\/dte\/(\d+)$/.exec(path))) return obtenerDte(m[1]);
    if (method === 'GET' && path === '/bitacora') return listarBitacora(query);
    if (method === 'POST' && path === '/contingencia') return enviarContingencia(body, u, modoSimular(headers));
    if (method === 'GET' && path === '/contingencia') return db.eventosCont.slice().reverse().map(function (e) { return eventoContOut(e, false); });
    if (method === 'GET' && (m = /^\/contingencia\/(\d+)$/.exec(path))) return eventoContOut(porId(db.eventosCont, m[1], 'Evento de contingencia'), true);

    err('NO_ENCONTRADO', 'Ruta no encontrada: ' + method + ' /api' + path);
  }

  /**
   * Punto de entrada para api.js.
   * @returns {{status:number, body:object}} misma forma que la respuesta HTTP del backend
   */
  function handle(method, path, query, body, headers) {
    try {
      var r = route(method.toUpperCase(), path, query || {}, body || {}, headers || {});
      if (r && typeof r.status === 'number' && 'data' in r) return { status: r.status, body: { ok: true, data: r.data } };
      return { status: 200, body: { ok: true, data: r } };
    } catch (e) {
      if (e instanceof Err) return { status: e.status, body: { ok: false, error: { codigo: e.codigo, mensaje: e.mensaje } } };
      return { status: 500, body: { ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: String(e && e.message || e) } } };
    }
  }

  return { handle: handle, _db: db, numeroALetras: numeroALetras };
})();
