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
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 shadow-xl">
      <p className="text-[11px] text-[#888888] mb-1.5 capitalize">{label}</p>
      <div className="space-y-1">
        <Line color="#00D76B" label="Encaissé" value={revenue} />
        <Line color="#EF4444" label="Sorties" value={outflow} />
        <div className="pt-1 mt-1 border-t border-[#2a2a2a]">
          <Line color={net >= 0 ? '#00D76B' : '#EF4444'} label="Net" value={net} bold />
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
      <span className="flex items-center gap-1.5 text-[#aaaaaa]">
        <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className={`tabular-nums ${bold ? 'font-semibold text-white' : 'text-[#dddddd]'}`}>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: '#666666', fontSize: 11 }}
          tickLine={false}
          axisLine={{ stroke: '#2a2a2a' }}
        />
        <YAxis
          tick={{ fill: '#666666', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <Tooltip cursor={{ fill: '#ffffff08' }} content={<ChartTooltip />} />
        <Bar dataKey="revenue" name="Encaissé" fill="#00D76B" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="outflow" name="Sorties" fill="#EF4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
