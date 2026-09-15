'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { eur } from './financeMeta'
import type { FinanceChartPoint } from './FinanceChart'

interface TooltipPayloadItem {
  name: string
  value: number
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const revenue = payload.find((p) => p.name === 'Encaissé')?.value ?? 0
  const outflow = payload.find((p) => p.name === 'Sorties')?.value ?? 0
  const net = revenue - outflow
  return (
    <div className="bg-surface-2 border border-line rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-dim mb-1.5 capitalize">{label}</p>
      <div className="space-y-1">
        <Line color="rgb(var(--c-brand))" label="Encaissé" value={revenue} />
        <Line color="#EF4444" label="Sorties" value={outflow} />
        <div className="pt-1 mt-1 border-t border-line">
          <Line color={net >= 0 ? 'rgb(var(--c-brand))' : '#EF4444'} label="Net" value={net} bold />
        </div>
      </div>
    </div>
  )
}

function Line({
  color,
  label,
  value,
  bold,
}: {
  color: string
  label: string
  value: number
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="flex items-center gap-1.5 text-dim">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className={`tabular-nums ${bold ? 'font-semibold text-ink' : 'text-dim'}`}>
        {eur(value)}
      </span>
    </div>
  )
}

// Canvas recharts isolé — chargé en lazy (ssr: false) pour sortir recharts du bundle initial.
export default function FinanceChartInner({ data }: { data: FinanceChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--c-surface-3))" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: 'rgb(var(--c-text-faint))', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: 'rgb(var(--c-border))' }}
        />
        <YAxis
          tick={{ fill: 'rgb(var(--c-text-faint))', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip />} />
        <Bar dataKey="revenue" name="Encaissé" fill="rgb(var(--c-brand))" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="outflow" name="Sorties" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
