import type { BillingCycle, FinanceCategory } from '@/lib/types'

// Libellés FR + couleurs pour les catégories de dépense/abonnement.
export const CATEGORY_META: Record<FinanceCategory, { label: string; color: string }> = {
  software:       { label: 'Logiciels',     color: '#3B82F6' },
  hardware:       { label: 'Matériel',      color: '#A78BFA' },
  subcontracting: { label: 'Sous-traitance', color: '#F59E0B' },
  marketing:      { label: 'Marketing',     color: '#EC4899' },
  office:         { label: 'Frais généraux', color: '#14B8A6' },
  other:          { label: 'Autre',         color: '#6B7280' },
}

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_META).map(([value, m]) => ({
  value: value as FinanceCategory,
  label: m.label,
  color: m.color,
}))

export const BILLING_META: Record<BillingCycle, { label: string; short: string }> = {
  monthly: { label: 'Mensuel', short: '/mois' },
  yearly:  { label: 'Annuel',  short: '/an' },
}

/** Format euros — entier, séparateur FR. */
export function eur(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

/** Charge mensuelle normalisée d'un abonnement (annuel ÷ 12). */
export function monthlyBurn(amount: number, cycle: BillingCycle): number {
  return cycle === 'yearly' ? amount / 12 : amount
}
