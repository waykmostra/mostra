'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronDown, Check, X, Plus, Loader2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { setClientCompany, createCompany } from '../companies/actions'

interface CompanyOption {
  id: string
  name: string
}

interface Props {
  clientId: string
  currentCompanyId: string | null
  currentCompanyName: string | null
  companies: CompanyOption[]
}

export default function CompanyAssign({
  clientId,
  currentCompanyId,
  currentCompanyName,
  companies,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setCreating(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function assign(companyId: string | null) {
    setOpen(false)
    startTransition(async () => {
      const res = await setClientCompany(clientId, companyId)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(companyId ? 'Société rattachée' : 'Société retirée')
      router.refresh()
    })
  }

  function createAndAssign() {
    const clean = newName.trim()
    if (!clean) {
      toast.error('Le nom est requis.')
      return
    }
    startTransition(async () => {
      const res = await createCompany({ name: clean })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      const res2 = await setClientCompany(clientId, res.companyId)
      if (!res2.success) {
        toast.error(res2.error)
        return
      }
      toast.success('Société créée et rattachée')
      setCreating(false)
      setNewName('')
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="bg-surface border border-line rounded-xl p-6">
      <h2 className="text-xs font-semibold text-faint uppercase tracking-widest mb-3">
        Société
      </h2>

      <div className="flex items-center justify-between gap-3">
        {currentCompanyId && currentCompanyName ? (
          <Link
            href={`/clients/companies/${currentCompanyId}`}
            className="group inline-flex items-center gap-2.5 min-w-0"
          >
            <div className="w-9 h-9 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-4 w-4 text-brand" />
            </div>
            <span className="text-sm font-medium text-ink truncate group-hover:text-brand transition-colors">
              {currentCompanyName}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-faint group-hover:text-dim flex-shrink-0" />
          </Link>
        ) : (
          <p className="text-sm text-faint italic">Aucune société rattachée</p>
        )}

        {/* Sélecteur */}
        <div ref={ref} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-line text-dim hover:text-ink hover:border-line-strong transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {currentCompanyId ? 'Modifier' : 'Rattacher'}
            <ChevronDown className="h-3 w-3" />
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-1 z-20 w-60 bg-surface border border-line rounded-xl shadow-2xl shadow-black/50 py-1 overflow-hidden">
              {creating ? (
                <div className="p-2">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && createAndAssign()}
                    placeholder="Nom de la société"
                    className="w-full bg-surface border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink placeholder-faint focus:outline-none focus:border-line-strong"
                  />
                  <div className="flex items-center justify-end gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="px-2 py-1 rounded text-[11px] text-faint hover:text-ink transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={createAndAssign}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />
                      Créer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {companies.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => assign(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                    >
                      <Building2 className="h-3.5 w-3.5 text-faint flex-shrink-0" />
                      <span className="text-xs text-ink truncate flex-1">{c.name}</span>
                      {c.id === currentCompanyId && (
                        <Check className="h-3.5 w-3.5 text-brand flex-shrink-0" />
                      )}
                    </button>
                  ))}

                  <div className="h-px bg-surface-2 my-1" />

                  <button
                    type="button"
                    onClick={() => setCreating(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors text-brand"
                  >
                    <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className="text-xs">Créer une société</span>
                  </button>

                  {currentCompanyId && (
                    <button
                      type="button"
                      onClick={() => assign(null)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
                    >
                      <X className="h-3.5 w-3.5 text-faint flex-shrink-0" />
                      <span className="text-xs text-faint">Retirer la société</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
