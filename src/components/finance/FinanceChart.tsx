'use client'

import dynamic from 'next/dynamic'

export interface FinanceChartPoint {
  month: string
  revenue: number
  outflow: number
}

// recharts est lourd et client-only : on le sort du bundle initial via un import dynamique.
const FinanceChartCanvas = dynamic(() => import('./FinanceChartInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[240px] flex items-center justify-center">
      <span className="text-xs text-faint italic">Chargement du graphique…</span>
    </div>
  ),
})

export default function FinanceChart({ data }: { data: FinanceChartPoint[] }) {
  const hasData = data.some((d) => d.revenue > 0 || d.outflow > 0)

  return (
    <div className="bg-surface border border-line rounded-xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-sm font-semibold text-ink">Cashflow — 6 derniers mois</h2>
        <div className="flex items-center gap-3 text-[10px] text-faint">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-brand" /> Encaissé
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-[#EF4444]" /> Sorties
          </span>
        </div>
      </div>

      {hasData ? (
        <FinanceChartCanvas data={data} />
      ) : (
        <div className="h-[240px] flex items-center justify-center">
          <p className="text-xs text-faint italic">Pas encore de données financières.</p>
        </div>
      )}
    </div>
  )
}
