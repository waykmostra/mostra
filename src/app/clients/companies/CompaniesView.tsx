'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Building2,
  Plus,
  Search,
  Users,
  FolderOpen,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { createCompany } from './actions'
import type { CompanyWithStats } from '@/lib/types'

function eur(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

export default function CompaniesView({
  initialCompanies,
}: {
  initialCompanies: CompanyWithStats[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [website, setWebsite] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = initialCompanies.filter((c) =>
    !search.trim() ? true : c.name.toLowerCase().includes(search.toLowerCase()),
  )

  function submit() {
    const clean = name.trim()
    if (!clean) {
      toast.error('Le nom de la société est requis.')
      return
    }
    startTransition(async () => {
      const res = await createCompany({ name: clean, website: website.trim() || undefined })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Société créée')
      setName('')
      setWebsite('')
      setAdding(false)
      router.push(`/clients/companies/${res.companyId}`)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/clients"
          className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-ink transition-colors mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          Retour aux clients
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-ink">Sociétés</h1>
            <p className="text-sm text-faint mt-0.5">
              {initialCompanies.length} société{initialCompanies.length !== 1 ? 's' : ''} — regroupez
              les fiches d&apos;un même client
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAdding((a) => !a)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand text-ink hover:bg-brand transition-colors flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nouvelle société
          </button>
        </div>
      </div>

      {/* Formulaire de création */}
      {adding && (
        <div className="bg-surface border border-line rounded-xl p-4 flex flex-col sm:flex-row gap-2.5">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Nom de la société (ex. Flowride)"
            className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-line-strong"
          />
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Site web (optionnel)"
            className="flex-1 bg-surface border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder-faint focus:outline-none focus:border-line-strong"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-brand text-ink hover:bg-brand transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Créer
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="p-2 rounded-lg text-faint hover:text-ink hover:bg-surface-2 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Recherche */}
      {initialCompanies.length > 0 && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Chercher une société…"
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-surface border border-line text-ink placeholder-faint focus:outline-none focus:border-line-strong"
          />
        </div>
      )}

      {/* Grille */}
      {filtered.length === 0 ? (
        <div className="bg-surface border border-line rounded-xl p-10 flex flex-col items-center gap-3">
          <Building2 className="h-8 w-8 text-[rgb(var(--c-border))]" />
          <p className="text-sm text-faint">
            {initialCompanies.length === 0
              ? 'Aucune société. Crée-en une, ou rattache une société depuis une fiche client.'
              : 'Aucune société ne correspond.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/clients/companies/${c.id}`}
              className="group bg-surface border border-line rounded-xl p-4 hover:border-line-strong transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                  <Building2 className="h-5 w-5 text-brand" />
                </div>
                <p className="text-sm font-semibold text-ink truncate group-hover:text-brand transition-colors">
                  {c.name}
                </p>
                <ChevronRight className="h-4 w-4 text-faint group-hover:text-dim ml-auto flex-shrink-0" />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-dim">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {c.client_count} contact{c.client_count !== 1 ? 's' : ''}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  {c.project_count} projet{c.project_count !== 1 ? 's' : ''}
                </span>
                {c.total_revenue > 0 && (
                  <span className="ml-auto text-[#22C55E] tabular-nums font-medium">
                    {eur(c.total_revenue)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
