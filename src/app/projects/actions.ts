'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'
import { createNotification } from '@/lib/notifications'
import { sendEmail } from '@/lib/email/send'
import type { PhaseTemplate, SubPhaseDefinition, PaymentStatus, ProjectUpdate } from '@/lib/types'

export type CreateProjectInput = {
  name: string
  description?: string
  /** ID dans la table CRM `clients` (pas le profile auth). */
  crmClientId?: string | null
  projectManagerId?: string | null
}

export type CreateProjectResult = { data: { id: string; name: string } } | { error: string }

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const { supabase, admin, user } = auth

  // Unicité du nom
  const { data: existing } = await supabase
    .from('projects')
    .select('id')
    .ilike('name', input.name.trim())
    .maybeSingle()

  if (existing) {
    return { error: 'Un projet avec ce nom existe déjà.' }
  }

  // Création du projet
  const { data: project, error: projError } = await db(supabase)
    .from('projects')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      client_id: input.crmClientId || null,
      project_manager_id: input.projectManagerId || null,
      status: 'active',
      progress: 0,
    })
    .select('id, name')
    .single()

  if (projError || !project) {
    return { error: `Erreur lors de la création : ${projError?.message ?? 'erreur inconnue'}` }
  }

  const proj = project as { id: string; name: string }

  // Création des phases depuis les templates (globaux)
  const { data: templates } = await supabase
    .from('phase_templates')
    .select('*')
    .eq('is_default', true)
    .order('sort_order', { ascending: true })

  if (templates && templates.length > 0) {
    const typedTemplates = templates as PhaseTemplate[]

    const phaseRows = typedTemplates.map((tpl) => ({
      project_id: proj.id,
      phase_template_id: tpl.id,
      name: tpl.name,
      slug: tpl.slug,
      sort_order: tpl.sort_order,
      status: 'pending' as const,
    }))

    const { data: createdPhases } = await db(supabase)
      .from('project_phases')
      .insert(phaseRows)
      .select('id, phase_template_id')

    // Sous-phases depuis les templates
    if (createdPhases && createdPhases.length > 0) {
      const templateById = new Map(typedTemplates.map((t) => [t.id, t]))
      const subPhaseInserts: Array<{
        phase_id: string
        name: string
        slug: string
        sort_order: number
        status: 'pending'
      }> = []

      for (const phase of createdPhases as { id: string; phase_template_id: string | null }[]) {
        if (!phase.phase_template_id) continue
        const tpl = templateById.get(phase.phase_template_id)
        if (!tpl) continue

        const rawSps = typeof tpl.sub_phases === 'string' ? JSON.parse(tpl.sub_phases) : tpl.sub_phases
        const sps: SubPhaseDefinition[] = Array.isArray(rawSps) ? rawSps : []

        sps.forEach((sp, idx) => {
          subPhaseInserts.push({
            phase_id: phase.id,
            name: sp.name,
            slug: sp.slug,
            sort_order: sp.sort_order ?? idx + 1,
            status: 'pending',
          })
        })
      }

      if (subPhaseInserts.length > 0) {
        await db(supabase).from('sub_phases').insert(subPhaseInserts)
      }
    }
  }

  // Log
  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: proj.id,
      user_id: user.id,
      action: 'project_created',
      details: { project_name: proj.name },
    })

  // Notifier le client (résoudre clients.profile_id pour avoir l'auth user id)
  if (input.crmClientId) {
    const crmClientId = input.crmClientId
    void (async () => {
      const [{ data: rawProj }, { data: rawClient }] = await Promise.all([
        admin.from('projects').select('share_token').eq('id', proj.id).maybeSingle(),
        admin
          .from('clients')
          .select('profile_id, email')
          .eq('id', crmClientId)
          .maybeSingle(),
      ])

      const shareToken = (rawProj as { share_token: string | null } | null)?.share_token
      const clientRow = rawClient as { profile_id: string | null; email: string | null } | null
      const clientUserId = clientRow?.profile_id ?? null
      const clientEmail = clientRow?.email ?? null

      if (clientUserId) {
        await createNotification({
          userId: clientUserId,
          projectId: proj.id,
          type: 'project_created',
          title: `🚀 Votre projet « ${proj.name} » a démarré`,
          message: 'Mostra vient de créer votre projet.',
          link: shareToken ? `/client/${shareToken}` : null,
        })
      }

      if (clientEmail) {
        void sendEmail({
          to: clientEmail,
          template: 'project_created',
          data: { projectName: proj.name, agencyName: 'Mostra' },
          link: shareToken ? `/client/${shareToken}` : undefined,
        })
      }
    })()
  }

  return { data: { id: proj.id, name: proj.name } }
}

