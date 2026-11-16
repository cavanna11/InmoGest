'use client';

import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { zodFieldErrors } from '@/lib/action.ts';

type Parse = (data: FormData) => { success: true } | { success: false; error: z.ZodError };

/**
 * Validación en el campo: al salir de cada campo se valida el formulario con el mismo esquema que usa
 * el servidor, y se muestra el error solo de los campos que la persona ya tocó (o de todos al enviar).
 * Al enviar con errores no se manda nada y el foco va al primero. Con `warnUnsaved`, el navegador
 * avisa antes de cerrar o recargar si hay cambios sin guardar.
 *
 * `aliases` traduce el nombre de un campo al de su error (por ejemplo, los campos "phone" se validan
 * juntos como "phones").
 */
export function useFieldValidation(
  parse: Parse,
  serverErrors: Record<string, string> | undefined,
  { aliases = {}, warnUnsaved = false }: { aliases?: Record<string, string>; warnUnsaved?: boolean } = {},
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!warnUnsaved || !dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, warnUnsaved]);

  function validate(): Record<string, string> {
    const form = formRef.current;
    if (!form) return {};
    const parsed = parse(new FormData(form));
    const next = parsed.success ? {} : zodFieldErrors(parsed.error);
    setErrors(next);
    return next;
  }

  return {
    formRef,
    onChange() {
      if (!dirty) setDirty(true);
    },
    onBlur(event: React.FocusEvent<HTMLFormElement>) {
      const name = event.target instanceof HTMLElement ? event.target.getAttribute('name') : null;
      if (!name) return;
      setTouched((current) => new Set(current).add(aliases[name] ?? name));
      validate();
    },
    onSubmitCapture(event: React.FormEvent<HTMLFormElement>) {
      const found = validate();
      const names = Object.keys(found);
      if (names.length === 0) {
        setDirty(false);
        return;
      }
      event.preventDefault();
      setTouched(new Set(names));
      const field = Object.entries(aliases).find(([, alias]) => alias === names[0])?.[0] ?? names[0];
      // Después del clic (que deja el foco en el botón), al primer campo con error.
      const first = formRef.current?.querySelector<HTMLElement>(`#${field}, [name="${field}"]`);
      requestAnimationFrame(() => first?.focus());
    },
    error(name: string): string | undefined {
      return (touched.has(name) ? errors[name] : undefined) ?? serverErrors?.[name];
    },
  };
}
