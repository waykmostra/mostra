'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Search, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { setClientCompany } from '../actions'

interface Props {
  companyId: string
  /** Contacts qui ne sont pas encore dans cette société. */
  contacts: { id: string; contact_name: string; company_name: string | null }[]
}

/**
 * Ajout d'un contact depuis la fiche société : en créer un nouveau (formulaire
 * avec la société présélectionnée) ou rattacher un contact existant.
 */
export default function AddContactMenu({ companyId, contacts }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [isPending, startTransition] = useTransition()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? contacts.filter((c) => c.contact_name.toLowerCase().includes(q)) : contacts
  }, [contacts, query])

  function attach(clientId: string) {
    setOpen(false)
    startTransition(async () => {
      const res = await setClientCompany(clientId, companyId)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Contact ajouté')
      setQuery('')
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending || contacts.length === 0}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-dim transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
      >
        {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Rattacher un contact
        <ChevronDown className="h-3 w-3" />
      </button>
      <Link
        href={`/clients/new?companyId=${companyId}`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-colors hover:bg-surface-3"
      >
        <UserPlus className="h-3.5 w-3.5" />
        Nouveau contact
      </Link>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un contact"
              className="w-full bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-faint">Aucun contact trouvé.</p>
            ) : (
              matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => attach(c.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="flex-1 truncate text-xs text-ink">{c.contact_name}</span>
                  {c.company_name && (
                    <span className="max-w-[45%] flex-shrink-0 truncate text-[10px] text-faint">
                      {c.company_name}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
