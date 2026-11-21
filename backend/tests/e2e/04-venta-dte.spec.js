const { test, expect } = require('@playwright/test');
const { captura, login, irA, agregarProducto, confirmarVenta, cerrarResultado } = require('./helpers');

const stock = async (page, codigo) =>
  (await (await page.request.get(`/api/productos?q=${codigo}`)).json()).data.find((p) => p.codigo === codigo).stock;

test.describe('Venta y emisión de DTE', () => {
  test('Factura 01 a consumidor final: PROCESADO con sello, JSON y descuento de stock', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    const antes = await stock(page, 'P001');
    await agregarProducto(page, 'Cuaderno');
    await expect(page.locator('#v-total')).toHaveText('$2.83'); // 2.50 + IVA incluido
    const { estado, numeroControl } = await confirmarVenta(page);
    expect(estado).toBe('PROCESADO');
    expect(numeroControl).toMatch(/^DTE-01-M001P001-\d{15}$/);
    await expect(page.locator('#dr-datos')).toContainText(/\d{4}[A-Z0-9]{36}/); // sello de 40 caracteres
    await expect(page.locator('#dr-json')).toContainText('"tipoDte": "01"');
    await captura(page, 'venta-factura-01');
    await cerrarResultado(page);
    expect(await stock(page, 'P001')).toBe(antes - 1);
  });

  test('CCF 03 a un contribuyente: IVA desglosado y tributo 20', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await page.locator('#vt-03').click();
    const roble = await page.locator('#v-cliente option', { hasText: 'El Roble' }).getAttribute('value');
    await page.locator('#v-cliente').selectOption(roble);
    await expect(page.locator('.cli-resumen')).toContainText('NRC');
    await agregarProducto(page, 'Cuaderno');
    await expect(page.locator('#v-total')).toHaveText('$2.83'); // 2.50 + 0.33 de IVA
    const { estado, numeroControl } = await confirmarVenta(page);
    expect(estado).toBe('PROCESADO');
    expect(numeroControl).toMatch(/^DTE-03-/);
    await expect(page.locator('#dr-json')).toContainText('"codigo": "20"');
    await expect(page.locator('#dr-datos')).toContainText('El Roble');
    await captura(page, 'venta-ccf-03');
    await cerrarResultado(page);

    await irA(page, 'v-historial');
    const fila = page.locator('#h-tbody tr', { hasText: numeroControl });
    await expect(fila).toContainText('CCF 03');
    await expect(fila.getByRole('button', { name: 'Nota de crédito' })).toBeVisible(); // un 03 PROCESADO admite NC
  });

  test('CCF 03 sin cliente contribuyente → aviso y no emite', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await page.locator('#vt-03').click();
    await agregarProducto(page, 'Cuaderno');
    await page.locator('#v-confirmar').click();
    await expect(page.locator('#toast-msg')).toContainText('requiere elegir un cliente CONTRIBUYENTE');
    await expect(page.locator('#dte-result-modal')).not.toHaveClass(/show/);
  });
});
