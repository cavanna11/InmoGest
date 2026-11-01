// Landing comercial de InmoPanel by C&C (docs/BRAND.md). Usa solo tokens semánticos (styles/tokens.css): nada de colores sueltos.
// Destinos de los CTA en ./config.ts; textos en ./content.ts.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { DEMO_SECTION_ID, PRODUCT_STATUS, SHOW_PRICES, demoHref, landingLinks } from './config.ts';
import { faqs, features, plans, problems, startSteps } from './content.ts';
import { MatchingDemo, NewContactDemo, TeamReplyDemo } from './demos.tsx';

const nav = [
  { href: '#funciones', label: 'Funciones' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  ...(SHOW_PRICES ? [{ href: '#planes', label: 'Planes' }] : []),
  { href: '#preguntas', label: 'Preguntas' },
];

// Sin tailwind-merge, dos clases de la misma propiedad en un elemento no tienen ganador fijo: el tamaño
// va por `size` y la visibilidad responsive por spans internos, nunca sumando clases en conflicto.
const buttonBase =
  'inline-flex items-center justify-center rounded-md text-sm font-medium whitespace-nowrap transition-colors';
const buttonSizes = { md: 'h-10 px-4', sm: 'h-9 px-3 sm:px-4' };
const buttonVariants = {
  primary: `${buttonBase} bg-primary text-primary-foreground hover:bg-primary/90`,
  outline: `${buttonBase} border border-input bg-background hover:bg-accent hover:text-accent-foreground`,
  // Sobre fondo primary (bloque de demo).
  inverse: `${buttonBase} bg-primary-foreground text-primary hover:bg-primary-foreground/90`,
  inverseOutline: `${buttonBase} border border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10`,
};

function ButtonLink({ href, variant = 'primary', size = 'md', className = '', children }: {
  href: string;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: ReactNode;
}) {
  const classes = `${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
  // Rutas internas con Link (prefetch); anclas y destinos externos con <a>.
  return href.startsWith('/') ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}

function DemoCta({ className, variant }: { className?: string; variant?: keyof typeof buttonVariants }) {
  return (
    <ButtonLink href={demoHref()} variant={variant} className={className}>
      Solicitar una demo
    </ButtonLink>
  );
}

function PlatformCta({ className, size }: { className?: string; size?: keyof typeof buttonSizes }) {
  if (!landingLinks.platform) return null;
  return (
    <ButtonLink href={landingLinks.platform} variant="outline" size={size} className={className}>
      Acceder a la plataforma
    </ButtonLink>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 shrink-0 ${className}`} fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Section({ id, eyebrow, title, intro, children, muted = false }: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 ${muted ? 'bg-muted/50' : ''}`}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 max-w-2xl">
          <p className="mb-2 text-sm font-medium text-muted-foreground">{eyebrow}</p>
          <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h2>
          {intro ? <p className="mt-3 text-muted-foreground text-pretty">{intro}</p> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* InmoPanel es la marca protagonista; "by C&C" va en segundo plano (docs/BRAND.md). */}
        <a href="#inicio" className="flex items-baseline gap-1.5" aria-label="InmoPanel by C&C, inicio">
          <span className="text-base font-semibold tracking-tight">InmoPanel</span>
          <span className="text-xs text-muted-foreground">by C&amp;C</span>
        </a>
        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex items-center gap-6 text-sm text-muted-foreground">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-foreground">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          {landingLinks.platform ? (
            <ButtonLink href={landingLinks.platform} variant="outline" size="sm">
              <span className="sm:hidden">Ingresar</span>
              <span className="hidden sm:inline">Acceder a la plataforma</span>
            </ButtonLink>
          ) : null}
          <ButtonLink href={demoHref()} size="sm">
            <span className="sm:hidden">Pedir demo</span>
            <span className="hidden sm:inline">Solicitar una demo</span>
          </ButtonLink>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="inicio" className="px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
        <div>
          <p className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Gestión inmobiliaria inteligente</span>
            {PRODUCT_STATUS ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">{PRODUCT_STATUS}</span>
            ) : null}
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Contactos, propiedades y WhatsApp de tu inmobiliaria, en un solo lugar.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">
            Cada consulta queda registrada, todo el equipo puede responder y, cuando entra una propiedad, InmoPanel te
            dice qué clientes la están buscando.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <DemoCta />
            <PlatformCta />
          </div>
          <ul className="mt-8 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:gap-x-6">
            {['Prueba gratis de 14 días', 'Sin instalación', 'Importá desde planillas'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="text-foreground" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <NewContactDemo layout="stacked" />
      </div>
    </section>
  );
}

function Problems() {
  return (
    <Section
      id="problema"
      eyebrow="El problema"
      title="La información comercial de una inmobiliaria suele estar en todos lados menos en un sistema."
      muted
    >
      <div className="overflow-hidden rounded-xl border border-border bg-background">
        <div className="hidden grid-cols-2 border-b border-border text-sm font-medium md:grid">
          <p className="px-5 py-3 text-muted-foreground">Hoy</p>
          <p className="border-l border-border px-5 py-3">Con InmoPanel</p>
        </div>
        <ul className="divide-y divide-border">
          {problems.map((item) => (
            <li key={item.today} className="grid md:grid-cols-2">
              <p className="px-5 pt-4 text-sm text-muted-foreground md:py-4">
                <span className="font-medium md:hidden">Hoy: </span>
                {item.today}
              </p>
              <p className="flex gap-2 px-5 pt-2 pb-4 text-sm md:border-l md:border-border md:py-4">
                <CheckIcon className="mt-0.5" />
                <span>{item.withUs}</span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function Demos() {
  return (
    <Section
      id="como-funciona"
      eyebrow="Cómo funciona"
      title="Así se ve el trabajo de todos los días."
      intro="Dos flujos centrales del sistema, paso a paso. Las maquetas son ilustrativas y usan datos ficticios."
    >
      <div className="flex flex-col gap-8">
        <TeamReplyDemo />
        <MatchingDemo />
      </div>
    </Section>
  );
}

function Features() {
  return (
    <Section
      id="funciones"
      eyebrow="Funciones"
      title="Todo lo que necesita el equipo comercial, sin herramientas sueltas."
      muted
    >
      <ul className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <li key={feature.title} className="bg-background p-6">
            <h3 className="font-semibold">{feature.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{feature.text}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function GetStarted() {
  return (
    <Section
      id="empezar"
      eyebrow="Cómo empezar"
      title="Empezá por tu cuenta, sin instalaciones ni esperas."
      intro="Un asistente te guía en cada paso y muestra qué falta. Podés saltear pasos y retomarlos después."
    >
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {startSteps.map((step, i) => (
          <li key={step.title} className="flex flex-col gap-3">
            <span className="flex size-8 items-center justify-center rounded-full border border-input text-sm font-semibold">
              {i + 1}
            </span>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Pricing() {
  if (!SHOW_PRICES) return null;
  return (
    <Section
      id="planes"
      eyebrow="Planes"
      title="Un precio accesible para cada tamaño de inmobiliaria."
      intro="Todos los planes incluyen la gestión de contactos, propiedades, matching, bandeja de WhatsApp, embudo y agenda. Cambian la capacidad y las automatizaciones."
      muted
    >
      <ul className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            className={`flex flex-col rounded-xl border bg-background p-6 ${plan.highlighted ? 'border-primary shadow-sm' : 'border-border'}`}
          >
            <h3 className="font-semibold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
            <p className="mt-5">
              <span className="text-3xl font-semibold tabular-nums">USD {plan.price}</span>
              <span className="text-sm text-muted-foreground"> / mes</span>
            </p>
            <ul className="mt-6 flex flex-col gap-2 text-sm">
              {plan.limits.map((limit) => (
                <li key={limit} className="flex gap-2">
                  <CheckIcon className="mt-0.5" />
                  {limit}
                </li>
              ))}
              {plan.extras.map((extra) => (
                <li key={extra.text} className="flex flex-wrap items-center gap-x-2 pl-6 text-muted-foreground">
                  {extra.text}
                  {extra.soon ? (
                    <span className="rounded-full border border-border px-1.5 text-[11px]">Próximamente</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <DemoCta className="mt-8" variant={plan.highlighted ? 'primary' : 'outline'} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted-foreground">
        Precios mensuales de referencia en dólares. El pago es por transferencia bancaria.
      </p>
    </Section>
  );
}

function DemoRequest() {
  return (
    <section id={DEMO_SECTION_ID} className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl rounded-2xl bg-primary px-6 py-12 text-center text-primary-foreground sm:px-12">
        <h2 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          Mirá InmoPanel con los datos de tu inmobiliaria.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80 text-pretty">
          Te mostramos cómo quedarían tus contactos, propiedades y conversaciones, y resolvemos tus dudas sobre WhatsApp
          y la migración.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {landingLinks.demo ? (
            <ButtonLink href={landingLinks.demo} variant="inverse">
              Solicitar una demo
            </ButtonLink>
          ) : (
            // PENDIENTE: falta el canal para pedir demos (landingLinks.demo). No se inventa uno.
            <p className="rounded-md border border-primary-foreground/30 px-4 py-2 text-sm">
              Muy pronto vas a poder coordinar una demo desde acá.
            </p>
          )}
          {landingLinks.platform ? (
            <ButtonLink href={landingLinks.platform} variant="inverseOutline">
              Acceder a la plataforma
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <Section id="preguntas" eyebrow="Preguntas frecuentes" title="Lo que suelen preguntar antes de empezar.">
      <div className="divide-y divide-border rounded-xl border border-border">
        {faqs.map((item) => (
          <details key={item.q} className="group px-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span
                aria-hidden="true"
                className="text-xl leading-none text-muted-foreground transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="pb-5 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

function Footer() {
  const legal = [
    { href: landingLinks.terms, label: 'Términos y condiciones' },
    { href: landingLinks.privacy, label: 'Política de privacidad' },
  ].filter((link): link is { href: string; label: string } => Boolean(link.href));

  return (
    <footer className="border-t border-border px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>
          <p>
            <span className="font-semibold text-foreground">InmoPanel</span> <span className="text-xs">by C&amp;C</span>
          </p>
          <p className="mt-1">Gestión inmobiliaria inteligente. Todo tu negocio inmobiliario, en un solo lugar.</p>
        </div>
        <nav aria-label="Pie de página">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="hover:text-foreground">
                  {item.label}
                </a>
              </li>
            ))}
            {/* Los enlaces legales aparecen solo cuando existen (PRD §10). */}
            {legal.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="hover:text-foreground">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Problems />
        <Demos />
        <Features />
        <GetStarted />
        <Pricing />
        <DemoRequest />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
