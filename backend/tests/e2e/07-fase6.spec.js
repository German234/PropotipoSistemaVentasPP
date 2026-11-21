/**
 * Fase 6: pantallas que antes eran maqueta, ahora con datos reales de la API (o marcadas como simuladas).
 */
const { test, expect } = require('@playwright/test');
const { captura, toast, login, irA, agregarProducto, confirmarVenta, cerrarResultado } = require('./helpers');

const api = async (page, url) => (await (await page.request.get(url)).json()).data;

test.describe('Fase 6', () => {
  test('Borradores: guardar, listar, continuar y se eliminan al emitir', async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await agregarProducto(page, 'Cuaderno');
    await agregarProducto(page, 'Cuaderno');
    await page.locator('#v-borrador-btn').click();
    await expect(toast(page)).toContainText(/Borrador #\d+ guardado \(total estimado \$5\.66\)/);
    await expect(page.locator('#v-borrador-btn')).toHaveText(/Actualizar borrador #\d+/);
    const [b] = await api(page, '/api/borradores');
    expect(b).toMatchObject({ tipoDte: '01', totalEstimado: 5.66 });

    // venta nueva vacía y luego continuar el borrador desde el panel
    await page.locator('#v-cart button.del').click();
    await irA(page, 'v-borradores');
    const fila = page.locator('#bo-tbody tr', { hasText: `#${b.id}` });
    await expect(fila).toContainText('$5.66');
    await captura(page, 'fase6-borradores');
    await fila.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.locator('#v-venta')).toBeVisible();
    await expect(page.locator('#v-total')).toHaveText('$5.66');

    const { estado } = await confirmarVenta(page);
    expect(estado).toBe('PROCESADO');
    await cerrarResultado(page);
    await expect.poll(async () => (await api(page, '/api/borradores')).length).toBe(0);
  });

  test('Correo: el modal dice que es simulado y la bitácora lo registra; nunca "enviado"', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await agregarProducto(page, 'Lapicero');
    const { numeroControl } = await confirmarVenta(page);
    await cerrarResultado(page);
    await irA(page, 'v-historial');
    await page.locator('#h-tbody tr', { hasText: numeroControl }).getByTitle('Enviar por correo').click();
    await expect(page.locator('#email-modal')).toHaveClass(/show/);
    await expect(page.locator('#email-modal')).toContainText('no se envía ningún correo');
    await page.locator('#email-input').fill('cliente@correo.com');
    await captura(page, 'fase6-correo-simulado');
    await page.locator('#email-send').click();
    await expect(toast(page)).toContainText('NO se envió ningún correo');
    await expect(toast(page)).not.toContainText(/enviado a/);
    const [b] = await api(page, '/api/bitacora?accion=CORREO_SIMULADO');
    expect(b).toMatchObject({ resultado: 'SIMULADO', usuario: 'admin' });
  });

  test('Panel gerencial con los totales reales de la API', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.locator('#sb-vendedor button', { hasText: 'Panel gerencial' }).click();
    await expect(page.locator('#app-gerente')).toHaveClass(/active/);
    const r = await api(page, '/api/reportes/resumen');
    const fmt = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await expect(page.locator('#kpi-netas')).toHaveText(fmt(r.totales.ventasNetas));
    await expect(page.locator('#kpi-docs')).toHaveText(String(r.totales.documentos));
    await expect(page.locator('#g-dash')).not.toContainText('$48,320');
    await captura(page, 'fase6-dashboard');
    await page.locator('#sb-gerente button[data-panel="g-ventas"]').click();
    await expect(page.locator('#gv-tbody tr').first()).toContainText(/DTE-0[135]-/);
    await page.locator('#sb-gerente button[data-panel="g-reportes"]').click();
    const descarga = page.waitForEvent('download');
    await page.getByRole('button', { name: '⬇ Exportar a CSV' }).click();
    expect((await descarga).suggestedFilename()).toMatch(/^reporte-ventas-\d{4}-\d{2}\.csv$/);
    // sin botón de PDF falso: solo el aviso de que no está disponible
    await expect(page.locator('#g-reportes').getByRole('button', { name: /PDF/ })).toHaveCount(0);
    await expect(page.locator('#g-reportes')).toContainText('Exportar a PDF no está disponible');
  });

  test('Usuarios: crear un vendedor real que puede iniciar sesión y desactivarlo', async ({ page, browser }) => {
    await login(page, 'admin', 'admin123');
    await page.locator('#sb-vendedor button', { hasText: 'Administración' }).click();
    await expect(page.locator('#u-tbody')).toContainText('vendedor');
    await expect(page.locator('#u-tbody')).not.toContainText('Carlos Mejía');
    await page.locator('#u-usuario').fill('e2e.cajero');
    await page.locator('#u-nombre').fill('Cajero E2E');
    await page.locator('#u-password').fill('cajeroE2E1');
    await page.locator('#u-save').click();
    await expect(toast(page)).toContainText('Usuario e2e.cajero creado');
    await expect(page.locator('#u-tbody')).toContainText('Cajero E2E');
    await captura(page, 'fase6-usuarios');

    const otra = await (await browser.newContext()).newPage();
    await login(otra, 'e2e.cajero', 'cajeroE2E1');
    await otra.context().close();

    page.once('dialog', (d) => d.accept());
    await page.locator('#u-tbody tr', { hasText: 'e2e.cajero' }).getByTitle('Desactivar').click();
    await expect(toast(page)).toContainText('desactivado');
    const r = await page.request.post('/api/auth/login', { data: { usuario: 'e2e.cajero', password: 'cajeroE2E1' } });
    expect(r.status()).toBe(401);
  });

  test('Configuración: emisor real de solo lectura y firmador identificado como simulado', async ({ page }) => {
    await login(page, 'admin', 'admin123');
    await page.locator('#sb-vendedor button', { hasText: 'Administración' }).click();
    await page.locator('#sb-admin button[data-panel="a-config"]').click();
    const e = await api(page, '/api/emisor');
    await expect(page.locator('#cfg-emisor')).toContainText(e.nombre);
    await expect(page.locator('#cfg-emisor')).toContainText(e.nit);
    await expect(page.locator('#a-config')).toContainText('Firmador simulado');
    await expect(page.locator('#a-config')).not.toContainText('certificado_mh.crt');
    await expect(page.locator('#a-config input')).toHaveCount(0);
    await expect(page.locator('#a-config').getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
    await captura(page, 'fase6-config');
  });
});
