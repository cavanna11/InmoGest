// Landing comercial de InmoPanel by C&C (docs/BRAND.md). Usa solo tokens semánticos (styles/tokens.css).
// Destinos de los CTA en ./config.ts; textos en ./content.ts; animaciones en ./landing.css.
// InmoPanel está en desarrollo: las funciones se presentan como las del primer lanzamiento.

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo.tsx';
import { ThemeToggle } from '@/components/theme.tsx';
import { DEMO_SECTION_ID, PRODUCT_STATUS, SHOW_PRICES, demoHref, landingLinks } from './config.ts';
import { commitments, faqs, painPoints, pillars, plans, startSteps } from './content.ts';
import { InboxFlow, OpportunityFlow } from './demos.tsx';
import { FlowPlayer } from './flow-player.tsx';
import './landing.css';

const nav = [
  { href: '#como-ayuda', label: 'Cómo te ayuda' },
  { href: '#como-funciona', label: 'Cómo funciona' },
  ...(SHOW_PRICES ? [{ href: '#planes', label: 'Planes' }] : []),
  { href: '#preguntas', label: 'Preguntas' },
];

// Sin tailwind-merge en este módulo: tamaño y variante van por props, nunca sumando clases en conflicto.
const buttonBase =
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-[background-color,box-shadow,transform] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:translate-y-px motion-reduce:transition-none';
const buttonSizes = { md: 'h-11 px-5', sm: 'h-10 px-3 sm:px-4' };
const buttonVariants = {
  primary: `${buttonBase} bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md`,
  outline: `${buttonBase} border border-input bg-surface text-foreground hover:border-primary hover:text-primary`,
  // Sobre fondo de marca (bloque de contacto).
  inverse: `${buttonBase} bg-primary-foreground text-primary hover:bg-primary-foreground/90`,
};

function ButtonLink({ href, variant = 'primary', size = 'md', className = '', children }: {
  href: string;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
  children: ReactNode;
}) {
  const classes = `${buttonVariants[variant]} ${buttonSizes[size]} ${className}`;
  return href.startsWith('/') ? (
    <Link href={href} className={classes}>
      {children}
    </Link>
  ) : href.startsWith('http') ? (
    // Canales externos (WhatsApp): en otra pestaña, sin exponer la landing al destino.
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {children}
    </a>
  ) : (
    <a href={href} className={classes}>
      {children}
    </a>
  );
}

