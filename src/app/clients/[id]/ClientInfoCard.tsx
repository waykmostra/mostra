'use client'

import { useState, useTransition } from 'react'
import {
  Mail,
  Phone,
  User,
  StickyNote,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { updateClient } from '../actions'
import type { Client } from '@/lib/types'

interface ClientInfoCardProps {
  client: Client
}

// Société (bloc dédié), site web (porté par la société), source et statut ne
// sont plus éditables ici : un contact = une personne et ses coordonnées.
type FieldKey = 'contact_name' | 'email' | 'phone' | 'notes'

export default function ClientInfoCard({ client: initialClient }: ClientInfoCardProps) {
  const [client, setClient] = useState(initialClient)
  const [editing, setEditing] = useState<FieldKey | null>(null)

  function commit(field: FieldKey, value: string | null) {
    // Optimistic update
    setClient((c) => ({ ...c, [field]: value } as Client))
    setEditing(null)
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <h2 className="text-xs font-semibold text-faint uppercase tracking-widest">
        Informations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EditableField
          icon={<User className="h-3.5 w-3.5" />}
          label="Contact"
          field="contact_name"
          value={client.contact_name}
          editing={editing === 'contact_name'}
          onEdit={() => setEditing('contact_name')}
          onCancel={() => setEditing(null)}
          onSave={(v) => commit('contact_name', v)}
          required
          clientId={client.id}
        />

        <EditableField
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Email"
          field="email"
          type="email"
          value={client.email}
          editing={editing === 'email'}
          onEdit={() => setEditing('email')}
          onCancel={() => setEditing(null)}
          onSave={(v) => commit('email', v || null)}
          link={client.email ? `mailto:${client.email}` : undefined}
          placeholder="Ajouter un email"
          clientId={client.id}
        />

        <EditableField
          icon={<Phone className="h-3.5 w-3.5" />}
          label="Téléphone"
          field="phone"
          value={client.phone}
          editing={editing === 'phone'}
          onEdit={() => setEditing('phone')}
          onCancel={() => setEditing(null)}
          onSave={(v) => commit('phone', v || null)}
          link={client.phone ? `tel:${client.phone}` : undefined}
          placeholder="Ajouter un numéro"
          clientId={client.id}
        />
      </div>

      {/* Notes (full width) */}
      <NotesField
        clientId={client.id}
        value={client.notes}
        onSave={(v) => commit('notes', v || null)}
      />
    </div>
  )
}

// ─── EditableField ──────────────────────────────────────────────

function EditableField({
  icon,
  label,
  field,
  value,
  type = 'text',
  link,
  required,
  placeholder,
  editing,
  onEdit,
  onCancel,
  onSave,
  clientId,
}: {
  icon: React.ReactNode
  label: string
  field: FieldKey
  value: string | null
  type?: 'text' | 'email'
  link?: string
  required?: boolean
  placeholder?: string
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSave: (v: string) => void
  clientId: string
}) {
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  function startEdit() {
    setDraft(value ?? '')
    onEdit()
  }

  function handleSave() {
    if (required && !draft.trim()) {
      toast.error(`${label} ne peut pas être vide.`)
      return
    }
    startTransition(async () => {
      const result = await updateClient(clientId, { [field]: draft.trim() || null })
      if (result.success) {
        onSave(draft.trim())
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-surface border border-line rounded-lg px-3 py-2.5 group">
      <p className="text-[10px] uppercase tracking-widest text-faint font-medium mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <input
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') onCancel()
            }}
            placeholder={placeholder}
            autoFocus
            disabled={isPending}
            className="
              min-w-0 flex-1 bg-surface-2 border border-line-strong rounded px-2 py-1.5
              text-base sm:text-sm text-ink focus:outline-none focus:border-[rgb(var(--c-text-faint))]
              disabled:opacity-50
            "
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            aria-label="Enregistrer"
            className="p-2 rounded text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              onCancel()
            }}
            disabled={isPending}
            aria-label="Annuler"
            className="p-2 rounded text-faint hover:bg-surface-3 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {value ? (
            link ? (
              <a
                href={link}
                target={link.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="text-sm text-ink hover:text-brand transition-colors truncate"
              >
                {value}
              </a>
            ) : (
              <button type="button" onClick={startEdit} className="min-w-0 flex-1 text-left text-sm text-ink truncate">
                {value}
              </button>
            )
          ) : (
            <button type="button" onClick={startEdit} className="min-w-0 flex-1 text-left text-sm text-faint italic">
              {placeholder ?? 'Ajouter'}
            </button>
          )}
          {/* Sans souris (mobile, tablette), pas de survol : le crayon reste visible. */}
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Modifier ${label.toLowerCase()}`}
            className="
              opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity
              -m-1 p-2 rounded text-faint hover:text-ink hover:bg-surface-3 flex-shrink-0
            "
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── NotesField ─────────────────────────────────────────────────

function NotesField({
  clientId,
  value,
  onSave,
}: {
  clientId: string
  value: string | null
  onSave: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  function startEdit() {
    setDraft(value ?? '')
    setEditing(true)
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateClient(clientId, { notes: draft.trim() || null })
      if (result.success) {
        onSave(draft.trim())
        setEditing(false)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-faint font-medium flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" />
          Notes
        </p>
        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            aria-label="Modifier les notes"
            className="
              opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity
              -m-1 p-2 rounded text-faint hover:text-ink hover:bg-surface-3
            "
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={4}
            autoFocus
            disabled={isPending}
            placeholder="Notes libres sur ce client…"
            className="
              w-full bg-surface-2 border border-line-strong rounded px-2 py-1.5
              text-base sm:text-sm text-ink placeholder-faint
              focus:outline-none focus:border-[rgb(var(--c-text-faint))] resize-none
              disabled:opacity-50
            "
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setDraft(value ?? '')
                setEditing(false)
              }}
              disabled={isPending}
              className="text-xs text-faint hover:text-ink transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="
                inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold
                bg-brand text-ink hover:bg-brand transition-colors
                disabled:opacity-50
              "
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      ) : value ? (
        <button type="button" onClick={startEdit} className="block w-full text-left text-sm text-dim whitespace-pre-wrap">
          {value}
        </button>
      ) : (
        <button type="button" onClick={startEdit} className="text-sm text-faint italic">
          Ajouter une note
        </button>
      )}
    </div>
  )
}
