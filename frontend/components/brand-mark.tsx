import { Logo } from './brand/logo.tsx';

/** Marca en pantallas de la app (acceso y panel): logo con "InmoPanel" protagonista y "by C&C" (docs/BRAND.md). */
export function BrandMark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return <Logo className={className} size={size} />;
}