/** Burbuja de chat (ícono genérico, no el logo de WhatsApp): indica que el botón abre una conversación. */
function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-4 shrink-0 ${className}`} fill="none">
      <path
        d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const demoOpensWhatsApp = demoHref().startsWith('https://wa.me/');

/**
 * "Solicitar una demo" en toda la página. Si el canal es WhatsApp lo anticipa: ícono visible y aviso
 * para lectores de pantalla.
 */
function DemoButton({ size, variant, className, label = 'Solicitar una demo', shortLabel }: {
  size?: keyof typeof buttonSizes;
  variant?: keyof typeof buttonVariants;
  className?: string;
  label?: string;
  shortLabel?: string;
}) {
  return (
    <ButtonLink href={demoHref()} size={size} variant={variant} className={className}>
      {demoOpensWhatsApp ? <ChatIcon /> : null}
      {shortLabel ? (
        <>
          <span className="sm:hidden">{shortLabel}</span>
          <span className="hidden sm:inline">{label}</span>
        </>
      ) : (
        label
      )}
      {demoOpensWhatsApp ? <span className="sr-only"> (se abre WhatsApp)</span> : null}
    </ButtonLink>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`size-4 shrink-0 ${className}`} fill="none">
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SoonBadge() {
  return <span className="rounded-full border border-border px-2 py-0.5 text-xs font-medium text-muted-foreground">Próximamente</span>;
}

function Section({ id, eyebrow, title, intro, children, tone = 'plain' }: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  tone?: 'plain' | 'muted';
}) {
  return (
    <section id={id} className={`scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28 ${tone === 'muted' ? 'bg-muted' : ''}`}>
      <div className="mx-auto max-w-6xl">
        <div className="ip-reveal mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-semibold text-primary">{eyebrow}</p>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          {intro ? <div className="mt-4 text-lg text-muted-foreground text-pretty">{intro}</div> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md backdrop-saturate-150 supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#inicio" aria-label="InmoPanel by C&C, inicio" className="shrink-0 rounded-md whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {/* En pantallas chicas solo "InmoPanel": "by C&C" no entra al lado de los botones. */}
          <Logo showCompany={false} className="sm:hidden" />
          <Logo className="hidden sm:inline-flex" />
        </a>
        {/* Desde lg: entre md y lg las etiquetas se partían en dos líneas junto a los botones. */}
        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="flex items-center gap-7 text-sm font-medium whitespace-nowrap text-muted-foreground">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {landingLinks.platform ? (
            <ButtonLink href={landingLinks.platform} variant="outline" size="sm">
              Ingresar
            </ButtonLink>
          ) : null}
          <DemoButton size="sm" shortLabel="Pedir demo" />
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section id="inicio" className="relative isolate overflow-hidden px-4 pt-8 pb-16 sm:px-6 sm:pt-20 sm:pb-28">
      {/* Trama sutil de "panel": guía visual, sin competir con el contenido. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 sm:gap-14 lg:grid-cols-[1.05fr_1fr]">
        <div className="min-w-0">
          <p className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-primary sm:mb-6">
            <span>Software de gestión para inmobiliarias</span>
            {PRODUCT_STATUS ? (
              <span className="rounded-full border border-highlight/50 bg-highlight/10 px-2.5 py-0.5 text-xs font-semibold text-foreground backdrop-blur-sm">
                {PRODUCT_STATUS}
              </span>
            ) : null}
          </p>
          <h1 className="text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-6xl">
            Que ninguna consulta ni oportunidad se te escape.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty sm:mt-6 sm:text-xl">
            InmoPanel reúne los contactos, las propiedades y las conversaciones de WhatsApp de tu inmobiliaria en un solo
            lugar. Y cuando entra una propiedad, te avisa qué clientes la están buscando.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <DemoButton />
            <ButtonLink href="#como-funciona" variant="outline">
              Ver cómo funciona
            </ButtonLink>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground sm:mt-9 sm:gap-x-6">
            {['Prueba gratis de 14 días', 'Sin instalación: navegador y celular', 'Importás tus planillas'].map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="text-primary" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative isolate min-w-0">
          {/* Resplandores de marca detrás de la maqueta de vidrio. */}
          <div aria-hidden="true" className="ip-glow ip-glow-primary -top-10 -right-6 -z-10 size-56 sm:size-72" />
          <div aria-hidden="true" className="ip-glow ip-glow-highlight -bottom-8 -left-8 -z-10 size-40 sm:size-56" />
          <FlowPlayer description="Ejemplo: entra una propiedad, coincide con la búsqueda de un cliente al 67 %, se avisa al agente y se envía la ficha por WhatsApp.">
            <OpportunityFlow />
          </FlowPlayer>
        </div>
      </div>
    </section>
  );
}

function PainPoints() {
  return (
    <Section
      id="problema"
      eyebrow="Lo que pasa hoy"
      title="Las ventas no se pierden por falta de clientes: se pierden en el camino."
      intro="Situaciones que se repiten en muchas inmobiliarias cuando la información no está en un solo lugar."
      tone="muted"
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {painPoints.map((item) => (
          <li key={item.title} className="ip-reveal flex flex-col rounded-xl border border-border bg-surface p-6">
            <p className="font-semibold text-pretty">{item.title}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-highlight" />
              {item.consequence}
            </p>
            <p className="mt-5 flex gap-2 border-t border-border pt-4 text-sm font-medium">
              <CheckIcon className="mt-0.5 text-primary" />
              <span>
                <span className="text-primary">Con InmoPanel: </span>
                {item.solution}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function HowItHelps() {
  return (
    <Section
      id="como-ayuda"
      eyebrow="Cómo te ayuda InmoPanel"
      title="Todo el trabajo comercial de la inmobiliaria, ordenado en un panel."
      intro={
        <p>
          InmoPanel está en desarrollo. Esto es lo que incluye el primer lanzamiento; lo marcado como
          «Próximamente» llega después.
        </p>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {pillars.map((pillar, index) => (
          <article key={pillar.id} className="ip-reveal flex flex-col rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-primary/60 sm:p-7">
            <span aria-hidden="true" className="mb-5 flex size-10 items-center justify-center rounded-lg bg-secondary text-sm font-bold text-secondary-foreground">
              0{index + 1}
            </span>
            <h3 className="text-xl font-bold">{pillar.title}</h3>
            <p className="mt-2 text-muted-foreground">{pillar.summary}</p>
            <ul className="mt-6 grid gap-4 border-t border-border pt-6">
              {pillar.items.map((item) => (
                <li key={item.title}>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    <CheckIcon className="text-primary" />
                    {item.title}
                    {item.soon ? <SoonBadge /> : null}
                  </p>
                  <p className="mt-1 pl-6 text-sm text-muted-foreground">{item.text}</p>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    'Un número nuevo le escribe al WhatsApp de la inmobiliaria.',
    'InmoPanel crea el contacto; si el número ya existía, vincula la conversación a su ficha.',
    'La primera persona del equipo que abre la conversación queda asignada.',
    'Cualquier agente puede responder y queda registrado quién lo hizo y cuándo.',
  ];
  return (
    <Section
      id="como-funciona"
      eyebrow="Cómo funciona"
      title="Una bandeja de WhatsApp para todo el equipo."
      intro="Las consultas ya no dependen del celular de cada agente: entran a una bandeja compartida y quedan en la inmobiliaria."
      tone="muted"
    >
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <ol className="ip-reveal grid min-w-0 gap-5">
          {steps.map((step, i) => (
            <li key={step} className="flex gap-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </span>
              <p className="pt-1 text-pretty">{step}</p>
            </li>
          ))}
        </ol>
        <div className="relative isolate min-w-0">
          <div aria-hidden="true" className="ip-glow ip-glow-primary -top-8 -left-6 -z-10 size-56" />
          <FlowPlayer description="Ejemplo: un número nuevo escribe, se crea el contacto, Laura abre la conversación y Martín responde; queda registrado quién respondió.">
            <InboxFlow />
          </FlowPlayer>
        </div>
      </div>
    </Section>
  );
}

function Commitments() {
  return (
    <Section
      id="confianza"
      eyebrow="Claro desde el principio"
      title="Decisiones de producto que podés verificar."
      tone="muted"
    >
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {commitments.map((item) => (
          <li key={item.title} className="ip-reveal rounded-xl border border-border bg-surface p-6">
            <h3 className="font-bold">{item.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
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
      title="Empezás por tu cuenta, sin instalaciones ni esperas."
      intro="Un asistente te guía en cada paso y muestra qué falta. Podés saltear pasos y retomarlos después."
    >
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {startSteps.map((step, i) => (
          <li key={step.title} className="ip-reveal flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
            <span className="text-sm font-bold text-highlight-foreground">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-highlight">{i + 1}</span>
            </span>
            <h3 className="font-bold">{step.title}</h3>
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
      intro="Todos los planes incluyen contactos, propiedades, coincidencias, bandeja de WhatsApp, embudo y agenda. Cambian la capacidad y las automatizaciones."
      tone="muted"
    >
      <ul className="grid gap-6 lg:grid-cols-3">
        {plans.map((plan) => (
          <li
            key={plan.name}
            className={`ip-reveal relative flex flex-col rounded-2xl border bg-surface p-7 ${plan.highlighted ? 'border-primary shadow-lg' : 'border-border'}`}
          >
            {plan.highlighted ? (
              <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Recomendado
              </span>
            ) : null}
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.summary}</p>
            <p className="mt-6">
              <span className="text-4xl font-extrabold tabular-nums">USD {plan.price}</span>
              <span className="text-sm text-muted-foreground"> / mes</span>
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm">
              {plan.limits.map((limit) => (
                <li key={limit} className="flex gap-2">
                  <CheckIcon className="mt-0.5 text-primary" />
                  {limit}
                </li>
              ))}
              {plan.extras.map((extra) => (
                <li key={extra.text} className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6 text-muted-foreground">
                  {extra.text}
                  {extra.soon ? <SoonBadge /> : null}
                </li>
              ))}
            </ul>
            <DemoButton variant={plan.highlighted ? 'primary' : 'outline'} className="mt-8" />
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
    <section id={DEMO_SECTION_ID} className="scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <div className="ip-reveal relative mx-auto max-w-4xl overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-14">
        <div aria-hidden="true" className="ip-glow ip-glow-highlight -top-20 -right-16 size-64" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-64 rounded-full border-[28px] border-primary-foreground/10" />
        <h2 className="relative text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Conocé InmoPanel antes del lanzamiento.
        </h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-primary-foreground/85 text-pretty">
          Te mostramos cómo quedarían tus contactos, propiedades y conversaciones, y resolvemos tus dudas sobre WhatsApp y
          la migración de tus datos.
        </p>
        <div className="relative mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {landingLinks.demo ? (
            <>
              <DemoButton variant="inverse" label="Coordinar por WhatsApp" />
              <p className="ip-glass-on-brand relative rounded-lg px-4 py-2 text-sm">Se abre WhatsApp con el mensaje listo para enviar.</p>
            </>
          ) : (
            // PENDIENTE: falta el canal para pedir demos (landingLinks.demo). No se inventa uno.
            <p className="rounded-lg border border-primary-foreground/30 px-5 py-3 text-sm font-medium">
              Muy pronto vas a poder coordinar una demo desde acá.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <Section id="preguntas" eyebrow="Preguntas frecuentes" title="Lo que suelen preguntar antes de empezar.">
      <div className="ip-reveal divide-y divide-border rounded-2xl border border-border bg-surface">
        {faqs.map((item) => (
          <details key={item.q} className="group px-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md py-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
              <h3 className="text-base">{item.q}</h3>
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border text-lg leading-none text-primary transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
              >
                +
              </span>
            </summary>
            <p className="pb-5 text-muted-foreground">{item.a}</p>
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
    <footer className="border-t border-border bg-muted px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-8 text-sm text-muted-foreground md:grid-cols-[1.4fr_1fr] md:items-start">
        <div>
          <Logo />
          <p className="mt-3 max-w-sm">Gestión inmobiliaria inteligente. Todo tu negocio inmobiliario, en un solo lugar.</p>
          <p className="mt-4 text-xs">InmoPanel es un producto de C&amp;C.</p>
        </div>
        <nav aria-label="Pie de página">
          <ul className="grid gap-2 sm:grid-cols-2">
            {nav.map((item) => (
              <li key={item.href}>
                <a href={item.href} className="transition-colors hover:text-foreground">
                  {item.label}
                </a>
              </li>
            ))}
            {/* Los enlaces legales aparecen solo cuando existen (PRD §10). */}
            {legal.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="transition-colors hover:text-foreground">
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
    <div className="ip-landing">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar al contenido
      </a>
      <Header />
      <main id="contenido">
        <Hero />
        <PainPoints />
        <HowItHelps />
        <HowItWorks />
        <Commitments />
        <GetStarted />
        <Pricing />
        <DemoRequest />
        <Faq />
      </main>
      <Footer />
    </div>
  );
}
