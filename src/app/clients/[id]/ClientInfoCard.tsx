'use client'

import { useState, useTransition } from 'react'
import {
  Mail,
  Phone,
  Globe,
  Building2,
  User,
  StickyNote,
  Tag,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { updateClient } from '../actions'
import type { Client, ClientSource } from '@/lib/types'

const SOURCE_LABEL: Record<ClientSource, string> = {
  instagram:     'Instagram',
  linkedin:      'LinkedIn',
  word_of_mouth: 'Bouche-à-oreille',
  website:       'Site web',
  referral:      'Recommandation',
  cold_outreach: 'Démarchage',
  other:         'Autre',
}

interface ClientInfoCardProps {
  client: Client
}

type FieldKey =
  | 'company_name'
  | 'contact_name'
  | 'email'
  | 'phone'
  | 'website'
  | 'source'
  | 'notes'

export default function ClientInfoCard({ client: initialClient }: ClientInfoCardProps) {
  const [client, setClient] = useState(initialClient)
  const [editing, setEditing] = useState<FieldKey | null>(null)

  function commit(field: FieldKey, value: string | null) {
    // Optimistic update
    setClient((c) => ({ ...c, [field]: value } as Client))
    setEditing(null)
  }

  return (
    <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-6 space-y-4">
      <h2 className="text-xs font-semibold text-[#666666] uppercase tracking-widest">
        Informations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <EditableField
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Société"
          field="company_name"
          value={client.company_name}
          editing={editing === 'company_name'}
          onEdit={() => setEditing('company_name')}
          onCancel={() => setEditing(null)}
          onSave={(v) => commit('company_name', v || null)}
          clientId={client.id}
          placeholder="ex. Acme Corp"
        />

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
          clientId={client.id}
        />

        <EditableField
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Site web"
          field="website"
          value={client.website}
          editing={editing === 'website'}
          onEdit={() => setEditing('website')}
          onCancel={() => setEditing(null)}
          onSave={(v) => commit('website', v || null)}
          link={client.website || undefined}
          clientId={client.id}
        />

        <SelectField
          icon={<Tag className="h-3.5 w-3.5" />}
          label="Source"
          value={client.source}
          onChange={(v) => {
            setClient((c) => ({ ...c, source: v }))
          }}
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
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2.5 group">
      <p className="text-[10px] uppercase tracking-widest text-[#444444] font-medium mb-1 flex items-center gap-1.5">
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
              flex-1 bg-[#1a1a1a] border border-[#333333] rounded px-2 py-1
              text-sm text-white focus:outline-none focus:border-[#555555]
              disabled:opacity-50
            "
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="p-1 rounded text-[#22C55E] hover:bg-[#22C55E]/10 transition-colors"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              onCancel()
            }}
            disabled={isPending}
            className="p-1 rounded text-[#666666] hover:bg-[#222222] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
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
                className="text-sm text-white hover:text-[#00D76B] transition-colors truncate"
              >
                {value}
              </a>
            ) : (
              <p className="text-sm text-white truncate">{value}</p>
            )
          ) : (
            <p className="text-sm text-[#555555] italic">—</p>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              onEdit()
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-[#444444] hover:text-white hover:bg-[#222222]
            "
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── SelectField (source) ───────────────────────────────────────

function SelectField({
  icon,
  label,
  value,
  onChange,
  clientId,
}: {
  icon: React.ReactNode
  label: string
  value: ClientSource
  onChange: (v: ClientSource) => void
  clientId: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(v: ClientSource) {
    onChange(v)
    startTransition(async () => {
      const result = await updateClient(clientId, { source: v })
      if (!result.success) toast.error(result.error)
    })
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-widest text-[#444444] font-medium mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <select
        value={value}
        onChange={(e) => handleChange(e.target.value as ClientSource)}
        disabled={isPending}
        className="
          w-full bg-transparent text-sm text-white
          focus:outline-none cursor-pointer
          disabled:opacity-50
        "
      >
        {Object.entries(SOURCE_LABEL).map(([k, v]) => (
          <option key={k} value={k} className="bg-[#1a1a1a]">{v}</option>
        ))}
      </select>
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
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg p-4 group">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-[#444444] font-medium flex items-center gap-1.5">
          <StickyNote className="h-3.5 w-3.5" />
          Notes
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              setEditing(true)
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-[#444444] hover:text-white hover:bg-[#222222]
            "
          >
            <Pencil className="h-3 w-3" />
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
              w-full bg-[#1a1a1a] border border-[#333333] rounded px-2 py-1.5
              text-sm text-white placeholder-[#3a3a3a]
              focus:outline-none focus:border-[#555555] resize-none
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
              className="text-xs text-[#666666] hover:text-white transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="
                inline-flex items-center gap-1 px-3 py-1.5 rounded text-xs font-semibold
                bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors
                disabled:opacity-50
              "
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-[#a0a0a0] whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-[#555555] italic">Aucune note. Survolez pour ajouter.</p>
      )}
    </div>
  )
}
