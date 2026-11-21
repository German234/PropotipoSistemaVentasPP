/** Utilidades de las pruebas e2e: login por la UI, navegación, capturas, venta y lectura del modal de resultado. */
const path = require('path');
const fs = require('fs');
const { expect } = require('@playwright/test');

const CAPTURAS = path.join(process.env.E2E_OUT || path.join(__dirname, '..', '..', 'e2e-report'), 'capturas');
const NUM_CONTROL = /DTE-0[135]-M001P001-\d{15}/;
let n = 0;

/** Captura de pantalla completa en E2E_OUT/capturas/NN-nombre.png (evidencia). */
async function captura(page, nombre) {
  fs.mkdirSync(CAPTURAS, { recursive: true });
  n += 1;
  const archivo = path.join(CAPTURAS, `${String(n).padStart(2, '0')}-${nombre}.png`);
  await page.screenshot({ path: archivo, fullPage: false });
  return archivo;
}

const toast = (page) => page.locator('#toast-msg');

async function login(page, usuario, password) {
  await page.goto('/');
  await page.locator('#login-user').fill(usuario);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-btn').click();
  await expect(page.locator('#app-vendedor')).toHaveClass(/active/);
}

/** Abre un panel del POS con el botón real del menú lateral. */
async function irA(page, panel) {
  await page.locator(`#sb-vendedor button[data-panel="${panel}"]`).click();
  await expect(page.locator(`#${panel}`)).toBeVisible();
}

/** Agrega un producto buscándolo en el catálogo de Nueva venta. */
async function agregarProducto(page, texto) {
  await page.locator('#v-prod-search').fill(texto);
  await page.locator('#v-catalog .dd-item', { hasText: texto }).first().click();
}

/** Confirma la venta y devuelve { estado, numeroControl } leídos del modal de resultado. */
async function confirmarVenta(page) {
  await page.locator('#v-confirmar').click();
  const modal = page.locator('#dte-result-modal');
  await expect(modal).toHaveClass(/show/);
  await expect(page.locator('#dr-datos')).toContainText(NUM_CONTROL);
  const estado = (await page.locator('#dr-estado .dr-badge').textContent()).trim();
  const numeroControl = (await page.locator('#dr-datos').textContent()).match(NUM_CONTROL)[0];
  return { estado, numeroControl };
}

async function cerrarResultado(page) {
  await page.locator('#dte-result-modal button', { hasText: 'Listo' }).click();
  await expect(page.locator('#dte-result-modal')).not.toHaveClass(/show/);
}

/** Petición a la API con la sesión del navegador (cookie) y el X-CSRF-Token de la cookie pos_csrf. */
async function apiComoNavegador(page, metodo, url, data) {
  const csrf = (await page.context().cookies()).find((c) => c.name === 'pos_csrf');
  return page.request.fetch(url, { method: metodo, data, headers: csrf ? { 'X-CSRF-Token': csrf.value } : {} });
}

module.exports = { captura, toast, login, irA, agregarProducto, confirmarVenta, cerrarResultado, apiComoNavegador, NUM_CONTROL };
