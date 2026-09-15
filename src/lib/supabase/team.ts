import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import type { TeamMember, TeamMemberRole, TeamMemberWithRoles, TeamRole } from '@/lib/types'

type Sb = SupabaseClient<Database>

// ============================================================================
// Lectures du module Équipe (migration 030) : annuaire des intervenants.
// Dégrade en douceur (listes vides) si les tables n'existent pas encore.
// ============================================================================

export async function getTeamRoles(supabase: Sb): Promise<TeamRole[]> {
  const { data } = await supabase
    .from('team_roles')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  return (data as TeamRole[] | null) ?? []
}

/**
 * Tous les membres + leurs métiers résolus, triés par nom.
 * Un membre sans métier a `roles: []` (affiché dans la section « Sans métier »).
 */
export async function getTeamMembersWithRoles(supabase: Sb): Promise<TeamMemberWithRoles[]> {
  const [membersRes, rolesRes, linksRes] = await Promise.all([
    supabase.from('team_members').select('*').order('contact_name', { ascending: true }),
    supabase.from('team_roles').select('*').order('sort_order', { ascending: true }),
    supabase.from('team_member_roles').select('*'),
  ])

  const members = (membersRes.data as TeamMember[] | null) ?? []
  if (members.length === 0) return []

  const roles = (rolesRes.data as TeamRole[] | null) ?? []
  const links = (linksRes.data as TeamMemberRole[] | null) ?? []

  const roleById = new Map(roles.map((r) => [r.id, r]))
  const rolesByMember = new Map<string, TeamRole[]>()
  for (const link of links) {
    const role = roleById.get(link.role_id)
    if (!role) continue
    const list = rolesByMember.get(link.member_id) ?? []
    list.push(role)
    rolesByMember.set(link.member_id, list)
  }

  return members.map((m) => ({
    ...m,
    roles: (rolesByMember.get(m.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export interface TeamMemberDetail {
  member: TeamMember
  roles: TeamRole[]
}

/** Détail d'un membre + ses métiers (pour la fiche /team/[id]). */
export async function getTeamMemberDetail(supabase: Sb, id: string): Promise<TeamMemberDetail | null> {
  const { data: memberRow } = await supabase
    .from('team_members')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  const member = memberRow as TeamMember | null
  if (!member) return null

  const { data: linkRows } = await supabase
    .from('team_member_roles')
    .select('role_id')
    .eq('member_id', id)

  const links = (linkRows as { role_id: string }[] | null) ?? []
  let roles: TeamRole[] = []

  if (links.length > 0) {
    const { data: roleRows } = await supabase
      .from('team_roles')
      .select('*')
      .in('id', links.map((l) => l.role_id))
      .order('sort_order', { ascending: true })
    roles = (roleRows as TeamRole[] | null) ?? []
  }

  return { member, roles }
}
