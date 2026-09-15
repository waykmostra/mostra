import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Users, FolderOpen, ChevronRight, Mail, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getCompanyDetail } from '@/lib/supabase/queries'
import { formatDate } from '@/lib/utils/dates'
import CompanyHeader from './CompanyHeader'

const STATUS_LABEL: Record<string, string> = {
  active: 'Actif',
  completed: 'Terminé',
  archived: 'Archivé',
  on_hold: 'En pause',
}
const STATUS_CLASS: Record<string, string> = {
  active: 'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20',
  completed: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20',
  archived: 'text-faint bg-surface-2 border-line',
  on_hold: 'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
}

function eur(n: number): string {
  return `${Math.round(n).toLocaleString('fr-FR')} €`
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile()
  if (!me) redirect('/login')
  if (!me.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const detail = await getCompanyDetail(supabase, params.id)
  if (!detail) notFound()

  const { company, clients, projects, totalRevenue } = detail

  return (
    <div className="space-y-5 max-w-4xl">
      <Link
        href="/clients/companies"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux sociétés
      </Link>

      {/* Header éditable + suppression */}
      <CompanyHeader company={company} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-faint mb-1">
            <Users className="h-3 w-3" /> Contacts
          </div>
          <p className="text-xl font-bold text-ink tabular-nums">{clients.length}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-faint mb-1">
            <FolderOpen className="h-3 w-3" /> Projets
          </div>
          <p className="text-xl font-bold text-ink tabular-nums">{projects.length}</p>
        </div>
        <div className="bg-surface border border-line rounded-xl p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-faint mb-1">
            <Wallet className="h-3 w-3" /> CA encaissé
          </div>
          <p className="text-xl font-bold text-[#22C55E] tabular-nums">{eur(totalRevenue)}</p>
        </div>
      </div>

      {/* Contacts */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">
          Contacts
          <span className="ml-2 text-faint font-normal">{clients.length}</span>
        </h2>
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {clients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Users className="h-8 w-8 text-[rgb(var(--c-border))]" />
              <p className="text-sm text-faint">
                Aucun contact. Rattache un client à cette société depuis sa fiche.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {clients.map((c) => {
                const displayName = c.company_name || c.contact_name
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors group"
                  >
                    <div className="w-9 h-9 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-brand">
                        {displayName[0]?.toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink truncate">{c.contact_name}</p>
                      {c.email && (
                        <p className="text-[11px] text-faint flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {c.email}
                        </p>
                      )}
                    </div>
                    {c.active_projects > 0 && (
                      <span className="text-[11px] text-[#22C55E] flex-shrink-0">
                        {c.active_projects} actif{c.active_projects !== 1 ? 's' : ''}
                      </span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 text-faint group-hover:text-dim flex-shrink-0" />
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Projets */}
      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">
          Projets
          <span className="ml-2 text-faint font-normal">{projects.length}</span>
        </h2>
        <div className="bg-surface border border-line rounded-xl overflow-hidden">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <FolderOpen className="h-8 w-8 text-[rgb(var(--c-border))]" />
              <p className="text-sm text-faint">Aucun projet pour cette société.</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2 transition-colors group"
                >
                  <p className="text-sm font-medium text-ink truncate flex-1">{p.name}</p>
                  <p className="text-xs text-ink tabular-nums flex-shrink-0">
                    {p.value_eur !== null ? eur(p.value_eur) : <span className="text-faint">—</span>}
                  </p>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit flex-shrink-0 ${STATUS_CLASS[p.status] ?? STATUS_CLASS.archived}`}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                  <span className="text-[11px] text-faint flex-shrink-0 hidden sm:inline">
                    {formatDate(p.updated_at)}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-faint group-hover:text-dim flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
