'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { createExpense, updateExpense, deleteExpense } from '@/app/finance/actions'
import type { ExpenseWithProject, FinanceCategory } from '@/lib/types'
import { CATEGORY_META, CATEGORY_OPTIONS, eur } from './financeMeta'

interface ProjectOption {
  id: string
  name: string
}

const inputCls =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-lg px-3 py-2 text-sm text-white placeholder-[#555555] focus:outline-none focus:border-[#555555] [color-scheme:dark]'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

// ── Formulaire (création + édition) ───────────────────────────────

function ExpenseForm({
  initial,
  projects,
  onCancel,
  onSaved,
}: {
  initial?: ExpenseWithProject
  projects: ProjectOption[]
  onCancel: () => void
  onSaved: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [amount, setAmount] = useState(initial ? String(initial.amount_eur) : '')
  const [category, setCategory] = useState<FinanceCategory>(initial?.category ?? 'other')
  const [incurredOn, setIncurredOn] = useState(initial?.incurred_on ?? todayISO())
  const [projectId, setProjectId] = useState(initial?.project_id ?? '')
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
        incurred_on: incurredOn || undefined,
        project_id: projectId || null,
        notes: notes.trim() || null,
      }
      const res = initial
        ? await updateExpense(initial.id, payload)
        : await createExpense(payload)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(initial ? 'Dépense mise à jour.' : 'Dépense ajoutée.')
      onSaved()
    })
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#262626] rounded-lg p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2.5">
        <input
          className={inputCls}
          placeholder="Libellé (ex. Licence Adobe)"
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
          value={incurredOn}
          onChange={(e) => setIncurredOn(e.target.value)}
        />
        <select
          className={inputCls}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="" className="bg-[#1a1a1a]">
            Aucun projet
          </option>
          {projects.map((p) => (
            <option key={p.id} value={p.id} className="bg-[#1a1a1a]">
              {p.name}
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

export default function ExpensesPanel({
  expenses,
  projects,
}: {
  expenses: ExpenseWithProject[]
  projects: ProjectOption[]
}) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const total = expenses.reduce((s, e) => s + e.amount_eur, 0)

  function done() {
    setAdding(false)
    setEditingId(null)
    router.refresh()
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteExpense(id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Dépense supprimée.')
      setConfirmId(null)
      router.refresh()
    })
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#1e1e1e] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Dépenses</h2>
          <p className="text-[11px] text-[#666666] mt-0.5 tabular-nums">{eur(total)} au total</p>
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
        {adding && (
          <ExpenseForm projects={projects} onCancel={() => setAdding(false)} onSaved={done} />
        )}

        {expenses.length === 0 && !adding ? (
          <p className="text-xs text-[#555555] italic px-2 py-6 text-center">
            Aucune dépense enregistrée.
          </p>
        ) : (
          expenses.map((e) => {
            if (editingId === e.id) {
              return (
                <ExpenseForm
                  key={e.id}
                  initial={e}
                  projects={projects}
                  onCancel={() => setEditingId(null)}
                  onSaved={done}
                />
              )
            }
            const cat = CATEGORY_META[e.category] ?? CATEGORY_META.other
            return (
              <div
                key={e.id}
                className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#161616] transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{e.label}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                      style={{ color: cat.color, backgroundColor: `${cat.color}1a` }}
                    >
                      {cat.label}
                    </span>
                    <span className="text-[11px] text-[#555555]">{formatDate(e.incurred_on)}</span>
                    {e.project_name && e.project_id && (
                      <Link
                        href={`/projects/${e.project_id}`}
                        className="text-[11px] text-[#00D76B] hover:underline truncate max-w-[140px]"
                      >
                        {e.project_name}
                      </Link>
                    )}
                  </div>
                </div>
                <span className="text-sm text-white tabular-nums font-medium flex-shrink-0">
                  {eur(e.amount_eur)}
                </span>
                {confirmId === e.id ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => remove(e.id)}
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
                        setEditingId(e.id)
                      }}
                      aria-label="Modifier"
                      className="p-1.5 rounded text-[#666666] hover:text-white hover:bg-[#222222]"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setConfirmId(e.id)}
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
