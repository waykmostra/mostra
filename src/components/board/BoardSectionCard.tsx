'use client'

import { useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FolderOpen,
  ImageIcon,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  Trash2,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import ImageLightbox from '@/components/shared/ImageLightbox'
import {
  addBoardLink,
  addBoardText,
  arrangeBoardSections,
  deleteBoardSection,
  updateBoardSection,
  uploadBoardFile,
} from '@/app/projects/board-actions'
import BoardItemCard, { ToolButton } from './BoardItemCard'
import BoardComments from './BoardComments'
import { useBoard, useBoardAction } from './BoardContext'
import type { BoardSectionView } from '@/lib/board'
import type { BoardSectionType } from '@/lib/types'

export const SECTION_META: Record<BoardSectionType, { label: string; icon: LucideIcon; empty: string }> = {
  text: { label: 'Texte', icon: Type, empty: 'Aucun bloc de texte.' },
  media: { label: 'Images et vidéos', icon: ImageIcon, empty: 'Aucune image ni vidéo.' },
  documents: { label: 'Documents', icon: FolderOpen, empty: 'Aucun lien ni document.' },
}

interface Props {
  section: BoardSectionView
  /** Ordre des sections de la colonne. */
  columnSectionIds: string[]
  /** Colonnes voisines, pour déplacer la section (admin). */
  prevColumn: { id: string; sectionIds: string[] } | null
  nextColumn: { id: string; sectionIds: string[] } | null
  columnId: string
}

export default function BoardSectionCard({ section, columnSectionIds, prevColumn, nextColumn, columnId }: Props) {
  const { editable, canComment, comments } = useBoard()
  const { run, isPending } = useBoardAction()
  const meta = SECTION_META[section.type]
  const Icon = meta.icon

  const [title, setTitle] = useState(section.title ?? '')
  const [threadOpen, setThreadOpen] = useState(false)
  const [targetItemId, setTargetItemId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [lightbox, setLightbox] = useState<number | null>(null)

  // Hauteur pendant un redimensionnement (aperçu local avant enregistrement).
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const cardRef = useRef<HTMLElement>(null)
  const height = dragHeight ?? section.height

  const thread = comments.filter((c) => c.board_section_id === section.id)
  const openCount = thread.filter((c) => !c.is_resolved).length
  const itemIds = section.items.map((i) => i.id)
  const images = section.items.filter((i) => i.kind === 'image' && i.url)
  const idx = columnSectionIds.indexOf(section.id)

  function moveWithin(delta: number) {
    const next = [...columnSectionIds]
    const [moved] = next.splice(idx, 1)
    next.splice(idx + delta, 0, moved)
    void run(() => arrangeBoardSections(columnId, next))
  }

  function moveTo(column: { id: string; sectionIds: string[] }) {
    void run(() => arrangeBoardSections(column.id, [...column.sectionIds, section.id]))
  }

  function startResize(e: React.PointerEvent) {
    const el = cardRef.current
    if (!el) return
    e.preventDefault()
    const startY = e.clientY
    const startH = el.getBoundingClientRect().height
    let current = startH

    const onMove = (ev: PointerEvent) => {
      current = Math.min(2000, Math.max(80, startH + ev.clientY - startY))
      setDragHeight(current)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      void run(() => updateBoardSection(section.id, { height: Math.round(current) })).then(() => setDragHeight(null))
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const commentFor = (itemId: string) => () => {
    setTargetItemId(itemId)
    setThreadOpen(true)
  }
  const countFor = (itemId: string) => thread.filter((c) => c.board_item_id === itemId && !c.is_resolved).length

  return (
    <section
      ref={cardRef}
      className="surface group relative flex flex-col p-4"
      style={height ? { height } : undefined}
    >
      {/* En-tête */}
      <header className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 flex-shrink-0 text-faint" strokeWidth={1.75} />
        {editable ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() !== (section.title ?? '')) void run(() => updateBoardSection(section.id, { title }))
            }}
            placeholder={meta.label}
            className="min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 font-display text-[15px] text-ink outline-none placeholder:text-faint focus:bg-surface-2"
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-[15px] text-ink">{section.title || meta.label}</h3>
        )}

        {(canComment || thread.length > 0) && (
          <button
            type="button"
            onClick={() => setThreadOpen((o) => !o)}
            title="Commentaires"
            className={`inline-flex h-7 items-center gap-1 rounded px-1.5 text-[11.5px] transition-colors hover:bg-surface-2 ${
              openCount > 0 ? 'text-brand-text' : 'text-faint hover:text-ink'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            {thread.length > 0 && <span className="tnum">{openCount || thread.length}</span>}
          </button>
        )}

        {editable && (
          <div className="flex items-center">
            {idx > 0 && (
              <ToolButton label="Monter la section" onClick={() => moveWithin(-1)} disabled={isPending}>
                <ArrowUp className="h-3.5 w-3.5" />
              </ToolButton>
            )}
            {idx < columnSectionIds.length - 1 && (
              <ToolButton label="Descendre la section" onClick={() => moveWithin(1)} disabled={isPending}>
                <ArrowDown className="h-3.5 w-3.5" />
              </ToolButton>
            )}
            {prevColumn && (
              <ToolButton label="Vers la colonne de gauche" onClick={() => moveTo(prevColumn)} disabled={isPending}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </ToolButton>
            )}
            {nextColumn && (
              <ToolButton label="Vers la colonne de droite" onClick={() => moveTo(nextColumn)} disabled={isPending}>
                <ArrowRight className="h-3.5 w-3.5" />
              </ToolButton>
            )}
            {confirmDelete ? (
              <span className="inline-flex items-center gap-1 pl-1">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => void run(() => deleteBoardSection(section.id), 'Section supprimée, contenu renvoyé dans « À trier »')}
                  className="text-[11px] font-medium text-late hover:opacity-80"
                >
                  Supprimer
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-[11px] text-dim hover:text-ink">
                  Non
                </button>
              </span>
            ) : (
              <ToolButton label="Supprimer la section (son contenu part dans « À trier »)" onClick={() => setConfirmDelete(true)} disabled={isPending}>
                <Trash2 className="h-3.5 w-3.5" />
              </ToolButton>
            )}
          </div>
        )}
      </header>

      {/* Contenu — défile si l'admin a fixé une hauteur. */}
      <div className={`min-h-0 flex-1 ${height ? 'overflow-y-auto pr-1' : ''}`}>
        {section.items.length === 0 && !editable && <p className="text-[13px] text-faint">{meta.empty}</p>}

        {section.type === 'media' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
            {section.items.map((item) => (
              <BoardItemCard
                key={item.id}
                item={item}
                sectionId={section.id}
                siblingIds={itemIds}
                commentCount={countFor(item.id)}
                onComment={commentFor(item.id)}
                onOpenImage={() => setLightbox(images.findIndex((i) => i.id === item.id))}
              />
            ))}
          </div>
        ) : (
          // Section texte : des blocs séparés par un filet, comme des paragraphes.
          <div className={section.type === 'text' ? 'divide-y divide-line' : 'space-y-1'}>
            {section.items.map((item) => (
              <div key={item.id} className={section.type === 'text' ? 'py-2.5 first:pt-0 last:pb-0' : undefined}>
                <BoardItemCard
                  item={item}
                  sectionId={section.id}
                  siblingIds={itemIds}
                  commentCount={countFor(item.id)}
                  onComment={commentFor(item.id)}
                  onOpenImage={() => setLightbox(images.findIndex((i) => i.id === item.id))}
                />
              </div>
            ))}
          </div>
        )}

        {editable && <AddControls section={section} />}

        {threadOpen && (
          <BoardComments
            sectionId={section.id}
            items={section.items}
            targetItemId={targetItemId}
            onClearTarget={() => setTargetItemId(null)}
            onClose={() => {
              setThreadOpen(false)
              setTargetItemId(null)
            }}
          />
        )}
      </div>

      {/* Poignée de hauteur — double-clic : la section suit à nouveau son contenu. */}
      {editable && (
        <div
          role="separator"
          aria-orientation="horizontal"
          title="Glisser pour régler la hauteur — double-clic pour revenir à la hauteur auto"
          onPointerDown={startResize}
          onDoubleClick={() => void run(() => updateBoardSection(section.id, { height: null }))}
          className="absolute inset-x-6 -bottom-1 hidden h-2 cursor-ns-resize items-center justify-center lg:flex"
        >
          <span className="h-1 w-10 rounded-full bg-line-strong opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100" />
        </div>
      )}

      {lightbox !== null && lightbox >= 0 && (
        <ImageLightbox
          images={images.map((i) => ({ src: i.url ?? '', title: typeof i.content.caption === 'string' ? i.content.caption : undefined }))}
          currentIndex={lightbox}
          onClose={() => setLightbox(null)}
          onPrev={() => setLightbox((i) => (i !== null && i > 0 ? i - 1 : i))}
          onNext={() => setLightbox((i) => (i !== null && i < images.length - 1 ? i + 1 : i))}
        />
      )}
    </section>
  )
}

/** Le « + » de chaque section : ce qu'on y ajoute dépend de son type. */
function AddControls({ section }: { section: BoardSectionView }) {
  const { projectId } = useBoard()
  const { run, isPending } = useBoardAction()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return
    const list = Array.from(files)
    setUploading(list.length)
    for (const file of list) {
      const fd = new FormData()
      fd.set('projectId', projectId)
      fd.set('sectionId', section.id)
      fd.set('file', file)
      const ok = await run(() => uploadBoardFile(fd))
      if (!ok) toast.error(`« ${file.name} » n’a pas pu être ajouté`)
      setUploading((n) => n - 1)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function addLink() {
    const ok = await run(() => addBoardLink(projectId, section.id, { url, title: linkTitle }))
    if (ok) {
      setUrl('')
      setLinkTitle('')
      setLinkOpen(false)
    }
  }

  const accept = section.type === 'media' ? 'image/*,video/*' : undefined
  const busy = isPending || uploading > 0

  return (
    <div className="mt-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => void upload(e.target.files)}
      />

      {linkOpen && (
        <div className="mb-2 space-y-1.5">
          <input
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addLink()
              if (e.key === 'Escape') setLinkOpen(false)
            }}
            placeholder="https://…"
            className="field h-9 text-[13px]"
          />
          <div className="flex gap-1.5">
            <input
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void addLink()
              }}
              placeholder="Titre (facultatif)"
              className="field h-9 flex-1 text-[13px]"
            />
            <button type="button" onClick={() => void addLink()} disabled={busy || !url.trim()} className="btn-primary min-h-[36px] px-3 text-[12.5px]">
              Ajouter
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1">
        {section.type === 'text' && (
          <AddButton onClick={() => void run(() => addBoardText(projectId, section.id, ''))} disabled={busy}>
            <Plus className="h-3.5 w-3.5" /> Bloc de texte
          </AddButton>
        )}
        {section.type === 'media' && (
          <AddButton onClick={() => fileRef.current?.click()} disabled={busy}>
            <Plus className="h-3.5 w-3.5" /> Image ou vidéo
          </AddButton>
        )}
        {section.type === 'documents' && (
          <>
            <AddButton onClick={() => setLinkOpen((o) => !o)} disabled={busy}>
              <Link2 className="h-3.5 w-3.5" /> Lien
            </AddButton>
            <AddButton onClick={() => fileRef.current?.click()} disabled={busy}>
              <Paperclip className="h-3.5 w-3.5" /> Fichier
            </AddButton>
          </>
        )}
        {uploading > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-faint">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Envoi… ({uploading})
          </span>
        )}
      </div>
    </div>
  )
}

function AddButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1.5 text-[12.5px] text-dim transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      {children}
    </button>
  )
}
