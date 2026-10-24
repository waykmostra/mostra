import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { settleCheckoutSession } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'

// Corps brut obligatoire pour vérifier la signature ; jamais mis en cache.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Webhook Stripe — seule source de vérité fiable d'un paiement (le client peut
 * fermer l'onglet avant la page de retour). Sans signature valide, rien n'est lu.
 *
 * Événements à cocher dans le dashboard Stripe :
 *   checkout.session.completed
 *   checkout.session.async_payment_succeeded   (SEPA, virements : réglés plus tard)
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const signature = request.headers.get('stripe-signature')
  if (!secret || !signature) return new NextResponse('Signature manquante', { status: 400 })

  const payload = await request.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch {
    // Signature invalide : on ne révèle rien sur la raison.
    return new NextResponse('Signature invalide', { status: 400 })
  }

  if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
    return NextResponse.json({ received: true })
  }

  // Idempotence : un événement déjà enregistré n'est pas retraité.
  const admin = createAdminClient()
  const { error: dupError } = await db(admin).from('stripe_events').insert({ id: event.id, type: event.type })
  if (dupError) {
    // 23505 = déjà reçu → on acquitte. Autre erreur → Stripe réessaiera.
    return dupError.code === '23505'
      ? NextResponse.json({ received: true, duplicate: true })
      : new NextResponse('Erreur base', { status: 500 })
  }

  try {
    await settleCheckoutSession(event.data.object as Stripe.Checkout.Session)
  } catch (err) {
    // On libère l'événement pour que la nouvelle tentative de Stripe soit traitée.
    await admin.from('stripe_events').delete().eq('id', event.id)
    console.error('[stripe webhook]', err instanceof Error ? err.message : err)
    return new NextResponse('Erreur de traitement', { status: 500 })
  }

  return NextResponse.json({ received: true })
}
