import type { Metadata } from 'next';
import { SectionPreview } from '@/modules/panel/section-preview.tsx';
import { PREVIEW_SECTIONS } from '@/modules/panel/sections.ts';

export const metadata: Metadata = { title: PREVIEW_SECTIONS.agenda.title };

export default function Page() {
  return <SectionPreview slug="agenda" />;
}
