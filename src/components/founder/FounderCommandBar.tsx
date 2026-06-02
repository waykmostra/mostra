'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, Loader2, X, CornerDownLeft } from 'lucide-react'
import { toast } from 'sonner'
import { STAGE_META, PROSPECTION_STAGES, PIPELINE_STAGES } from '@/components/founder/pipelineMeta'
import { useProspectDrawer } from '@/components/founder/ProspectDrawer'
import type { PipelineStage } from '@/lib/types'
import {
  searchContacts,
  createProspect,
  type ContactSearchResult,
} from '@/app/founder/prospection/actions'

// Étapes proposées au Quick-Add (prospection + pipeline, pas les terminaux).
const QUICK_STAGES: PipelineStage[] = [...PROSPECTION_STAGES, ...PIPELINE_STAGES]

export default function FounderCommandBar() {
  const router = useRouter()
  const { open } = useProspectDrawer()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ContactSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const [quickOpen, setQuickOpen] = useState(false)

  // Raccourcis clavier : Cmd/Ctrl+K → focus recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Recherche debouncée.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const res = await searchContacts(query)
      setResults(res)
      setSearching(false)
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  // Fermer le dropdown au clic extérieur.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function pick(id: string) {
    open(id)
    setQuery('')
    setResults([])
    setFocused(false)
    inputRef.current?.blur()
  }

  const showDropdown = focused && query.trim().length >= 2

  return (
    <>
      <div className="fixed top-0 left-0 md:left-[180px] z-40 h-14 flex items-center gap-2 pl-16 md:pl-8 pr-4 max-w-full">
        {/* Recherche globale */}
        <div ref={boxRef} className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#555555]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder="Rechercher un contact…"
            className="w-44 sm:w-72 pl-8 pr-8 py-1.5 rounded-lg text-sm bg-[#141414] border border-[#2a2a2a] text-white
              placeholder-[#444444] focus:outline-none focus:border-[#444444] focus:w-72 sm:focus:w-80 transition-all"
          />
          {query ? (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus() }}
              aria-label="Effacer"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#555555] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 text-[9px] text-[#555555] border border-[#2a2a2a] rounded px-1 py-0.5">
              ⌘K
            </kbd>
          )}

          {/* Dropdown résultats */}
          {showDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-80 max-w-[85vw] bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-2xl shadow-black/50 overflow-hidden">
              {searching ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-[#666666]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Recherche…
                </div>
              ) : results.length === 0 ? (
                <p className="px-3 py-3 text-xs text-[#555555]">Aucun contact trouvé.</p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-1">
                  {results.map((r) => {
                    const name = r.company_name || r.contact_name
                    return (
                      <li key={r.id}>
                        <button
                          onClick={() => pick(r.id)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-[#1d1d1d] transition-colors"
                        >
                          <span className="w-7 h-7 rounded-full bg-[#00D76B]/10 border border-[#00D76B]/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-[#00D76B]">{name[0]?.toUpperCase() ?? '?'}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-white truncate">{name}</span>
                            {r.email && <span className="block text-[11px] text-[#666666] truncate">{r.email}</span>}
                          </span>
                          {r.pipeline_stage && (
                            <span
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded flex-shrink-0"
                              style={{
                                color: STAGE_META[r.pipeline_stage].color,
                                backgroundColor: `${STAGE_META[r.pipeline_stage].color}1a`,
                              }}
                            >
                              {STAGE_META[r.pipeline_stage].label}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Quick-Add */}
        <button
          onClick={() => setQuickOpen(true)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium
            bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors flex-shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Prospect</span>
        </button>
      </div>

      {quickOpen && (
        <QuickAddModal
          onClose={() => setQuickOpen(false)}
          onCreated={(id) => {
            setQuickOpen(false)
            router.refresh()
            open(id)
          }}
        />
      )}
    </>
  )
}

// ── Modal Quick-Add ─────────────────────────────────────────────────────────

function QuickAddModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const firstRef = useRef<HTMLInputElement>(null)
  const [isPending, startTransition] = useTransition()
  const [contactName, setContactName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [profileUrl, setProfileUrl] = useState('')
  const [stage, setStage] = useState<PipelineStage>('froid')

  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function submit() {
    if (!contactName.trim()) {
      toast.error('Le nom est requis.')
      firstRef.current?.focus()
      return
    }
    startTransition(async () => {
      const res = await createProspect({
        contactName,
        companyName: companyName || undefined,
        profileUrl: profileUrl || undefined,
        stage,
      })
      if (!res.success) { toast.error(res.error); return }
      toast.success('Prospect ajouté ✓')
      onCreated(res.clientId)
    })
  }

  const field =
    'w-full bg-[#1a1a1a] border border-[#333333] rounded-md px-3 py-2 text-sm text-white placeholder-[#444444] focus:outline-none focus:border-[#555555]'

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-24 px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-[#111111] border border-[#2a2a2a] rounded-xl shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 h-12 border-b border-[#1e1e1e]">
          <h2 className="text-sm font-semibold text-white">Nouveau prospect</h2>
          <button onClick={onClose} aria-label="Fermer" className="text-[#666666] hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">Nom *</label>
            <input
              ref={firstRef}
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="Prénom Nom"
              className={field}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">Entreprise</label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="Société (optionnel)"
              className={field}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">URL profil</label>
            <input
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
              placeholder="linkedin.com/in/… (optionnel)"
              className={field}
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-[#555555] mb-1.5">Statut</label>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as PipelineStage)}
              className={`${field} cursor-pointer`}
            >
              {QUICK_STAGES.map((s) => (
                <option key={s} value={s} className="bg-[#1a1a1a]">{STAGE_META[s].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[#1e1e1e] flex items-center justify-between">
          <span className="text-[10px] text-[#555555] flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> Entrée pour ajouter
          </span>
          <button
            onClick={submit}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#00D76B] text-black hover:bg-[#00c560] transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}
