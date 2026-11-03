import Link from 'next/link';
import { whatsappHref } from '@/components/landing/config.ts';
import { Button } from '@/components/ui/button.tsx';

/** Aviso de la beta cerrada (ADR 0010): el alta de cuentas la hace C&C. */
export function ClosedBetaNotice() {
  return (
    <div className="grid gap-4 text-sm" role="status">
      <p>
        InmoPanel está en <strong>beta cerrada</strong>: por ahora damos de alta cada inmobiliaria a mano. Escribinos y te
        mandamos tu acceso.
      </p>
      <Button asChild>
        <a href={whatsappHref('Hola, quiero acceso a la beta de InmoPanel.')} target="_blank" rel="noopener noreferrer">
          Pedir acceso por WhatsApp
        </a>
      </Button>
      <p className="text-center text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/ingresar" className="text-foreground underline underline-offset-4">
          Ingresar
        </Link>
      </p>
    </div>
  );
}
