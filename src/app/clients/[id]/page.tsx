import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, FolderOpen, ChevronRight, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getClientDetail } from '@/lib/supabase/queries'
import { getClientAccess } from '@/lib/supabase/access'
import { formatDate } from '@/lib/utils/dates'
import DeleteClientButton from '../DeleteClientButton'
import ClientHeader from './ClientHeader'
import ClientInfoCard from './ClientInfoCard'
import InteractionsTimeline from './InteractionsTimeline'
import AccountSection from './AccountSection'

const STATUS_LABEL: Record<string, string> = {
  active:    'Actif',
  completed: 'Terminé',
  archived:  'Archivé',
  on_hold:   'En pause',
}

const STATUS_CLASS: Record<string, string> = {
  active:    'text-[#22C55E] bg-[#22C55E]/10 border-[#22C55E]/20',
  completed: 'text-[#3B82F6] bg-[#3B82F6]/10 border-[#3B82F6]/20',
  archived:  'text-[#555555] bg-[#1a1a1a] border-[#2a2a2a]',
  on_hold:   'text-[#F59E0B] bg-[#F59E0B]/10 border-[#F59E0B]/20',
}

export default async function ClientDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile()
  if (!me) redirect('/login')
  if (!me.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const detail = await getClientDetail(supabase, params.id)
  if (!detail) notFound()

  const { client, projects, interactions } = detail
  const displayName = client.company_name || client.contact_name
  const hasAccount = !!client.profile_id
  const hasEmail = !!client.email
  const activeCount = projects.filter((p) => p.status === 'active').length
  const access = await getClientAccess(client.profile_id ?? null)

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back */}
      <Link
        href="/clients"
        className="inline-flex items-center gap-1.5 text-sm text-[#666666] hover:text-white transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour aux clients
      </Link>

      {/* Header (statut éditable + follow-up + nouveau projet) */}
      <ClientHeader client={client} />

      {/* Infos commerciales éditables */}
      <ClientInfoCard client={client} />

      {/* Compte connectable */}
      <AccountSection
        clientId={client.id}
        hasAccount={hasAccount}
        hasEmail={hasEmail}
        access={access}
      />

      {/* Interactions */}
      <InteractionsTimeline clientId={client.id} initialInteractions={interactions} />

      {/* Projets liés */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">
            Projets
            <span className="ml-2 text-[#555555] font-normal">
              {projects.length} au total · {activeCount} actif{activeCount !== 1 ? 's' : ''}
            </span>
          </h2>
          <Link
            href={`/projects/new?clientId=${client.id}`}
            className="
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-[#1a1a1a] border border-[#2a2a2a] text-white hover:bg-[#222222]
              transition-colors
            "
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Nouveau projet
          </Link>
        </div>

        <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl overflow-hidden">
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <FolderOpen className="h-8 w-8 text-[#2a2a2a]" />
              <p className="text-sm text-[#444444]">Aucun projet pour ce client.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a] overflow-x-auto">
              <div className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-4 px-5 py-2.5 text-[10px] text-[#444444] uppercase tracking-widest font-medium min-w-[640px]">
                <span>Projet</span>
                <span>Deadline</span>
                <span>Valeur</span>
                <span>Statut</span>
                <span className="text-right">Action</span>
              </div>

              {projects.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_120px_100px_100px_80px] gap-4 px-5 py-3.5 items-center hover:bg-[#161616] transition-colors min-w-[640px]"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 max-w-[140px] h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#00D76B] rounded-full"
                          style={{ width: `${p.progress ?? 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-[#555555] tabular-nums">
                        {p.progress ?? 0}%
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#888888]">
                    {p.deadline ? formatDate(p.deadline) : <span className="text-[#444444]">—</span>}
                  </p>

                  <p className="text-xs text-white tabular-nums">
                    {p.value_eur !== null ? (
                      `${p.value_eur.toLocaleString('fr-FR')} €`
                    ) : (
                      <span className="text-[#444444]">—</span>
                    )}
                  </p>

                  <span
                    className={`
                      inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit
                      ${STATUS_CLASS[p.status] ?? STATUS_CLASS.archived}
                    `}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>

                  <div className="flex items-center justify-end">
                    <Link
                      href={`/projects/${p.id}`}
                      className="
                        inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px]
                        border border-[#2a2a2a] text-[#666666] hover:text-white hover:border-[#444444]
                        transition-colors
                      "
                    >
                      Voir
                      <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zone de danger */}
      <div className="bg-[#111111] border border-[#EF4444]/15 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="h-4 w-4 text-[#EF4444] mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Zone de danger</h3>
            <p className="text-xs text-[#666666] mt-0.5">
              Supprimer ce client supprime aussi son compte auth le cas échéant et toutes ses
              interactions. Les projets associés sont conservés mais détachés.
            </p>
          </div>
        </div>
        <DeleteClientButton clientId={params.id} clientName={displayName} redirectTo="/clients" />
      </div>
    </div>
  )
}
