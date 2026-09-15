import { FolderOpen, Activity, CheckCircle } from 'lucide-react'

interface StatsCardsProps {
  total: number
  active: number
  completed: number
}

const CARDS = (stats: StatsCardsProps) => [
  {
    label: 'Total Projects',
    value: stats.total,
    icon: FolderOpen,
    iconColor: 'text-brand',
    iconBg: 'bg-brand/10',
  },
  {
    label: 'Active Projects',
    value: stats.active,
    icon: Activity,
    iconColor: 'text-[#3B82F6]',
    iconBg: 'bg-[#3B82F6]/10',
  },
  {
    label: 'Completed',
    value: stats.completed,
    icon: CheckCircle,
    iconColor: 'text-[#22C55E]',
    iconBg: 'bg-[#22C55E]/10',
  },
]

export default function StatsCards(props: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      {CARDS(props).map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="bg-surface-2 border border-line rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <div className={`${card.iconBg} rounded-lg p-2.5 flex-shrink-0`}>
              <Icon className={`h-5 w-5 ${card.iconColor}`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-ink tabular-nums">{card.value}</p>
              <p className="text-xs text-faint mt-0.5">{card.label}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