// ── deleteProject ────────────────────────────────────────────────

export type ProjectActionResult = { success: true } | { success: false; error: string }

export async function deleteProject(projectId: string): Promise<ProjectActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, admin } = auth

  // Vérifier que le projet existe
  const { data: project } = await db(supabase)
    .from('projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle()

  if (!project) return { success: false, error: 'Projet introuvable.' }

  // Cleanup Storage
  const { data: storageFiles } = await admin.storage
    .from('project-files')
    .list(projectId, { limit: 1000 })

  if (storageFiles && storageFiles.length > 0) {
    const allPaths: string[] = []

    for (const folder of storageFiles) {
      if (folder.id === null) {
        const { data: subFiles } = await admin.storage
          .from('project-files')
          .list(`${projectId}/${folder.name}`, { limit: 1000 })

        if (subFiles) {
          for (const sub of subFiles) {
            if (sub.id === null) {
              const { data: vFiles } = await admin.storage
                .from('project-files')
                .list(`${projectId}/${folder.name}/${sub.name}`, { limit: 1000 })
              if (vFiles) {
                allPaths.push(
                  ...vFiles.map((f) => `${projectId}/${folder.name}/${sub.name}/${f.name}`),
                )
              }
            } else {
              allPaths.push(`${projectId}/${folder.name}/${sub.name}`)
            }
          }
        }
      } else {
        allPaths.push(`${projectId}/${folder.name}`)
      }
    }

    if (allPaths.length > 0) {
      const { error: storageErr } = await admin.storage.from('project-files').remove(allPaths)
      if (storageErr) console.error('[deleteProject] storage cleanup error:', storageErr)
    }
  }

  // Hard delete (cascade FK)
  const { error: deleteErr } = await db(supabase).from('projects').delete().eq('id', projectId)

  if (deleteErr) return { success: false, error: deleteErr.message }

  revalidatePath('/dashboard')
  revalidatePath('/projects')
  return { success: true }
}

// ── archiveProject ───────────────────────────────────────────────

export async function archiveProject(projectId: string): Promise<ProjectActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const { error } = await db(supabase)
    .from('projects')
    .update({ status: 'archived' })
    .eq('id', projectId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ── assignClient ─────────────────────────────────────────────────
// Assigne un client CRM (table `clients`) à un projet.

export async function assignClient(
  projectId: string,
  crmClientId: string | null,
): Promise<ProjectActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  // Vérifier que le client CRM existe
  if (crmClientId) {
    const { data: rawClient } = await supabase
      .from('clients')
      .select('id')
      .eq('id', crmClientId)
      .maybeSingle()

    if (!rawClient) return { success: false, error: 'Client introuvable.' }
  }

  const { error } = await db(supabase)
    .from('projects')
    .update({ client_id: crmClientId })
    .eq('id', projectId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ── assignProjectManager ─────────────────────────────────────────

export async function assignProjectManager(
  projectId: string,
  pmUserId: string | null,
): Promise<ProjectActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, user } = auth

  const { data: rawProject } = await supabase
    .from('projects')
    .select('id, name, project_manager_id')
    .eq('id', projectId)
    .maybeSingle()

  const project = rawProject as { id: string; name: string; project_manager_id: string | null } | null
  if (!project) return { success: false, error: 'Projet introuvable.' }

  // Vérifier que le PM est admin
  if (pmUserId) {
    const { data: pmProfile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', pmUserId)
      .maybeSingle()

    if (!pmProfile) return { success: false, error: 'Utilisateur introuvable.' }
    if (!(pmProfile as { is_admin: boolean }).is_admin) {
      return { success: false, error: 'Seul un admin peut être PM.' }
    }
  }

  const { error } = await db(supabase)
    .from('projects')
    .update({ project_manager_id: pmUserId })
    .eq('id', projectId)

  if (error) return { success: false, error: error.message }

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: projectId,
      user_id: user.id,
      action: 'pm_assigned',
      details: { project_manager_id: pmUserId },
    })

  revalidatePath('/dashboard')
  revalidatePath(`/projects/${projectId}`)
  return { success: true }
}

