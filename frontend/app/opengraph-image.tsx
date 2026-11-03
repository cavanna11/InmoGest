import { ImageResponse } from 'next/og';

// Imagen para compartir enlaces (Open Graph / redes), generada con next/og (incluido en Next.js).
// Colores fijos de marca (docs/BRAND.md); la geometría del logo replica components/brand/logo.tsx.
export const alt = 'InmoPanel by C&C — Software de gestión para inmobiliarias';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background: '#f6f9f8',
          color: '#10201e',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg viewBox="0 0 32 32" width="88" height="88">
            <rect width="32" height="32" rx="8" fill="#0a7468" />
            <path d="M11 7.5v17" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" fill="none" />
            <path d="M11 7.5h5.75a5.75 5.75 0 0 1 0 11.5H11" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <path d="M17.25 19l3.4 3.4" stroke="#e2572f" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <circle cx="22.4" cy="23.6" r="2.9" fill="#e2572f" />
          </svg>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontSize: 56, fontWeight: 700 }}>InmoPanel</span>
            <span style={{ fontSize: 28, color: '#536361' }}>by C&amp;C</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <span style={{ fontSize: 30, fontWeight: 600, color: '#0a7468' }}>Gestión inmobiliaria inteligente</span>
          <span style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.08, maxWidth: 980 }}>
            Que ninguna consulta ni oportunidad se te escape.
          </span>
        </div>
        <span style={{ fontSize: 26, color: '#536361' }}>Contactos, propiedades y WhatsApp de tu inmobiliaria, en un solo lugar.</span>
      </div>
    ),
    size,
  );
}
