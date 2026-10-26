'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { toast } from 'sonner'
import { updatePhasePlanning } from '@/app/projects/planning-actions'
import type { PhaseStatus } from '@/lib/types'

// ============================================================
// Planning en escalier (Gantt) — une barre par grande étape
// ============================================================
// Jours en haut, étapes à gauche (colonne figée au défilement), une barre par
// étape : validée = vert plein, en cours = contour vert + remplissage partiel,
// à venir = gris. Ligne « Aujourd'hui », week-ends grisés, losange de
// livraison. Admin : glisser une barre la déplace, tirer un bord l'allonge,
// calage au jour ; clic sur une ligne vide = nouvelle barre de 5 jours.

export interface PlanningPhase {
  id: string
  name: string
  status: PhaseStatus
  planned_start?: string | null
  planned_end?: string | null
  started_at: string | null
  completed_at: string | null
}

type Zoom = 'week' | 'month'
const DAY_W: Record<Zoom, number> = { week: 40, month: 16 }
const NAME_W = 132
const ROW_H = 40
const EDGE = 8

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return key(d) }
const diff = (a: string, b: string) => Math.round((parse(a).getTime() - parse(b).getTime()) / 86_400_000)

interface Drag { id: string; mode: 'move' | 'start' | 'end'; x0: number; start: string; end: string }

