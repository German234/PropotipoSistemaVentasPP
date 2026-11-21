# Cobertura de código del backend (Jest)

> Generado por `backend/tests/tools/reporteKan23.js` el 2026-11-21 04:04:43 UTC desde `docs/kan-23/evidencia/`. No editar a mano.

Alcance: `backend/src/**/*.js` salvo `server.js` (arranque). El frontend no se instrumenta: se verifica con las pruebas e2e.

| Métrica | % | Cubiertas / total |
|---|---|---|
| Sentencias | **96.72 %** | 1980 / 2047 |
| Ramas | **84.86 %** | 1127 / 1328 |
| Funciones | **98.34 %** | 357 / 363 |
| Líneas | **98.45 %** | 1721 / 1748 |

## Por archivo (ordenado por ramas)

| Archivo | Sentencias | Ramas | Funciones | Líneas |
|---|---|---|---|---|
| `src/app.js` | 94.11 | 50 | 50 | 100 |
| `src/controllers/borradoresController.js` | 100 | 50 | 100 | 100 |
| `src/controllers/clientesController.js` | 100 | 50 | 100 | 100 |
| `src/controllers/dteController.js` | 100 | 50 | 100 | 100 |
| `src/controllers/productosController.js` | 100 | 50 | 100 | 100 |
| `src/controllers/usuariosController.js` | 100 | 50 | 100 | 100 |
| `src/dte/builders/ccf03.js` | 100 | 50 | 100 | 100 |
| `src/dte/builders/notaCredito05.js` | 100 | 50 | 100 | 100 |
| `src/dte/correlativo.js` | 88.88 | 50 | 100 | 100 |
| `src/services/emisorService.js` | 87.5 | 50 | 100 | 100 |
| `src/utils/respuesta.js` | 100 | 50 | 100 | 100 |
| `src/config/db.js` | 91.66 | 70 | 83.33 | 90.47 |
| `src/middleware/limiteLogin.js` | 90.24 | 70.37 | 88.88 | 94.11 |
| `src/dte/pdf.js` | 94.94 | 73.33 | 100 | 98.85 |
| `src/dte/catalogosMh.js` | 90 | 75 | 100 | 95.45 |
| `src/dte/simuladores/mhRegistro.js` | 92.3 | 75 | 100 | 100 |
| `src/dte/builders/comun.js` | 100 | 76.92 | 100 | 100 |
| `src/dte/builders/invalidacion.js` | 100 | 78.57 | 100 | 100 |
| `src/services/productosService.js` | 93.54 | 80 | 100 | 93.33 |
| `src/middleware/seguridad.js` | 91.66 | 83.33 | 100 | 100 |
| `src/services/borradoresService.js` | 97.61 | 83.33 | 100 | 100 |
| `src/utils/bitacora.js` | 90 | 83.33 | 100 | 88.88 |
| `src/services/contingenciaService.js` | 97.95 | 84.09 | 100 | 100 |
| `src/services/bitacoraService.js` | 91.3 | 85.36 | 100 | 100 |
| `src/services/clientesService.js` | 94.28 | 85.98 | 100 | 98.79 |
| `src/dte/builders/factura01.js` | 100 | 86.36 | 100 | 100 |
| `src/services/loteAutomaticoService.js` | 93.51 | 86.44 | 93.33 | 95.83 |
| `src/services/consultaMhService.js` | 95.23 | 86.66 | 94.44 | 96.42 |
| `src/services/reportesService.js` | 97.46 | 87.17 | 92.3 | 98.18 |
| `src/services/tareasProgramadas.js` | 92.1 | 87.27 | 100 | 93.93 |
| `src/dte/simuladores/mhRecepcion.js` | 100 | 87.5 | 100 | 100 |
| `src/config/seguridad.js` | 100 | 88.46 | 100 | 100 |
| `src/services/dteService.js` | 97.1 | 89.77 | 100 | 98.07 |
| `src/services/usuariosService.js` | 96.82 | 90 | 100 | 98.03 |
| `src/services/dteConsultasService.js` | 100 | 90.69 | 100 | 100 |
| `src/controllers/contingenciaController.js` | 100 | 92.3 | 100 | 100 |
| `src/dte/simuladores/mhAnulacion.js` | 100 | 93.33 | 100 | 100 |
| `src/dte/simuladores/mhContingencia.js` | 100 | 93.33 | 100 | 100 |
| `src/middleware/auth.js` | 100 | 96.42 | 100 | 100 |
| `src/utils/validar.js` | 100 | 97.29 | 100 | 100 |
| `src/config/politicas.js` | 100 | 100 | 100 | 100 |
| `src/controllers/authController.js` | 100 | 100 | 100 | 100 |
| `src/controllers/bitacoraController.js` | 100 | 100 | 100 | 100 |
| `src/controllers/catalogosController.js` | 100 | 100 | 100 | 100 |
| `src/controllers/emisorController.js` | 100 | 100 | 100 | 100 |
| `src/dte/builders/contingencia.js` | 100 | 100 | 100 | 100 |
| `src/dte/calculos.js` | 100 | 100 | 100 | 100 |
| `src/dte/numeroALetras.js` | 100 | 100 | 100 | 100 |
| `src/dte/simuladores/firmador.js` | 100 | 100 | 100 | 100 |
| `src/dte/simuladores/mhConsulta.js` | 100 | 100 | 100 | 100 |
| `src/middleware/errores.js` | 100 | 100 | 100 | 100 |
| `src/routes/auth.js` | 100 | 100 | 100 | 100 |
| `src/routes/bitacora.js` | 100 | 100 | 100 | 100 |
| `src/routes/borradores.js` | 100 | 100 | 100 | 100 |
| `src/routes/catalogos.js` | 100 | 100 | 100 | 100 |
| `src/routes/clientes.js` | 100 | 100 | 100 | 100 |
| `src/routes/contingencia.js` | 100 | 100 | 100 | 100 |
| `src/routes/dte.js` | 100 | 100 | 100 | 100 |
| `src/routes/emisor.js` | 100 | 100 | 100 | 100 |
| `src/routes/health.js` | 100 | 100 | 100 | 100 |
| `src/routes/productos.js` | 100 | 100 | 100 | 100 |
| `src/routes/reportes.js` | 100 | 100 | 100 | 100 |
| `src/routes/usuarios.js` | 100 | 100 | 100 | 100 |
| `src/services/authService.js` | 100 | 100 | 100 | 100 |
| `src/services/correoService.js` | 100 | 100 | 100 | 100 |
| `src/utils/cookies.js` | 100 | 100 | 100 | 100 |
| `src/utils/dinero.js` | 100 | 100 | 100 | 100 |
