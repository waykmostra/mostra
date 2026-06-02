'use client'

import { useState, useTransition } from 'react'
import {
  MessageSquare,
  MessageCircle,
  Phone,
  Users,
  StickyNote,
  Mail,
  Plus,
  Loader2,
  Trash2,
  Send,
  ArrowDownLeft,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { addInteraction, deleteInteraction } from '../actions'
import type { ClientInteraction, InteractionType } from '@/lib/types'

const TYPE_META: Record<InteractionType, { label: string; icon: LucideIcon; color: string }> = {
  message_sent:     { label: 'Message envoyé',  icon: Send,          color: '#3B82F6' },
  message_received: { label: 'Message reçu',    icon: ArrowDownLeft, color: '#22C55E' },
  email:            { label: 'Email',           icon: Mail,          color: '#A78BFA' },
  call:             { label: 'Appel',           icon: Phone,         color: '#F59E0B' },
  meeting:          { label: 'Réunion',         icon: Users,         color: '#EC4899' },
  note:             { label: 'Note',            icon: StickyNote,    color: '#94A3B8' },
}

interface InteractionsTimelineProps {
  clientId: string
  initialInteractions: ClientInteraction[]
}

export default function InteractionsTimeline({
  clientId,
  initialInteractions,
}: InteractionsTimelineProps) {
  const [interactions, setInteractions] = useState(initialInteractions)
  const [showForm, setShowForm] = useState(false)

  function handleAdded(newOne: ClientInteraction) {
    setInteractions((prev) => [newOne, ...prev])
    setShowForm(false)
  }

  function handleDeleted(id: string) {
    setInteractions((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-white">
          Interactions
          <span className="ml-2 text-[#555555] font-normal">{interactions.length}</span>
        </h2>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222]
              transition-colors
            "
          >
            <Plus className="h-3.5 w-3.5" />
            Ajouter
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="mb-3">
          <AddForm
            clientId={clientId}
            onAdded={handleAdded}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {/* Timeline */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
        {interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <MessageSquare className="h-8 w-8 text-[#2a2a2a]" />
            <p className="text-sm text-[#444444]">Aucune interaction. Ajoutez la première.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1a1a1a]">
            {interactions.map((i) => (
              <InteractionRow key={i.id} interaction={i} onDeleted={handleDeleted} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── AddForm ────────────────────────────────────────────────────

function AddForm({
  clientId,
  onAdded,
  onCancel,
}: {
  clientId: string
  onAdded: (i: ClientInteraction) => void
  onCancel: () => void
}) {
  const [type, setType] = useState<InteractionType>('message_sent')
  const [content, setContent] = useState('')
  const [channel, setChannel] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Le contenu est requis.')
      return
    }
    startTransition(async () => {
      const result = await addInteraction({
        clientId,
        type,
        content: content.trim(),
        channel: channel.trim() || undefined,
      })
      if (result.success) {
        toast.success('Interaction ajoutée.')
        onAdded({
          id: result.interactionId,
          client_id: clientId,
          type,
          content: content.trim(),
          channel: channel.trim() || null,
          occurred_at: new Date().toISOString(),
          created_by: null,
          created_at: new Date().toISOString(),
        })
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-4 space-y-3"
    >
      {/* Type selector */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#444444] font-medium mb-2">
          Type
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {(Object.entries(TYPE_META) as [InteractionType, typeof TYPE_META[InteractionType]][]).map(
            ([k, meta]) => {
              const Icon = meta.icon
              const active = type === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  className={`
                    flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-[10px] font-medium border
                    transition-colors
                    ${active
                      ? 'border-[#333333] bg-[#1a1a1a] text-white'
                      : 'border-[#1e1e1e] bg-[#0d0d0d] text-[#666666] hover:text-white'}
                  `}
                  style={active ? { borderColor: `${meta.color}80` } : undefined}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                  {meta.label}
                </button>
              )
            },
          )}
        </div>
      </div>

      {/* Content */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Détails de l'échange…"
        rows={3}
        autoFocus
        disabled={isPending}
        className="
          w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2
          text-sm text-white placeholder-[#3a3a3a] resize-none
          focus:outline-none focus:border-[#333333]
          disabled:opacity-50
        "
      />

      {/* Channel (optionnel) */}
      <input
        type="text"
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        placeholder="Canal (ex. WhatsApp, Instagram DM, en personne…)"
        disabled={isPending}
        className="
          w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-lg px-3 py-2
          text-xs text-white placeholder-[#3a3a3a]
          focus:outline-none focus:border-[#333333]
          disabled:opacity-50
        "
      />

      <div className="flex items-center gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-xs text-[#666666] hover:text-white transition-colors"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isPending || !content.trim()}
          className="
            inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
            bg-[#00D76B] text-white hover:bg-[#00C061] transition-colors
            disabled:opacity-50
          "
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Ajouter
        </button>
      </div>
    </form>
  )
}

// ─── InteractionRow ─────────────────────────────────────────────

function InteractionRow({
  interaction,
  onDeleted,
}: {
  interaction: ClientInteraction
  onDeleted: (id: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const meta = TYPE_META[interaction.type]
  const Icon = meta.icon

  function handleDelete() {
    if (!confirm('Supprimer cette interaction ?')) return
    startTransition(async () => {
      const result = await deleteInteraction(interaction.id)
      if (result.success) {
        onDeleted(interaction.id)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="px-5 py-3.5 flex items-start gap-3 group hover:bg-[#161616] transition-colors">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}30` }}
      >
        <Icon className="h-4 w-4" style={{ color: meta.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white">{meta.label}</span>
          {interaction.channel && (
            <span className="text-[10px] text-[#666666]">· {interaction.channel}</span>
          )}
          <span className="text-[10px] text-[#444444] ml-auto">
            {formatDate(interaction.occurred_at)}
          </span>
        </div>
        <p className="text-sm text-[#a0a0a0] mt-1 whitespace-pre-wrap break-words">
          {interaction.content}
        </p>
      </div>

      <button
        type="button"
        onClick={handleDelete}
        disabled={isPending}
        className="
          opacity-0 group-hover:opacity-100 transition-opacity
          p-1.5 rounded text-[#444444] hover:text-[#EF4444] hover:bg-[#EF4444]/10
          flex-shrink-0
        "
        title="Supprimer"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  )
}
