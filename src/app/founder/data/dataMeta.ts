import type { DataColumnType, DataValue } from '@/lib/types'

// Métadonnées & helpers partagés de la section Data.

export const COLUMN_TYPE_META: Record<DataColumnType, { label: string; color: string }> = {
  number: { label: 'Nombre', color: '#00D76B' },
  category: { label: 'Catégorie', color: '#A78BFA' },
  text: { label: 'Texte', color: '#3B82F6' },
}

export const SET_COLORS = ['#00D76B', '#3B82F6', '#A78BFA', '#F59E0B', '#EC4899', '#22C55E', '#EF4444', '#9CA3AF']

export const CATEGORY_PALETTE = [
  '#00D76B', '#3B82F6', '#A78BFA', '#F59E0B', '#EC4899',
  '#22C55E', '#EF4444', '#9CA3AF', '#14B8A6', '#F97316',
]

/** Couleur déterministe d'une valeur de catégorie (stable d'un rendu à l'autre). */
export function categoryColor(value: string, options?: string[] | null): string {
  if (options && options.length > 0) {
    const i = options.indexOf(value)
    if (i >= 0) return CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
  }
  let h = 0
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0
  return CATEGORY_PALETTE[h % CATEGORY_PALETTE.length]
}

/** Convertit une valeur de cellule en nombre exploitable (ou null). */
export function toNumber(v: DataValue): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export function fmtNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('fr-FR') : n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}
