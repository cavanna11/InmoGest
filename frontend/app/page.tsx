import { brand } from '@/lib/brand.ts';

// Página inicial provisoria: solo informa. Sin botones ni enlaces a funciones que todavía
// no existen (registro e ingreso llegan en el incremento 1.1).
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-5 py-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold sm:text-4xl">{brand.product}</h1>
        {/* C&C es el respaldo: más chico y atenuado, sin competir con el nombre del producto. */}
        <p className="text-sm text-muted-foreground">by {brand.company}</p>
      </header>
      <p className="text-lg font-medium">{brand.descriptor}.</p>
      <p className="text-lg">
        {brand.tagline} Contactos, conversaciones de WhatsApp, propiedades, búsquedas, oportunidades y agenda de tu
        inmobiliaria, centralizados.
      </p>
      <p className="text-muted-foreground">
        Estamos construyendo la plataforma. El registro de inmobiliarias todavía no está disponible.
      </p>
    </main>
  );
}
