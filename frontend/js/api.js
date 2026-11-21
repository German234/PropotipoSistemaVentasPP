/* api.js — cliente HTTP del frontend (contrato: docs/API.md).
 * - BASE_URL relativa: Express sirve frontend/ y la API en el mismo origen.
 * - Token JWT en localStorage; se manda como Authorization: Bearer.
 * - Desenvuelve { ok, data } → resuelve con data; { ok:false, error } → rechaza con ApiError.
 * - USE_MOCK = true → responde MockApi (js/mocks.js) con la misma forma, sin backend.
 * Globales expuestos: API_CONFIG, ApiError, api. (Script clásico, sin módulos.)
 */
var API_CONFIG = {
  BASE_URL: '/api',
  USE_MOCK: false,       // true = sin backend (js/mocks.js); false = API real (cd backend && npm start)
  MOCK_DELAY_MS: 250,    // latencia simulada en modo mock
  TOKEN_KEY: 'pos.token',
  USER_KEY: 'pos.usuario'
};

function ApiError(codigo, mensaje, status, data) {
  this.name = 'ApiError';
  this.codigo = codigo;
  this.mensaje = mensaje;
  this.message = mensaje;
  this.status = status;
  this.data = data;
}
ApiError.prototype = Object.create(Error.prototype);
ApiError.prototype.constructor = ApiError;

