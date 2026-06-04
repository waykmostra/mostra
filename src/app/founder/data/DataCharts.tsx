'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { BarChart3 } from 'lucide-react'
import type { DataColumn, DataEntry } from '@/lib/types'
import { categoryColor, columnNumber, fmtNumber, formatNumberValue, numberUnit, CATEGORY_PALETTE } from './dataMeta'
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
  'bg-[#1a1a1a] border border-[#333333] rounded-md px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#555555] cursor-pointer'

const MAX_LABEL = 24

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
  const textCols = useMemo(() => columns.filter((c) => c.type === 'text'), [columns])

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const numberStats = useMemo(
    () =>
      numberCols.map((col) => {
        const nums = entries
          .map((e) => columnNumber(col, e.values[col.id]))
          .filter((n): n is number => n != null)
        const sum = nums.reduce((a, b) => a + b, 0)
        const avg = nums.length ? sum / nums.length : 0
        // Pour une note (/N), un % ou une fraction, la moyenne est la mesure parlante.
        const avgFocused =
          col.number_format === 'rating' || col.number_format === 'percent' || col.number_format === 'fraction'
        return {
          col,
          label: avgFocused ? `Moy. ${col.name}` : `Σ ${col.name}`,
          value: avgFocused
            ? formatNumberValue(col, Math.round(avg * 100) / 100)
            : formatNumberValue(col, sum),
          sub: avgFocused
            ? `${nums.length} entrée${nums.length !== 1 ? 's' : ''}`
            : `moy. ${formatNumberValue(col, Math.round(avg * 100) / 100)}`,
        }
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

  // ── Modes de graphique ───────────────────────────────────────────────────────
  const canEntry = numberCols.length > 0
  const canCategory = categoryCols.length > 0
  const [mode, setMode] = useState<'entry' | 'category'>(canCategory ? 'category' : 'entry')
  const effectiveMode: 'entry' | 'category' =
    mode === 'category' && !canCategory ? 'entry' : mode === 'entry' && !canEntry ? 'category' : mode

  // Mode « par entrée » : une barre par ligne (étiquette texte × score).
  const [entryValueId, setEntryValueId] = useState(numberCols[0]?.id ?? '')
  const [entryLabelId, setEntryLabelId] = useState(textCols[0]?.id ?? '')
  const valueCol = numberCols.find((c) => c.id === entryValueId) ?? numberCols[0] ?? null
  const labelCol = textCols.find((c) => c.id === entryLabelId) ?? null

  const entryData: ChartDatum[] = useMemo(() => {
    if (!valueCol) return []
    const out: ChartDatum[] = []
    entries.forEach((e, i) => {
      const v = columnNumber(valueCol, e.values[valueCol.id])
      if (v == null) return
      let name = labelCol ? String(e.values[labelCol.id] ?? '').trim() : ''
      if (!name) name = `#${i + 1}`
      if (name.length > MAX_LABEL) name = `${name.slice(0, MAX_LABEL)}…`
      out.push({ name, value: v, color: CATEGORY_PALETTE[out.length % CATEGORY_PALETTE.length] })
    })
    out.sort((a, b) => b.value - a.value)
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, valueCol?.id, labelCol?.id])

  // Mode « par catégorie » : regroupé.
  const [dimId, setDimId] = useState(categoryCols[0]?.id ?? '')
  const [measureStr, setMeasureStr] = useState('count')
  const dimCol = categoryCols.find((c) => c.id === dimId) ?? categoryCols[0] ?? null
  const rawMeasure = parseMeasure(measureStr)
  const measure: Measure =
    rawMeasure.kind !== 'count' && !numberCols.some((c) => c.id === rawMeasure.colId)
      ? { kind: 'count' }
      : rawMeasure

  const categoryData: ChartDatum[] = useMemo(() => {
    if (!dimCol) return []
    const groups = new Map<string, number[]>()
    for (const e of entries) {
      const dv = e.values[dimCol.id]
      if (dv == null || dv === '') continue
      const key = String(dv)
      if (measure.kind === 'count') {
        groups.set(key, [...(groups.get(key) ?? []), 1])
      } else {
        const mcol = numberCols.find((c) => c.id === measure.colId)
        const n = mcol ? columnNumber(mcol, e.values[measure.colId]) : null
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

  const chartData = effectiveMode === 'entry' ? entryData : categoryData
  const measureLabel =
    effectiveMode === 'entry'
      ? valueCol
        ? `${valueCol.name}${numberUnit(valueCol) ? ` (${numberUnit(valueCol)})` : ''}`
        : ''
      : measure.kind === 'count'
        ? "Nombre d'entrées"
        : `${measure.kind === 'sum' ? 'Somme' : 'Moyenne'} · ${numberCols.find((c) => c.id === measure.colId)?.name ?? ''}`

  const noCharts = !canEntry && !canCategory

  return (
    <div className="space-y-4 pt-2">
      <h2 className="text-sm font-semibold text-white flex items-center gap-2">
        <BarChart3 className="h-4 w-4" style={{ color: accent }} />
        Analyses
      </h2>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiMini label="Entrées" value={fmtNumber(entries.length)} accent={accent} />
        {numberStats.map((s) => (
          <KpiMini key={s.col.id} label={s.label} value={s.value} sub={s.sub} />
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
      {noCharts ? (
        <div className="bg-[#0e0e0e] border border-dashed border-[#222222] rounded-xl p-6 text-center">
          <p className="text-xs text-[#666666]">
            Ajoute une colonne <span className="text-[#00D76B]">Nombre</span> ou{' '}
            <span className="text-[#A78BFA]">Catégorie</span> pour visualiser tes données.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Sélecteur de mode (si les deux sont possibles) */}
          {canEntry && canCategory && (
            <div className="inline-flex bg-[#111111] border border-[#2a2a2a] rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setMode('entry')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${effectiveMode === 'entry' ? 'bg-[#222222] text-white' : 'text-[#666666] hover:text-white'}`}
              >
                Par entrée
              </button>
              <button
                onClick={() => setMode('category')}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${effectiveMode === 'category' ? 'bg-[#222222] text-white' : 'text-[#666666] hover:text-white'}`}
              >
                Par catégorie
              </button>
            </div>
          )}

          {/* Contrôles selon le mode */}
          {effectiveMode === 'entry' ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[#666666]">Comparer le score</span>
              <select value={valueCol?.id ?? ''} onChange={(e) => setEntryValueId(e.target.value)} className={field}>
                {numberCols.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {textCols.length > 0 && (
                <>
                  <span className="text-[#666666]">· étiqueté par</span>
                  <select value={labelCol?.id ?? ''} onChange={(e) => setEntryLabelId(e.target.value)} className={field}>
                    {textCols.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          ) : (
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
          )}

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
