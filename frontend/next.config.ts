import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { NextConfig } from 'next';

// Las variables viven en el .env.local de la raíz del monorepo (una sola copia para app, worker y
// scripts). En Vercel no existe ese archivo y las variables llegan por el entorno.
const rootEnv = resolve(process.cwd(), '..', '.env.local');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

// Cabeceras de seguridad base (docs/SECURITY.md). La CSP completa con nonces se define cuando haya
// formularios y scripts propios; por ahora se impide el embebido en iframes.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  transpilePackages: ['@inmogest/shared'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
