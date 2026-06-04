import type { DataColumn, DataColumnType, DataNumberFormat, DataValue } from '@/lib/types'

// Métadonnées & helpers partagés de la section Data.

export const COLUMN_TYPE_META: Record<DataColumnType, { label: string; color: string }> = {
  number: { label: 'Nombre', color: '#00D76B' },
  category: { label: 'Catégorie', color: '#A78BFA' },
  text: { label: 'Texte', color: '#3B82F6' },
}

export const NUMBER_FORMAT_META: Record<DataNumberFormat, { label: string }> = {
  raw: { label: 'Brut' },
  rating: { label: 'Note (sur N)' },
  fraction: { label: 'Fraction « a/b » (max par entrée)' },
  percent: { label: 'Pourcentage (%)' },
  currency: { label: 'Montant (€)' },
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

/**
 * Formate un NOMBRE déjà agrégé (KPI, moyenne…) selon le format de la colonne.
 * Pour 'fraction', la valeur agrégée est un pourcentage.
 */
export function formatNumberValue(col: Pick<DataColumn, 'number_format' | 'number_max'>, n: number): string {
  switch (col.number_format) {
    case 'rating':
      return `${fmtNumber(n)}/${col.number_max ?? '?'}`
    case 'percent':
    case 'fraction':
      return `${fmtNumber(n)} %`
    case 'currency':
      return `${fmtNumber(n)} €`
    default:
      return fmtNumber(n)
  }
}

/** Suffixe court d'une colonne (pour les axes/légendes de graphiques). */
export function numberUnit(col: Pick<DataColumn, 'number_format' | 'number_max'>): string {
  switch (col.number_format) {
    case 'rating':
      return `/${col.number_max ?? '?'}`
    case 'percent':
    case 'fraction':
      return '%'
    case 'currency':
      return '€'
    default:
      return ''
  }
}

/** Parse une fraction littérale « a/b » → pourcentage (a/b·100), ou null. */
export function parseFractionPercent(raw: DataValue): number | null {
  if (raw == null) return null
  const m = String(raw).trim().match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/)
  if (!m) return null
  const num = parseFloat(m[1].replace(',', '.'))
  const den = parseFloat(m[2].replace(',', '.'))
  if (!den || !Number.isFinite(num) || !Number.isFinite(den)) return null
  return (num / den) * 100
}

/** Nombre comparable d'une valeur, en tenant compte du format (fraction → %). */
export function columnNumber(col: Pick<DataColumn, 'number_format'>, value: DataValue): number | null {
  if (col.number_format === 'fraction') return parseFractionPercent(value)
  return toNumber(value)
}

/** Texte affiché dans une cellule Nombre (fraction = « 1/5 · 20% »). */
export function displayCell(col: Pick<DataColumn, 'number_format' | 'number_max'>, value: DataValue): string {
  if (col.number_format === 'fraction') {
    const raw = String(value ?? '').trim()
    if (!raw) return ''
    const pct = parseFractionPercent(value)
    return pct != null ? `${raw} · ${fmtNumber(Math.round(pct))}%` : raw
  }
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? formatNumberValue(col, n) : String(value ?? '')
}
