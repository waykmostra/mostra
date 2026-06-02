import { TrendingUp, TrendingDown, Repeat, Wallet, type LucideIcon } from 'lucide-react'
import { eur } from './financeMeta'

interface FinanceKpisProps {
  /** Revenus encaissés sur le mois courant. */
  revenue: number
  /** Dépenses ponctuelles sur le mois courant. */
  expenses: number
  /** Charge d'abonnements mensualisée. */
  subscriptions: number
  /** Net = revenue − expenses − subscriptions. */
  net: number
}

export default function FinanceKpis({ revenue, expenses, subscriptions, net }: FinanceKpisProps) {
  const cards: { label: string; value: string; icon: LucideIcon; color: string }[] = [
    { label: 'Encaissé ce mois', value: eur(revenue), icon: TrendingUp, color: '#00D76B' },
    { label: 'Dépenses ce mois', value: eur(expenses), icon: TrendingDown, color: '#EF4444' },
    { label: 'Abonnements / mois', value: eur(subscriptions), icon: Repeat, color: '#A78BFA' },
    {
      label: 'Net ce mois',
      value: eur(net),
      icon: Wallet,
      color: net >= 0 ? '#00D76B' : '#EF4444',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <div
            key={c.label}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{ backgroundColor: `${c.color}1a` }}>
              <Icon className="h-5 w-5" style={{ color: c.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-semibold text-white tabular-nums truncate">{c.value}</p>
              <p className="text-xs text-[#666666] mt-0.5">{c.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
