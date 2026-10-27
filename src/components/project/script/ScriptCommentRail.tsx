'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, MessageSquare, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { formatRelative } from '@/lib/utils/dates'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import type { BlockComment } from '@/lib/hooks/useRealtimeBlockComments'
import type { EditorRow } from '@/lib/scriptTable'

const GAP = 10 // espace mini entre deux fils dans la colonne

export interface RowThread {
  row: EditorRow
  /** Aperçu de la ligne (narration en priorité). */
  title: string
  comments: BlockComment[]
}

interface ThreadProps {
  thread: RowThread
  active: boolean
  projectId: string
  phaseId: string
  subPhaseId: string
  onActivate: () => void
  onClose: () => void
}

/**
 * Un fil de commentaires d'une ligne du script. Replié, il montre les derniers
 * messages ; actif, il ajoute la zone de réponse (comme une bulle Google Docs).
 */
export function RowCommentThread({
  thread,
  active,
  projectId,
  phaseId,
  subPhaseId,
  onActivate,
  onClose,
}: ThreadProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const { row, title, comments } = thread
  const visible = active ? comments : comments.filter((c) => !c.is_resolved)

  async function submit() {
    if (!text.trim() || !row.id) return
    setSending(true)
    const result = await addComment({ projectId, phaseId, subPhaseId, blockId: row.id, content: text.trim() })
    setSending(false)
    if (!result.success) toast.error((result as { error: string }).error)
    else setText('')
  }

  async function resolve(commentId: string) {
    const result = await toggleResolveComment(commentId)
    if (!result.success) toast.error((result as { error: string }).error)
  }

  return (
    <div
      onClick={active ? undefined : onActivate}
      className={`rounded-xl border bg-surface transition-shadow ${
        active
          ? 'border-[#F59E0B]/50 shadow-[var(--e2)]'
          : 'cursor-pointer border-line shadow-[var(--e1)] hover:border-line-strong'
      }`}
    >
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <p className="min-w-0 flex-1 truncate text-[11px] text-faint" title={title}>
          {title}
        </p>
        {active && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            aria-label="Fermer le fil"
            className="-mr-1 -mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded text-faint hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="space-y-3 px-3 pb-3 pt-2">
        {visible.length === 0 && !active && (
          <p className="text-[12px] text-faint">Aucun commentaire ouvert.</p>
        )}
        {visible.map((c) => {
          const authorName = c.author?.full_name ?? 'Utilisateur'
          const initials = authorName
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()
          return (
            <div key={c.id} className={`flex gap-2.5 ${c.is_resolved ? 'opacity-45' : ''}`}>
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface-3">
                {c.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.author.avatar_url} alt={authorName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[9px] font-medium text-faint">{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-0.5 flex flex-wrap items-center gap-x-2">
                  <span className="text-[12px] font-medium text-ink">{authorName}</span>
                  <span className="text-[10.5px] text-faint">{formatRelative(c.created_at)}</span>
                  {c.is_resolved && <span className="text-[10.5px] text-brand-text">Résolu</span>}
                </div>
                <p className={`whitespace-pre-wrap text-[13px] leading-relaxed text-dim ${active ? '' : 'line-clamp-3'}`}>
                  {c.content}
                </p>
              </div>
              {!c.is_resolved && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    void resolve(c.id)
                  }}
                  className="mt-0.5 shrink-0 text-faint transition-colors hover:text-brand-text"
                  title="Marquer comme résolu"
                  aria-label="Marquer comme résolu"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )
        })}

        {active && (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  void submit()
                }
                if (e.key === 'Escape') onClose()
              }}
              placeholder={comments.length ? 'Répondre… (Ctrl+Entrée)' : 'Commenter cette ligne… (Ctrl+Entrée)'}
              rows={2}
              className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2.5 py-1 text-[12px] text-dim transition-colors hover:text-ink"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={!text.trim() || sending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand/20 bg-brand/10 px-2.5 py-1 text-[12px] font-medium text-brand-text transition-colors hover:bg-brand/20 disabled:opacity-40"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {comments.length ? 'Répondre' : 'Commenter'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface RailProps {
  /** Conteneur commun au script et à la colonne : les hauteurs s'y mesurent. */
  containerRef: React.RefObject<HTMLElement>
  threads: RowThread[]
  activeRowKey: string | null
  projectId: string
  phaseId: string
  subPhaseId: string
  onActivate: (rowKey: string) => void
  onClose: () => void
  /** Change quand la mise en page du script change (vue, lignes, filtres). */
  layoutKey: string
}

/**
 * Colonne de commentaires à droite du script, façon Google Docs : chaque fil
 * s'aligne sur sa ligne. Quand deux fils se chevauchent, ils se décalent ; le
 * fil actif garde sa place en face de sa ligne et pousse les autres.
 */
export default function ScriptCommentRail({
  containerRef,
  threads,
  activeRowKey,
  projectId,
  phaseId,
  subPhaseId,
  onActivate,
  onClose,
  layoutKey,
}: RailProps) {
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const [tops, setTops] = useState<Record<string, number>>({})
  const [height, setHeight] = useState(0)
  const [tick, setTick] = useState(0)

  // Re-mesure quand le script change de taille (saisie, fenêtre, polices).
  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setTick((t) => t + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    const base = container.getBoundingClientRect().top

    const items = threads
      .map((t) => {
        const anchor = container.querySelector<HTMLElement>(`[data-row-key="${CSS.escape(t.row._key)}"]`)
        const card = cardRefs.current.get(t.row._key)
        return {
          key: t.row._key,
          anchor: anchor ? anchor.getBoundingClientRect().top - base : null,
          h: card?.offsetHeight ?? 0,
        }
      })
      .filter((i): i is { key: string; anchor: number; h: number } => i.anchor !== null)
      .sort((a, b) => a.anchor - b.anchor)

    const next: Record<string, number> = {}
    const pivot = Math.max(0, items.findIndex((i) => i.key === activeRowKey))
    if (items.length) {
      next[items[pivot].key] = items[pivot].anchor
      // Après le pivot : on pousse vers le bas.
      for (let i = pivot + 1; i < items.length; i++) {
        const prev = items[i - 1]
        next[items[i].key] = Math.max(items[i].anchor, next[prev.key] + prev.h + GAP)
      }
      // Avant le pivot : on remonte, sans passer au-dessus du haut.
      for (let i = pivot - 1; i >= 0; i--) {
        const below = items[i + 1]
        next[items[i].key] = Math.max(0, Math.min(items[i].anchor, next[below.key] - items[i].h - GAP))
      }
    }
    const bottom = items.reduce((m, i) => Math.max(m, (next[i.key] ?? 0) + i.h), 0)

    setTops((prev) => {
      const same =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.entries(next).every(([k, v]) => Math.abs((prev[k] ?? -1) - v) < 0.5)
      return same ? prev : next
    })
    setHeight((h) => (Math.abs(h - bottom) < 0.5 ? h : bottom))
  }, [threads, activeRowKey, layoutKey, tick, containerRef])

  if (threads.length === 0) {
    return (
      <p className="flex items-start gap-2 pt-1 text-[12px] leading-relaxed text-faint">
        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Survole une ligne et clique sur la bulle pour la commenter.
      </p>
    )
  }

  return (
    <div className="relative" style={{ height }}>
      {threads.map((t) => {
        const top = tops[t.row._key]
        return (
          <div
            key={t.row._key}
            ref={(el) => {
              if (el) cardRefs.current.set(t.row._key, el)
              else cardRefs.current.delete(t.row._key)
            }}
            className="absolute inset-x-0 transition-[top] duration-200 ease-[var(--ease)]"
            style={{ top: top ?? 0, visibility: top === undefined ? 'hidden' : undefined, zIndex: t.row._key === activeRowKey ? 2 : 1 }}
          >
            <RowCommentThread
              thread={t}
              active={t.row._key === activeRowKey}
              projectId={projectId}
              phaseId={phaseId}
              subPhaseId={subPhaseId}
              onActivate={() => onActivate(t.row._key)}
              onClose={onClose}
            />
          </div>
        )
      })}
    </div>
  )
}
