'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Loader2, Check, Pencil, X, StickyNote, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import AutoGrowTextarea from '@/components/shared/AutoGrowTextarea'
import type { Note, NoteGroup } from '@/lib/types'
import {
  createGroup,
  renameGroup,
  recolorGroup,
  deleteGroup,
  createNote,
  updateNote,
  deleteNote,
} from './actions'

const GROUP_COLORS = ['#00D76B', '#3B82F6', '#A78BFA', '#F59E0B', '#EC4899', '#22C55E', '#EF4444', '#9CA3AF']

const field =
  'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

export default function NotesClient({ groups, notes }: { groups: NoteGroup[]; notes: Note[] }) {
  const router = useRouter()
  const refresh = () => router.refresh()

  const [selectedId, setSelectedId] = useState<string | null>(groups[0]?.id ?? null)
  const [pendingSelect, setPendingSelect] = useState<string | null>(null)
  const [creatingGroup, setCreatingGroup] = useState(false)

  // Garde une sélection valide au fil des créations / suppressions.
  useEffect(() => {
    if (groups.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (pendingSelect && groups.some((g) => g.id === pendingSelect)) {
      setSelectedId(pendingSelect)
      setPendingSelect(null)
      return
    }
    if (!selectedId || !groups.some((g) => g.id === selectedId)) {
      if (!pendingSelect) setSelectedId(groups[0].id)
    }
  }, [groups, selectedId, pendingSelect])

  const selected = groups.find((g) => g.id === selectedId) ?? null
  const groupNotes = useMemo(
    () => notes.filter((n) => n.group_id === selectedId),
    [notes, selectedId],
  )

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-white">Notes</h1>
        <p className="text-sm text-[#666666] mt-0.5">
          {notes.length} note{notes.length !== 1 ? 's' : ''} · {groups.length} groupe{groups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Groupes */}
      <div className="flex items-center gap-2 flex-wrap">
        {groups.map((g) => {
          const active = g.id === selectedId
          const count = notes.filter((n) => n.group_id === g.id).length
          return (
            <button
              key={g.id}
              onClick={() => setSelectedId(g.id)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors border"
              style={
                active
                  ? { color: g.color, backgroundColor: `${g.color}1a`, borderColor: `${g.color}55` }
                  : { color: '#888888', borderColor: '#1f1f1f' }
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: g.color }} />
              {g.name}
              <span className="text-[10px] opacity-70">{count}</span>
            </button>
          )
        })}

        <button
          onClick={() => setCreatingGroup((v) => !v)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border border-dashed border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#3a3a3a] transition-colors"
        >
          <FolderPlus className="h-3 w-3" />
          Groupe
        </button>
      </div>

      {creatingGroup && (
        <NewGroupForm
          onClose={() => setCreatingGroup(false)}
          onCreated={(id) => {
            setCreatingGroup(false)
            setPendingSelect(id)
            refresh()
          }}
        />
      )}

      {/* Contenu du groupe sélectionné */}
      {groups.length === 0 ? (
        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-10 flex flex-col items-center gap-3">
          <StickyNote className="h-8 w-8 text-[#2a2a2a]" />
          <p className="text-sm text-[#666666] text-center">
            Aucun groupe. Crée ton premier groupe (ex. « idée LinkedIn »).
          </p>
        </div>
      ) : selected ? (
        <div className="space-y-4">
          <GroupHeader group={selected} onChanged={refresh} />
          <Composer groupId={selected.id} color={selected.color} onCreated={refresh} />

          {groupNotes.length === 0 ? (
            <p className="text-sm text-[#555555] italic px-1">Aucune note dans ce groupe.</p>
          ) : (
            <div className="space-y-2.5">
              {groupNotes.map((note) => (
                <NoteCard key={note.id} note={note} onChanged={refresh} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── Création de groupe ────────────────────────────────────────────────────────

function NewGroupForm({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [color, setColor] = useState(GROUP_COLORS[0])

  function submit() {
    const clean = name.trim()
    if (!clean) return toast.error('Le nom du groupe est requis.')
    startTransition(async () => {
      const res = await createGroup(clean, color)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Groupe créé ✓')
      onCreated(res.groupId)
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        placeholder="Nom du groupe (ex. idée LinkedIn)"
        className={field}
      />
      <div className="flex items-center justify-between gap-3">
        <ColorPicker value={color} onChange={setColor} />
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">
            Annuler
          </button>
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

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      {GROUP_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          aria-label={`Couleur ${c}`}
          className="w-5 h-5 rounded-full transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            outline: value === c ? `2px solid ${c}` : 'none',
            outlineOffset: 2,
          }}
        />
      ))}
    </div>
  )
}

// ── En-tête + gestion du groupe ───────────────────────────────────────────────

function GroupHeader({ group, onChanged }: { group: NoteGroup; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(group.name)
  const [showColors, setShowColors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function saveName() {
    const clean = name.trim()
    if (!clean) return toast.error('Le nom du groupe est requis.')
    if (clean === group.name) { setEditing(false); return }
    startTransition(async () => {
      const res = await renameGroup(group.id, clean)
      if (!res.success) { toast.error(res.error); return }
      setEditing(false)
      onChanged()
    })
  }

  function pickColor(c: string) {
    setShowColors(false)
    startTransition(async () => {
      const res = await recolorGroup(group.id, c)
      if (!res.success) { toast.error(res.error); return }
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteGroup(group.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Groupe supprimé')
      onChanged()
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveName() }
                if (e.key === 'Escape') { setName(group.name); setEditing(false) }
              }}
              className={field}
            />
            <button onClick={saveName} disabled={isPending} className="w-8 h-8 flex items-center justify-center rounded-md text-[#00D76B] hover:bg-[#00D76B]/10">
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </button>
            <button onClick={() => { setName(group.name); setEditing(false) }} className="w-8 h-8 flex items-center justify-center rounded-md text-[#888888] hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowColors((v) => !v)}
            className="flex items-center gap-2 group"
            title="Changer la couleur"
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color }} />
            <h2 className="text-base font-semibold text-white">{group.name}</h2>
          </button>
        )}

        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => { setName(group.name); setEditing(true) }}
              aria-label="Renommer"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <span className="inline-flex items-center gap-1">
                <button onClick={remove} disabled={isPending} className="px-2 py-1 rounded text-[10px] font-medium bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20">
                  {isPending ? '…' : 'Supprimer'}
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded text-[10px] text-[#888888] hover:text-white">
                  Annuler
                </button>
              </span>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                aria-label="Supprimer le groupe"
                className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {showColors && !editing && (
        <div className="pl-1">
          <ColorPicker value={group.color} onChange={pickColor} />
        </div>
      )}
    </div>
  )
}

// ── Composer note ─────────────────────────────────────────────────────────────

function Composer({ groupId, color, onCreated }: { groupId: string; color: string; onCreated: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [content, setContent] = useState('')

  function submit() {
    const clean = content.trim()
    if (!clean) return toast.error('La note est vide.')
    startTransition(async () => {
      const res = await createNote(groupId, clean)
      if (!res.success) { toast.error(res.error); return }
      setContent('')
      onCreated()
    })
  }

  return (
    <div className="bg-[#0e0e0e] border border-[#1f1f1f] rounded-xl p-4 space-y-3">
      <AutoGrowTextarea
        value={content}
        minRows={2}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit()
        }}
        placeholder="Écris une note… (⌘/Ctrl + Entrée pour ajouter)"
        className={field}
      />
      <div className="flex justify-end">
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-black transition-colors disabled:opacity-50"
          style={{ backgroundColor: color }}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Ajouter
        </button>
      </div>
    </div>
  )
}

// ── Carte note ────────────────────────────────────────────────────────────────

function NoteCard({ note, onChanged }: { note: Note; onChanged: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.content)

  function save() {
    const clean = draft.trim()
    if (!clean) return toast.error('La note est vide.')
    if (clean === note.content) { setEditing(false); return }
    startTransition(async () => {
      const res = await updateNote(note.id, clean)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Modifié ✓')
      setEditing(false)
      onChanged()
    })
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteNote(note.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Note supprimée')
      onChanged()
    })
  }

  return (
    <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4 group">
      {editing ? (
        <div className="space-y-2">
          <AutoGrowTextarea
            value={draft}
            minRows={2}
            autoFocus
            focusEnd
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save()
              if (e.key === 'Escape') { setDraft(note.content); setEditing(false) }
            }}
            className={field}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Enregistrer
            </button>
            <button onClick={() => { setDraft(note.content); setEditing(false) }} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-[#888888] hover:text-white transition-colors">
              <X className="h-3.5 w-3.5" />
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-[#cccccc] leading-relaxed whitespace-pre-wrap flex-1 min-w-0">{note.content}</p>
          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => { setDraft(note.content); setEditing(true) }}
              aria-label="Modifier"
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#555555] hover:text-white hover:bg-[#1a1a1a] transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
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
      )}

      {!editing && <p className="text-[10px] text-[#444444] mt-2">{formatDate(note.created_at)}</p>}
    </div>
  )
}
