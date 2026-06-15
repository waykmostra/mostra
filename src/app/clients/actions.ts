'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'

// ── Helpers lien set-password ────────────────────────────────────────────────

/** Origine absolue du déploiement (robuste si NEXT_PUBLIC_APP_URL absent). */
function appOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL
  if (env) return env.replace(/\/+$/, '')
  const h = headers()
  const host = h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'https'
  return host ? `${proto}://${host}` : ''
}

function buildSetupUrl(token: string): string {
  return `${appOrigin()}/setup-password/${token}`
}

/** Expiration du lien : 30 jours (au lieu du défaut SQL 7j). */
function setupExpiresAt(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
}
import type {
  Client,
  ClientSource,
  ClientStatus,
  InteractionType,
  Project,
} from '@/lib/types'

// ============================================================================
// CRM Server Actions — table `clients` (et `client_interactions`).
//
// Architecture (migration 018) :
//   - `clients` = fiche CRM (peut être un prospect sans compte auth)
//   - `profiles` = compte auth (admin OU client connecté)
//   - `clients.profile_id` est non-null SEULEMENT si un compte auth a été créé
//   - `projects.client_id` → `clients.id`
// ============================================================================

export type ClientActionResult = { success: true } | { success: false; error: string }

// ── createClient ─────────────────────────────────────────────────
// Crée une fiche CRM (PAS de compte auth — c'est l'étape suivante via
// createAccountForClient si on veut générer un lien set-password).

export interface CreateClientInput {
  companyName?: string
  contactName: string
  email?: string
  phone?: string
  website?: string
  source: ClientSource
  status?: ClientStatus
  notes?: string
}

export type CreateClientResult =
  | { success: true; clientId: string }
  | { success: false; error: string }

export async function createClient(input: CreateClientInput): Promise<CreateClientResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const contactName = input.contactName.trim()
  if (!contactName) {
    return { success: false, error: 'Le nom du contact est requis.' }
  }

  const payload = {
    company_name: input.companyName?.trim() || null,
    contact_name: contactName,
    email: input.email?.trim().toLowerCase() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    source: input.source,
    status: input.status ?? ('interest' as ClientStatus),
    notes: input.notes?.trim() || null,
  }

  const { data: row, error } = await db(admin)
    .from('clients')
    .insert(payload)
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Erreur création client.' }
  }

  revalidatePath('/clients')
  return { success: true, clientId: (row as { id: string }).id }
}

// ── updateClient ─────────────────────────────────────────────────

export interface UpdateClientInput {
  companyName?: string | null
  contactName?: string
  email?: string | null
  phone?: string | null
  website?: string | null
  source?: ClientSource
  status?: ClientStatus
  notes?: string | null
  followUpPending?: boolean
}