// ── updateProjectMeta ────────────────────────────────────────────
// Met à jour les métadonnées business/finance de la carte 360° (P3).
// Édition inline : deadline, valeur, statut paiement, devis, facture.

const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'invoiced', 'paid', 'overdue', 'partial']

export type UpdateProjectMetaInput = {
  deadline?: string | null
  value_eur?: number | null
  payment_status?: PaymentStatus
  quote_url?: string | null
  invoice_url?: string | null
  /** Date d'encaissement explicite (sinon auto-gérée via payment_status). */
  paid_at?: string | null
}

export async function updateProjectMeta(
  projectId: string,
  input: UpdateProjectMetaInput,
): Promise<ProjectActionResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  const patch: ProjectUpdate = {}

  if ('deadline' in input) {
    patch.deadline = input.deadline || null
  }

  if ('value_eur' in input) {
    const v = input.value_eur
    if (v !== null && v !== undefined && (Number.isNaN(v) || v < 0)) {
      return { success: false, error: 'La valeur doit être un nombre positif.' }
    }
    patch.value_eur = v ?? null
  }

  if ('payment_status' in input && input.payment_status) {
    if (!PAYMENT_STATUSES.includes(input.payment_status)) {
      return { success: false, error: 'Statut de paiement invalide.' }
    }
    patch.payment_status = input.payment_status
    // Cashflow (P4) : "payé" date l'encaissement à maintenant ; tout autre
    // statut l'efface. Un override explicite (ci-dessous) reste prioritaire.
    patch.paid_at = input.payment_status === 'paid' ? new Date().toISOString() : null
  }

  if ('paid_at' in input) {
    patch.paid_at = input.paid_at || null
  }

  if ('quote_url' in input) {
    patch.quote_url = input.quote_url?.trim() || null
  }

  if ('invoice_url' in input) {
    patch.invoice_url = input.invoice_url?.trim() || null
  }

  if (Object.keys(patch).length === 0) return { success: true }

  const { error } = await db(supabase).from('projects').update(patch).eq('id', projectId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/dashboard')
  revalidatePath('/finance')
  return { success: true }
}

// ── regenerateShareToken ─────────────────────────────────────────
// Génère un nouveau share_token pour invalider l'ancien lien public.

export async function regenerateShareToken(
  projectId: string,
): Promise<{ success: true; token: string } | { success: false; error: string }> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase } = auth

  // Génère un nouveau token via crypto.randomUUID() — pas exposé en SQL côté
  // RLS donc on peut le générer côté Node.
  const newToken = crypto.randomUUID().replace(/-/g, '') +
                   crypto.randomUUID().replace(/-/g, '').slice(0, 16)

  const { data: updated, error } = await db(supabase)
    .from('projects')
    .update({ share_token: newToken })
    .eq('id', projectId)
    .select('share_token')
    .single()

  if (error || !updated) {
    return { success: false, error: error?.message ?? 'Erreur génération token' }
  }

  revalidatePath(`/projects/${projectId}`)
  return { success: true, token: (updated as { share_token: string }).share_token }
}
