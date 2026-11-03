// Valores del formulario de propiedades. Fuera del módulo 'use client': el servidor los importa
// como datos (desde un módulo de cliente llegarían como referencia).

export type PropertyFormValues = {
  id?: string;
  title: string;
  description: string;
  operation: string;
  property_type: string;
  status: string;
  price: number | null;
  currency: string;
  expenses: number | null;
  expenses_currency: string;
  province: string;
  city: string;
  neighborhood: string;
  address: string;
  show_address: boolean;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  covered_area_m2: number | null;
  total_area_m2: number | null;
  features: string[];
  assigned_user_id: string | null;
};

export const EMPTY_PROPERTY: PropertyFormValues = {
  title: '',
  description: '',
  operation: 'sale',
  property_type: 'apartment',
  status: 'draft',
  price: null,
  currency: 'USD',
  expenses: null,
  expenses_currency: 'ARS',
  province: '',
  city: '',
  neighborhood: '',
  address: '',
  show_address: false,
  rooms: null,
  bedrooms: null,
  bathrooms: null,
  covered_area_m2: null,
  total_area_m2: null,
  features: [],
  assigned_user_id: null,
};
