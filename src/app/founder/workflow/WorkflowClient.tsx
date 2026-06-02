'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Check,
  Flame,
  Settings2,
  Plus,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import type { DailyWorkflowItem, DailyWorkflowTask } from '@/lib/types'
import {
  toggleTask,
  addTask,
  updateTaskLabel,
  setTaskActive,
  deleteTask,
} from './actions'

interface Props {
  items: DailyWorkflowItem[]
  allTasks: DailyWorkflowTask[]
  streak: number
}

const TODAY_LABEL = new Date().toLocaleDateString('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export default function WorkflowClient({ items: initialItems, allTasks, streak }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [editing, setEditing] = useState(false)

  const done = items.filter((i) => i.done_today).length
  const total = items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  function toggle(item: DailyWorkflowItem) {
    const next = !item.done_today
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done_today: next } : i)))
    toggleTask(item.id, next).then((res) => {
      if (!res.success) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done_today: !next } : i)))
        toast.error(res.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Daily Workflow</h1>
          <p className="text-sm text-[#666666] mt-0.5 capitalize">{TODAY_LABEL}</p>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors
            ${editing ? 'bg-[#1a1a1a] border-[#444444] text-white' : 'bg-[#111111] border-[#2a2a2a] text-[#888888] hover:text-white'}`}
        >
          <Settings2 className="h-4 w-4" />
          Modifier
        </button>
      </div>

      {/* Score + streak */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tabular-nums">{done}</span>
            <span className="text-lg text-[#555555] tabular-nums">/ {total}</span>
          </div>
          <p className="text-[11px] text-[#555555] mt-1">tâches du jour</p>
          <div className="mt-3 h-1.5 rounded-full bg-[#1f1f1f] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, backgroundColor: allDone ? '#00D76B' : '#3B82F6' }}
            />
          </div>
        </div>

        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-5">
          <div className="flex items-center gap-2">
            <Flame className={`h-7 w-7 ${streak > 0 ? 'text-[#F59E0B]' : 'text-[#333333]'}`} />
            <span className="text-3xl font-bold text-white tabular-nums">{streak}</span>
          </div>
          <p className="text-[11px] text-[#555555] mt-1">
            jour{streak !== 1 ? 's' : ''} consécutif{streak !== 1 ? 's' : ''} à 100 %
          </p>
        </div>
      </div>

      {allDone && (
        <div className="bg-[#00D76B]/10 border border-[#00D76B]/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <Check className="h-4 w-4 text-[#00D76B]" />
          <span className="text-sm text-[#00D76B] font-medium">Journée complète. Bien joué.</span>
        </div>
      )}

      {/* Checklist */}
      {!editing && (
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-8 text-center">
              <p className="text-sm text-[#666666]">Aucune tâche active. Ajoute-en via « Modifier ».</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => toggle(item)}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-colors
                  ${item.done_today
                    ? 'bg-[#00D76B]/[0.06] border-[#00D76B]/25'
                    : 'bg-[#111111] border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
              >
                <span
                  className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-colors
                    ${item.done_today ? 'bg-[#00D76B] border-[#00D76B]' : 'border-[#3a3a3a]'}`}
                >
                  {item.done_today && <Check className="h-3.5 w-3.5 text-black" />}
                </span>
                <span className={`text-sm ${item.done_today ? 'text-[#888888] line-through' : 'text-white'}`}>
                  {item.label}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Édition des tâches */}
      {editing && <TaskEditor allTasks={allTasks} onChanged={() => router.refresh()} />}
    </div>
  )
}

// ── Éditeur de tâches ───────────────────────────────────────────────────────

function TaskEditor({ allTasks, onChanged }: { allTasks: DailyWorkflowTask[]; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [newLabel, setNewLabel] = useState('')

  function add() {
    const clean = newLabel.trim()
    if (!clean) return
    startTransition(async () => {
      const res = await addTask(clean)
      if (!res.success) { toast.error(res.error); return }
      setNewLabel('')
      onChanged()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-semibold text-[#888888] uppercase tracking-wider">Tâches</h2>

      <div className="space-y-1.5">
        {allTasks.map((t) => (
          <TaskRow key={t.id} task={t} isPending={isPending} onChanged={onChanged} startTransition={startTransition} />
        ))}
      </div>

      {/* Ajouter */}
      <div className="flex items-center gap-2 pt-1">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Nouvelle tâche…"
          className="flex-1 bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]"
        />
        <button
          onClick={add}
          disabled={isPending || !newLabel.trim()}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>
    </div>
  )
}

function TaskRow({
  task,
  isPending,
  onChanged,
  startTransition,
}: {
  task: DailyWorkflowTask
  isPending: boolean
  onChanged: () => void
  startTransition: (cb: () => void) => void
}) {
  const [label, setLabel] = useState(task.label)

  function commitLabel() {
    if (label.trim() === task.label || !label.trim()) {
      setLabel(task.label)
      return
    }
    startTransition(async () => {
      const res = await updateTaskLabel(task.id, label)
      if (!res.success) { toast.error(res.error); setLabel(task.label) }
      else onChanged()
    })
  }

  function toggleActive() {
    startTransition(async () => {
      const res = await setTaskActive(task.id, !task.active)
      if (!res.success) { toast.error(res.error); return }
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteTask(task.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Tâche supprimée')
      onChanged()
    })
  }

  return (
    <div className={`flex items-center gap-2 ${task.active ? '' : 'opacity-50'}`}>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onBlur={commitLabel}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
        className="flex-1 bg-[#161616] border border-[#262626] rounded-md px-2.5 py-1.5 text-sm text-white focus:outline-none focus:border-[#444444]"
      />
      <button
        onClick={toggleActive}
        disabled={isPending}
        aria-label={task.active ? 'Désactiver' : 'Activer'}
        title={task.active ? 'Active (cliquer pour masquer)' : 'Masquée (cliquer pour activer)'}
        className="w-8 h-8 flex items-center justify-center rounded-md text-[#666666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
      >
        {task.active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button
        onClick={remove}
        disabled={isPending}
        aria-label="Supprimer"
        className="w-8 h-8 flex items-center justify-center rounded-md text-[#666666] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  )
}
