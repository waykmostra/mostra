import Link from 'next/link'
import {
  CalendarClock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'

export interface DeadlineAlert {
  id: string
  name: string
  clientName: string | null
  deadline: string
  days: number
}

export interface InvoiceAlert {
  id: string
  name: string
  clientName: string | null
  value: number
}

interface AlertsPanelProps {
  deadlineAlerts: DeadlineAlert[]
  toInvoiceList: InvoiceAlert[]
  overdueList: InvoiceAlert[]
}

const MAX_ROWS = 6

function deadlineBadge(days: number): { text: string; color: string } {
  if (days < 0) return { text: `Retard ${Math.abs(days)}j`, color: '#EF4444' }
  if (days === 0) return { text: "Aujourd'hui", color: '#EF4444' }
  if (days <= 2) return { text: `J-${days}`, color: '#EF4444' }
  return { text: `J-${days}`, color: '#F59E0B' }
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`

function Row({
  href,
  title,
  subtitle,
  right,
  rightColor,
}: {
  href: string
  title: string
  subtitle: string | null
  right: string
  rightColor: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#1a1a1a] transition-colors group"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm text-white truncate">{title}</p>
        {subtitle && <p className="text-[11px] text-[#666666] truncate">{subtitle}</p>}
      </div>
      <span
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0"
        style={{ color: rightColor, backgroundColor: `${rightColor}1a`, borderColor: `${rightColor}33` }}
      >
        {right}
      </span>
      <ChevronRight className="h-3.5 w-3.5 text-[#444444] group-hover:text-[#888888] flex-shrink-0" />
    </Link>
  )
}

function Section({
  icon,
  title,
  count,
  children,
  empty,
}: {
  icon: React.ReactNode
  title: string
  count: number
  children: React.ReactNode
  empty: string
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2 px-3">
        {icon}
        <h3 className="text-xs font-semibold text-white uppercase tracking-wider">{title}</h3>
        {count > 0 && (
          <span className="text-[10px] text-[#666666] tabular-nums">{count}</span>
        )}
      </div>
      {count === 0 ? (
        <p className="text-xs text-[#555555] italic px-3 py-2">{empty}</p>
      ) : (
        <div className="space-y-0.5">{children}</div>
      )}
    </div>
  )
}

export default function AlertsPanel({
  deadlineAlerts,
  toInvoiceList,
  overdueList,
}: AlertsPanelProps) {
  const totalAlerts = deadlineAlerts.length + toInvoiceList.length + overdueList.length

  if (totalAlerts === 0) {
    return (
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center gap-2.5 text-[#22C55E]">
          <CheckCircle2 className="h-5 w-5" />
          <p className="text-sm font-medium text-white">Tout est à jour</p>
        </div>
        <p className="text-xs text-[#666666] mt-1">
          Aucune échéance proche, aucune facture en attente.
        </p>
      </div>
    )
  }

  // La facturation regroupe "à facturer" (ambre) puis "impayés" (rouge).
  const invoiceCount = toInvoiceList.length + overdueList.length

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm font-semibold text-white">Alertes &amp; actions</h2>
        <span className="text-[10px] text-[#444444] uppercase tracking-widest tabular-nums">
          {totalAlerts} à traiter
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Échéances */}
        <Section
          icon={<CalendarClock className="h-4 w-4 text-[#F59E0B]" />}
          title="Échéances proches"
          count={deadlineAlerts.length}
          empty="Aucune deadline sous 7 jours."
        >
          {deadlineAlerts.slice(0, MAX_ROWS).map((a) => {
            const b = deadlineBadge(a.days)
            return (
              <Row
                key={a.id}
                href={`/projects/${a.id}`}
                title={a.name}
                subtitle={a.clientName ? `${a.clientName} · ${formatDate(a.deadline)}` : formatDate(a.deadline)}
                right={b.text}
                rightColor={b.color}
              />
            )
          })}
          {deadlineAlerts.length > MAX_ROWS && (
            <p className="text-[11px] text-[#555555] px-3 pt-1">
              +{deadlineAlerts.length - MAX_ROWS} autre{deadlineAlerts.length - MAX_ROWS > 1 ? 's' : ''}
            </p>
          )}
        </Section>

        {/* Facturation */}
        <Section
          icon={<FileText className="h-4 w-4 text-[#F59E0B]" />}
          title="Facturation"
          count={invoiceCount}
          empty="Rien à facturer."
        >
          {overdueList.slice(0, MAX_ROWS).map((a) => (
            <Row
              key={a.id}
              href={`/projects/${a.id}`}
              title={a.name}
              subtitle={a.clientName}
              right={`${eur(a.value)} · retard`}
              rightColor="#EF4444"
            />
          ))}
          {toInvoiceList.slice(0, Math.max(0, MAX_ROWS - overdueList.length)).map((a) => (
            <Row
              key={a.id}
              href={`/projects/${a.id}`}
              title={a.name}
              subtitle={a.clientName}
              right={eur(a.value)}
              rightColor="#F59E0B"
            />
          ))}
          {invoiceCount > MAX_ROWS && (
            <p className="text-[11px] text-[#555555] px-3 pt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              +{invoiceCount - MAX_ROWS} autre{invoiceCount - MAX_ROWS > 1 ? 's' : ''}
            </p>
          )}
        </Section>
      </div>
    </div>
  )
}
