'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts'

export interface ChartDatum {
  name: string
  value: number
  color: string
}

const tooltipStyle = {
  background: '#1a1a1a',
  border: '1px solid #2a2a2a',
  borderRadius: 8,
  fontSize: 12,
}

// Canvas recharts isolé — chargé en lazy (ssr: false) pour sortir recharts du
// bundle initial de la page Data.
export default function DataChartsInner({
  data,
  measureLabel,
}: {
  data: ChartDatum[]
  measureLabel: string
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Barres */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Comparaison — {measureLabel}</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e1e1e" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#666666', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#2a2a2a' }} />
            <YAxis tick={{ fill: '#666666', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip cursor={{ fill: '#ffffff08' }} contentStyle={tooltipStyle} labelStyle={{ color: '#888888' }} />
            <Bar dataKey="value" name={measureLabel} radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Camembert */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Répartition</h3>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={92} paddingAngle={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} stroke="#111111" />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#888888' }} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#888888' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