var api = (function () {
  'use strict';

  function ls(fn) { try { return fn(); } catch (e) { return null; } }

  /* ---------- sesión ----------
   * API real (Fase 3): el JWT vive en la cookie HttpOnly `pos_token` que pone el backend; el JavaScript de la página
   * no puede leerlo, así que un XSS ya no puede robar el token. Nada sensible se guarda en localStorage.
   * Las peticiones que modifican datos llevan X-CSRF-Token (= cookie legible `pos_csrf`).
   * Modo mock: no hay servidor ni cookies; el token falso de mocks.js se guarda en sessionStorage.
   */
  var usuarioSesion = null;
  ls(function () { localStorage.removeItem(API_CONFIG.TOKEN_KEY); localStorage.removeItem(API_CONFIG.USER_KEY); }); // restos de versiones anteriores
  function getToken() { return API_CONFIG.USE_MOCK ? ls(function () { return sessionStorage.getItem(API_CONFIG.TOKEN_KEY); }) : null; }
  function getUsuario() { return usuarioSesion; }
  function setSession(token, usuario) {
    usuarioSesion = usuario;
    if (API_CONFIG.USE_MOCK) ls(function () { sessionStorage.setItem(API_CONFIG.TOKEN_KEY, token); });
  }
  function clearSession() {
    usuarioSesion = null;
    ls(function () { sessionStorage.removeItem(API_CONFIG.TOKEN_KEY); });
  }
  function isLoggedIn() { return !!usuarioSesion; }
  function csrfToken() {
    var m = /(?:^|;\s*)pos_csrf=([^;]+)/.exec(typeof document !== 'undefined' ? document.cookie : '');
    return m ? decodeURIComponent(m[1]) : null;
  }
  function cabecerasSesion(method, headers) {
    var token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!API_CONFIG.USE_MOCK && ['GET', 'HEAD', 'OPTIONS'].indexOf(method) === -1) {
      var c = csrfToken(); if (c) headers['X-CSRF-Token'] = c;
    }
    return headers;
  }

  /* ---------- núcleo ---------- */
  function queryString(q) {
    if (!q) return '';
    var parts = Object.keys(q).filter(function (k) { return q[k] !== undefined && q[k] !== null && q[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); });
    return parts.length ? '?' + parts.join('&') : '';
  }

  /** Convierte {status, body} en data o ApiError. */
  function procesar(status, body) {
    if (body && body.ok === true) return body.data;
    var e = (body && body.error) || {};
    var err = new ApiError(e.codigo || 'ERROR_INTERNO', e.mensaje || ('Error HTTP ' + status), status, body);
    if (err.codigo === 'NO_AUTENTICADO') {
      clearSession();
      try { document.dispatchEvent(new CustomEvent('api:no-autenticado', { detail: err })); } catch (x) { /* sin DOM */ }
    }
    throw err;
  }

  /**
   * request(method, path, { query, body, simular, auth })
   *   path relativo a BASE_URL ('/productos'); simular = 'ok'|'rechazo'|'contingencia' → header X-Simular.
   *   auth=false para no mandar el token (login/health).
   * @returns Promise<data>
   */
  function request(method, path, opts) {
    opts = opts || {};
    method = method.toUpperCase();
    var headers = { 'Accept': 'application/json' };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.auth !== false) cabecerasSesion(method, headers);
    if (opts.simular) headers['X-Simular'] = opts.simular;

    if (API_CONFIG.USE_MOCK) {
      return new Promise(function (resolve) { setTimeout(resolve, API_CONFIG.MOCK_DELAY_MS); }).then(function () {
        var body = opts.body === undefined ? undefined : JSON.parse(JSON.stringify(opts.body));
        var r = MockApi.handle(method, path, opts.query, body, headers);
        return procesar(r.status, r.body);
      });
    }

    return fetch(API_CONFIG.BASE_URL + path + queryString(opts.query), {
      method: method,
      headers: headers,
      credentials: 'same-origin',
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    }).then(function (res) {
      return res.text().then(function (txt) {
        var json = null;
        try { json = txt ? JSON.parse(txt) : null; } catch (e) { /* respuesta no JSON */ }
        if (!json) json = { ok: false, error: { codigo: res.status >= 500 ? 'ERROR_INTERNO' : 'VALIDACION', mensaje: 'Respuesta inválida del servidor (HTTP ' + res.status + ')' } };
        return procesar(res.status, json);
      });
    }, function (netErr) {
      throw new ApiError('SIN_CONEXION', 'No se pudo conectar con la API: ' + netErr.message, 0);
    });
  }

  /* ---------- endpoints (docs/API.md) ---------- */
  return {
    request: request,
    getToken: getToken, getUsuario: getUsuario, setSession: setSession, clearSession: clearSession, isLoggedIn: isLoggedIn,

    /** { api, db, ambiente, fecha, demo: { credenciales:[{usuario,password,rol}] } | null } */
    health: function () { return request('GET', '/health', { auth: false }); },

    /** El backend deja la sesión en cookies; aquí solo se recuerda el usuario en memoria. Resuelve con { token, usuario } */
    login: function (usuario, password) {
      return request('POST', '/auth/login', { body: { usuario: usuario, password: password }, auth: false })
        .then(function (d) { setSession(d.token, d.usuario); return d; });
    },
    /** Restaura la sesión al recargar (GET /auth/sesion con la cookie). Resuelve con el usuario o rechaza (401). */
    sesion: function () {
      // sin cookie pos_csrf (misma vida que la sesión) no hay sesión: no se consulta y se evita un 401 en consola
      if (API_CONFIG.USE_MOCK ? !getToken() : !csrfToken()) return Promise.reject(new ApiError('NO_AUTENTICADO', 'Sin sesión', 401));
      return request('GET', '/auth/sesion').then(function (d) { usuarioSesion = d.usuario; return d.usuario; });
    },
    /** POST /auth/logout borra las cookies en el servidor; la sesión local se limpia aunque falle la red. */
    logout: function () {
      var p = API_CONFIG.USE_MOCK ? Promise.resolve() : request('POST', '/auth/logout', { auth: false }).catch(function () {});
      clearSession();
      return p;
    },

    productos: {
      listar: function (q) { return request('GET', '/productos', { query: q }); },          // {q, incluirInactivos}
      obtener: function (id) { return request('GET', '/productos/' + id); },
      crear: function (p) { return request('POST', '/productos', { body: p }); },
      actualizar: function (id, cambios) { return request('PUT', '/productos/' + id, { body: cambios }); }
    },
    clientes: {
      listar: function (q) { return request('GET', '/clientes', { query: q }); },           // {q, tipo, incluirInactivos}
      obtener: function (id) { return request('GET', '/clientes/' + id); },
      crear: function (c) { return request('POST', '/clientes', { body: c }); },
      actualizar: function (id, cambios) { return request('PUT', '/clientes/' + id, { body: cambios }); }
    },
    emisor: function () { return request('GET', '/emisor'); },
    /** P2: { departamentos:[{codigo,nombre,municipios:[{codigo,nombre,distritos:[{codigo,nombre}]}]}], tiposDocumento } */
    catalogos: function () { return request('GET', '/catalogos'); },

    dte: {
      /** tipo '01'|'03'|'05'; payload según docs/API.md; simular opcional */
      emitir: function (tipo, payload, simular) { return request('POST', '/dte/' + tipo, { body: payload, simular: simular }); },
      factura: function (payload, simular) { return request('POST', '/dte/01', { body: payload, simular: simular }); },
      ccf: function (payload, simular) { return request('POST', '/dte/03', { body: payload, simular: simular }); },
      notaCredito: function (payload, simular) { return request('POST', '/dte/05', { body: payload, simular: simular }); },
      invalidar: function (id, body, simular) { return request('POST', '/dte/' + id + '/invalidar', { body: body, simular: simular }); },
      reintentar: function (id, simular) { return request('POST', '/dte/' + id + '/reintentar', { simular: simular }); },
      /** C3: consulta de DTE en MH (solo DTE en CONTINGENCIA) → { resultado: ENCONTRADO|NO_ENCONTRADO|SIN_RESPUESTA, estado, ... } */
      consultar: function (id, simular) { return request('POST', '/dte/' + id + '/consultar', { simular: simular }); },
      listar: function (filtros) { return request('GET', '/dte', { query: filtros }); },     // {tipo, estado, desde, hasta, clienteId}
      obtener: function (id) { return request('GET', '/dte/' + id); },
      /** GET /dte/:id/pdf → Promise<Blob> (binario, no JSON). Los errores llegan como ApiError. */
      pdf: function (id) {
        var headers = cabecerasSesion('GET', { 'Accept': 'application/pdf' });
        return fetch(API_CONFIG.BASE_URL + '/dte/' + id + '/pdf', { headers: headers, credentials: 'same-origin' }).then(function (res) {
          if (res.ok) return res.blob();
          return res.json().catch(function () { return null; }).then(function (json) {
            return procesar(res.status, json || { ok: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'No se pudo generar el PDF (HTTP ' + res.status + ')' } });
          });
        }, function (netErr) {
          throw new ApiError('SIN_CONEXION', 'No se pudo conectar con la API: ' + netErr.message, 0);
        });
      }
    },

    contingencia: {
      /** body {dteIds?, motivo?} (ADMIN); simular aplica al evento */
      enviar: function (body, simular) { return request('POST', '/contingencia', { body: body, simular: simular }); },
      listar: function () { return request('GET', '/contingencia'); },
      obtener: function (id) { return request('GET', '/contingencia/' + id); },
      /** C2: lote automático del cierre del día → { activo, hora, proximaEjecucion, ultimaEjecucion, pendientes } */
      programacion: function () { return request('GET', '/contingencia/programacion'); },
      /** body { activo?, hora? "HH:mm" } (ADMIN) */
      programar: function (body) { return request('PUT', '/contingencia/programacion', { body: body }); },
      /** C3: cola de consultas a MH → { activo, intervaloSeg, proximaConsulta, ultimaConsulta, cola[] } */
      consultas: function () { return request('GET', '/contingencia/consultas'); },
      /** body { activo?, intervaloSeg? 10–3600 } (ADMIN) */
      configurarConsultas: function (body) { return request('PUT', '/contingencia/consultas', { body: body }); }
    },

    bitacora: function (filtros) { return request('GET', '/bitacora', { query: filtros }); } // {accion, entidad, dteId, usuario, desde, hasta, limite}
  };
})();
