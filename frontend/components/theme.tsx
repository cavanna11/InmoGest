'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils.ts';

// Modo de color: claro por defecto, oscuro o el del sistema. La elección vive en localStorage
// (preferencia del navegador, no de la cuenta) y se aplica como data-theme en <html> (styles/tokens.css).

export type ThemeChoice = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'inmopanel-theme';
const EVENT = 'inmopanel-theme-change';

/**
 * Script que corre antes de pintar (va en el <head>): evita el parpadeo del tema claro al cargar en
 * oscuro y sigue los cambios del sistema cuando la elección es "system".
 */
export const themeScript = `(function(){try{var k='${STORAGE_KEY}',m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var c=localStorage.getItem(k);var d=c==='dark'||(c==='system'&&m.matches);document.documentElement.dataset.theme=d?'dark':'light';}a();m.addEventListener('change',a);window.addEventListener('${EVENT}',a);window.addEventListener('storage',a);}catch(e){}})();`;

function readChoice(): ThemeChoice {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'dark' || value === 'system' ? value : 'light';
  } catch {
    return 'light';
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function choose(choice: ThemeChoice) {
  try {
    localStorage.setItem(STORAGE_KEY, choice);
  } catch {
    // Sin almacenamiento (modo privado estricto): se aplica solo en esta página.
    document.documentElement.dataset.theme = choice === 'dark' ? 'dark' : 'light';
  }
  window.dispatchEvent(new Event(EVENT));
}

const OPTIONS = [
  { value: 'light', label: 'Modo claro', Icon: Sun },
  { value: 'dark', label: 'Modo oscuro', Icon: Moon },
  { value: 'system', label: 'Según el sistema', Icon: Monitor },
] as const;

export function ThemeToggle({ className }: { className?: string }) {
  // En el servidor no hay elección guardada: se muestra "claro" hasta hidratar.
  const current = useSyncExternalStore(subscribe, readChoice, () => 'light' as ThemeChoice);
  return (
    <div role="radiogroup" aria-label="Modo de color" className={cn('inline-flex rounded-full border border-border bg-muted p-0.5', className)}>
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={current === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            'inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
            current === value && 'bg-surface text-primary shadow-sm',
          )}
        >
          <Icon aria-hidden="true" className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
