'use client'

import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Link2,
  MessageCircle,
  MoveRight,
  Play,
  Trash2,
} from 'lucide-react'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import { arrangeBoardItems, deleteBoardItem, moveBoardItem, updateBoardItem } from '@/app/projects/board-actions'
import { useBoard, useBoardAction } from './BoardContext'
import type { BoardItemView } from '@/lib/board'

interface Props {
  item: BoardItemView
  /** Section courante (null = « À trier »). */
  sectionId: string | null
  /** Ordre des éléments de la section, pour monter / descendre. */
  siblingIds: string[]
  /** Nombre de commentaires sur l'élément. */
  commentCount?: number
  onComment?: () => void
  /** Ouvre l'image ou la vidéo dans la visionneuse plein écran. */
  onOpen?: () => void
  /**
   * Toute la carte se glisse (« À trier ») : le texte n'y est alors pas
   * éditable, pour ne pas confondre sélection et glisser. Sinon, une poignée.
   */
  dragWhole?: boolean
}

/** Type MIME du glisser-déposer d'un élément du Cadrage. */
export const BOARD_ITEM_MIME = 'application/x-mostra-board-item'

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function itemLabel(item: BoardItemView): string {
  const c = item.content
  if (item.kind === 'text') return str(c.text).split('\n')[0].slice(0, 60) || 'Bloc de texte'
  if (item.kind === 'link') return str(c.title) || hostOf(str(c.url))
  return str(c.caption) || str(c.file_name) || 'Fichier'
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Un élément du Cadrage. Son rendu suit sa nature (texte, image, vidéo, lien,
 * fichier), quelle que soit la section qui l'accueille : une note rangée
 * depuis « À trier » s'affiche toujours correctement.
 */
export default function BoardItemCard({
  item,
  sectionId,
  siblingIds,
  commentCount = 0,
  onComment,
  onOpen,
  dragWhole = false,
}: Props) {
  const { editable, canComment } = useBoard()
  const c = item.content
  const cardRef = useRef<HTMLDivElement>(null)

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.setData(BOARD_ITEM_MIME, item.id)
    e.dataTransfer.effectAllowed = 'move'
    if (cardRef.current) e.dataTransfer.setDragImage(cardRef.current, 16, 16)
  }

  const body = (() => {
    switch (item.kind) {
      case 'text':
        return <TextBody item={item} readOnly={dragWhole} />
      case 'image':
        return item.url ? (
          <figure>
            <button type="button" onClick={onOpen} className="block w-full overflow-hidden rounded-md bg-surface-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={str(c.caption) || str(c.file_name)} className="h-auto w-full object-cover" loading="lazy" draggable={false} />
            </button>
            <Caption item={item} readOnly={dragWhole} />
          </figure>
        ) : (
          <MissingFile name={str(c.file_name)} />
        )
      case 'video':
        return item.url ? (
          <figure>
            {/* Vignette : la lecture se fait dans la visionneuse, avec le lecteur de l'app. */}
            <button type="button" onClick={onOpen} className="relative block w-full overflow-hidden rounded-md bg-black" aria-label="Lire la vidéo">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video src={`${item.url}#t=0.1`} muted playsInline preload="metadata" className="pointer-events-none aspect-video w-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="rounded-full bg-black/55 p-3 transition-transform group-hover/item:scale-105">
                  <Play className="h-5 w-5 fill-white text-white" />
                </span>
              </span>
            </button>
            <Caption item={item} readOnly={dragWhole} />
          </figure>
        ) : (
          <MissingFile name={str(c.file_name)} />
        )
      case 'link':
        return (
          <a
            href={str(c.url)}
            target="_blank"
            rel="noopener noreferrer"
            className="group/link flex items-start gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-surface-2"
          >
            <Link2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-faint" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{itemLabel(item)}</span>
              <span className="block truncate text-[12px] text-faint">{hostOf(str(c.url))}</span>
              {str(c.note) && <span className="mt-1 block text-[12.5px] leading-relaxed text-dim">{str(c.note)}</span>}
            </span>
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-faint opacity-0 transition-opacity group-hover/link:opacity-100" />
          </a>
        )
      case 'file':
        return (
          <a
            href={item.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            download={str(c.file_name) || undefined}
            className="group/link flex items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-surface-2"
          >
            <FileText className="h-4 w-4 flex-shrink-0 text-faint" />
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{itemLabel(item)}</span>
            <Download className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
          </a>
        )
    }
  })()

  const showTools = editable || (canComment && onComment)

  return (
    <div
      ref={cardRef}
      className={`group/item relative ${editable && dragWhole ? 'cursor-grab active:cursor-grabbing' : ''}`}
      draggable={editable && dragWhole}
      onDragStart={editable && dragWhole ? onDragStart : undefined}
    >
      {body}
      {showTools && (
        <div className="absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-surface/95 p-0.5 opacity-0 shadow-sm ring-1 ring-line transition-opacity focus-within:opacity-100 group-hover/item:opacity-100">
          {editable && !dragWhole && (
            <span
              draggable
              onDragStart={onDragStart}
              title="Glisser vers une autre section"
              className="inline-flex h-7 w-6 cursor-grab items-center justify-center text-faint hover:text-ink active:cursor-grabbing"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
          )}
          {canComment && onComment && (
            <ToolButton label="Commenter" onClick={onComment}>
              <MessageCircle className="h-3.5 w-3.5" />
              {commentCount > 0 && <span className="tnum text-[10.5px]">{commentCount}</span>}
            </ToolButton>
          )}
          {editable && <AdminTools item={item} sectionId={sectionId} siblingIds={siblingIds} />}
        </div>
      )}
      {!showTools && commentCount > 0 && (
        <span className="absolute right-1 top-1 inline-flex items-center gap-1 rounded-md bg-surface/95 px-1.5 py-0.5 text-[10.5px] text-faint ring-1 ring-line">
          <MessageCircle className="h-3 w-3" />
          {commentCount}
        </span>
      )}
    </div>
  )
}

function TextBody({ item, readOnly }: { item: BoardItemView; readOnly: boolean }) {
  const { editable: canEdit } = useBoard()
  const editable = canEdit && !readOnly
  const { run } = useBoardAction()
  const saved = str(item.content.text)
  const [draft, setDraft] = useState(saved)

  if (!editable) {
    return saved ? (
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{saved}</p>
    ) : null
  }

  return (
    <AutoGrowTextarea
      value={draft}
      minRows={2}
      autoFocus={!saved}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== saved) void run(() => updateBoardItem(item.id, { text: draft }))
      }}
      placeholder="Écrire…"
      className="w-full rounded-md bg-transparent px-1 py-1 text-[14px] leading-relaxed text-ink outline-none transition-colors placeholder:text-faint focus:bg-surface-2"
    />
  )
}

