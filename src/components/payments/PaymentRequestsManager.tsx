'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Link2, Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cancelPaymentRequest, createPaymentRequest, deletePaymentRequest } from '@/app/projects/payment-actions'
import PaymentStatusPill from './PaymentStatusPill'
import type { PaymentRequest } from '@/lib/types'

type Row = Pick<PaymentRequest, 'id' | 'label' | 'amount_cents' | 'status' | 'pay_token' | 'paid_at' | 'created_at'>

function eur(cents: number) {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
}

/**
 * Demandes de paiement du projet (Stripe Checkout) : créer « Acompte 50 % »,
 * « Solde »…, copier le lien direct à envoyer au client, annuler.
 */
export default function PaymentRequestsManager({ projectId, requests }: { projectId: string; requests: Row[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')

  const paid = requests.filter((r) => r.status === 'paid').reduce((s, r) => s + r.amount_cents, 0)
  const due = requests.filter((r) => r.status === 'open').reduce((s, r) => s + r.amount_cents, 0)

  function run(action: () => Promise<{ success: boolean; error?: string }>, ok?: string) {
    startTransition(async () => {
      const res = await action().catch(() => ({ success: false, error: 'Le serveur n’a pas répondu' }))
      if (!res?.success) {
        toast.error(res?.error ?? 'Erreur')
        return
      }
      if (ok) toast.success(ok)
      router.refresh()
    })
  }

  function create() {
    const value = Number(amount.replace(/\s/g, '').replace(',', '.'))
    run(async () => {
      const res = await createPaymentRequest({ projectId, label, amountEur: value })
      if (res.success) {
        setLabel('')
        setAmount('')
        setAdding(false)
      }
      return res
    }, 'Demande de paiement créée ✓')
  }

  async function copyLink(token: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/pay/${token}`)
      toast.success('Lien de paiement copié')
    } catch {
      toast.error('Impossible de copier')
    }
  }

  return (
    <div className="surface space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[13.5px] font-medium text-ink">Paiements en ligne</p>
          <p className="mt-0.5 text-[12.5px] text-faint">
            {requests.length === 0
              ? 'Aucune demande. Le client paie par carte via Stripe.'
              : `Réglé ${eur(paid)}${due > 0 ? ` · reste ${eur(due)}` : ''}`}
          </p>
        </div>
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost min-h-[32px] text-[12.5px]">
            <Plus className="h-3.5 w-3.5" /> Demande
          </button>
        )}
      </div>

      {adding && (
        <div className="space-y-2 rounded-lg bg-surface-2 p-3">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Libellé (ex. Acompte 50 %)"
            maxLength={120}
            className="field h-9 text-[13px]"
          />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && create()}
                inputMode="decimal"
                placeholder="Montant"
                className="field h-9 pr-8 text-[13px]"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-faint">€</span>
            </div>
            <button
              type="button"
              onClick={create}
              disabled={isPending || !label.trim() || !amount.trim()}
              className="btn-primary min-h-[36px] px-3 text-[12.5px]"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Créer
            </button>
            <button type="button" onClick={() => setAdding(false)} aria-label="Annuler" className="btn-ghost min-h-[36px] px-2">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-[11.5px] text-faint">Montant TTC encaissé par Stripe, tel que saisi.</p>
        </div>
      )}

      {requests.length > 0 && (
        <ul className="divide-y divide-line">
          {requests.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2.5">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13.5px] ${r.status === 'canceled' ? 'text-faint line-through' : 'text-ink'}`}>
                  {r.label}
                </p>
                <p className="tnum text-[12.5px] text-faint">
                  {eur(r.amount_cents)}
                  {r.paid_at && ` · réglé le ${new Date(r.paid_at).toLocaleDateString('fr-FR')}`}
                </p>
              </div>
              <PaymentStatusPill status={r.status} />
              {r.status === 'open' && (
                <>
                  <button
                    type="button"
                    onClick={() => copyLink(r.pay_token)}
                    title="Copier le lien de paiement à envoyer au client"
                    className="btn-ghost min-h-[30px] px-2 text-[12px]"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Lien
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => run(() => cancelPaymentRequest(r.id), 'Demande annulée')}
                    title="Annuler la demande"
                    className="btn-ghost min-h-[30px] px-2 text-[12px]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {r.status === 'canceled' && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => run(() => deletePaymentRequest(r.id))}
                  title="Supprimer"
                  className="btn-ghost min-h-[30px] px-2 text-[12px] hover:!text-late"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
