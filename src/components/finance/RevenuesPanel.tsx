import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils/dates'
import type { PaymentStatus, RevenueEntry } from '@/lib/types'
import { eur } from './financeMeta'

const PAYMENT_META: Record<PaymentStatus, { label: string; color: string }> = {
  pending:  { label: 'En attente', color: '#6B7280' },
  invoiced: { label: 'Facturé',    color: '#3B82F6' },
  partial:  { label: 'Partiel',    color: '#F59E0B' },
  paid:     { label: 'Payé',       color: '#22C55E' },
  overdue:  { label: 'En retard',  color: '#EF4444' },
}

export default function RevenuesPanel({ revenues }: { revenues: RevenueEntry[] }) {
  const paid = revenues
    .filter((r) => r.payment_status === 'paid')
    .reduce((s, r) => s + r.value_eur, 0)
  const pending = revenues
    .filter((r) => r.payment_status !== 'paid')
    .reduce((s, r) => s + r.value_eur, 0)

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#1e1e1e] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Revenus — projets</h2>
          <p className="text-[11px] text-[#666666] mt-0.5">
            Dérivés des projets valorisés (lecture seule)
          </p>
        </div>
        <div className="flex items-center gap-4 text-right flex-shrink-0">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#444444]">Encaissé</p>
            <p className="text-sm font-semibold text-[#22C55E] tabular-nums">{eur(paid)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#444444]">En attente</p>
            <p className="text-sm font-semibold text-[#F59E0B] tabular-nums">{eur(pending)}</p>
          </div>
        </div>
      </div>

      {revenues.length === 0 ? (
        <p className="text-xs text-[#555555] italic px-5 py-8 text-center">
          Aucun projet valorisé. Renseigne une valeur sur la carte 360° d&apos;un projet.
        </p>
      ) : (
        <div className="divide-y divide-[#161616]">
          {revenues.map((r) => {
            const pay = PAYMENT_META[r.payment_status] ?? PAYMENT_META.pending
            return (
              <Link
                key={r.id}
                href={`/projects/${r.id}`}
                className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-[#1a1a1a] transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white truncate">{r.name}</p>
                  <p className="text-[11px] text-[#666666] truncate">
                    {r.client_name ?? 'Sans client'}
                    {r.paid_at ? ` · encaissé le ${formatDate(r.paid_at)}` : ''}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0"
                  style={{ color: pay.color, backgroundColor: `${pay.color}1a`, borderColor: `${pay.color}33` }}
                >
                  {pay.label}
                </span>
                <span className="text-sm text-white tabular-nums font-medium w-24 text-right flex-shrink-0">
                  {eur(r.value_eur)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[#444444] group-hover:text-[#888888] flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
