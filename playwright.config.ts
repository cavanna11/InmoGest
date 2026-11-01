import { defineConfig, devices } from '@playwright/test';

// E2E (docs/TESTING.md): locale es-AR, hora de Argentina, escritorio y celular de 360 px.
// Corre contra el build de producción: ejecutar `npm run build` antes de `npm run test:e2e`.
// Puerto propio para no chocar con otros proyectos locales en el 3000.
const PORT = Number(process.env.E2E_PORT || 3100);

// Los tests etiquetados @auth (registro, ingreso, emails) solo corren con E2E_AUTH=1 y SOLO contra un
// Supabase local (CI con `supabase start`), nunca contra un proyecto en la nube: crean usuarios y usan
// contraseñas de prueba. Ver docs/TESTING.md.
const AUTH_ENABLED = process.env.E2E_AUTH === '1';
if (AUTH_ENABLED) {
  const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://invalid').hostname;
  if (!['localhost', '127.0.0.1'].includes(host)) {
    throw new Error('E2E_AUTH=1 requiere NEXT_PUBLIC_SUPABASE_URL apuntando a un Supabase local (localhost/127.0.0.1).');
  }
}

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  ...(AUTH_ENABLED ? {} : { grepInvert: /@auth/ }),
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run start -w @inmogest/web -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    // Nunca reutilizar un servidor existente: podría ser otra aplicación.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