export async function updateClient(
  clientId: string,
  input: UpdateClientInput,
): Promise<ClientActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const patch: Record<string, unknown> = {}

  if (input.companyName !== undefined) {
    patch.company_name = input.companyName?.trim() || null
  }
  if (input.contactName !== undefined) {
    const name = input.contactName.trim()
    if (!name) return { success: false, error: 'Le nom du contact ne peut pas être vide.' }
    patch.contact_name = name
  }
  if (input.email !== undefined) {
    patch.email = input.email?.trim().toLowerCase() || null
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone?.trim() || null
  }
  if (input.website !== undefined) {
    patch.website = input.website?.trim() || null
  }
  if (input.source !== undefined) patch.source = input.source
  if (input.status !== undefined) patch.status = input.status
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null
  }
  if (input.followUpPending !== undefined) patch.follow_up_pending = input.followUpPending

  if (Object.keys(patch).length === 0) {
    return { success: true }
  }

  const { error } = await db(admin).from('clients').update(patch).eq('id', clientId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

// ── deleteClient ─────────────────────────────────────────────────
// Si le client n'a pas de compte auth : DELETE direct (les interactions
// cascade, projects.client_id passe à NULL).
// Sinon : il faut aussi nettoyer le compte auth pour cascader proprement
// (mêmes FK que l'ancien deleteClient sur les profiles non-cascadées).

export async function deleteClient(clientId: string): Promise<ClientActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { data: rawClient } = await admin
    .from('clients')
    .select('id, profile_id')
    .eq('id', clientId)
    .maybeSingle()

  const client = rawClient as Pick<Client, 'id' | 'profile_id'> | null
  if (!client) return { success: false, error: 'Client introuvable.' }

  // Cas 2 : compte auth lié → cleanup FK profile + supprimer le user auth.
  if (client.profile_id) {
    const profileId = client.profile_id

    // 1. Détacher des projets (FK nullable) — sécurité, en pratique projects.client_id
    //    est déjà nullable et passera à NULL via ON DELETE SET NULL côté FK.
    await db(admin)
      .from('projects')
      .update({ project_manager_id: null })
      .eq('project_manager_id', profileId)

    // 2. Audit trail : casser la FK sur activity_logs (nullable)
    await db(admin).from('activity_logs').update({ user_id: null }).eq('user_id', profileId)

    // 3. Tables NOT NULL — on doit supprimer les rows liées
    await admin.from('comments').delete().eq('user_id', profileId)
    await admin.from('phase_files').delete().eq('uploaded_by', profileId)

    // 4. password_setup_tokens (ON DELETE CASCADE depuis auth.users) — par sécurité
    await admin.from('password_setup_tokens').delete().eq('user_id', profileId)

    // 5. Détacher le client du profile pour que la cascade auth → profiles
    //    ne nullify pas un profile_id inexistant. clients.profile_id passe via
    //    le ON DELETE SET NULL côté FK.
    const { error: authErr } = await admin.auth.admin.deleteUser(profileId)
    if (authErr) return { success: false, error: authErr.message }
  }

  // Supprime la fiche CRM (les interactions cascade).
  const { error } = await db(admin).from('clients').delete().eq('id', clientId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/clients')
  return { success: true }
}

// ── createAccountForClient ───────────────────────────────────────
// Transforme un prospect en client connectable : crée le compte auth +
// profile + password_setup_token. Renvoie le lien set-password.

export type CreateAccountResult =
  | { success: true; setupUrl: string }
  | { success: false; error: string }

export async function createAccountForClient(clientId: string): Promise<CreateAccountResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { data: rawClient } = await admin
    .from('clients')
    .select('id, contact_name, email, phone, profile_id, status')
    .eq('id', clientId)
    .maybeSingle()

  const client = rawClient as
    | Pick<Client, 'id' | 'contact_name' | 'email' | 'phone' | 'profile_id' | 'status'>
    | null

  if (!client) return { success: false, error: 'Client introuvable.' }
  if (!client.email) {
    return { success: false, error: 'Email requis pour créer un compte.' }
  }
  if (client.profile_id) {
    return { success: false, error: 'Ce client a déjà un compte.' }
  }

  const email = client.email.toLowerCase().trim()

  // Recycle un user auth existant si email déjà connu, sinon crée.
  let userId: string
  const {
    data: { users },
  } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const existingUser = users.find((u) => u.email === email)

  if (existingUser) {
    userId = existingUser.id
  } else {
    const { data: newUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: client.contact_name },
    })
    if (authErr || !newUser.user) {
      return { success: false, error: authErr?.message ?? 'Erreur création compte.' }
    }
    userId = newUser.user.id
  }

  // Upsert profile (is_admin = false)
  await db(admin)
    .from('profiles')
    .upsert(
      {
        id: userId,
        email,
        full_name: client.contact_name,
        phone: client.phone ?? null,
        is_admin: false,
      },
      { onConflict: 'id' },
    )

  // Lier le client au profile + passer en 'active' si on était au stade prospect.
  const nextStatus: ClientStatus =
    client.status === 'interest' || client.status === 'warm' || client.status === 'cold'
      ? 'active'
      : client.status

  await db(admin)
    .from('clients')
    .update({ profile_id: userId, status: nextStatus })
    .eq('id', clientId)

  // Générer le password_setup_token (expire dans 30 jours)
  const { data: tokenRow, error: tokenErr } = await db(admin)
    .from('password_setup_tokens')
    .insert({ user_id: userId, expires_at: setupExpiresAt() })
    .select('token')
    .single()

  if (tokenErr || !tokenRow) {
    return {
      success: false,
      error: 'Compte créé mais impossible de générer le lien set-password.',
    }
  }

  const setupUrl = buildSetupUrl((tokenRow as { token: string }).token)

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true, setupUrl }
}

// ── regenerateSetupLink ──────────────────────────────────────────
// Invalide les anciens tokens et génère un nouveau lien set-password.
// Requiert que le client ait déjà un compte (profile_id non-null).