function Caption({ item, readOnly }: { item: BoardItemView; readOnly: boolean }) {
  const { editable: canEdit } = useBoard()
  const editable = canEdit && !readOnly
  const { run } = useBoardAction()
  const saved = str(item.content.caption)
  const [draft, setDraft] = useState(saved)

  if (!editable) {
    return saved ? <figcaption className="mt-1.5 text-[12.5px] text-dim">{saved}</figcaption> : null
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== saved) void run(() => updateBoardItem(item.id, { caption: draft }))
      }}
      placeholder="Légende"
      className="mt-1.5 w-full rounded-sm bg-transparent px-1 py-0.5 text-[12.5px] text-dim outline-none placeholder:text-faint focus:bg-surface-2"
    />
  )
}

function MissingFile({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-4 text-[12.5px] text-faint">
      <FileText className="h-4 w-4" />
      <span className="truncate">{name || 'Fichier indisponible'}</span>
    </div>
  )
}

function AdminTools({ item, sectionId, siblingIds }: { item: BoardItemView; sectionId: string | null; siblingIds: string[] }) {
  const { projectId, sectionOptions } = useBoard()
  const { run, isPending } = useBoardAction()
  const [confirm, setConfirm] = useState(false)
  const idx = siblingIds.indexOf(item.id)

  function move(delta: number) {
    const next = [...siblingIds]
    const [moved] = next.splice(idx, 1)
    next.splice(idx + delta, 0, moved)
    void run(() => arrangeBoardItems(projectId, sectionId, next))
  }

  return (
    <>
      {sectionId && idx > 0 && (
        <ToolButton label="Monter" onClick={() => move(-1)} disabled={isPending}>
          <ArrowUp className="h-3.5 w-3.5" />
        </ToolButton>
      )}
      {sectionId && idx >= 0 && idx < siblingIds.length - 1 && (
        <ToolButton label="Descendre" onClick={() => move(1)} disabled={isPending}>
          <ArrowDown className="h-3.5 w-3.5" />
        </ToolButton>
      )}

      {/* Ranger dans une autre section (ou renvoyer dans « À trier »). */}
      <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-faint transition-colors hover:bg-surface-2 hover:text-ink" title="Ranger dans…">
        <MoveRight className="h-3.5 w-3.5" />
        <select
          aria-label="Ranger dans…"
          value=""
          disabled={isPending}
          onChange={(e) => {
            const target = e.target.value === '__inbox' ? null : e.target.value
            void run(() => moveBoardItem(item.id, target), 'Rangé ✓')
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          <option value="" disabled>
            Ranger dans…
          </option>
          {sectionOptions
            .filter((o) => o.id !== sectionId)
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          {sectionId && <option value="__inbox">À trier</option>}
        </select>
      </label>

      {confirm ? (
        <span className="inline-flex items-center gap-1 px-1">
          <button
            type="button"
            disabled={isPending}
            onClick={() => void run(() => deleteBoardItem(item.id))}
            className="text-[11px] font-medium text-late hover:opacity-80"
          >
            Supprimer
          </button>
          <button type="button" onClick={() => setConfirm(false)} className="text-[11px] text-dim hover:text-ink">
            Non
          </button>
        </span>
      ) : (
        <ToolButton label="Supprimer" onClick={() => setConfirm(true)} disabled={isPending}>
          <Trash2 className="h-3.5 w-3.5" />
        </ToolButton>
      )}
    </>
  )
}

export function ToolButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded px-1 text-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
    >
      {children}
    </button>
  )
}
