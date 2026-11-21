/**
 * Pruebas end-to-end del frontend (Playwright) contra la API real y la BD de PRUEBAS.
 *
 *   cd backend && npm run test:e2e
 *
 * - Levanta el servidor en E2E_PORT (3099) con DB_NAME = BatallonAtlacatl_Test (nunca la BD de la demo:
 *   globalSetup aborta si el nombre coincide) y sin temporizadores (lote automático y cola de consultas).
 * - Navegador: Microsoft Edge instalado (channel msedge), así no hay que descargar navegadores.
 *   Otro: E2E_CHANNEL=chrome, o E2E_CHANNEL=chromium tras `npx playwright install chromium`.
 * - Reportes: E2E_OUT (por defecto backend/e2e-report/): html/, resultados.json, capturas/ y artefactos/.
 */
const path = require('path');
const { defineConfig } = require('@playwright/test');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });
const PORT = Number(process.env.E2E_PORT) || 3099;
const OUT = path.resolve(process.env.E2E_OUT || path.join(__dirname, '..', '..', 'e2e-report'));
const BD = process.env.DB_TEST_NAME || 'BatallonAtlacatl_Test';
const CHANNEL = process.env.E2E_CHANNEL || 'msedge';
process.env.E2E_OUT = OUT;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  globalSetup: require.resolve('./globalSetup.js'),
  fullyParallel: false,
  workers: 1,                 // comparten la BD de pruebas
  retries: 0,
  timeout: 45000,
  expect: { timeout: 8000 },
  outputDir: path.join(OUT, 'artefactos'),
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(OUT, 'html'), open: 'never' }],
    ['json', { outputFile: path.join(OUT, 'resultados.json') }],
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: CHANNEL === 'chromium' ? undefined : CHANNEL,
    headless: true,
    viewport: { width: 1366, height: 860 },
    acceptDownloads: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    locale: 'es-SV',
  },
  webServer: {
    command: 'node src/server.js',
    cwd: path.join(__dirname, '..', '..'),
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'ignore',
    stderr: 'pipe',
    // Solo variables no secretas: Playwright ya hereda process.env y el servidor lee las credenciales de backend/.env.
    // NO esparcir process.env aquí: el reporter JSON/HTML serializa este objeto (filtraría DB_PASSWORD y JWT_SECRET).
    env: {
      DB_NAME: BD,
      PORT: String(PORT),
      NODE_ENV: 'test',
      DEMO_CREDENCIALES: '1',
      CONTINGENCIA_LOTE_ACTIVO: '0',
      CONSULTA_MH_ACTIVO: '0',
    },
  },
});
