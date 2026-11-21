const { test, expect } = require('@playwright/test');
const { captura, toast, login } = require('./helpers');

test.describe('Inicio de sesión', () => {
  test('muestra las credenciales de prueba en el entorno local', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#login-demo')).toBeVisible();
    await expect(page.locator('#login-demo')).toContainText('admin');
    await captura(page, 'login-pantalla');
  });

  test('contraseña incorrecta → mensaje claro y sigue en el login', async ({ page }) => {
    await page.goto('/');
    await page.locator('#login-user').fill('admin');
    await page.locator('#login-pass').fill('incorrecta');
    await page.locator('#login-btn').click();
    await expect(toast(page)).toContainText('Usuario o contraseña incorrectos');
    await expect(page.locator('#login')).toHaveClass(/active/);
    await captura(page, 'login-fallido');
  });

  test('login correcto, la sesión sobrevive a la recarga y logout la cierra', async ({ page, context }) => {
    await login(page, 'admin', 'admin123');
    await expect(page.locator('#v-avatar')).toHaveAttribute('title', /ADMIN/);
    await captura(page, 'login-ok-admin');

    // Fase 3: el token está en una cookie HttpOnly, no en el almacenamiento del navegador
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'pos_token')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
    const almacenado = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
    expect(almacenado).not.toMatch(/eyJ/); // ningún JWT

    await page.reload();
    await expect(page.locator('#app-vendedor')).toHaveClass(/active/);

    await page.locator('#sb-vendedor button', { hasText: 'Cerrar sesión' }).click();
    await expect(page.locator('#login')).toHaveClass(/active/);
    expect((await context.cookies()).find((c) => c.name === 'pos_token')).toBeUndefined();
  });
});
