import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getTeamMemberDetail, getTeamRoles } from '@/lib/supabase/team'
import TeamMemberHeader from './TeamMemberHeader'
import TeamMemberInfoCard from './TeamMemberInfoCard'
import MemberRolesEditor from './MemberRolesEditor'
import DeleteMemberButton from './DeleteMemberButton'

export default async function TeamMemberDetailPage({ params }: { params: { id: string } }) {
  const me = await getCurrentProfile()
  if (!me) redirect('/login')
  if (!me.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const [detail, allRoles] = await Promise.all([
    getTeamMemberDetail(supabase, params.id),
    getTeamRoles(supabase),
  ])
  if (!detail) notFound()

  const { member, roles } = detail

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back */}
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 text-sm text-faint hover:text-ink transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Retour à l&apos;équipe
      </Link>

      {/* Header (avatar + nom + dispo éditable) */}
      <TeamMemberHeader member={member} roles={roles} />

      {/* Métiers */}
      <MemberRolesEditor
        memberId={member.id}
        allRoles={allRoles}
        initialRoleIds={roles.map((r) => r.id)}
      />

      {/* Infos éditables */}
      <TeamMemberInfoCard member={member} />

      {/* Zone de danger */}
      <div className="bg-surface border border-[#EF4444]/15 rounded-xl p-5">
        <div className="flex items-start gap-3 mb-3">
          <AlertCircle className="h-4 w-4 text-[#EF4444] mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-ink">Zone de danger</h3>
            <p className="text-xs text-faint mt-0.5">
              Supprimer cet intervenant retire sa fiche et ses métiers. Action définitive.
            </p>
          </div>
        </div>
        <DeleteMemberButton
          memberId={member.id}
          memberName={member.contact_name}
          redirectTo="/team"
        />
      </div>
    </div>
  )
}
