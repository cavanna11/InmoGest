// @auth: recorrido del súper panel con el superadministrador del seed. Solo corre con E2E_AUTH=1, contra el
// Supabase local del runner de CI: esa cuenta y su contraseña de desarrollo no existen en ningún otro lado.
import { expect, test, type Page } from '@playwright/test';
import { uniqueTestEmail } from './support/mailpit.ts';

const SUPERADMIN = { email: 'superadmin@inmogest.test', password: 'InmoGest-dev-2026' };

async function confirm(page: Page, trigger: string, confirmLabel = trigger) {
  await page.getByRole('button', { name: trigger, exact: true }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: confirmLabel, exact: true }).click();
}

test.describe('súper panel @auth', () => {
  test.skip(({ isMobile }) => isMobile, 'solo escritorio');

  test('crea, entra como soporte, suspende, da de baja y elimina una inmobiliaria', async ({ page }) => {
    const name = `Inmobiliaria E2E ${Date.now()}`;

    await page.goto('/ingresar');
    await page.getByLabel('Email').fill(SUPERADMIN.email);
    await page.getByLabel('Contraseña').fill(SUPERADMIN.password);
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(/\/plataforma/);

    // Alta con enlace de acceso para el dueño.
    await page.goto('/plataforma/inmobiliarias');
    await page.getByText('+ Nueva inmobiliaria').click();
    await page.getByLabel('Nombre de la inmobiliaria').fill(name);
    await page.getByLabel('Nombre del dueño').fill('Dueña E2E');
    await page.getByLabel('Email del dueño').fill(uniqueTestEmail('plataforma'));
    await page.getByRole('button', { name: 'Crear inmobiliaria' }).click();
    await expect(page.getByText(`Creamos ${name}`)).toBeVisible();

    await page.goto('/plataforma/inmobiliarias');
    await page.getByRole('link', { name }).first().click();
    await expect(page).toHaveURL(/\/plataforma\/[0-9a-f-]{36}/);
    const detail = page.url();

    // Ingresar como: entra al panel con la franja de soporte, y vuelve al súper panel.
    await confirm(page, 'Ingresar como soporte', 'Ingresar');
    await expect(page).toHaveURL(/\/panel/);
    await page.getByRole('button', { name: 'Salir del contexto' }).click();
    await expect(page).toHaveURL(/\/plataforma/);

    // Suspender y reactivar.
    await page.goto(detail);
    await confirm(page, 'Suspender');
    await expect(page.getByText('Suspendida').first()).toBeVisible();
    await confirm(page, 'Reactivar');
    await expect(page.getByRole('button', { name: 'Suspender', exact: true })).toBeVisible();

    // La eliminación definitiva exige dar de baja antes y escribir el nombre exacto.
    await confirm(page, 'Dar de baja');
    await expect(page.getByText('Dada de baja').first()).toBeVisible();
    await page.getByLabel(`Para confirmar, escribí: ${name}`).fill('otro nombre');
    await page.getByRole('button', { name: 'Eliminar para siempre' }).click();
    await expect(page).toHaveURL(detail);
    await page.getByLabel(`Para confirmar, escribí: ${name}`).fill(name);
    await page.getByRole('button', { name: 'Eliminar para siempre' }).click();
    await expect(page).toHaveURL(/\/plataforma\/inmobiliarias/);
    await expect(page.getByRole('link', { name })).toHaveCount(0);
  });

  test('sin sesión, el súper panel lleva a ingresar', async ({ page }) => {
    const response = await page.goto('/plataforma/inmobiliarias');
    // Sin sesión lleva a ingresar; nunca muestra el panel.
    expect(page.url()).toContain('/ingresar');
    expect(response?.ok()).toBe(true);
    await expect(page.getByText('Súper panel')).toHaveCount(0);
  });
});
