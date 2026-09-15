'use client'

import { useState, useTransition } from 'react'
import {
  Mail,
  Phone,
  Globe,
  User,
  Languages,
  Euro,
  StickyNote,
  Tag,
  Pencil,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { updateTeamMember } from '../actions'
import type { TeamMember } from '@/lib/types'

// Clés camelCase acceptées par updateTeamMember.
type TextKey = 'contactName' | 'email' | 'phone' | 'portfolioUrl' | 'languages'
type NumberKey = 'dailyRateEur' | 'projectRateEur'

interface Props {
  member: TeamMember
}

export default function TeamMemberInfoCard({ member: initial }: Props) {
  const [member, setMember] = useState(initial)

  return (
    <div className="bg-surface border border-line rounded-xl p-6 space-y-4">
      <h2 className="text-xs font-semibold text-faint uppercase tracking-widest">
        Informations
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TextField
          icon={<User className="h-3.5 w-3.5" />}
          label="Nom"
          inputKey="contactName"
          value={member.contact_name}
          required
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, contact_name: v ?? m.contact_name }))}
        />
        <TextField
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Email"
          inputKey="email"
          type="email"
          value={member.email}
          link={member.email ? `mailto:${member.email}` : undefined}
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, email: v }))}
        />
        <TextField
          icon={<Phone className="h-3.5 w-3.5" />}
          label="Téléphone"
          inputKey="phone"
          value={member.phone}
          link={member.phone ? `tel:${member.phone}` : undefined}
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, phone: v }))}
        />
        <TextField
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Portfolio / lien"
          inputKey="portfolioUrl"
          value={member.portfolio_url}
          link={member.portfolio_url || undefined}
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, portfolio_url: v }))}
        />
        <TextField
          icon={<Languages className="h-3.5 w-3.5" />}
          label="Langues"
          inputKey="languages"
          value={member.languages}
          placeholder="ex. FR, EN"
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, languages: v }))}
        />
        <NumberField
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Tarif / jour"
          inputKey="dailyRateEur"
          value={member.daily_rate_eur}
          suffix="€/j"
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, daily_rate_eur: v }))}
        />
        <NumberField
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Tarif / projet"
          inputKey="projectRateEur"
          value={member.project_rate_eur}
          suffix="€/projet"
          memberId={member.id}
          onSaved={(v) => setMember((m) => ({ ...m, project_rate_eur: v }))}
        />
      </div>

      {/* Tags */}
      <TagsField
        memberId={member.id}
        value={member.tags}
        onSaved={(v) => setMember((m) => ({ ...m, tags: v }))}
      />

      {/* Notes */}
      <NotesField
        memberId={member.id}
        value={member.notes}
        onSaved={(v) => setMember((m) => ({ ...m, notes: v }))}
      />
    </div>
  )
}

// ─── Champ texte éditable ───────────────────────────────────────

