import Link from 'next/link'
import { ArrowRight, CreditCard } from 'lucide-react'
import PayButton from './PayButton'

export interface OpenPayment {
  label: string
  amount_cents: number
  pay_token: string
}

function eur(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/**
 * Rappel de paiement sur la vue d'ensemble client : visible tant qu'une
 * demande est à régler. Une seule demande → on paie directement d'ici ;
 * plusieurs → le total et un accès à la page Paiement.
 */
export default function PaymentReminder({ token, payments }: { token: string; payments: OpenPayment[] }) {
  if (payments.length === 0) return null
  const single = payments.length === 1 ? payments[0] : null
  const total = payments.reduce((s, p) => s + p.amount_cents, 0)

  return (
    <div className="space-y-3 rounded-xl border border-soon/30 bg-soon/10 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-soon/15 text-soon">
          <CreditCard className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="mono-label text-soon">Paiement à régler</p>
          <p className="mt-1 truncate text-[14px] font-medium text-ink">
            {single ? single.label : `${payments.length} demandes en attente`}
          </p>
          <p className="font-display tnum mt-1 text-[1.5rem] leading-none text-ink">{eur(total)}</p>
        </div>
      </div>

      {single ? (
        <PayButton payToken={single.pay_token} returnTo="portal" label="Payer" className="btn-brand w-full" />
      ) : (
        <Link href={`/client/${token}/paiement`} className="btn-brand w-full">
          Voir et payer <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  )
}
