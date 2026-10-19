'use client'

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { Check, Loader2, Send, X } from 'lucide-react'
import { addComment, toggleResolveComment } from '@/app/projects/comment-actions'
import { useBoard, useBoardAction } from './BoardContext'
import { itemLabel } from './BoardItemCard'
import type { BoardItemView } from '@/lib/board'

interface Props {
  sectionId: string
  items: BoardItemView[]
  /** Élément visé par le prochain commentaire (null = la section entière). */
  targetItemId: string | null
  onClearTarget: () => void
  onClose: () => void
}

/** Fil de commentaires d'une section du Cadrage (et de ses éléments). */
export default function BoardComments({ sectionId, items, targetItemId, onClearTarget, onClose }: Props) {
  const { projectId, canComment, comments } = useBoard()
  const { run, isPending } = useBoardAction()
  const [draft, setDraft] = useState('')

  const thread = comments.filter((c) => c.board_section_id === sectionId)
  const itemById = new Map(items.map((i) => [i.id, i]))
  const target = targetItemId ? itemById.get(targetItemId) ?? null : null

  async function submit() {
    const content = draft.trim()
    if (!content) return
    const ok = await run(() =>
      addComment({
        projectId,
        boardSectionId: sectionId,
        boardItemId: targetItemId ?? undefined,
        content,
      }),
    )
    if (ok) {
      setDraft('')
      onClearTarget()
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="mono-label text-faint">Commentaires</p>
        <button type="button" onClick={onClose} aria-label="Fermer les commentaires" className="text-faint hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {thread.length === 0 ? (
        <p className="text-[12.5px] text-faint">Aucun commentaire pour l’instant.</p>
      ) : (
        <ul className="space-y-2.5">
          {thread.map((c) => {
            const on = c.board_item_id ? itemById.get(c.board_item_id) : null
            return (
              <li key={c.id} className={c.is_resolved ? 'opacity-55' : ''}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[12.5px] font-medium text-ink">
                    {c.author?.full_name ?? 'Utilisateur'}
                  </span>
                  <span className="text-[11px] text-faint">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}
                  </span>
                  {canComment && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => void run(() => toggleResolveComment(c.id))}
                      title={c.is_resolved ? 'Rouvrir' : 'Marquer comme traité'}
                      className="ml-auto text-faint transition-colors hover:text-brand-text disabled:opacity-40"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                {on && <p className="mt-0.5 truncate text-[11.5px] text-faint">sur « {itemLabel(on)} »</p>}
                <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-dim">{c.content}</p>
              </li>
            )
          })}
        </ul>
      )}

      {canComment && (
        <div className="mt-3">
          {target && (
            <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-faint">
              <span className="truncate">sur « {itemLabel(target)} »</span>
              <button type="button" onClick={onClearTarget} aria-label="Commenter la section entière" className="hover:text-ink">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit()
              }}
              rows={2}
              placeholder="Ajouter un commentaire…"
              className="field min-h-0 flex-1 resize-none text-[13px]"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={isPending || !draft.trim()}
              aria-label="Envoyer"
              className="btn-primary min-h-[36px] px-3"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
