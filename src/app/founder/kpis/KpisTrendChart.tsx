'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

export interface KpiTrendPoint {
  week: string
  Prospects: number
  Réponses: number
  Calls: number
}

// Canvas recharts isolé — chargé en lazy (ssr: false) pour sortir recharts du bundle initial.
export default function KpisTrendChart({ data }: { data: KpiTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
        <XAxis dataKey="week" tick={{ fill: '#666666', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#2a2a2a' }} />
        <YAxis tick={{ fill: '#666666', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          cursor={{ stroke: '#ffffff20' }}
          contentStyle={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: '#888888' }}
        />
        <Line type="monotone" dataKey="Prospects" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Réponses" stroke="#A78BFA" strokeWidth={2} dot={{ r: 3 }} />
        <Line type="monotone" dataKey="Calls" stroke="#00D76B" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}
