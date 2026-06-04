'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import type { DataColumn, DataEntry } from '@/lib/types'
import { categoryColor, toNumber, fmtNumber } from './dataMeta'
import type { ChartDatum } from './DataChartsInner'

// recharts lourd + client-only : sorti du bundle initial.
const DataChartsInner = dynamic(() => import('./DataChartsInner'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] flex items-center justify-center">
      <span className="text-xs text-[#555555] italic">Chargement des graphiques…</span>
    </div>
  ),
})

// Heuristique « réussite » : repère une option de catégorie qui signale un succès.
const SUCCESS_RE = /r[ée]ussi|success|gagn[ée]|won|oui|ok|positif|closed|sign[ée]/i

const field =
  'bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-[#555555] cursor-pointer'

type Measure = { kind: 'count' } | { kind: 'sum' | 'avg'; colId: string }

function parseMeasure(m: string): Measure {
  if (m.startsWith('sum:')) return { kind: 'sum', colId: m.slice(4) }
  if (m.startsWith('avg:')) return { kind: 'avg', colId: m.slice(4) }
  return { kind: 'count' }
}

export default function DataCharts({
  columns,
  entries,
  accent,
}: {
  columns: DataColumn[]
  entries: DataEntry[]
  accent: string
}) {
  const numberCols = useMemo(() => columns.filter((c) => c.type === 'number'), [columns])
  const categoryCols = useMemo(() => columns.filter((c) => c.type === 'category'), [columns])

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const numberStats = useMemo(
    () =>
      numberCols.map((col) => {
        const nums = entries
          .map((e) => toNumber(e.values[col.id]))
          .filter((n): n is number => n != null)
        const sum = nums.reduce((a, b) => a + b, 0)
        const avg = nums.length ? sum / nums.length : 0
        return { col, sum, avg, count: nums.length }
      }),
    [numberCols, entries],
  )

  const successStats = useMemo(
    () =>
      categoryCols
        .map((col) => {
          const opt = (col.options ?? []).find((o) => SUCCESS_RE.test(o))
          if (!opt) return null
          const filled = entries.filter((e) => {
            const v = e.values[col.id]
            return v != null && v !== ''
          })
          if (filled.length === 0) return null
          const wins = filled.filter((e) => String(e.values[col.id]) === opt).length
          return { col, opt, rate: (wins / filled.length) * 100, wins, total: filled.length }
        })
        .filter((s): s is NonNullable<typeof s> => s !== null),
    [categoryCols, entries],
  )

  // ── Constructeur de graphique ────────────────────────────────────────────────
  const [dimId, setDimId] = useState(categoryCols[0]?.id ?? '')
  const [measureStr, setMeasureStr] = useState('count')

  const dimCol = categoryCols.find((c) => c.id === dimId) ?? categoryCols[0] ?? null

  const rawMeasure = parseMeasure(measureStr)
  const measure: Measure =
    rawMeasure.kind !== 'count' && !numberCols.some((c) => c.id === rawMeasure.colId)
      ? { kind: 'count' }
      : rawMeasure

  const measureLabel =
    measure.kind === 'count'
      ? "Nombre d'entrées"
      : `${measure.kind === 'sum' ? 'Somme' : 'Moyenne'} · ${numberCols.find((c) => c.id === measure.colId)?.name ?? ''}`

  const chartData: ChartDatum[] = useMemo(() => {
    if (!dimCol) return []
    const groups = new Map<string, number[]>()
    for (const e of entries) {
      const dv = e.values[dimCol.id]
      if (dv == null || dv === '') continue
      const key = String(dv)
      if (measure.kind === 'count') {
        groups.set(key, [...(groups.get(key) ?? []), 1])
      } else {
        const n = toNumber(e.values[measure.colId])
        if (n == null) continue
        groups.set(key, [...(groups.get(key) ?? []), n])
      }
    }
    const out: ChartDatum[] = []
    for (const [key, arr] of groups) {
      let v: number
      if (measure.kind === 'sum') v = arr.reduce((a, b) => a + b, 0)
      else if (measure.kind === 'avg') v = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
      else v = arr.length
      out.push({ name: key, value: Math.round(v * 100) / 100, color: categoryColor(key, dimCol.options) })
    }
    out.sort((a, b) => b.value - a.value)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, dimCol?.id, measureStr])

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4" style={{ color: accent }} />
        Analyses
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiMini label="Entrées" value={fmtNumber(entries.length)} accent={accent} />
        {numberStats.map(({ col, sum, avg }) => (
          <KpiMini
            key={col.id}
            label={`Σ ${col.name}`}
            value={fmtNumber(sum)}
            sub={`moy. ${fmtNumber(Math.round(avg * 100) / 100)}`}
          />
        ))}
        {successStats.map(({ col, opt, rate, wins, total }) => (
          <KpiMini
            key={col.id}
            label={`Taux « ${opt} »`}
            value={`${Math.round(rate)}%`}
            sub={`${wins}/${total} · ${col.name}`}
            accent="#22C55E"
          />
        ))}
      </div>

      {/* Graphiques */}
      {categoryCols.length === 0 ? (
        <div className="bg-[#0e0e0e] border border-dashed border-[#222222] rounded-xl p-6 text-center">
          <p className="text-xs text-[#666666]">
            Ajoute une colonne <span className="text-[#A78BFA]">Catégorie</span> pour comparer et visualiser tes données.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Contrôles */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#666666]">Regrouper par</span>
            <select value={dimCol?.id ?? ''} onChange={(e) => setDimId(e.target.value)} className={field}>
              {categoryCols.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <span className="text-[#666666]">·</span>
            <select value={measureStr} onChange={(e) => setMeasureStr(e.target.value)} className={field}>
              <option value="count">Nombre d&apos;entrées</option>
              {numberCols.map((c) => (
                <option key={`sum:${c.id}`} value={`sum:${c.id}`}>Somme de {c.name}</option>
              ))}
              {numberCols.map((c) => (
                <option key={`avg:${c.id}`} value={`avg:${c.id}`}>Moyenne de {c.name}</option>
              ))}
            </select>
          </div>

          {chartData.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 text-center">
              <p className="text-xs text-[#555555] italic">Pas encore de données à visualiser.</p>
            </div>
          ) : (
            <DataChartsInner data={chartData} measureLabel={measureLabel} />
          )}
        </div>
      )}
    </div>
  )
}

function KpiMini({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wider text-[#666666] truncate">{label}</p>
      <p className="text-lg font-bold mt-0.5 tabular-nums" style={{ color: accent ?? '#ffffff' }}>{value}</p>
      {sub && <p className="text-[10px] text-[#555555] mt-0.5 truncate">{sub}</p>}
    </div>
  )
}
