'use client';

import { useCallback, useSyncExternalStore } from 'react';

// Preferencias de interfaz de este navegador (orden del menú, grupos plegados, menú compacto).
// Viven en localStorage a propósito: no son datos de la inmobiliaria y no tocan la base. Si el
// almacenamiento no está disponible (modo privado estricto), se usa el valor por defecto.

const EVENT = 'inmopanel-preference-change';

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

// Respaldo en memoria si localStorage falla: la preferencia dura hasta recargar la página.
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key) ?? null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Valor guardado bajo `key` (JSON). En el servidor y durante la hidratación devuelve `fallback`, así el
 * HTML coincide; después toma lo guardado.
 */
export function useLocalPreference<T>(key: string, fallback: T): [T, (value: T | null) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );
  let value = fallback;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = fallback;
    }
  }
  const set = useCallback(
    (next: T | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(next));
        memory.delete(key);
      } catch {
        // Sin almacenamiento: se recuerda en memoria hasta recargar.
        memory.set(key, next === null ? null : JSON.stringify(next));
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );
  return [value, set];
}
