// Página inicial provisoria de la Fase 0: solo informa. Sin botones ni enlaces a funciones que todavía
// no existen (registro e ingreso llegan en la Fase 1).
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">C&amp;C</p>
      <h1 className="text-3xl font-semibold sm:text-4xl">InmoGest</h1>
      <p className="text-lg text-neutral-700 dark:text-neutral-300">
        CRM inmobiliario para inmobiliarias argentinas: contactos, propiedades, matching automático, agenda y
        WhatsApp en un solo lugar.
      </p>
      <p className="text-neutral-600 dark:text-neutral-400">
        Estamos construyendo la plataforma. El registro de inmobiliarias todavía no está disponible.
      </p>
    </main>
  );
}
