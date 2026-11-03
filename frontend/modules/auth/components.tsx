'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { describedBy, Field, Input } from '@/components/ui/form-controls.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { idle } from '@/lib/action.ts';
import {
  invitedSignUpAction,
  requestPasswordResetAction,
  resendConfirmationAction,
  signInAction,
  signUpAction,
  updatePasswordAction,
} from './actions.ts';
import type { LegalDocumentSummary } from './queries.ts';

const PASSWORD_HINT = 'Al menos 10 caracteres, con mayúsculas, minúsculas y números.';

function TextField({
  id,
  label,
  error,
  hint,
  ...props
}: React.ComponentProps<'input'> & { id: string; label: string; error?: string | undefined; hint?: string }) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <Input id={id} name={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy(id, { hint, error })} {...props} />
    </Field>
  );
}

export function SignUpForm({ legal }: { legal: LegalDocumentSummary[] }) {
  const [state, action] = useActionState(signUpAction, idle);
  if (state.status === 'success') return <FormMessage state={state} />;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="organizationName" label="Nombre de la inmobiliaria" autoComplete="organization" required error={e.organizationName} />
      <TextField id="fullName" label="Tu nombre" autoComplete="name" required error={e.fullName} />
      <TextField id="email" label="Email" type="email" autoComplete="email" required error={e.email} />
      <TextField id="password" label="Contraseña" type="password" autoComplete="new-password" required hint={PASSWORD_HINT} error={e.password} />
      <div className="grid gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acceptLegal" className="mt-0.5 size-4 accent-primary" aria-invalid={e.acceptLegal ? true : undefined} />
          <span>
            Acepto los {legal.map((doc, i) => (
              <span key={doc.id}>
                {i > 0 ? ' y la ' : ''}
                <Link
                  href={doc.kind === 'terms' ? '/legal/terminos' : '/legal/privacidad'}
                  target="_blank"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {doc.kind === 'terms' ? 'términos y condiciones' : 'política de privacidad'}
                </Link>
                {doc.isDraft ? (
                  <>
                    {' '}
                    <Badge variant="warning">No válido — solo desarrollo</Badge>
                  </>
                ) : null}
              </span>
            ))}
            .
          </span>
        </label>
        {e.acceptLegal ? (
          <p className="text-sm text-destructive" role="alert">
            {e.acceptLegal}
          </p>
        ) : null}
      </div>
      <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta y probar gratis</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tenés cuenta?{' '}
        <Link href="/ingresar" className="text-foreground underline underline-offset-4">
          Ingresá
        </Link>
      </p>
    </form>
  );
}

export function InvitedSignUpForm({ token, email }: { token: string; email: string }) {
  const [state, action] = useActionState(invitedSignUpAction, idle);
  if (state.status === 'success') return <FormMessage state={state} />;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <TextField id="email" label="Email" type="email" value={email} readOnly disabled />
      <TextField id="fullName" label="Tu nombre" autoComplete="name" required error={e.fullName} />
      <TextField id="password" label="Contraseña" type="password" autoComplete="new-password" required hint={PASSWORD_HINT} error={e.password} />
      <SubmitButton pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton>
    </form>
  );
}

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next} />
      <TextField id="email" label="Email" type="email" autoComplete="email" required error={e.email} />
      <TextField id="password" label="Contraseña" type="password" autoComplete="current-password" required error={e.password} />
      <SubmitButton pendingLabel="Ingresando…">Ingresar</SubmitButton>
      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <Link href="/recuperar" className="text-foreground underline underline-offset-4">
          Olvidé mi contraseña
        </Link>
        <span>
          ¿Tu inmobiliaria todavía no usa InmoPanel?{' '}
          <Link href="/registro" className="text-foreground underline underline-offset-4">
            Probalo gratis
          </Link>
        </span>
      </div>
    </form>
  );
}

export function ResendConfirmationForm() {
  const [state, action] = useActionState(resendConfirmationAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <TextField id="resend-email" name="email" label="Email de la cuenta" type="email" autoComplete="email" required error={e.email} />
      <SubmitButton variant="outline" pendingLabel="Enviando…">
        Reenviar email de confirmación
      </SubmitButton>
    </form>
  );
}

export function RequestResetForm() {
  const [state, action] = useActionState(requestPasswordResetAction, idle);
  if (state.status === 'success') return <FormMessage state={state} />;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="email" label="Email" type="email" autoComplete="email" required error={e.email} />
      <SubmitButton pendingLabel="Enviando…">Enviarme el enlace</SubmitButton>
    </form>
  );
}

export function UpdatePasswordForm({ submitLabel = 'Guardar contraseña' }: { submitLabel?: string }) {
  const [state, action] = useActionState(updatePasswordAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <TextField id="password" label="Contraseña nueva" type="password" autoComplete="new-password" required hint={PASSWORD_HINT} error={e.password} />
      <TextField id="confirm" label="Repetí la contraseña" type="password" autoComplete="new-password" required error={e.confirm} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
