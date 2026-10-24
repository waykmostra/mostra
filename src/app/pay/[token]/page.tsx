import { notFound } from 'next/navigation'
import { CheckCircle2, Lock, XCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { confirmFromReturn, findRequestByToken, formatEur } from '@/lib/payments'
import Logo from '@/components/shared/Logo'
import PayButton from '@/components/payments/PayButton'

export const dynamic = 'force-dynamic'

/**
 * Lien direct de paiement d'une demande (/pay/<jeton>), à envoyer au client
 * par WhatsApp ou mail. Le jeton est l'accès : aucune connexion requise, et la
 * page ne montre que cette demande (projet, libellé, montant).
 */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: { token: string }
  searchParams: { paiement?: string; session_id?: string }
}) {
  // Retour de Stripe : confirmation côté serveur avant d'afficher l'état.
  if (searchParams.paiement === 'ok') {
    await confirmFromReturn(searchParams.session_id, { payToken: params.token })
  }

  const request = await findRequestByToken(createAdminClient(), params.token)
  if (!request) notFound()

  const paid = request.status === 'paid'
  const canceled = request.status === 'canceled'

  return (
    <main className="w-full max-w-[440px]">
      <div className="mb-6 flex justify-center">
        <Logo variant="full" color="theme" className="h-[22px]" />
      </div>

      <div className="surface overflow-hidden">
        <div className="px-6 py-6">
          <p className="mono-label text-faint">{request.project.name}</p>
          <h1 className="mt-2 text-[1.375rem] leading-tight text-ink">{request.label}</h1>
          <p className="font-display tnum mt-4 text-[2.25rem] leading-none text-ink">
            {formatEur(request.amount_cents)}
          </p>
        </div>

        <div className="border-t border-line bg-surface-2/60 px-6 py-5">
          {paid ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-brand-text" />
              <p className="text-[14px] text-ink">
                Paiement reçu{request.paid_at && ` le ${new Date(request.paid_at).toLocaleDateString('fr-FR')}`}. Merci !
              </p>
            </div>
          ) : canceled ? (
            <div className="flex items-center gap-3">
              <XCircle className="h-5 w-5 flex-shrink-0 text-faint" />
              <p className="text-[14px] text-dim">Cette demande de paiement n’est plus active.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchParams.paiement === 'annule' && (
                <p className="text-[13px] text-dim">Paiement annulé : rien n’a été débité.</p>
              )}
              {searchParams.paiement === 'ok' && (
                <p className="text-[13px] text-dim">
                  Paiement en cours de confirmation par votre banque. Cette page se mettra à jour.
                </p>
              )}
              <PayButton
                payToken={request.pay_token}
                returnTo="link"
                label={`Payer ${formatEur(request.amount_cents)}`}
                className="btn-brand w-full"
              />
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] text-faint">
        <Lock className="h-3 w-3" /> Paiement sécurisé par Stripe. Mostra ne voit jamais vos données bancaires.
      </p>
    </main>
  )
}
