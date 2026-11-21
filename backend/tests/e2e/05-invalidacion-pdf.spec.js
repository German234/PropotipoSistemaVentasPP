const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { captura, toast, login, irA, agregarProducto, confirmarVenta, cerrarResultado } = require('./helpers');

const stock = async (page, codigo) =>
  (await (await page.request.get(`/api/productos?q=${codigo}`)).json()).data.find((p) => p.codigo === codigo).stock;

test.describe('Invalidación y PDF', () => {
  test('ADMIN anula una factura desde Transacciones: INVALIDADO, stock devuelto y bitácora', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    const inicial = await stock(page, 'P002');
    await agregarProducto(page, 'Lapicero');
    const { numeroControl } = await confirmarVenta(page);
    await cerrarResultado(page);
    expect(await stock(page, 'P002')).toBe(inicial - 1);

    await irA(page, 'v-historial');
    const fila = page.locator('#h-tbody tr', { hasText: numeroControl });
    await fila.getByRole('button', { name: 'Anular' }).click();
    await expect(page.locator('#anular-modal')).toHaveClass(/show/);
    await expect(page.locator('#an-doc')).toHaveText(numeroControl);
    await page.locator('#an-motivo').fill('Error en la información del documento (e2e)');
    await captura(page, 'invalidacion-modal');
    await page.locator('#an-ok').click();
    await expect(toast(page)).toContainText('DTE anulado');
    await expect(page.locator('#dte-result-modal')).toHaveClass(/show/);
    await expect(page.locator('#dr-estado')).toContainText('INVALIDADO');
    await captura(page, 'invalidacion-resultado');
    await cerrarResultado(page);
    await expect(fila).toContainText('Anulado');
    await expect(fila.getByRole('button', { name: 'Anular' })).toHaveCount(0);

    expect(await stock(page, 'P002')).toBe(inicial);
    const dte = (await (await page.request.get(`/api/dte?estado=INVALIDADO`)).json()).data.find((d) => d.numeroControl === numeroControl);
    const bit = await (await page.request.get(`/api/bitacora?accion=INVALIDACION&dteId=${dte.id}`)).json();
    expect(bit.data[0]).toMatchObject({ resultado: 'PROCESADO', usuario: 'admin' });
  });

  test('Descargar el PDF real del DTE desde Transacciones', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await irA(page, 'v-historial');
    const fila = page.locator('#h-tbody tr').first();
    const numeroControl = (await fila.textContent()).match(/DTE-0[135]-M001P001-\d{15}/)[0];
    await fila.getByTitle('Enviar por correo').click();
    await expect(page.locator('#email-modal')).toHaveClass(/show/);
    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#email-modal button', { hasText: 'Descargar PDF' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toBe(`${numeroControl}.pdf`);
    const destino = path.join(process.env.E2E_OUT, 'capturas', descarga.suggestedFilename());
    await descarga.saveAs(destino);
    const bytes = fs.readFileSync(destino);
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(5000);
    await expect(toast(page)).toContainText('PDF descargado');
  });
});
