import { ArrowDownLeft, ArrowUpRight, History } from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import type { ExpenseWithProject, RevenueEntry, RevenueWithClient } from '@/lib/types'
import { CATEGORY_META, REVENUE_CATEGORY_META, eur } from './financeMeta'

interface Movement {
  key: string
  label: string
  sub: string | null
  date: string
  amount: number
  direction: 'in' | 'out'
}

/**
 * Historique des 5 derniers mouvements d'argent (entrées + sorties), fusionnés
 * et triés par date. Entrées = revenus projets encaissés + revenus libres.
 * Sorties = dépenses. (Les abonnements récurrents ne sont pas des mouvements datés.)
 */
export default function RecentMovements({
  expenses,
  revenues,
  manualRevenues,
}: {
  expenses: ExpenseWithProject[]
  revenues: RevenueEntry[]
  manualRevenues: RevenueWithClient[]
}) {
  const movements: Movement[] = []

  // Entrées — revenus projets encaissés
  for (const r of revenues) {
    if (r.payment_status !== 'paid' || !r.paid_at) continue
    movements.push({
      key: `proj-${r.id}`,
      label: r.name,
      sub: r.client_name ?? 'Projet',
      date: r.paid_at,
      amount: r.value_eur,
      direction: 'in',
    })
  }

  // Entrées — revenus libres
  for (const r of manualRevenues) {
    movements.push({
      key: `rev-${r.id}`,
      label: r.label,
      sub: r.client_name ?? REVENUE_CATEGORY_META[r.category]?.label ?? null,
      date: r.received_on,
      amount: r.amount_eur,
      direction: 'in',
    })
  }

  // Sorties — dépenses
  for (const e of expenses) {
    movements.push({
      key: `exp-${e.id}`,
      label: e.label,
      sub: e.project_name ?? CATEGORY_META[e.category]?.label ?? null,
      date: e.incurred_on,
      amount: e.amount_eur,
      direction: 'out',
    })
  }

  const last5 = movements
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div className="bg-surface border border-line rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-line flex items-center gap-2">
        <History className="h-4 w-4 text-faint" />
        <h2 className="text-sm font-semibold text-ink">Derniers mouvements</h2>
        <span className="text-[11px] text-faint ml-1">entrées &amp; sorties</span>
      </div>

      {last5.length === 0 ? (
        <p className="text-xs text-faint italic px-5 py-8 text-center">
          Aucun mouvement pour le moment.
        </p>
      ) : (
        <div className="divide-y divide-line">
          {last5.map((m) => {
            const isIn = m.direction === 'in'
            const color = isIn ? '#22C55E' : '#EF4444'
            const Icon = isIn ? ArrowDownLeft : ArrowUpRight
            return (
              <div key={m.key} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                <span
                  className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0"
                  style={{ backgroundColor: `${color}18`, color }}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink truncate">{m.label}</p>
                  <p className="text-[11px] text-faint truncate">
                    {m.sub ? `${m.sub} · ` : ''}
                    {formatDate(m.date)}
                  </p>
                </div>
                <span
                  className="text-sm font-semibold tabular-nums flex-shrink-0"
                  style={{ color }}
                >
                  {isIn ? '+' : '−'}
                  {eur(m.amount)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
