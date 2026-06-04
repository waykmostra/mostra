'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Loader2, Database, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import type { DataSet } from '@/lib/types'
import { SET_COLORS } from './dataMeta'
import { createSet } from './actions'

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

export default function DataListClient({
  sets,
  counts,
}: {
  sets: DataSet[]
  counts: Record<string, number>
}) {
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Data</h1>
          <p className="text-sm text-[#666666] mt-0.5">
            {sets.length} base{sets.length !== 1 ? 's' : ''} de statistiques · saisie manuelle + graphiques
          </p>
        </div>
        <button
          onClick={() => setCreating((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          Nouvelle base
        </button>
      </div>

      {creating && <NewSetForm onClose={() => setCreating(false)} />}

      {sets.length === 0 && !creating ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <Database className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666] text-center">
            Aucune base. Crée ta première base (ex. « Messages de prospection »).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sets.map((s) => (
            <Link
              key={s.id}
              href={`/founder/data/${s.id}`}
              className="group bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 hover:border-[#3a3a3a] transition-colors flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}1a` }}>
                  <Database className="h-4 w-4" style={{ color: s.color }} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate group-hover:text-[#00D76B] transition-colors">{s.name}</p>
                  <p className="text-[11px] text-[#666666]">{counts[s.id] ?? 0} entrée{(counts[s.id] ?? 0) !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-[#444444] group-hover:text-[#888888] flex-shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function NewSetForm({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SET_COLORS[0])

  function submit() {
    const clean = name.trim()
    if (!clean) return toast.error('Le nom de la base est requis.')
    startTransition(async () => {
      const res = await createSet(clean, color)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Base créée ✓')
      router.push(`/founder/data/${res.id}`)
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Nom de la base (ex. Messages de prospection)"
        className={field}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {SET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Couleur ${c}`}
              className="w-5 h-5 rounded-full transition-transform hover:scale-110"
              style={{ backgroundColor: c, outline: color === c ? `2px solid ${c}` : 'none', outlineOffset: 2 }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">Annuler</button>
          <button
            onClick={submit}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Créer
          </button>
        </div>
      </div>
    </div>
  )
}