export default function ProjectPlanning({ phases, editable = false }: { phases: PlanningPhase[]; editable?: boolean }) {
  const today = key(new Date())
  const [zoom, setZoom] = useState<Zoom>('week')
  const [dates, setDates] = useState<Record<string, { start: string | null; end: string | null }>>(() =>
    Object.fromEntries(phases.map((p) => [p.id, { start: p.planned_start?.slice(0, 10) ?? null, end: p.planned_end?.slice(0, 10) ?? null }])),
  )
  const [drag, setDrag] = useState<(Drag & { dDays: number }) | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const dayW = DAY_W[zoom]

  // Plage affichée : du lundi avant la première date à une semaine après la dernière.
  const { from, days } = useMemo(() => {
    const all = [today]
    for (const p of phases) {
      const d = dates[p.id]
      if (d?.start) all.push(d.start)
      if (d?.end) all.push(d.end)
      if (p.started_at) all.push(p.started_at.slice(0, 10))
      if (p.completed_at) all.push(p.completed_at.slice(0, 10))
    }
    all.sort()
    let start = addDays(all[0], -2)
    const wd = (parse(start).getDay() + 6) % 7
    start = addDays(start, -wd)
    const end = addDays(all[all.length - 1], zoom === 'week' ? 10 : 21)
    const n = Math.max(diff(end, start) + 1, zoom === 'week' ? 28 : 70)
    return { from: start, days: Array.from({ length: n }, (_, i) => addDays(start, i)) }
  }, [phases, dates, today, zoom])

  const x = (day: string) => diff(day, from) * dayW

  // À l'ouverture et au changement de zoom : aujourd'hui au premier tiers de la vue.
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollLeft = Math.max(0, NAME_W + diff(today, from) * dayW - el.clientWidth / 3)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  // Dates en cours de glissé (aperçu fantôme), sinon les dates enregistrées.
  function shown(id: string) {
    const d = dates[id]
    if (!drag || drag.id !== id) return d
    const { start, end, mode, dDays } = drag
    if (mode === 'move') return { start: addDays(start, dDays), end: addDays(end, dDays) }
    if (mode === 'start') return { start: diff(addDays(start, dDays), end) > 0 ? end : addDays(start, dDays), end }
    return { start, end: diff(addDays(end, dDays), start) < 0 ? start : addDays(end, dDays) }
  }

  async function save(id: string, start: string | null, end: string | null) {
    const before = dates[id]
    setDates((prev) => ({ ...prev, [id]: { start, end } }))
    const res = await updatePhasePlanning(id, start, end)
    if (!res.success) {
      setDates((prev) => ({ ...prev, [id]: before }))
      toast.error(res.error)
    }
  }

  function onBarDown(e: React.PointerEvent, id: string) {
    if (!editable || e.button !== 0) return
    const d = dates[id]
    if (!d?.start || !d?.end) return
    e.preventDefault()
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const mode: Drag['mode'] = e.clientX - r.left < EDGE ? 'start' : r.right - e.clientX < EDGE ? 'end' : 'move'
    const base: Drag = { id, mode, x0: e.clientX, start: d.start, end: d.end }
    let dDays = 0
    setDrag({ ...base, dDays })
    const move = (ev: PointerEvent) => {
      dDays = Math.round((ev.clientX - base.x0) / dayW)
      setDrag({ ...base, dDays })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (!dDays) return
      const s = base.mode === 'end' ? base.start : addDays(base.start, dDays)
      const en = base.mode === 'start' ? base.end : addDays(base.end, dDays)
      if (diff(en, s) < 0) return
      void save(id, s, en)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  function onRowClick(e: React.MouseEvent, id: string) {
    if (!editable || dates[id]?.start) return
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const start = addDays(from, Math.floor((e.clientX - r.left) / dayW))
    void save(id, start, addDays(start, 4))
  }

  // Livraison prévue = fin prévue de la dernière étape planifiée.
  const lastEnd = phases.reduce<string | null>((acc, p) => {
    const e = dates[p.id]?.end
    return e && (!acc || e > acc) ? e : acc
  }, null)
  const width = days.length * dayW
  const anyPlanned = phases.some((p) => dates[p.id]?.start)

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Planning</h2>
          {lastEnd ? (
            <p className="mt-0.5 text-[13px] text-dim">
              {editable ? 'Livraison prévue le ' : 'Votre vidéo est prévue pour le '}
              <span className="font-medium text-ink">{format(parse(lastEnd), 'd MMMM', { locale: fr })}</span>
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-faint">
              {editable ? 'Clique sur la ligne d’une étape pour poser ses dates, puis glisse ou étire la barre.' : 'Le planning arrive bientôt.'}
            </p>
          )}
        </div>
        {(anyPlanned || editable) && <div className="ml-auto flex rounded-lg bg-surface-2 p-0.5">
          {(['week', 'month'] as Zoom[]).map((z) => (
            <button key={z} type="button" onClick={() => setZoom(z)}
              className={`h-8 rounded-md px-3 text-[13px] font-medium ${zoom === z ? 'bg-surface text-ink shadow-sm' : 'text-dim hover:text-ink'}`}>
              {z === 'week' ? 'Semaine' : 'Mois'}
            </button>
          ))}
        </div>}
      </div>

      {(anyPlanned || editable) && (
        <div ref={scroller} className="overflow-x-auto border-t border-line">
          <div className="relative" style={{ width: NAME_W + width }}>
            {/* En-tête des jours */}
            <div className="flex border-b border-line">
              <div className="sticky left-0 z-20 shrink-0 bg-surface" style={{ width: NAME_W }} />
              <div className="relative h-11" style={{ width }}>
                {days.map((d, i) => {
                  const date = parse(d)
                  const first = date.getDate() === 1 || i === 0
                  const monday = date.getDay() === 1
                  return (
                    <div key={d} className="absolute top-0 h-full" style={{ left: i * dayW, width: dayW }}>
                      {first && <span className="absolute left-1 top-1 whitespace-nowrap text-[11px] font-medium capitalize text-dim">{format(date, 'MMMM', { locale: fr })}</span>}
                      {(zoom === 'week' || monday) && (
                        <span className={`absolute bottom-1 left-0 w-full text-center font-mono text-[11px] ${d === today ? 'font-semibold text-brand-text' : 'text-faint'}`}>
                          {zoom === 'week' ? `${format(date, 'EEEEE', { locale: fr }).toUpperCase()}${date.getDate()}` : date.getDate()}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Lignes */}
            {phases.map((p) => {
              const d = shown(p.id)
              const planned = !!d?.start && !!d?.end
              const done = p.status === 'completed' || p.status === 'approved'
              const active = p.status === 'in_progress' || p.status === 'in_review'
              const left = planned ? x(d!.start!) : 0
              const w = planned ? (diff(d!.end!, d!.start!) + 1) * dayW : 0
              const elapsed = planned && active ? Math.min(1, Math.max(0, (diff(today, d!.start!) + 1) / (diff(d!.end!, d!.start!) + 1))) : 0
              const realStart = p.started_at?.slice(0, 10)
              const realEnd = p.completed_at?.slice(0, 10) ?? (realStart ? today : null)
              const showReal = !!realStart && !!realEnd && planned && (realStart !== d!.start || (done && realEnd !== d!.end))
              const dragging = drag?.id === p.id
              return (
                <div key={p.id} className="flex border-b border-line last:border-b-0">
                  <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-surface px-3 text-[13px] text-ink" style={{ width: NAME_W, height: ROW_H }}>
                    <span className="truncate">{p.name}</span>
                  </div>
                  <div
                    className={`relative ${editable && !planned ? 'cursor-copy' : ''}`}
                    style={{ width, height: ROW_H }}
                    onClick={(e) => onRowClick(e, p.id)}
                  >
                    {/* Week-ends */}
                    {days.map((day, i) => {
                      const wd = parse(day).getDay()
                      return wd === 0 || wd === 6 ? <div key={day} className="absolute inset-y-0 bg-surface-2/70" style={{ left: i * dayW, width: dayW }} /> : null
                    })}
                    {planned && (
                      <div
                        onPointerDown={(e) => onBarDown(e, p.id)}
                        title={`${p.name} : ${format(parse(d!.start!), 'd MMM', { locale: fr })} → ${format(parse(d!.end!), 'd MMM', { locale: fr })}`}
                        className={`absolute top-2 h-6 overflow-hidden rounded-md ${
                          done ? 'bg-brand' : active ? 'bg-brand/10 ring-2 ring-inset ring-brand' : 'bg-surface-3'
                        } ${editable ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${dragging ? 'opacity-80 shadow-lg' : ''}`}
                        style={{ left, width: Math.max(w, dayW) }}
                      >
                        {active && <div className="absolute inset-y-0 left-0 bg-brand/35" style={{ width: `${elapsed * 100}%` }} />}
                        {editable && (
                          <>
                            <span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" />
                            <span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" />
                          </>
                        )}
                      </div>
                    )}
                    {dragging && planned && (
                      <span className="pointer-events-none absolute -top-1 z-30 -translate-y-full whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[12px] text-[rgb(var(--c-surface))]" style={{ left }}>
                        {format(parse(d!.start!), 'd MMM', { locale: fr })} → {format(parse(d!.end!), 'd MMM', { locale: fr })}
                      </span>
                    )}
                    {showReal && (
                      <div className="absolute h-[3px] rounded-full bg-ink/40" title="Réel"
                        style={{ left: x(realStart!), width: Math.max(dayW / 2, (diff(realEnd!, realStart!) + 1) * dayW), top: ROW_H - 7 }} />
                    )}
                  </div>
                </div>
              )
            })}

            {/* Aujourd'hui + livraison, par-dessus toutes les lignes */}
            <div className="pointer-events-none absolute bottom-0 top-11 z-10 w-px bg-brand" style={{ left: NAME_W + x(today) + dayW / 2 }} />
            {lastEnd && (
              <div className="pointer-events-none absolute bottom-0 top-11 z-10" style={{ left: NAME_W + x(lastEnd) + dayW }}>
                <span className="absolute -left-[5px] top-1 block h-2.5 w-2.5 rotate-45 bg-ink" title="Livraison prévue" />
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
