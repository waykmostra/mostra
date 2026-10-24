import 'server-only'
import { randomBytes } from 'crypto'
import type Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'
import { createNotifications, getProjectRecipients } from '@/lib/notifications'
import { appUrl, getStripe } from '@/lib/stripe'
import type { PaymentRequest, Project } from '@/lib/types'

/**
 * Paiements Stripe Checkout (migration 038).
 *
 * Règles de sécurité :
 *   - le montant d'une session vient toujours de la base, jamais du navigateur ;
 *   - un paiement n'est validé que sur la parole de Stripe (webhook signé, ou
 *     session relue côté serveur avec la clé secrète), jamais sur l'URL seule ;
 *   - l'encaissement est idempotent : webhook et page de retour peuvent
 *     arriver tous les deux, la demande n'est marquée payée qu'une fois.
 */

type Admin = ReturnType<typeof createAdminClient>

/** Jeton du lien direct : 24 octets aléatoires (≈ 192 bits), non devinable. */
export function newPayToken(): string {
  return randomBytes(24).toString('base64url')
}

export function formatEur(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

export async function findRequestByToken(
  admin: Admin,
  payToken: string,
): Promise<(PaymentRequest & { project: Pick<Project, 'id' | 'name' | 'share_token' | 'client_id'> }) | null> {
  // Jeton malformé : inutile d'interroger la base.
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(payToken)) return null
  const { data } = await admin
    .from('payment_requests')
    .select('*, project:projects(id, name, share_token, client_id)')
    .eq('pay_token', payToken)
    .maybeSingle()
  return (data as (PaymentRequest & { project: Pick<Project, 'id' | 'name' | 'share_token' | 'client_id'> }) | null) ?? null
}

/**
 * Crée une session Checkout pour une demande ouverte et renvoie son URL.
 * `returnTo` : page de retour dans l'app (portail ou lien direct).
 */
export async function createCheckoutForRequest(
  payToken: string,
  returnTo: 'portal' | 'link',
): Promise<{ url: string } | { error: string }> {
  const admin = createAdminClient()
  const request = await findRequestByToken(admin, payToken)
  if (!request) return { error: 'Demande de paiement introuvable.' }
  if (request.status === 'paid') return { error: 'Cette demande est déjà réglée.' }
  if (request.status !== 'open') return { error: 'Cette demande n’est plus active.' }

  const base = appUrl()
  const back =
    returnTo === 'portal' && request.project.share_token
      ? `${base}/client/${request.project.share_token}/paiement`
      : `${base}/pay/${request.pay_token}`

  const session = await getStripe().checkout.sessions.create(
    {
      mode: 'payment',
      // Moyens de paiement : ceux activés dans le dashboard Stripe (carte, Apple Pay, SEPA…).
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: request.currency,
            unit_amount: request.amount_cents,
            product_data: { name: `${request.project.name} — ${request.label}` },
          },
        },
      ],
      client_reference_id: request.id,
      metadata: { payment_request_id: request.id, project_id: request.project_id },
      payment_intent_data: {
        metadata: { payment_request_id: request.id, project_id: request.project_id },
        description: `${request.project.name} — ${request.label}`,
      },
      success_url: `${back}?paiement=ok&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${back}?paiement=annule`,
      locale: 'fr',
      // Session courte : un lien de paiement abandonné ne reste pas ouvert.
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
    },
    // Évite deux sessions si le client double-clique.
    { idempotencyKey: `checkout-${request.id}-${Math.floor(Date.now() / 10_000)}` },
  )

  if (!session.url) return { error: 'Stripe n’a pas renvoyé de page de paiement.' }

  await db(admin).from('payment_requests').update({ stripe_session_id: session.id }).eq('id', request.id)
  return { url: session.url }
}

/**
 * Valide une session Checkout terminée : vérifie qu'elle est bien payée et
 * qu'elle correspond à la demande, puis encaisse. Sert au webhook et à la
 * page de retour (relecture de la session avec la clé secrète).
 */
