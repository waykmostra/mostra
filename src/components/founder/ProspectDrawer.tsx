'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  X,
  ExternalLink,
  Mail,
  Phone,
  Building2,
  Loader2,
  Send,
  MessageSquare,
  Users,
  StickyNote,
  Phone as PhoneIcon,
  ArrowRight,
  Check,
  FolderOpen,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils/dates'
import { STAGE_META, STAGE_OPTIONS } from '@/components/founder/pipelineMeta'
import type {
  ClientInteraction,
  InteractionType,
  PipelineStage,
} from '@/lib/types'
import type { ClientDetailData } from '@/lib/supabase/queries'
import {
  getProspectDetail,
  updateProspectStage,
  setProspectFollowUp,
  convertProspectToClient,
} from '@/app/founder/prospection/actions'
import { addInteraction } from '@/app/clients/actions'

// ── Contexte global du panneau latéral ──────────────────────────────────────

interface DrawerContext {
  open: (clientId: string) => void
  close: () => void
  openId: string | null
}

const Ctx = createContext<DrawerContext>({
  open: () => {},
  close: () => {},
  openId: null,
})

export function useProspectDrawer(): DrawerContext {
  return useContext(Ctx)
}

export function ProspectDrawerProvider({ children }: { children: React.ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = useCallback((clientId: string) => setOpenId(clientId), [])
  const close = useCallback(() => setOpenId(null), [])

  return (
    <Ctx.Provider value={{ open, close, openId }}>
      {children}
      <ProspectDrawer openId={openId} onClose={close} />
    </Ctx.Provider>
  )
}

// ── Métadonnées interactions ────────────────────────────────────────────────

const INTERACTION_META: Record<InteractionType, { label: string; icon: typeof Send; color: string }> = {
  message_sent:     { label: 'Message envoyé', icon: Send,          color: '#3B82F6' },
  message_received: { label: 'Réponse reçue',  icon: MessageSquare, color: '#22C55E' },
  call:             { label: 'Appel',          icon: PhoneIcon,     color: '#A78BFA' },
  meeting:          { label: 'RDV',            icon: Users,         color: '#F59E0B' },
  note:             { label: 'Note',           icon: StickyNote,    color: '#6B7280' },
  email:            { label: 'Email',          icon: Mail,          color: '#00D76B' },
}

// ── Panneau latéral ─────────────────────────────────────────────────────────

function ProspectDrawer({ openId, onClose }: { openId: string | null; onClose: () => void }) {
  const router = useRouter()
  const [detail, setDetail] = useState<ClientDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [note, setNote] = useState('')
  const [date, setDate] = useState('')

  const refetch = useCallback(async (id: string) => {
    const data = await getProspectDetail(id)
    setDetail(data)
    setDate(data?.client.next_follow_up_on ?? '')
  }, [])

  useEffect(() => {
    if (!openId) {
      setDetail(null)
      setNote('')
      return
    }
    setLoading(true)
    getProspectDetail(openId)
      .then((data) => {
        setDetail(data)
        setDate(data?.client.next_follow_up_on ?? '')
      })
      .finally(() => setLoading(false))
  }, [openId])

  // Fermeture au clavier (Échap).
  useEffect(() => {
    if (!openId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, onClose])

  const client = detail?.client ?? null

  function changeStage(stage: PipelineStage) {
    if (!client) return
    startTransition(async () => {
      const res = await updateProspectStage(client.id, stage)
      if (!res.success) { toast.error(res.error); return }
      await refetch(client.id)
      router.refresh()
    })
  }

  function changeDate(value: string) {
    if (!client) return
    setDate(value)
    startTransition(async () => {
      const res = await setProspectFollowUp(client.id, value || null)
      if (!res.success) { toast.error(res.error); return }
      router.refresh()
    })
  }

  function addNote() {
    if (!client) return
    const content = note.trim()
    if (!content) return
    startTransition(async () => {
      const res = await addInteraction({ clientId: client.id, type: 'note', content })
      if (!res.success) { toast.error(res.error); return }
      setNote('')
      await refetch(client.id)
      router.refresh()
    })
  }

  function convert() {
    if (!client) return
    startTransition(async () => {
      const res = await convertProspectToClient(client.id)
      if (!res.success) { toast.error(res.error); return }
      toast.success('Prospect converti en client ✓')
      await refetch(client.id)
      router.refresh()
    })
  }

  const visible = openId !== null
  const displayName = client ? client.company_name || client.contact_name : ''
  const isClient = client?.status === 'active' || client?.pipeline_stage === 'signe'

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden={!visible}
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200
          ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Drawer */}
      <aside
        className={`fixed top-0 right-0 z-50 h-screen w-full max-w-md bg-[#0e0e0e] border-l border-[#2a2a2a]
          flex flex-col transition-transform duration-200 ease-out
          ${visible ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label="Détail du prospect"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#1e1e1e] flex-shrink-0">
          <span className="text-xs font-semibold uppercase tracking-widest text-[#555555]">
            {isClient ? 'Client' : 'Prospect'}
          </span>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-[#666666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-[#555555]" />
          </div>
        )}

        {!loading && !client && visible && (
          <div className="flex-1 flex items-center justify-center px-6">
            <p className="text-sm text-[#666666] text-center">Fiche introuvable.</p>
          </div>
        )}

        {!loading && client && (
          <div className="flex-1 overflow-y-auto">
            {/* Identité */}
            <div className="px-5 py-5 border-b border-[#1e1e1e]">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-[#00D76B]">
                    {displayName[0]?.toUpperCase() ?? '?'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-white truncate">{displayName}</h2>
                  {client.company_name && (
                    <p className="text-xs text-[#888888] truncate mt-0.5">{client.contact_name}</p>
                  )}
                  {client.pipeline_stage && (
                    <span
                      className="inline-flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        color: STAGE_META[client.pipeline_stage].color,
                        backgroundColor: `${STAGE_META[client.pipeline_stage].color}1a`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: STAGE_META[client.pipeline_stage].color }}
                      />
                      {STAGE_META[client.pipeline_stage].label}
                    </span>
                  )}
                </div>
              </div>

              {/* Coordonnées */}
              <div className="mt-4 space-y-1.5">
                {client.email && (
                  <a href={`mailto:${client.email}`} className="flex items-center gap-2 text-xs text-[#999999] hover:text-white transition-colors">
                    <Mail className="h-3.5 w-3.5 text-[#555555] flex-shrink-0" />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.phone && (
                  <a href={`tel:${client.phone}`} className="flex items-center gap-2 text-xs text-[#999999] hover:text-white transition-colors">
                    <Phone className="h-3.5 w-3.5 text-[#555555] flex-shrink-0" />
                    <span className="truncate">{client.phone}</span>
                  </a>
                )}
                {client.profile_url && (
                  <a
                    href={/^https?:\/\//i.test(client.profile_url) ? client.profile_url : `https://${client.profile_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-[#999999] hover:text-[#00D76B] transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-[#555555] flex-shrink-0" />
                    <span className="truncate">Profil externe</span>
                  </a>
                )}
                {client.notes && (
                  <p className="text-xs text-[#777777] leading-relaxed pt-1.5 whitespace-pre-wrap">{client.notes}</p>
                )}
              </div>
            </div>

            {/* Contrôles funnel */}
            <div className="px-5 py-4 border-b border-[#1e1e1e] space-y-3">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">Étape</label>
                <select
                  value={client.pipeline_stage ?? ''}
                  onChange={(e) => changeStage(e.target.value as PipelineStage)}
                  disabled={isPending}
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-2.5 py-2 text-sm text-white focus:outline-none focus:border-[#555555]"
                >
                  {!client.pipeline_stage && <option value="">— Hors funnel —</option>}
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#1a1a1a]">{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">Prochaine relance</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => changeDate(e.target.value)}
                  disabled={isPending}
                  className="w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-2.5 py-2 text-sm text-[#bbbbbb] focus:outline-none focus:border-[#555555] [color-scheme:dark]"
                />
              </div>

              {!isClient && (
                <button
                  onClick={convert}
                  disabled={isPending}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                    bg-[#00D76B]/10 border border-[#00D76B]/30 text-[#00D76B] hover:bg-[#00D76B]/20 transition-colors disabled:opacity-50"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Convertir en client
                </button>
              )}
            </div>

            {/* Projets liés */}
            {detail!.projects.length > 0 && (
              <div className="px-5 py-4 border-b border-[#1e1e1e]">
                <h3 className="text-[10px] uppercase tracking-widest text-[#555555] mb-2">Projets</h3>
                <div className="space-y-1.5">
                  {detail!.projects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center gap-2 text-xs text-[#aaaaaa] hover:text-white transition-colors"
                    >
                      <FolderOpen className="h-3.5 w-3.5 text-[#555555] flex-shrink-0" />
                      <span className="truncate">{p.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Ajout rapide de note */}
            <div className="px-5 py-4 border-b border-[#1e1e1e]">
              <h3 className="text-[10px] uppercase tracking-widest text-[#555555] mb-2">Ajouter une note</h3>
              <div className="flex items-start gap-2">
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      addNote()
                    }
                  }}
                  rows={2}
                  placeholder="Notes d'appel, besoins, contexte…"
                  className="flex-1 bg-[#1a1a1a] border border-[#333333] rounded-md px-2.5 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555] resize-none"
                />
                <button
                  onClick={addNote}
                  disabled={isPending || !note.trim()}
                  aria-label="Enregistrer la note"
                  className="mt-0.5 w-9 h-9 flex items-center justify-center rounded-md bg-[#1a1a1a] border border-[#333333] text-[#888888] hover:text-white hover:border-[#555555] transition-colors disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Historique */}
            <div className="px-5 py-4">
              <h3 className="text-[10px] uppercase tracking-widest text-[#555555] mb-3">Historique</h3>
              {detail!.interactions.length === 0 ? (
                <p className="text-xs text-[#555555] italic">Aucune interaction.</p>
              ) : (
                <ul className="space-y-3">
                  {detail!.interactions.map((it: ClientInteraction) => {
                    const meta = INTERACTION_META[it.type]
                    const Icon = meta.icon
                    return (
                      <li key={it.id} className="flex gap-2.5">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
                        >
                          <Icon className="h-3 w-3" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-[#aaaaaa]">{meta.label}</span>
                            <span className="text-[10px] text-[#555555]">{formatDate(it.occurred_at)}</span>
                          </div>
                          <p className="text-xs text-[#888888] mt-0.5 whitespace-pre-wrap break-words">{it.content}</p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* Footer — lien fiche complète */}
        {!loading && client && (
          <div className="px-5 py-3 border-t border-[#1e1e1e] flex-shrink-0">
            <Link
              href={`/clients/${client.id}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 text-xs text-[#888888] hover:text-white transition-colors"
            >
              Ouvrir la fiche complète
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </aside>
    </>
  )
}
