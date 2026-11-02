import { expect, test } from '@playwright/test';

test('la página inicial es la landing de InmoPanel by C&C', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('InmoPanel by C&C — Software de gestión para inmobiliarias');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'InmoPanel by C&C, inicio' })).toBeVisible();
  // Los nombres anteriores del proyecto no aparecen en nada visible (docs/BRAND.md).
  await expect(page.locator('body')).not.toContainText(/InmoGest/i);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es-AR');
});

test('la landing no tiene enlaces rotos ni botones sin nombre', async ({ page, request }) => {
  await page.goto('/');
  const hrefs = await page.locator('a[href]').evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
  // Anclas internas: la sección de destino existe.
  for (const href of hrefs.filter((h) => h.startsWith('#') && h.length > 1)) {
    await expect(page.locator(href), `ancla ${href}`).toHaveCount(1);
  }
  // Rutas propias: responden (nada de botones a páginas que todavía no existen).
  for (const href of new Set(hrefs.filter((h) => h.startsWith('/')))) {
    const response = await request.get(href);
    expect(response.status(), `enlace ${href}`).toBeLessThan(400);
  }
  for (const name of await page.getByRole('button').allInnerTexts()) {
    expect(name.trim().length, 'botón sin nombre').toBeGreaterThan(0);
  }
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

test('SEO: datos estructurados, robots, ícono, imagen para compartir y llms.txt', async ({ page, request }) => {
  await page.goto('/');
  const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
  const types = (JSON.parse(jsonLd ?? '[]') as Array<{ '@type': string }>).map((item) => item['@type']);
  expect(types).toEqual(expect.arrayContaining(['Organization', 'SoftwareApplication', 'FAQPage']));
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /gestión para inmobiliarias/i);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /InmoPanel/);
  // Sin NEXT_PUBLIC_SITE_INDEXABLE el sitio no se indexa (dominio definitivo pendiente).
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  expect(await (await request.get('/robots.txt')).text()).toMatch(/Disallow: \/$/m);
  expect((await request.get('/llms.txt')).status()).toBe(200);
  expect((await request.get('/icon.svg')).status()).toBe(200);
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toBeTruthy();
  expect((await request.get(new URL(og ?? '', page.url()).pathname)).headers()['content-type']).toContain('image/png');
});

test('las animaciones corren solas y respetan movimiento reducido', async ({ page }) => {
  await page.goto('/');
  // Sin botones para volver a reproducir: las demos se reproducen en loop.
  await expect(page.getByRole('button', { name: /ver de nuevo/i })).toHaveCount(0);
  const animated = await page.locator('.ip-step').first().evaluate((el) => getComputedStyle(el).animationIterationCount);
  expect(animated).toBe('infinite');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  const still = await page.locator('.ip-step').first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { name: style.animationName, opacity: style.opacity };
  });
  expect(still).toEqual({ name: 'none', opacity: '1' });
});
