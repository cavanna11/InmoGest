import { expect, test } from '@playwright/test';

test('la página inicial informa el estado y no tiene botones sin acción', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('InmoGest');
  await expect(page.getByRole('heading', { level: 1, name: 'InmoGest' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
  await expect(page.getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('link')).toHaveCount(0);
});

test('sin desplazamiento horizontal', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('envía cabeceras de seguridad', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-powered-by']).toBeUndefined();
});

test('/api/health responde JSON sin cache', async ({ request }) => {
  const response = await request.get('/api/health');
  // 200 con la base accesible; 503 si falta configuración o la base no responde.
  expect([200, 503]).toContain(response.status());
  expect(response.headers()['cache-control']).toContain('no-store');
  const body = (await response.json()) as { status: string };
  expect(['ok', 'unconfigured', 'error']).toContain(body.status);
});
