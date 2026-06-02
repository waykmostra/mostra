'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Loader2,
  ExternalLink,
  AlertTriangle,
  Eye,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import type { Competitor } from '@/lib/types'
import { createCompetitor, updateCompetitor, deleteCompetitor, type CompetitorInput } from './actions'

const STALE_DAYS = 7

function staleDaysOf(updatedAt: string): number {
  return Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000)
}

function externalHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

const EMPTY: CompetitorInput = { name: '', website: '', positioning: '', theirMethods: '', replicate: '' }

export default function VeilleClient({ competitors }: { competitors: Competitor[] }) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)

  const staleCount = competitors.filter((c) => staleDaysOf(c.updated_at) > STALE_DAYS).length

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Veille concurrentielle</h1>
          <p className="text-sm text-[#666666] mt-0.5">
            {competitors.length} concurrent{competitors.length !== 1 ? 's' : ''} suivi{competitors.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors"
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </div>

      {staleCount > 0 && (
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
          <span className="text-sm text-[#F59E0B]">
            {staleCount} fiche{staleCount !== 1 ? 's' : ''} pas mise{staleCount !== 1 ? 's' : ''} à jour depuis +{STALE_DAYS} jours.
          </span>
        </div>
      )}

      {adding && (
        <CompetitorForm
          initial={EMPTY}
          onCancel={() => setAdding(false)}
          onSubmit={async (input) => {
            const res = await createCompetitor(input)
            if (!res.success) { toast.error(res.error); return false }
            toast.success('Concurrent ajouté ✓')
            setAdding(false)
            router.refresh()
            return true
          }}
        />
      )}

      {competitors.length === 0 && !adding ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <Eye className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666]">Aucun concurrent suivi. Ajoute le premier.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c) => (
            <CompetitorCard key={c.id} competitor={c} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Carte ───────────────────────────────────────────────────────────────────

function CompetitorCard({ competitor: c, onChanged }: { competitor: Competitor; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const stale = staleDaysOf(c.updated_at) > STALE_DAYS

  function remove() {
    startTransition(async () => {
      const res = await deleteCompetitor(c.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Concurrent supprimé')
      onChanged()
    })
  }

  if (editing) {
    return (
      <CompetitorForm
        initial={{
          name: c.name,
          website: c.website ?? '',
          positioning: c.positioning ?? '',
          theirMethods: c.their_methods ?? '',
          replicate: c.replicate ?? '',
        }}
        onCancel={() => setEditing(false)}
        onSubmit={async (input) => {
          const res = await updateCompetitor(c.id, input)
          if (!res.success) { toast.error(res.error); return false }
          toast.success('Mis à jour ✓')
          setEditing(false)
          onChanged()
          return true
        }}
      />
    )
  }

  return (
    <div className={`bg-[#111111] border rounded-xl p-5 ${stale ? 'border-[#F59E0B]/25' : 'border-[#1a1a1a]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{c.name}</h3>
            {c.website && (
              <a
                href={externalHref(c.website)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#555555] hover:text-[#00D76B] transition-colors flex-shrink-0"
                aria-label="Site"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          <p className={`text-[10px] mt-1 ${stale ? 'text-[#F59E0B]' : 'text-[#555555]'}`}>
            Maj {formatDate(c.updated_at)}{stale && ' — à rafraîchir'}
          </p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setEditing(true)}
            aria-label="Modifier"
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={remove}
            disabled={isPending}
            aria-label="Supprimer"
            className="w-8 h-8 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Positionnement" value={c.positioning} />
        <Field label="Leurs méthodes" value={c.their_methods} />
        <Field label="Ce que je peux répliquer" value={c.replicate} accent />
      </div>
    </div>
  )
}

function Field({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-widest mb-1 ${accent ? 'text-[#00D76B]' : 'text-[#555555]'}`}>{label}</p>
      <p className="text-xs text-[#aaaaaa] leading-relaxed whitespace-pre-wrap">{value || <span className="text-[#444444] italic">—</span>}</p>
    </div>
  )
}

// ── Formulaire (create + edit) ──────────────────────────────────────────────

function CompetitorForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: CompetitorInput
  onCancel: () => void
  onSubmit: (input: CompetitorInput) => Promise<boolean>
}) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState(initial.name)
  const [website, setWebsite] = useState(initial.website ?? '')
  const [positioning, setPositioning] = useState(initial.positioning ?? '')
  const [theirMethods, setTheirMethods] = useState(initial.theirMethods ?? '')
  const [replicate, setReplicate] = useState(initial.replicate ?? '')

  function submit() {
    if (!name.trim()) return toast.error('Le nom est requis.')
    startTransition(async () => {
      await onSubmit({ name, website, positioning, theirMethods, replicate })
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Nom *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du concurrent" className={field} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Site</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="exemple.com" className={field} />
        </div>
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Positionnement</label>
        <textarea rows={2} value={positioning} onChange={(e) => setPositioning(e.target.value)} className={`${field} resize-none`} />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1">Leurs méthodes</label>
        <textarea rows={2} value={theirMethods} onChange={(e) => setTheirMethods(e.target.value)} className={`${field} resize-none`} />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-[#00D76B] mb-1">Ce que je peux répliquer</label>
        <textarea rows={2} value={replicate} onChange={(e) => setReplicate(e.target.value)} className={`${field} resize-none border-[#00D76B]/30`} />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Enregistrer
        </button>
        <button onClick={onCancel} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm text-[#888888] hover:text-white transition-colors">
          <X className="h-4 w-4" />
          Annuler
        </button>
      </div>
    </div>
  )
}