export async function settleCheckoutSession(session: Stripe.Checkout.Session): Promise<'settled' | 'already' | 'ignored'> {
  const requestId = session.metadata?.payment_request_id
  if (!requestId || session.mode !== 'payment' || session.payment_status !== 'paid') return 'ignored'

  const admin = createAdminClient()
  const { data } = await admin
    .from('payment_requests')
    .select('*, project:projects(id, name, client_id, value_eur)')
    .eq('id', requestId)
    .maybeSingle()
  const request = data as (PaymentRequest & { project: Pick<Project, 'id' | 'name' | 'client_id' | 'value_eur'> }) | null
  if (!request) return 'ignored'

  // La session doit régler exactement cette demande, à ce montant.
  if (session.amount_total !== request.amount_cents || session.currency !== request.currency) {
    console.error('[payments] montant ou devise incohérents pour la demande', request.id)
    return 'ignored'
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
  const paidAt = new Date().toISOString()

  // Encaissement atomique : seule la première exécution passe de « open » à « paid ».
  const { data: updated } = await db(admin)
    .from('payment_requests')
    .update({ status: 'paid', paid_at: paidAt, stripe_session_id: session.id, stripe_payment_intent_id: paymentIntentId })
    .eq('id', request.id)
    .eq('status', 'open')
    .select('id')
  if (!updated || (updated as unknown[]).length === 0) return 'already'

  // Revenu dans Finance
  const { data: revenue } = await db(admin)
    .from('revenues')
    .insert({
      label: `${request.project.name} — ${request.label}`,
      amount_eur: request.amount_cents / 100,
      received_on: paidAt.slice(0, 10),
      category: 'service',
      client_id: request.project.client_id,
      notes: `Stripe ${paymentIntentId ?? session.id}`,
    })
    .select('id')
    .single()
  if (revenue) {
    await db(admin)
      .from('payment_requests')
      .update({ revenue_id: (revenue as { id: string }).id })
      .eq('id', request.id)
  }

  await syncProjectPaymentStatus(admin, request.project_id)

  await db(admin).from('activity_logs').insert({
    project_id: request.project_id,
    user_id: null,
    action: 'status_changed',
    details: { message: `Paiement reçu : ${request.label} (${formatEur(request.amount_cents)})` },
  })

  // Notification aux admins (in-app + push)
  const r = await getProjectRecipients(request.project_id)
  const recipients = [...new Set([...r.adminIds, ...(r.projectManagerId ? [r.projectManagerId] : [])])]
  await createNotifications(
    recipients.map((userId) => ({
      userId,
      projectId: request.project_id,
      type: 'payment_received' as const,
      title: `💶 Paiement reçu : ${formatEur(request.amount_cents)}`,
      message: `${request.project.name} — ${request.label}`,
      link: `/projects/${request.project_id}`,
    })),
  )

  return 'settled'
}

/**
 * Statut de paiement du projet d'après ses demandes. Si le projet a un montant
 * (value_eur), c'est la somme encaissée qui compte : un acompte seul laisse le
 * projet « partiellement réglé ». Sans montant, toutes les demandes réglées →
 * payé. Aucune encaissée → facturé.
 */
export async function syncProjectPaymentStatus(admin: Admin, projectId: string): Promise<void> {
  const [{ data }, { data: rawProject }] = await Promise.all([
    admin.from('payment_requests').select('status, paid_at, amount_cents').eq('project_id', projectId),
    admin.from('projects').select('value_eur').eq('id', projectId).maybeSingle(),
  ])
  const rows = ((data as Pick<PaymentRequest, 'status' | 'paid_at' | 'amount_cents'>[] | null) ?? []).filter(
    (r) => r.status !== 'canceled',
  )
  if (rows.length === 0) return

  const paid = rows.filter((r) => r.status === 'paid')
  const paidCents = paid.reduce((s, r) => s + r.amount_cents, 0)
  const valueCents = Math.round(((rawProject as { value_eur: number | null } | null)?.value_eur ?? 0) * 100)
  const fullyPaid = valueCents > 0 ? paidCents >= valueCents : paid.length === rows.length

  let update: Record<string, unknown>
  if (fullyPaid) {
    const lastPaid = paid.map((r) => r.paid_at ?? '').sort().pop() || new Date().toISOString()
    update = { payment_status: 'paid', paid_at: lastPaid }
  } else if (paid.length > 0) {
    update = { payment_status: 'partial' }
  } else {
    update = { payment_status: 'invoiced' }
  }
  await db(admin).from('projects').update(update).eq('id', projectId)
}

/**
 * Page de retour Stripe : relit la session côté serveur (clé secrète) et
 * encaisse si elle est payée. Ne fait jamais confiance à l'URL seule : la
 * session doit appartenir à la demande (lien direct) ou au projet (portail).
 */
export async function confirmFromReturn(
  sessionId: string | undefined,
  expected: { payToken: string } | { projectId: string },
): Promise<void> {
  if (!sessionId || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if ('payToken' in expected) {
      const request = await findRequestByToken(createAdminClient(), expected.payToken)
      if (!request || session.metadata?.payment_request_id !== request.id) return
    } else if (session.metadata?.project_id !== expected.projectId) {
      return
    }
    await settleCheckoutSession(session)
  } catch (err) {
    console.error('[payments] confirmation au retour impossible', err instanceof Error ? err.message : err)
  }
}
