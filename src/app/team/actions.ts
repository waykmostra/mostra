'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { TeamAvailability } from '@/lib/types'

// ============================================================================
// Module Équipe (migration 030) — annuaire des intervenants.
// Tout est admin-only. Aucune table existante n'est touchée.
//   - team_members       : fiches
//   - team_roles         : métiers configurables
//   - team_member_roles  : lien N-N membre ↔ métiers
// ============================================================================

export type TeamResult = { success: true } | { success: false; error: string }
export type CreateMemberResult =
  | { success: true; memberId: string }
  | { success: false; error: string }
export type CreateRoleResult =
  | { success: true; roleId: string }
  | { success: false; error: string }

const AVAILABILITIES: TeamAvailability[] = ['active', 'occasional', 'unavailable', 'on_leave']

function revalidate(memberId?: string) {
  revalidatePath('/team')
  if (memberId) revalidatePath(`/team/${memberId}`)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function cleanTags(tags: string[] | undefined): string[] | null {
  if (!tags) return null
  const list = tags.map((t) => t.trim()).filter(Boolean)
  return list.length > 0 ? Array.from(new Set(list)) : null
}

/** Parse un montant € optionnel ; renvoie undefined si invalide, null si vide. */
function parseRate(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return value < 0 ? 0 : value
}

// ============================================================================
// MEMBRES
// ============================================================================

export interface CreateTeamMemberInput {
  contactName: string
  email?: string
  phone?: string
  portfolioUrl?: string
  languages?: string
  dailyRateEur?: number | null
  projectRateEur?: number | null
  availability?: TeamAvailability
  tags?: string[]
  notes?: string
  roleIds?: string[]
}

export async function createTeamMember(
  input: CreateTeamMemberInput,
): Promise<CreateMemberResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const contactName = input.contactName.trim()
  if (!contactName) return { success: false, error: 'Le nom de l\'intervenant est requis.' }

  const availability =
    input.availability && AVAILABILITIES.includes(input.availability)
      ? input.availability
      : 'active'

  const payload = {
    contact_name: contactName,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    portfolio_url: input.portfolioUrl?.trim() || null,
    languages: input.languages?.trim() || null,
    daily_rate_eur: parseRate(input.dailyRateEur),
    project_rate_eur: parseRate(input.projectRateEur),
    availability,
    tags: cleanTags(input.tags),
    notes: input.notes?.trim() || null,
  }

  const { data: row, error } = await db(admin)
    .from('team_members')
    .insert(payload)
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Erreur création intervenant.' }
  }

  const memberId = (row as { id: string }).id

  // Métiers (lien N-N) — best-effort, on n'échoue pas la création pour ça.
  const roleIds = Array.from(new Set((input.roleIds ?? []).filter(Boolean)))
  if (roleIds.length > 0) {
    await db(admin)
      .from('team_member_roles')
      .insert(roleIds.map((role_id) => ({ member_id: memberId, role_id })))
  }

  revalidate()
  return { success: true, memberId }
}

export interface UpdateTeamMemberInput {
  contactName?: string
  email?: string | null
  phone?: string | null
  portfolioUrl?: string | null
  languages?: string | null
  dailyRateEur?: number | null
  projectRateEur?: number | null
  availability?: TeamAvailability
  tags?: string[] | null
  notes?: string | null
}

export async function updateTeamMember(
  memberId: string,
  input: UpdateTeamMemberInput,
): Promise<TeamResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: Record<string, unknown> = {}

  if (input.contactName !== undefined) {
    const name = input.contactName.trim()
    if (!name) return { success: false, error: 'Le nom ne peut pas être vide.' }
    patch.contact_name = name
  }
  if (input.email !== undefined) patch.email = input.email?.trim().toLowerCase() || null
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null
  if (input.portfolioUrl !== undefined) patch.portfolio_url = input.portfolioUrl?.trim() || null
  if (input.languages !== undefined) patch.languages = input.languages?.trim() || null
  if (input.dailyRateEur !== undefined) patch.daily_rate_eur = parseRate(input.dailyRateEur)
  if (input.projectRateEur !== undefined) patch.project_rate_eur = parseRate(input.projectRateEur)
  if (input.availability !== undefined) {
    if (!AVAILABILITIES.includes(input.availability)) {
      return { success: false, error: 'Disponibilité invalide.' }
    }
    patch.availability = input.availability
  }
  if (input.tags !== undefined) patch.tags = input.tags ? cleanTags(input.tags) : null
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(admin).from('team_members').update(patch).eq('id', memberId)
  if (error) return { success: false, error: error.message }

  revalidate(memberId)
  return { success: true }
}

export async function deleteTeamMember(memberId: string): Promise<TeamResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Les liens team_member_roles cascade (FK ON DELETE CASCADE).
  const { error } = await db(admin).from('team_members').delete().eq('id', memberId)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

/** Quick-toggle de la disponibilité depuis l'annuaire / la fiche. */
export async function updateMemberAvailability(
  memberId: string,
  availability: TeamAvailability,
): Promise<TeamResult> {
  return updateTeamMember(memberId, { availability })
}

/** Remplace l'ensemble des métiers d'un membre par la liste fournie. */
export async function setMemberRoles(
  memberId: string,
  roleIds: string[],
): Promise<TeamResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const cleanIds = Array.from(new Set(roleIds.filter(Boolean)))

  // Stratégie simple et sûre : on remplace tout (supprime puis ré-insère).
  const { error: delErr } = await db(admin)
    .from('team_member_roles')
    .delete()
    .eq('member_id', memberId)
  if (delErr) return { success: false, error: delErr.message }

  if (cleanIds.length > 0) {
    const { error: insErr } = await db(admin)
      .from('team_member_roles')
      .insert(cleanIds.map((role_id) => ({ member_id: memberId, role_id })))
    if (insErr) return { success: false, error: insErr.message }
  }

  revalidate(memberId)
  return { success: true }
}

// ============================================================================
// MÉTIERS (team_roles) — configurables
// ============================================================================

export async function createRole(name: string, color: string): Promise<CreateRoleResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const clean = name.trim()
  if (!clean) return { success: false, error: 'Le nom du métier est requis.' }

  // sort_order = nb de métiers existants (ajout en fin de liste).
  const { count } = await db(admin)
    .from('team_roles')
    .select('id', { count: 'exact', head: true })

  const { data, error } = await db(admin)
    .from('team_roles')
    .insert({ name: clean, color: color || '#00D76B', sort_order: count ?? 0 })
    .select('id')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'Erreur création métier.' }

  revalidate()
  return { success: true, roleId: (data as { id: string }).id }
}

export async function updateRole(
  roleId: string,
  patch: { name?: string; color?: string },
): Promise<TeamResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const update: Record<string, unknown> = {}
  if (patch.name !== undefined) {
    const clean = patch.name.trim()
    if (!clean) return { success: false, error: 'Le nom du métier est requis.' }
    update.name = clean
  }
  if (patch.color !== undefined) update.color = patch.color

  if (Object.keys(update).length === 0) return { success: true }

  const { error } = await db(admin).from('team_roles').update(update).eq('id', roleId)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

export async function deleteRole(roleId: string): Promise<TeamResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Les liens team_member_roles cascade : les membres perdent juste ce métier.
  const { error } = await db(admin).from('team_roles').delete().eq('id', roleId)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}
