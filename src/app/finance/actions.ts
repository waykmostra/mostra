'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type {
  BillingCycle,
  ExpenseInsert,
  ExpenseUpdate,
  FinanceCategory,
  SubscriptionInsert,
  SubscriptionUpdate,
} from '@/lib/types'

// ============================================================================
// Finance Server Actions — tables `expenses` et `subscriptions` (migration 020)
//
// Périmètre : cashflow uniquement (dépenses + abonnements). Les REVENUS ne sont
// PAS gérés ici : ils dérivent des projets (value_eur + payment_status + paid_at).
// Données admin-only : on écrit via db(admin) après vérification requireAdmin().
// ============================================================================

export type FinanceActionResult = { success: true } | { success: false; error: string }

const CATEGORIES: FinanceCategory[] = [
  'software',
  'hardware',
  'subcontracting',
  'marketing',
  'office',
  'other',
]
const BILLING_CYCLES: BillingCycle[] = ['monthly', 'yearly']

/** Valide + arrondit un montant en euros (2 décimales). */
function normalizeAmount(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value) || value < 0) return null
  return Math.round(value * 100) / 100
}

// ── Dépenses ──────────────────────────────────────────────────────

export interface CreateExpenseInput {
  label: string
  amount_eur: number
  category?: FinanceCategory
  /** Date 'YYYY-MM-DD'. Défaut DB : aujourd'hui. */
  incurred_on?: string
  project_id?: string | null
  notes?: string | null
}

export async function createExpense(input: CreateExpenseInput): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const label = input.label?.trim()
  if (!label) return { success: false, error: 'Le libellé est requis.' }

  const amount = normalizeAmount(input.amount_eur)
  if (amount === null) return { success: false, error: 'Le montant doit être un nombre positif.' }

  const category = input.category ?? 'other'
  if (!CATEGORIES.includes(category)) return { success: false, error: 'Catégorie invalide.' }

  const payload: ExpenseInsert = {
    label,
    amount_eur: amount,
    category,
    project_id: input.project_id || null,
    notes: input.notes?.trim() || null,
    created_by: user.id,
  }
  if (input.incurred_on) payload.incurred_on = input.incurred_on

  const { error } = await db(admin).from('expenses').insert(payload)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}

export interface UpdateExpenseInput {
  label?: string
  amount_eur?: number
  category?: FinanceCategory
  incurred_on?: string
  project_id?: string | null
  notes?: string | null
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: ExpenseUpdate = {}

  if ('label' in input) {
    const label = input.label?.trim()
    if (!label) return { success: false, error: 'Le libellé est requis.' }
    patch.label = label
  }
  if ('amount_eur' in input) {
    const amount = normalizeAmount(input.amount_eur)
    if (amount === null) return { success: false, error: 'Le montant doit être un nombre positif.' }
    patch.amount_eur = amount
  }
  if ('category' in input && input.category) {
    if (!CATEGORIES.includes(input.category)) return { success: false, error: 'Catégorie invalide.' }
    patch.category = input.category
  }
  if ('incurred_on' in input && input.incurred_on) patch.incurred_on = input.incurred_on
  if ('project_id' in input) patch.project_id = input.project_id || null
  if ('notes' in input) patch.notes = input.notes?.trim() || null

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(admin).from('expenses').update(patch).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}

export async function deleteExpense(id: string): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('expenses').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}

// ── Abonnements ───────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  label: string
  amount_eur: number
  billing_cycle?: BillingCycle
  category?: FinanceCategory
  active?: boolean
  started_on?: string
  notes?: string | null
}

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const label = input.label?.trim()
  if (!label) return { success: false, error: 'Le libellé est requis.' }

  const amount = normalizeAmount(input.amount_eur)
  if (amount === null) return { success: false, error: 'Le montant doit être un nombre positif.' }

  const billingCycle = input.billing_cycle ?? 'monthly'
  if (!BILLING_CYCLES.includes(billingCycle)) {
    return { success: false, error: 'Périodicité invalide.' }
  }

  const category = input.category ?? 'software'
  if (!CATEGORIES.includes(category)) return { success: false, error: 'Catégorie invalide.' }

  const payload: SubscriptionInsert = {
    label,
    amount_eur: amount,
    billing_cycle: billingCycle,
    category,
    notes: input.notes?.trim() || null,
  }
  if (typeof input.active === 'boolean') payload.active = input.active
  if (input.started_on) payload.started_on = input.started_on

  const { error } = await db(admin).from('subscriptions').insert(payload)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}

export interface UpdateSubscriptionInput {
  label?: string
  amount_eur?: number
  billing_cycle?: BillingCycle
  category?: FinanceCategory
  active?: boolean
  started_on?: string
  notes?: string | null
}

export async function updateSubscription(
  id: string,
  input: UpdateSubscriptionInput,
): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: SubscriptionUpdate = {}

  if ('label' in input) {
    const label = input.label?.trim()
    if (!label) return { success: false, error: 'Le libellé est requis.' }
    patch.label = label
  }
  if ('amount_eur' in input) {
    const amount = normalizeAmount(input.amount_eur)
    if (amount === null) return { success: false, error: 'Le montant doit être un nombre positif.' }
    patch.amount_eur = amount
  }
  if ('billing_cycle' in input && input.billing_cycle) {
    if (!BILLING_CYCLES.includes(input.billing_cycle)) {
      return { success: false, error: 'Périodicité invalide.' }
    }
    patch.billing_cycle = input.billing_cycle
  }
  if ('category' in input && input.category) {
    if (!CATEGORIES.includes(input.category)) return { success: false, error: 'Catégorie invalide.' }
    patch.category = input.category
  }
  if ('active' in input && typeof input.active === 'boolean') patch.active = input.active
  if ('started_on' in input && input.started_on) patch.started_on = input.started_on
  if ('notes' in input) patch.notes = input.notes?.trim() || null

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(admin).from('subscriptions').update(patch).eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}

export async function deleteSubscription(id: string): Promise<FinanceActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin).from('subscriptions').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/finance')
  return { success: true }
}
