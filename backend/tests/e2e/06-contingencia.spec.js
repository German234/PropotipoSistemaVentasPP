const { test, expect } = require('@playwright/test');
const { captura, toast, login, irA, agregarProducto, confirmarVenta, cerrarResultado } = require('./helpers');

test.describe('Contingencia', () => {
  test('MH no responde → DTE en CONTINGENCIA → lote manual → PROCESADO con sello', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.locator('#v-simular').selectOption('contingencia');
    await agregarProducto(page, 'Cuaderno');
    const { estado, numeroControl } = await confirmarVenta(page);
    expect(estado).toBe('CONTINGENCIA');
    await expect(page.locator('#dr-json')).toContainText('"tipoContingencia": 1');
    await captura(page, 'contingencia-emision');
    await cerrarResultado(page);

    // Panel de contingencia desde el menú del POS
    await page.locator('#sb-vendedor').getByRole('button', { name: /Contingencia/ }).click();
    await expect(page.locator('#a-contingencia')).toBeVisible();
    await expect(page.locator('#ct-tbody tr', { hasText: numeroControl })).toBeVisible();
    await page.locator('#ct-motivo').fill('MH no respondió durante la prueba e2e');
    await page.locator('#ct-simular').selectOption('ok');
    await captura(page, 'contingencia-cola');
    await page.locator('#ct-enviar').click();
    await expect(toast(page)).toContainText(/Lote enviado · \d+ de \d+ DTE transmitidos y sellados/);
    await expect(page.locator('#ct-tbody tr', { hasText: numeroControl })).toHaveCount(0);
    await captura(page, 'contingencia-lote-enviado');

    const lista = await (await page.request.get('/api/dte?estado=PROCESADO')).json();
    const dte = lista.data.find((d) => d.numeroControl === numeroControl);
    expect(dte).toBeTruthy();
    const det = await (await page.request.get(`/api/dte/${dte.id}`)).json();
    expect(det.data.selloRecibido).toMatch(/^\d{4}[A-Z0-9]{36}$/);
    expect(det.data.eventoContingencia).toMatchObject({ estado: 'PROCESADO' });
  });

  test('VENDEDOR: el DTE en contingencia se puede reintentar desde Transacciones', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.locator('#v-simular').selectOption('contingencia');
    await agregarProducto(page, 'Cuaderno');
    const { numeroControl } = await confirmarVenta(page);
    await cerrarResultado(page);
    await page.locator('#sb-vendedor button', { hasText: 'Cerrar sesión' }).click();

    await login(page, 'vendedor', 'vendedor123');
    await irA(page, 'v-historial');
    const fila = page.locator('#h-tbody tr', { hasText: numeroControl });
    await fila.getByRole('button', { name: 'Reintentar envío' }).click();
    await expect(toast(page)).toContainText('DTE procesado · sello recibido');
    await expect(page.locator('#dr-estado')).toContainText('PROCESADO');
    await captura(page, 'contingencia-reintento');
  });
});
