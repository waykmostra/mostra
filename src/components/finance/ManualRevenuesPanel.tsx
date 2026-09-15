'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { createRevenue, updateRevenue, deleteRevenue } from '@/app/finance/actions'
import type { RevenueCategory, RevenueWithClient } from '@/lib/types'
import { REVENUE_CATEGORY_META, REVENUE_CATEGORY_OPTIONS, eur } from './financeMeta'

interface ClientOption {
  id: string
  name: string
}

const inputCls =
  'w-full bg-surface-2 border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-[rgb(var(--c-text-faint))] [color-scheme:dark]'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ── Formulaire (création + édition) ───────────────────────────────

function RevenueForm({
  initial,
  clients,
  onCancel,
  onSaved,
}: {
  initial?: RevenueWithClient
  clients: ClientOption[]
  onCancel: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount_eur) : '')
  const [category, setCategory] = useState<RevenueCategory>(initial?.category ?? 'service')
  const [receivedOn, setReceivedOn] = useState(initial?.received_on ?? todayISO())
  const [clientId, setClientId] = useState(initial?.client_id ?? '')
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
        category,
        received_on: receivedOn || undefined,
        client_id: clientId || null,
        notes: notes.trim() || null,
      }
      const res = initial
        ? await updateRevenue(initial.id, payload)
        : await createRevenue(payload)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? 'Revenu mis à jour.' : 'Revenu ajouté.')
      onSaved()
    })
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2.5">
        <input
          className={inputCls}
          placeholder="Libellé (ex. Formation montage)"
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
          value={category}
          onChange={(e) => setCategory(e.target.value as RevenueCategory)}
        >
          {REVENUE_CATEGORY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface-2">
              {o.label}
            </option>
          ))}
        </select>
        <input
          className={inputCls}
          type="date"
          value={receivedOn}
          onChange={(e) => setReceivedOn(e.target.value)}
        />
        <select
          className={inputCls}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="" className="bg-surface-2">
            Aucun client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id} className="bg-surface-2">
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <input
        className={inputCls}
        placeholder="Notes (optionnel)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex items-center justify-end gap-2 pt-0.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="px-3 py-1.5 rounded-lg text-xs text-dim hover:text-ink hover:bg-surface-2 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {initial ? 'Enregistrer' : 'Ajouter'}
        </button>
      </div>
    </div>
  )
}

// ── Panneau ───────────────────────────────────────────────────────

export default function ManualRevenuesPanel({
  revenues,
  clients,
}: {
  revenues: RevenueWithClient[]
  clients: ClientOption[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = revenues.reduce((s, r) => s + r.amount_eur, 0)

  function done() {
    setAdding(false)
    setEditingId(null)
    router.refresh()
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteRevenue(id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Revenu supprimé.')
      setConfirmId(null)
      router.refresh()
    })
  }

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 sm:px-5 py-3.5 border-b border-line flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink">Revenus libres</h2>
          <p className="text-[11px] text-faint mt-0.5 tabular-nums">
            {eur(total)} encaissés · hors projets
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => {
              setEditingId(null)
              setAdding(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-2 border border-line text-ink hover:bg-surface-3 transition-colors flex-shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        )}
      </div>

      <div className="p-3 space-y-2">
        {adding && (
          <RevenueForm clients={clients} onCancel={() => setAdding(false)} onSaved={done} />
        )}

        {revenues.length === 0 && !adding ? (
          <p className="text-xs text-faint italic px-2 py-6 text-center">
            Aucun revenu libre. Ajoute un revenu hors-projet (prestation, formation…).
          </p>
        ) : (
          revenues.map((r) => {
            if (editingId === r.id) {
              return (
                <RevenueForm
                  key={r.id}
                  initial={r}
                  clients={clients}
                  onCancel={() => setEditingId(null)}
                  onSaved={done}
                />
              )
            }
            const cat = REVENUE_CATEGORY_META[r.category] ?? REVENUE_CATEGORY_META.other
            return (
              <div
                key={r.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{r.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ color: cat.color, backgroundColor: `${cat.color}1a` }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-faint">{formatDate(r.received_on)}</span>
                    {r.client_name && (
                      <span className="text-[11px] text-dim truncate max-w-[140px]">
                        {r.client_name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-sm text-[#22C55E] tabular-nums font-medium flex-shrink-0">
                  {eur(r.amount_eur)}
                </span>
                {confirmId === r.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => remove(r.id)}
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
                      className="p-1.5 rounded text-faint hover:bg-surface-3"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setAdding(false)
                        setEditingId(r.id)
                      }}
                      aria-label="Modifier"
                      className="p-1.5 rounded text-faint hover:text-ink hover:bg-surface-3"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmId(r.id)}
                      aria-label="Supprimer"
                      className="p-1.5 rounded text-faint hover:text-[#EF4444] hover:bg-[#EF4444]/10"
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
