import { Activity, TrendingUp, FileText, CalendarClock, type LucideIcon } from 'lucide-react'

interface DashboardKpisProps {
  activeCount: number
  caMonth: number
  toInvoice: number
  deadlineSoonCount: number
}

function eur(n: number) {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

export default function DashboardKpis({
  activeCount,
  caMonth,
  toInvoice,
  deadlineSoonCount,
}: DashboardKpisProps) {
  const cards: { label: string; value: string; icon: LucideIcon; color: string }[] = [
    { label: 'Projets actifs', value: String(activeCount), icon: Activity, color: '#3B82F6' },
    { label: 'Encaissé ce mois', value: eur(caMonth), icon: TrendingUp, color: '#00D76B' },
    { label: 'À facturer', value: eur(toInvoice), icon: FileText, color: '#F59E0B' },
    {
      label: 'Deadlines < 7j',
      value: String(deadlineSoonCount),
      icon: CalendarClock,
      color: deadlineSoonCount > 0 ? '#EF4444' : '#6B7280',
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
            <div
              className="rounded-lg p-2.5 flex-shrink-0"
              style={{ backgroundColor: `${c.color}1a` }}
            >
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
