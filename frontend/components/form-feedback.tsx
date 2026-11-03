'use client';

import { useFormStatus } from 'react-dom';
import type { FormState } from '@/lib/action.ts';
import { Button, type ButtonProps } from './ui/button.tsx';
import { Alert } from './ui/surfaces.tsx';

/** Botón de envío que se deshabilita y avisa mientras la acción corre. */
export function SubmitButton({ children, pendingLabel, ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-disabled={pending || props.disabled} {...props}>
      {pending ? (pendingLabel ?? 'Guardando…') : children}
    </Button>
  );
}

/** Mensaje general del formulario (éxito o error), anunciado por lectores de pantalla. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === 'idle' || !state.message) return null;
  return <Alert variant={state.status === 'success' ? 'success' : 'destructive'}>{state.message}</Alert>;
}
