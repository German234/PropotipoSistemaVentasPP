/**
 * Dos proyectos:
 *   unit        → lógica pura (cálculos, letras, simuladores, builders + esquemas MH, middlewares). Sin BD.
 *   integration → API completa con supertest contra la BD de pruebas (BatallonAtlacatl_Test).
 * La BD de pruebas se crea/siembra en tests/globalSetup.js; nunca se usa la BD de la demo.
 */
const comun = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
};

module.exports = {
  projects: [
    { ...comun, displayName: 'unit', testMatch: ['<rootDir>/tests/unit/**/*.test.js'] },
    {
      ...comun,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
      globalSetup: '<rootDir>/tests/globalSetup.js',
    },
  ],
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageReporters: ['text-summary', 'text', 'html'],
  testTimeout: 30000,
};
