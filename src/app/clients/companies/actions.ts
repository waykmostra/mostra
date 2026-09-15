'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import type { ClientStatus } from '@/lib/types'

const COMPANY_STATUSES: ClientStatus[] = ['active', 'former']

// ============================================================================
// Sociétés (migration 033) — regroupement de clients CRM. Admin-only.
//   - companies (id, name, website, notes)
//   - clients.company_id → companies.id
// ============================================================================

export type CompanyResult = { success: true } | { success: false; error: string }
export type CreateCompanyResult =
  | { success: true; companyId: string }
  | { success: false; error: string }

function revalidate(companyId?: string) {
  revalidatePath('/clients')
  revalidatePath('/clients/companies')
  if (companyId) revalidatePath(`/clients/companies/${companyId}`)
}

export interface CreateCompanyInput {
  name: string
  website?: string
  notes?: string
}

/**
 * Crée une société. Si une société du même nom existe déjà (unicité
 * insensible à la casse), renvoie l'existante (pratique pour le « créer ou
 * rattacher » depuis une fiche client).
 */
export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const name = input.name?.trim()
  if (!name) return { success: false, error: 'Le nom de la société est requis.' }

  const { data, error } = await db(admin)
    .from('companies')
    .insert({
      name,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error) {
    // Doublon (index unique lower(name)) → renvoyer l'existante.
    if ((error as { code?: string }).code === '23505') {
      const { data: existing } = await admin
        .from('companies')
        .select('id')
        .ilike('name', name)
        .maybeSingle()
      const id = (existing as { id: string } | null)?.id
      if (id) {
        revalidate()
        return { success: true, companyId: id }
      }
    }
    return { success: false, error: error.message }
  }

  revalidate()
  return { success: true, companyId: (data as { id: string }).id }
}

export interface UpdateCompanyInput {
  name?: string
  website?: string | null
  notes?: string | null
}

export async function updateCompany(id: string, input: UpdateCompanyInput): Promise<CompanyResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: Record<string, unknown> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (!name) return { success: false, error: 'Le nom ne peut pas être vide.' }
    patch.name = name
  }
  if (input.website !== undefined) patch.website = input.website?.trim() || null
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(admin).from('companies').update(patch).eq('id', id)
  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return { success: false, error: 'Une société porte déjà ce nom.' }
    }
    return { success: false, error: error.message }
  }

  revalidate(id)
  return { success: true }
}

export async function deleteCompany(id: string): Promise<CompanyResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Les clients rattachés sont détachés (company_id → NULL via FK ON DELETE SET NULL).
  const { error } = await db(admin).from('companies').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidate()
  return { success: true }
}

/** Rattache (ou détache si null) un client CRM à une société. */
export async function setClientCompany(
  clientId: string,
  companyId: string | null,
): Promise<CompanyResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { error } = await db(admin)
    .from('clients')
    .update({ company_id: companyId })
    .eq('id', clientId)
  if (error) return { success: false, error: error.message }

  revalidate(companyId ?? undefined)
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

/** Change le statut CRM d'une société (drag & drop du Kanban sociétés). */
export async function updateCompanyStatus(
  companyId: string,
  status: ClientStatus,
): Promise<CompanyResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  if (!COMPANY_STATUSES.includes(status)) {
    return { success: false, error: 'Statut invalide.' }
  }

  const { error } = await db(admin).from('companies').update({ status }).eq('id', companyId)
  if (error) return { success: false, error: error.message }

  // Sync inverse : la société tire TOUS ses contacts rattachés vers son statut
  // (cf. updateClientStatus pour le sens contact → société).
  await db(admin).from('clients').update({ status }).eq('company_id', companyId)

  revalidate(companyId)
  return { success: true }
}
