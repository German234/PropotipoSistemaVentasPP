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

  /* ---------- sesión ---------- */
  function getToken() { return ls(function () { return localStorage.getItem(API_CONFIG.TOKEN_KEY); }); }
  function getUsuario() {
    var s = ls(function () { return localStorage.getItem(API_CONFIG.USER_KEY); });
    try { return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function setSession(token, usuario) {
    ls(function () {
      localStorage.setItem(API_CONFIG.TOKEN_KEY, token);
      localStorage.setItem(API_CONFIG.USER_KEY, JSON.stringify(usuario));
    });
  }
  function clearSession() {
    ls(function () { localStorage.removeItem(API_CONFIG.TOKEN_KEY); localStorage.removeItem(API_CONFIG.USER_KEY); });
  }
  function isLoggedIn() { return !!getToken(); }

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
    var token = getToken();
    if (opts.auth !== false && token) headers['Authorization'] = 'Bearer ' + token;
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

    health: function () { return request('GET', '/health', { auth: false }); },

    /** Guarda token y usuario; resuelve con { token, usuario } */
    login: function (usuario, password) {
      return request('POST', '/auth/login', { body: { usuario: usuario, password: password }, auth: false })
        .then(function (d) { setSession(d.token, d.usuario); return d; });
    },
    logout: function () { clearSession(); },

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

    dte: {
      /** tipo '01'|'03'|'05'; payload según docs/API.md; simular opcional */
      emitir: function (tipo, payload, simular) { return request('POST', '/dte/' + tipo, { body: payload, simular: simular }); },
      factura: function (payload, simular) { return request('POST', '/dte/01', { body: payload, simular: simular }); },
      ccf: function (payload, simular) { return request('POST', '/dte/03', { body: payload, simular: simular }); },
      notaCredito: function (payload, simular) { return request('POST', '/dte/05', { body: payload, simular: simular }); },
      invalidar: function (id, body, simular) { return request('POST', '/dte/' + id + '/invalidar', { body: body, simular: simular }); },
      reintentar: function (id, simular) { return request('POST', '/dte/' + id + '/reintentar', { simular: simular }); },
      listar: function (filtros) { return request('GET', '/dte', { query: filtros }); },     // {tipo, estado, desde, hasta, clienteId}
      obtener: function (id) { return request('GET', '/dte/' + id); }
    },

    contingencia: {
      /** body {dteIds?, motivo?} (ADMIN); simular aplica al evento */
      enviar: function (body, simular) { return request('POST', '/contingencia', { body: body, simular: simular }); },
      listar: function () { return request('GET', '/contingencia'); },
      obtener: function (id) { return request('GET', '/contingencia/' + id); }
    },

    bitacora: function (filtros) { return request('GET', '/bitacora', { query: filtros }); } // {accion, entidad, dteId, usuario, desde, hasta, limite}
  };
})();
