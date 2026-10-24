'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { startCheckout } from '@/app/pay/actions'

/** Bouton « Payer » : crée la session côté serveur puis ouvre la page Stripe. */
export default function PayButton({
  payToken,
  returnTo,
  label = 'Payer',
  className = 'btn-brand',
}: {
  payToken: string
  returnTo: 'portal' | 'link'
  label?: string
  className?: string
}) {
  const [loading, setLoading] = useState(false)

  async function pay() {
    setLoading(true)
    const res = await startCheckout(payToken, returnTo).catch(() => null)
    if (res && 'url' in res) {
      window.location.assign(res.url)
      return // la page part chez Stripe, on garde le spinner
    }
    setLoading(false)
    toast.error(res && 'error' in res ? res.error : 'Paiement indisponible pour le moment.')
  }

  return (
    <button type="button" onClick={pay} disabled={loading} className={className}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
      {label}
    </button>
  )
}
