'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Check, Pencil, X, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import type { ContentIdea, ContentPlatform, ContentStatus } from '@/lib/types'
import { createIdea, updateIdeaStatus, updateIdeaContent, deleteIdea } from './actions'

const PLATFORM_META: Record<ContentPlatform, { label: string; color: string }> = {
  linkedin:  { label: 'LinkedIn',  color: '#3B82F6' },
  instagram: { label: 'Instagram', color: '#EC4899' },
  x:         { label: 'X',         color: '#9CA3AF' },
}

const STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  idea:        { label: 'Idée',     color: '#6B7280' },
  in_progress: { label: 'En cours', color: '#F59E0B' },
  published:   { label: 'Publié',   color: '#22C55E' },
}

const PLATFORMS: ContentPlatform[] = ['linkedin', 'instagram', 'x']
const STATUS_ORDER: ContentStatus[] = ['idea', 'in_progress', 'published']

function nextStatus(s: ContentStatus): ContentStatus {
  const i = STATUS_ORDER.indexOf(s)
  return STATUS_ORDER[(i + 1) % STATUS_ORDER.length]
}

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

export default function IdeasClient({ ideas }: { ideas: ContentIdea[] }) {
  const router = useRouter()
  const [filter, setFilter] = useState<ContentPlatform | 'all'>('all')

  const filtered = useMemo(
    () => (filter === 'all' ? ideas : ideas.filter((i) => i.platform === filter)),
    [ideas, filter],
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Inbox idées</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          {ideas.length} idée{ideas.length !== 1 ? 's' : ''} de contenu
        </p>
      </div>

      <Composer onCreated={() => router.refresh()} />

      {/* Filtre plateforme */}
      <div className="flex items-center gap-2 flex-wrap">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Tout" count={ideas.length} />
        {PLATFORMS.map((p) => (
          <FilterChip
            key={p}
            active={filter === p}
            onClick={() => setFilter(p)}
            label={PLATFORM_META[p].label}
            color={PLATFORM_META[p].color}
            count={ideas.filter((i) => i.platform === p).length}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <Lightbulb className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666]">Aucune idée ici. Note la première.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((idea) => (
            <IdeaCard key={idea.id} idea={idea} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Composer ────────────────────────────────────────────────────────────────

function Composer({ onCreated }: { onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState('')
  const [platform, setPlatform] = useState<ContentPlatform>('linkedin')

  function submit() {
    const clean = content.trim()
    if (!clean) return toast.error('Le contenu est requis.')
    startTransition(async () => {
      const res = await createIdea(clean, platform)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Idée ajoutée ✓')
      setContent('')
      onCreated()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <textarea
        rows={2}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
        }}
        placeholder="Une idée de post, un angle, un hook…"
        className={`${field} resize-none`}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {PLATFORMS.map((p) => {
            const active = platform === p
            const meta = PLATFORM_META[p]
            return (
              <button
                key={p}
                onClick={() => setPlatform(p)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors border"
                style={
                  active
                    ? { color: meta.color, backgroundColor: `${meta.color}1a`, borderColor: `${meta.color}55` }
                    : { color: '#666666', borderColor: '#262626' }
                }
              >
                {meta.label}
              </button>
            )
          })}
        </div>
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </div>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  color,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  color?: string
}) {
  const c = color ?? '#cccccc'
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border"
      style={
        active
          ? { color: c, backgroundColor: `${c}1a`, borderColor: `${c}55` }
          : { color: '#666666', borderColor: '#1f1f1f' }
      }
    >
      {label}
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  )
}

// ── Carte idée ──────────────────────────────────────────────────────────────

function IdeaCard({ idea, onChanged }: { idea: ContentIdea; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(idea.content)
  const platform = PLATFORM_META[idea.platform]
  const status = STATUS_META[idea.status]

  function cycleStatus() {
    const ns = nextStatus(idea.status)
    startTransition(async () => {
      const res = await updateIdeaStatus(idea.id, ns)
      if (!res.success) { toast.error(res.error); return }
      onChanged()
    })
  }

  function saveContent() {
    const clean = draft.trim()
    if (!clean) return toast.error('Le contenu est requis.')
    if (clean === idea.content) {
      setEditing(false)
      return
    }
    startTransition(async () => {
      const res = await updateIdeaContent(idea.id, clean)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Modifié ✓')
      setEditing(false)
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteIdea(idea.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Idée supprimée')
      onChanged()
    })
  }

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ color: platform.color, backgroundColor: `${platform.color}1a` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: platform.color }} />
            {platform.label}
          </span>
          <button
            onClick={cycleStatus}
            disabled={isPending}
            title="Changer le statut"
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
            style={{ color: status.color, backgroundColor: `${status.color}1a` }}
          >
            {status.label}
          </button>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {!editing && (
            <button
              onClick={() => {
                setDraft(idea.content)
                setEditing(true)
              }}
              aria-label="Modifier"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={remove}
            disabled={isPending}
            aria-label="Supprimer"
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={3}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') saveContent()
            }}
            className={`${field} resize-none`}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={saveContent}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
            <button
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#cccccc] leading-relaxed whitespace-pre-wrap">{idea.content}</p>
      )}

      <p className="text-[10px] text-[#444444] mt-2">{formatDate(idea.created_at)}</p>
    </div>
  )
}
