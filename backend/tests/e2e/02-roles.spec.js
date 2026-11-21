const { test, expect } = require('@playwright/test');
const { captura, login, irA, agregarProducto, confirmarVenta, cerrarResultado, apiComoNavegador } = require('./helpers');

test.describe('Restricciones por rol', () => {
  test('VENDEDOR: no ve opciones de ADMIN en el menú, la venta ni el inventario', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    const menu = page.locator('#sb-vendedor');
    await expect(menu.getByRole('button', { name: /Contingencia/ })).toBeHidden();
    await expect(menu.getByRole('button', { name: /Panel gerencial/ })).toBeHidden();
    await expect(menu.getByRole('button', { name: /Administración/ })).toBeHidden();
    await expect(page.locator('#v-simular')).toBeHidden();
    await captura(page, 'rol-vendedor-menu');

    await irA(page, 'v-inventario');
    await expect(page.locator('#inv-tbody button[title="Editar"]').first()).toBeHidden();
    await expect(page.locator('#inv-save')).toBeHidden();
  });

  test('VENDEDOR: emite una factura pero no ve "Anular" en Transacciones', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await agregarProducto(page, 'Cuaderno');
    const { estado, numeroControl } = await confirmarVenta(page);
    expect(estado).toBe('PROCESADO');
    await expect(page.locator('#dr-acciones')).not.toContainText('Anular');
    await cerrarResultado(page);

    await irA(page, 'v-historial');
    const fila = page.locator('#h-tbody tr', { hasText: numeroControl });
    await expect(fila).toBeVisible();
    await expect(fila.getByRole('button', { name: 'Anular' })).toHaveCount(0);
    await captura(page, 'rol-vendedor-sin-anular');
  });

  test('VENDEDOR: la API rechaza con 403 lo que la UI oculta (invalidar, crear producto, enviar contingencia)', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    const lista = await (await page.request.get('/api/dte?estado=PROCESADO')).json();
    const id = lista.data[0].id;
    for (const [m, url, body] of [
      ['POST', `/api/dte/${id}/invalidar`, { motivo: 'Intento sin permiso' }],
      ['POST', '/api/productos', { codigo: 'E2E-X', descripcion: 'x', precio: 1 }],
      ['POST', '/api/contingencia', {}],
    ]) {
      const r = await apiComoNavegador(page, m, url, body);
      expect(r.status(), `${m} ${url}`).toBe(403);
      expect((await r.json()).error.codigo).toBe('SIN_PERMISO');
    }
    const det = await (await page.request.get(`/api/dte/${id}`)).json();
    expect(det.data.estado).toBe('PROCESADO');
  });

  test('ADMIN: ve Contingencia, Administración, Simular MH y "Anular"', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    const menu = page.locator('#sb-vendedor');
    await expect(menu.getByRole('button', { name: /Contingencia/ })).toBeVisible();
    await expect(menu.getByRole('button', { name: /Administración/ })).toBeVisible();
    await expect(page.locator('#v-simular')).toBeVisible();
    await irA(page, 'v-historial');
    await expect(page.locator('#h-tbody tr').getByRole('button', { name: 'Anular' }).first()).toBeVisible();
    await captura(page, 'rol-admin-transacciones');
  });
});
