import { ImageResponse } from 'next/og';

// Ícono de aplicación (pantalla de inicio en iOS/Android): el isotipo de InmoPanel en PNG generado
// en el build con next/og (incluido en Next.js, sin dependencias). Colores fijos de marca.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0a7468' }}>
        <svg viewBox="0 0 32 32" width="180" height="180">
          <path d="M11 7.5v17" stroke="#f7fbfa" strokeWidth="3.2" strokeLinecap="round" fill="none" />
          <path d="M11 7.5h5.75a5.75 5.75 0 0 1 0 11.5H11" stroke="#f7fbfa" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M17.25 19l3.4 3.4" stroke="#e2572f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <circle cx="22.4" cy="23.6" r="2.9" fill="#e2572f" />
        </svg>
      </div>
    ),
    size,
  );
}