export async function regenerateSetupLink(
  clientId: string,
): Promise<{ success: true; setupUrl: string } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const { data: rawClient } = await admin
    .from('clients')
    .select('id, profile_id')
    .eq('id', clientId)
    .maybeSingle()

  const client = rawClient as Pick<Client, 'id' | 'profile_id'> | null
  if (!client) return { success: false, error: 'Client introuvable.' }
  if (!client.profile_id) return { success: false, error: 'Ce client n\'a pas de compte.' }

  const profileId = client.profile_id

  // Invalider les anciens tokens non utilisés
  await db(admin)
    .from('password_setup_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', profileId)
    .is('used_at', null)

  // Nouveau token (expire dans 30 jours)
  const { data: tokenRow, error: tokenErr } = await db(admin)
    .from('password_setup_tokens')
    .insert({ user_id: profileId, expires_at: setupExpiresAt() })
    .select('token')
    .single()

  if (tokenErr || !tokenRow) {
    return { success: false, error: tokenErr?.message ?? 'Erreur génération token' }
  }

  const setupUrl = buildSetupUrl((tokenRow as { token: string }).token)

  revalidatePath(`/clients/${clientId}`)
  return { success: true, setupUrl }
}

// ── updateClientStatus (Kanban drag-and-drop) ────────────────────

export async function updateClientStatus(
  clientId: string,
  newStatus: ClientStatus,
): Promise<ClientActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const { data: rawClient } = await admin
    .from('clients')
    .select('status')
    .eq('id', clientId)
    .maybeSingle()

  const prev = (rawClient as { status: ClientStatus } | null)?.status

  const { error } = await db(admin)
    .from('clients')
    .update({ status: newStatus })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }

  // Trace l'évolution dans la timeline d'interactions (si changement réel)
  if (prev && prev !== newStatus) {
    await db(admin).from('client_interactions').insert({
      client_id: clientId,
      type: 'note' as InteractionType,
      content: `Statut changé : ${prev} → ${newStatus}`,
      created_by: user.id,
    })
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

// ── addInteraction ───────────────────────────────────────────────
// Side-effect automatique sur clients selon le type :
//   - message_sent      → last_message_sent_at + follow_up_pending = true
//   - message_received  → last_reply_at + follow_up_pending = false
//   - email             → idem message_received (entrant)
//   - call/meeting/note → pas de side-effect

export interface AddInteractionInput {
  clientId: string
  type: InteractionType
  content: string
  channel?: string
  occurredAt?: string
}

export type AddInteractionResult =
  | { success: true; interactionId: string }
  | { success: false; error: string }

export async function addInteraction(input: AddInteractionInput): Promise<AddInteractionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const content = input.content.trim()
  if (!content) return { success: false, error: 'Le contenu est requis.' }

  const occurredAt = input.occurredAt ?? new Date().toISOString()

  const { data: row, error } = await db(admin)
    .from('client_interactions')
    .insert({
      client_id: input.clientId,
      type: input.type,
      content,
      channel: input.channel?.trim() || null,
      occurred_at: occurredAt,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !row) return { success: false, error: error?.message ?? 'Erreur ajout interaction.' }

  // Side-effects automatiques sur clients
  const patch: Record<string, unknown> = {}
  if (input.type === 'message_sent') {
    patch.last_message_sent_at = occurredAt
    patch.follow_up_pending = true
  } else if (input.type === 'message_received' || input.type === 'email') {
    patch.last_reply_at = occurredAt
    patch.follow_up_pending = false
  }

  if (Object.keys(patch).length > 0) {
    await db(admin).from('clients').update(patch).eq('id', input.clientId)
  }

  revalidatePath('/clients')
  revalidatePath(`/clients/${input.clientId}`)
  return { success: true, interactionId: (row as { id: string }).id }
}

// ── deleteInteraction ────────────────────────────────────────────

export async function deleteInteraction(interactionId: string): Promise<ClientActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  // Récupérer le client pour le revalidate ciblé.
  const { data: rawInter } = await admin
    .from('client_interactions')
    .select('client_id')
    .eq('id', interactionId)
    .maybeSingle()

  const clientId = (rawInter as { client_id: string } | null)?.client_id

  const { error } = await db(admin)
    .from('client_interactions')
    .delete()
    .eq('id', interactionId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

// ── getClientProjects ────────────────────────────────────────────
// Lecture des projets liés à un client CRM (projects.client_id → clients.id).

export type ClientProject = Pick<
  Project,
  'id' | 'name' | 'status' | 'progress' | 'share_token' | 'created_at' | 'updated_at'
>

export async function getClientProjects(clientId: string): Promise<ClientProject[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const { supabase } = auth

  const { data } = await supabase
    .from('projects')
    .select('id, name, status, progress, share_token, created_at, updated_at')
    .eq('client_id', clientId)
    .order('updated_at', { ascending: false })

  return (data as ClientProject[] | null) ?? []
}
