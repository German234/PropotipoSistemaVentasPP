const { test, expect } = require('@playwright/test');
const { captura, toast, login, irA } = require('./helpers');

const suf = Date.now().toString().slice(-6);

test.describe('Clientes', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'vendedor', 'vendedor123');
    await irA(page, 'v-clientes');
  });

  test('registro de consumidor final con DUI', async ({ page }) => {
    await page.locator('#cli-tipo').selectOption('CONSUMIDOR');
    await page.locator('#cli-nombre').fill(`E2E Consumidor ${suf}`);
    await page.locator('#cli-tipodoc').selectOption('13');
    await page.locator('#cli-numdoc').fill('01234567-8');
    await page.locator('#cli-save').click();
    await expect(toast(page)).toContainText('guardado');
    await expect(page.locator('#cli-tbody tr', { hasText: `E2E Consumidor ${suf}` })).toBeVisible();
  });

  test('registro de contribuyente con dirección del catálogo MH, edición y rechazo de datos inválidos', async ({ page }) => {
    const nombre = `E2E Contribuyente ${suf}`;
    await page.locator('#cli-tipo').selectOption('CONTRIBUYENTE');
    await page.locator('#cli-nombre').fill(nombre);
    await page.locator('#cli-nit').fill(`0614${suf}1234`.slice(0, 14));
    await page.locator('#cli-nrc').fill('12345');
    await page.locator('#cli-codact').fill('46900');
    await page.locator('#cli-descact').fill('Venta al por mayor');
    await page.locator('#cli-depto').selectOption('06');
    await page.locator('#cli-municipio').selectOption('23');
    await page.locator('#cli-distrito').selectOption('14');
    await page.locator('#cli-complemento').fill('Colonia Escalón');
    await page.locator('#cli-save').click();
    await expect(toast(page)).toContainText('guardado');
    const fila = page.locator('#cli-tbody tr', { hasText: nombre });
    await expect(fila).toContainText('12345');

    // Editar: el formulario carga los datos (incluida la cascada depto → municipio → distrito)
    await fila.getByTitle('Editar cliente').click();
    await expect(page.locator('#cli-form-title')).toContainText('Editar cliente');
    await expect(page.locator('#cli-nrc')).toHaveValue('12345');
    await expect(page.locator('#cli-distrito')).toHaveValue('14');

    // NRC inválido → error de la API, sigue editando
    await page.locator('#cli-nrc').fill('12A');
    await page.locator('#cli-save').click();
    await expect(toast(page)).toContainText(/No se pudo actualizar: .*nrc/);
    await captura(page, 'clientes-error-nrc');

    await page.locator('#cli-nrc').fill('99999');
    await page.locator('#cli-depto').selectOption('05');
    await page.locator('#cli-municipio').selectOption('28');
    await page.locator('#cli-distrito').selectOption('10');
    await page.locator('#cli-save').click();
    await expect(toast(page)).toContainText('actualizado');
    await expect(fila).toContainText('99999');
    await expect(page.locator('#cli-form-title')).toHaveText('Nuevo cliente');
    await captura(page, 'clientes-editado');

    // Consulta del cliente actualizado
    const lista = await (await page.request.get(`/api/clientes?q=${encodeURIComponent(nombre)}`)).json();
    expect(lista.data[0]).toMatchObject({ nrc: '99999', direccion: { departamento: '05', municipio: '28', distrito: '10' } });
  });
});
