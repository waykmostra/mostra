'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { getClientDetail, type ClientDetailData } from '@/lib/supabase/queries'
import type {
  ClientSource,
  ClientStatus,
  InteractionType,
  PipelineStage,
} from '@/lib/types'

// ============================================================================
// Vue Prospection — actions sur le funnel commercial (table `clients`).
// Le funnel vit sur `clients.pipeline_stage` + `clients.next_follow_up_on`
// (migration 021). Voir aussi src/app/clients/actions.ts pour le CRM complet.
// ============================================================================

export type ProspectionResult = { success: true } | { success: false; error: string }

const PIPELINE_STAGES: PipelineStage[] = [
  'froid',
  'contacte',
  'a_relancer',
  'repondu',
  'call_booke',
  'proposition',
  'signe',
  'perdu',
]

function revalidate(clientId?: string) {
  revalidatePath('/founder/prospection')
  revalidatePath('/founder/pipeline')
  revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
}

// ── updateProspectStage ──────────────────────────────────────────
// Fait évoluer un prospect dans le funnel. Trace le changement dans la
// timeline d'interactions (cohérent avec updateClientStatus du CRM).

export async function updateProspectStage(
  clientId: string,
  stage: PipelineStage,
): Promise<ProspectionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  if (!PIPELINE_STAGES.includes(stage)) {
    return { success: false, error: 'Étape de pipeline invalide.' }
  }

  const { data: rawClient } = await admin
    .from('clients')
    .select('pipeline_stage')
    .eq('id', clientId)
    .maybeSingle()

  const prev = (rawClient as { pipeline_stage: PipelineStage | null } | null)?.pipeline_stage

  const { error } = await db(admin)
    .from('clients')
    .update({ pipeline_stage: stage })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }

  if (prev !== stage) {
    await db(admin)
      .from('client_interactions')
      .insert({
        client_id: clientId,
        type: 'note' as InteractionType,
        content: `Étape pipeline : ${prev ?? '—'} → ${stage}`,
        created_by: user.id,
      })
  }

  revalidate(clientId)
  return { success: true }
}

// ── setProspectFollowUp ──────────────────────────────────────────
// Définit (ou efface) la date de prochaine relance.

export async function setProspectFollowUp(
  clientId: string,
  date: string | null,
): Promise<ProspectionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const next = date && date.trim() !== '' ? date : null

  const { error } = await db(admin)
    .from('clients')
    .update({ next_follow_up_on: next })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }

  revalidate(clientId)
  return { success: true }
}

// ── createProspect (Quick-Add) ───────────────────────────────────
// Crée une fiche CRM "prospect" (profile_id NULL) directement dans le funnel.
// Garde clients.status cohérent avec l'étape choisie.

const STAGE_TO_STATUS: Record<PipelineStage, ClientStatus> = {
  froid:       'cold',
  contacte:    'interest',
  a_relancer:  'warm',
  repondu:     'warm',
  call_booke:  'warm',
  proposition: 'warm',
  signe:       'active',
  perdu:       'lost',
}

export interface CreateProspectInput {
  contactName: string
  companyName?: string
  profileUrl?: string
  stage?: PipelineStage
}

export type CreateProspectResult =
  | { success: true; clientId: string }
  | { success: false; error: string }

export async function createProspect(input: CreateProspectInput): Promise<CreateProspectResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  const contactName = input.contactName.trim()
  if (!contactName) return { success: false, error: 'Le nom est requis.' }

  const stage: PipelineStage = input.stage ?? 'froid'
  if (!PIPELINE_STAGES.includes(stage)) {
    return { success: false, error: 'Étape de pipeline invalide.' }
  }

  const payload = {
    contact_name: contactName,
    company_name: input.companyName?.trim() || null,
    profile_url: input.profileUrl?.trim() || null,
    source: 'cold_outreach' as ClientSource,
    status: STAGE_TO_STATUS[stage],
    pipeline_stage: stage,
  }

  const { data: row, error } = await db(admin)
    .from('clients')
    .insert(payload)
    .select('id')
    .single()

  if (error || !row) {
    return { success: false, error: error?.message ?? 'Erreur création prospect.' }
  }

  revalidate()
  return { success: true, clientId: (row as { id: string }).id }
}

// ── convertProspectToClient (étape "Signé") ──────────────────────
// Bascule la fiche en client actif du CRM. Même base de données : la fiche
// existe déjà, on la "promeut" (status='active', pipeline_stage='signe') et on
// trace la conversion dans la timeline.

export async function convertProspectToClient(clientId: string): Promise<ProspectionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, user } = auth

  const { error } = await db(admin)
    .from('clients')
    .update({ status: 'active' as ClientStatus, pipeline_stage: 'signe' as PipelineStage })
    .eq('id', clientId)

  if (error) return { success: false, error: error.message }

  await db(admin)
    .from('client_interactions')
    .insert({
      client_id: clientId,
      type: 'note' as InteractionType,
      content: 'Prospect converti en client (signé).',
      created_by: user.id,
    })

  revalidate(clientId)
  return { success: true }
}

// ── searchContacts (recherche globale) ───────────────────────────
// Recherche sur nom de contact / société / email. Limité à 8 résultats.

export interface ContactSearchResult {
  id: string
  contact_name: string
  company_name: string | null
  email: string | null
  status: ClientStatus
  pipeline_stage: PipelineStage | null
}

export async function searchContacts(query: string): Promise<ContactSearchResult[]> {
  const auth = await requireAdmin()
  if ('error' in auth) return []
  const { admin } = auth

  const q = query.trim()
  if (q.length < 2) return []

  const pattern = `%${q.replace(/[%_]/g, '')}%`
  const { data } = await admin
    .from('clients')
    .select('id, contact_name, company_name, email, status, pipeline_stage')
    .or(`contact_name.ilike.${pattern},company_name.ilike.${pattern},email.ilike.${pattern}`)
    .order('updated_at', { ascending: false })
    .limit(8)

  return (data as ContactSearchResult[] | null) ?? []
}

// ── getProspectDetail (panneau latéral) ──────────────────────────
// Lecture à la demande pour le slide-over (réutilise getClientDetail du CRM).

export async function getProspectDetail(clientId: string): Promise<ClientDetailData | null> {
  const auth = await requireAdmin()
  if ('error' in auth) return null
  return getClientDetail(auth.supabase, clientId)
}
