'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  createSubscription,
  updateSubscription,
  deleteSubscription,
} from '@/app/finance/actions'
import type { BillingCycle, FinanceCategory, Subscription } from '@/lib/types'
import { BILLING_META, CATEGORY_META, CATEGORY_OPTIONS, eur, monthlyBurn } from './financeMeta'

const inputCls =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#555555] [color-scheme:dark]'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ── Formulaire (création + édition) ───────────────────────────────

function SubscriptionForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Subscription
  onCancel: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount_eur) : '')
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initial?.billing_cycle ?? 'monthly')
  const [category, setCategory] = useState<FinanceCategory>(initial?.category ?? 'software')
  const [startedOn, setStartedOn] = useState(initial?.started_on ?? todayISO())
  const [active, setActive] = useState(initial?.active ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [isPending, startTransition] = useTransition()

  function submit() {
    const trimmed = label.trim()
    if (!trimmed) return toast.error('Le libellé est requis.')
    const amt = Number(amount)
    if (amount.trim() === '' || Number.isNaN(amt) || amt < 0) {
      return toast.error('Montant invalide.')
    }
    startTransition(async () => {
      const payload = {
        label: trimmed,
        amount_eur: amt,
        billing_cycle: billingCycle,
        category,
        started_on: startedOn || undefined,
        active,
        notes: notes.trim() || null,
      }
      const res = initial
        ? await updateSubscription(initial.id, payload)
        : await createSubscription(payload)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? 'Abonnement mis à jour.' : 'Abonnement ajouté.')
      onSaved()
    })
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2.5">
        <input
          className={inputCls}
          placeholder="Libellé (ex. Figma)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          autoFocus
        />
        <input
          className={inputCls}
          type="number"
          min="0"
          step="0.01"
          placeholder="0 €"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <select
          className={inputCls}
          value={billingCycle}
          onChange={(e) => setBillingCycle(e.target.value as BillingCycle)}
        >
          <option value="monthly" className="bg-[#1a1a1a]">Mensuel</option>
          <option value="yearly" className="bg-[#1a1a1a]">Annuel</option>
        </select>
        <select
          className={inputCls}
          value={category}
          onChange={(e) => setCategory(e.target.value as FinanceCategory)}
        >
          {CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#1a1a1a]">
              {o.label}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          type="date"
          value={startedOn}
          onChange={(e) => setStartedOn(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[#aaaaaa] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="accent-[#00D76B] h-3.5 w-3.5"
          />
          Actif
        </label>
        <input
          className={`${inputCls} flex-1`}
          placeholder="Notes (optionnel)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white hover:bg-[#1a1a1a] transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

// ── Panneau ───────────────────────────────────────────────────────

export default function SubscriptionsPanel({ subscriptions }: { subscriptions: Subscription[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Charge mensuelle des abonnements actifs uniquement.
  const monthlyTotal = subscriptions
    .filter((s) => s.active)
    .reduce((acc, s) => acc + monthlyBurn(s.amount_eur, s.billing_cycle), 0)

  function done() {
    setAdding(false)
    setEditingId(null)
    router.refresh()
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteSubscription(id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Abonnement supprimé.')
      setConfirmId(null)
      router.refresh()
    })
  }

  function toggleActive(s: Subscription) {
    setBusyId(s.id)
    startTransition(async () => {
      const res = await updateSubscription(s.id, { active: !s.active })
      setBusyId(null)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#1e1e1e] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Abonnements</h2>
          <p className="text-[11px] text-[#666666] mt-0.5 tabular-nums">
            {eur(monthlyTotal)} / mois (actifs)
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => {
              setEditingId(null)
              setAdding(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222] transition-colors flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {adding && <SubscriptionForm onCancel={() => setAdding(false)} onSaved={done} />}

        {subscriptions.length === 0 && !adding ? (
          <p className="text-xs text-[#555555] italic px-2 py-6 text-center">
            Aucun abonnement enregistré.
          </p>
        ) : (
          subscriptions.map((s) => {
            if (editingId === s.id) {
              return (
                <SubscriptionForm
                  key={s.id}
                  initial={s}
                  onCancel={() => setEditingId(null)}
                  onSaved={done}
                />
              )
            }
            const cat = CATEGORY_META[s.category] ?? CATEGORY_META.other
            const billing = BILLING_META[s.billing_cycle]
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#161616] transition-colors group ${
                  s.active ? '' : 'opacity-55'
                }`}
              >
                {/* Toggle actif */}
                <button
                  onClick={() => toggleActive(s)}
                  disabled={isPending && busyId === s.id}
                  aria-label={s.active ? 'Désactiver' : 'Activer'}
                  title={s.active ? 'Actif — cliquer pour suspendre' : 'Suspendu — cliquer pour activer'}
                  className="flex-shrink-0"
                >
                  {isPending && busyId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#666666]" />
                  ) : (
                    <span
                      className="block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.active ? '#22C55E' : '#444444' }}
                    />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{s.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ color: cat.color, backgroundColor: `${cat.color}1a` }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-[#555555]">{billing.label}</span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-white tabular-nums font-medium">{eur(s.amount_eur)}</p>
                  <p className="text-[10px] text-[#555555]">{billing.short}</p>
                </div>

                {confirmId === s.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => remove(s.id)}
                      disabled={isPending}
                      aria-label="Confirmer la suppression"
                      className="p-1.5 rounded text-[#EF4444] hover:bg-[#EF4444]/10"
                    >
                      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={isPending}
                      aria-label="Annuler"
                      className="p-1.5 rounded text-[#666666] hover:bg-[#222222]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setAdding(false)
                        setEditingId(s.id)
                      }}
                      aria-label="Modifier"
                      className="p-1.5 rounded text-[#666666] hover:text-white hover:bg-[#222222]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmId(s.id)}
                      aria-label="Supprimer"
                      className="p-1.5 rounded text-[#666666] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