function TextField({
  icon,
  label,
  inputKey,
  value,
  type = 'text',
  link,
  required,
  placeholder,
  memberId,
  onSaved,
}: {
  icon: React.ReactNode
  label: string
  inputKey: TextKey
  value: string | null
  type?: 'text' | 'email'
  link?: string
  required?: boolean
  placeholder?: string
  memberId: string
  onSaved: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (required && !draft.trim()) {
      toast.error(`${label} ne peut pas être vide.`)
      return
    }
    const next = draft.trim() || null
    startTransition(async () => {
      const result = await updateTeamMember(memberId, { [inputKey]: next })
      if (result.success) {
        onSaved(next)
        setEditing(false)
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
              if (e.key === 'Escape') {
                setDraft(value ?? '')
                setEditing(false)
              }
            }}
            placeholder={placeholder}
            autoFocus
            disabled={isPending}
            className="
              flex-1 bg-surface-2 border border-line-strong rounded px-2 py-1
              text-sm text-ink focus:outline-none focus:border-[rgb(var(--c-text-faint))]
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
              setEditing(false)
            }}
            disabled={isPending}
            className="p-1 rounded text-faint hover:bg-surface-3 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {value ? (
            link ? (
              <a
                href={link.startsWith('http') || link.startsWith('mailto') || link.startsWith('tel') ? link : `https://${link}`}
                target={link.startsWith('http') ? '_blank' : undefined}
                rel="noreferrer"
                className="text-sm text-ink hover:text-brand transition-colors truncate"
              >
                {value}
              </a>
            ) : (
              <p className="text-sm text-ink truncate">{value}</p>
            )
          ) : (
            <p className="text-sm text-faint italic">—</p>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(value ?? '')
              setEditing(true)
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-faint hover:text-ink hover:bg-surface-3
            "
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Champ nombre (€) éditable ──────────────────────────────────

function NumberField({
  icon,
  label,
  inputKey,
  value,
  suffix,
  memberId,
  onSaved,
}: {
  icon: React.ReactNode
  label: string
  inputKey: NumberKey
  value: number | null
  suffix: string
  memberId: string
  onSaved: (v: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value === null ? '' : String(value))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const t = draft.trim()
    let next: number | null = null
    if (t !== '') {
      const n = Number(t)
      if (Number.isNaN(n) || n < 0) {
        toast.error('Entre un montant valide (≥ 0).')
        return
      }
      next = n
    }
    startTransition(async () => {
      const result = await updateTeamMember(memberId, { [inputKey]: next })
      if (result.success) {
        onSaved(next)
        setEditing(false)
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
            type="number"
            min={0}
            step="any"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setDraft(value === null ? '' : String(value))
                setEditing(false)
              }
            }}
            autoFocus
            disabled={isPending}
            className="
              flex-1 bg-surface-2 border border-line-strong rounded px-2 py-1
              text-sm text-ink focus:outline-none focus:border-[rgb(var(--c-text-faint))]
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
              setDraft(value === null ? '' : String(value))
              setEditing(false)
            }}
            disabled={isPending}
            className="p-1 rounded text-faint hover:bg-surface-3 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2">
          {value !== null ? (
            <p className="text-sm text-ink tabular-nums">
              {value.toLocaleString('fr-FR')} <span className="text-faint">{suffix}</span>
            </p>
          ) : (
            <p className="text-sm text-faint italic">—</p>
          )}
          <button
            type="button"
            onClick={() => {
              setDraft(value === null ? '' : String(value))
              setEditing(true)
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-faint hover:text-ink hover:bg-surface-3
            "
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tags ───────────────────────────────────────────────────────

function TagsField({
  memberId,
  value,
  onSaved,
}: {
  memberId: string
  value: string[] | null
  onSaved: (v: string[] | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState((value ?? []).join(', '))
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const list = draft
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const next = list.length > 0 ? Array.from(new Set(list)) : null
    startTransition(async () => {
      const result = await updateTeamMember(memberId, { tags: next })
      if (result.success) {
        onSaved(next)
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
          <Tag className="h-3.5 w-3.5" />
          Spécialités / tags
        </p>
        {!editing && (
          <button
            type="button"
            onClick={() => {
              setDraft((value ?? []).join(', '))
              setEditing(true)
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-faint hover:text-ink hover:bg-surface-3
            "
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave()
              if (e.key === 'Escape') {
                setDraft((value ?? []).join(', '))
                setEditing(false)
              }
            }}
            autoFocus
            disabled={isPending}
            placeholder="séparés par des virgules : 2D, After Effects, corporate"
            className="
              w-full bg-surface-2 border border-line-strong rounded px-2 py-1.5
              text-sm text-ink placeholder-faint
              focus:outline-none focus:border-[rgb(var(--c-text-faint))] disabled:opacity-50
            "
          />
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setDraft((value ?? []).join(', '))
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
                bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50
              "
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      ) : value && value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] text-dim bg-surface-3 border border-line"
            >
              {t}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-faint italic">Aucun tag. Survolez pour ajouter.</p>
      )}
    </div>
  )
}

// ─── Notes ──────────────────────────────────────────────────────

function NotesField({
  memberId,
  value,
  onSaved,
}: {
  memberId: string
  value: string | null
  onSaved: (v: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const next = draft.trim() || null
    startTransition(async () => {
      const result = await updateTeamMember(memberId, { notes: next })
      if (result.success) {
        onSaved(next)
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
            onClick={() => {
              setDraft(value ?? '')
              setEditing(true)
            }}
            className="
              opacity-0 group-hover:opacity-100 transition-opacity
              p-1 rounded text-faint hover:text-ink hover:bg-surface-3
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
            placeholder="Notes libres sur cet intervenant…"
            className="
              w-full bg-surface-2 border border-line-strong rounded px-2 py-1.5
              text-sm text-ink placeholder-faint
              focus:outline-none focus:border-[rgb(var(--c-text-faint))] resize-none disabled:opacity-50
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
                bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50
              "
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </div>
      ) : value ? (
        <p className="text-sm text-dim whitespace-pre-wrap">{value}</p>
      ) : (
        <p className="text-sm text-faint italic">Aucune note. Survolez pour ajouter.</p>
      )}
    </div>
  )
}
