'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/supabase/helpers'
import { newPayToken, syncProjectPaymentStatus } from '@/lib/payments'
import { getStripe } from '@/lib/stripe'
import type { PaymentRequest } from '@/lib/types'

/**
 * Demandes de paiement d'un projet (migration 038) — admin uniquement.
 * Le montant saisi ici est la seule source du prix facturé par Stripe.
 */

export type PaymentActionResult = { success: true } | { success: false; error: string }

const MIN_EUR = 0.5
const MAX_EUR = 1_000_000

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
}

export async function createPaymentRequest(input: {
  projectId: string
  label: string
  amountEur: number
}): Promise<PaymentActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const label = input.label.trim()
  if (!label || label.length > 120) return { success: false, error: 'Libellé requis (120 caractères max).' }
  const amount = Number(input.amountEur)
  if (!Number.isFinite(amount) || amount < MIN_EUR || amount > MAX_EUR) {
    return { success: false, error: 'Montant invalide (entre 0,50 € et 1 000 000 €).' }
  }
  const amountCents = Math.round(amount * 100)

  const { data: project } = await supabase.from('projects').select('id').eq('id', input.projectId).maybeSingle()
  if (!project) return { success: false, error: 'Projet introuvable' }

  const { error } = await db(supabase).from('payment_requests').insert({
    project_id: input.projectId,
    label,
    amount_cents: amountCents,
    pay_token: newPayToken(),
    created_by: user.id,
  })
  if (error) return { success: false, error: error.message }

  await syncProjectPaymentStatus(auth.admin, input.projectId)
  revalidate(input.projectId)
  return { success: true }
}

/** Annule une demande ouverte (la session Stripe en cours est expirée). */
export async function cancelPaymentRequest(requestId: string): Promise<PaymentActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data } = await supabase
    .from('payment_requests')
    .select('id, project_id, status, stripe_session_id')
    .eq('id', requestId)
    .maybeSingle()
  const request = data as Pick<PaymentRequest, 'id' | 'project_id' | 'status' | 'stripe_session_id'> | null
  if (!request) return { success: false, error: 'Demande introuvable' }
  if (request.status !== 'open') return { success: false, error: 'Seule une demande en attente peut être annulée.' }

  // Ferme la page de paiement éventuellement ouverte chez le client.
  if (request.stripe_session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(request.stripe_session_id)
      if (session.status === 'open') await getStripe().checkout.sessions.expire(session.id)
    } catch {
      // Session déjà expirée ou introuvable : rien à fermer.
    }
  }

  const { error } = await db(supabase)
    .from('payment_requests')
    .update({ status: 'canceled' })
    .eq('id', requestId)
    .eq('status', 'open')
  if (error) return { success: false, error: error.message }

  await syncProjectPaymentStatus(auth.admin, request.project_id)
  revalidate(request.project_id)
  return { success: true }
}

/** Supprime une demande annulée (une demande réglée est conservée : trace comptable). */
export async function deletePaymentRequest(requestId: string): Promise<PaymentActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { data } = await supabase.from('payment_requests').select('id, project_id, status').eq('id', requestId).maybeSingle()
  const request = data as Pick<PaymentRequest, 'id' | 'project_id' | 'status'> | null
  if (!request) return { success: false, error: 'Demande introuvable' }
  if (request.status !== 'canceled') return { success: false, error: 'Annulez la demande avant de la supprimer.' }

  const { error } = await supabase.from('payment_requests').delete().eq('id', requestId)
  if (error) return { success: false, error: error.message }

  revalidate(request.project_id)
  return { success: true }
}
