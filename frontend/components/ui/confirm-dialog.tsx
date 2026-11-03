'use client';

import { AlertDialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { Button, buttonVariants, type ButtonProps } from './button.tsx';

/**
 * Confirmación accesible (Radix AlertDialog, foco atrapado y Escape para cancelar) antes de enviar un
 * formulario de una acción delicada (desactivar un usuario, cambiar un rol). El botón de confirmar
 * envía el formulario indicado por `formId`.
 */
export function ConfirmSubmit({
  formId,
  title,
  description,
  confirmLabel,
  trigger,
  triggerVariant = 'outline',
  destructive = false,
  disabled = false,
}: {
  formId: string;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  trigger: ReactNode;
  triggerVariant?: ButtonProps['variant'];
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <Button type="button" size="sm" variant={triggerVariant} disabled={disabled}>
          {trigger}
        </Button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-popover p-6 text-popover-foreground">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="text-sm text-muted-foreground">{description}</AlertDialog.Description>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel className={buttonVariants({ variant: 'outline' })}>Cancelar</AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button type="submit" form={formId} className={buttonVariants({ variant: destructive ? 'destructive' : 'default' })}>
                {confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
