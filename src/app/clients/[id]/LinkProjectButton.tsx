'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Link2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { linkProjectToClient } from '../actions'

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  completed: 'Terminé',
  archived: 'Archivé',
  on_hold: 'En pause',
}

interface Props {
  clientId: string
  /** Projets pas encore liés à ce contact. */
  projects: { id: string; name: string; status: string }[]
}

/** Rattache un projet existant à la fiche contact (il y gagne l'accès). */
export default function LinkProjectButton({ clientId, projects }: Props) {
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
    return q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects
  }, [projects, query])

  function link(projectId: string) {
    setOpen(false)
    startTransition(async () => {
      const res = await linkProjectToClient(clientId, projectId)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Projet lié')
      setQuery('')
      router.refresh()
    })
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending || projects.length === 0}
        title={projects.length === 0 ? 'Tous les projets sont déjà liés' : undefined}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-dim transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
        Lier un projet
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl shadow-black/20">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <Search className="h-3.5 w-3.5 flex-shrink-0 text-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un projet"
              className="w-full bg-transparent text-xs text-ink placeholder:text-faint focus:outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 ? (
              <p className="px-3 py-2 text-xs text-faint">Aucun projet trouvé.</p>
            ) : (
              matches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => link(p.id)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span className="flex-1 truncate text-xs text-ink">{p.name}</span>
                  <span className="flex-shrink-0 text-[10px] text-faint">
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
