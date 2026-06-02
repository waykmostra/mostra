// Server-only utility — do NOT import in client components.
// Uses the admin client to bypass RLS when creating notifications for other users.

import { createAdminClient } from '@/lib/supabase/admin'
import { db } from '@/lib/supabase/helpers'

export type NotificationType =
  | 'comment_added'
  | 'phase_approved'
  | 'revision_requested'
  | 'form_submitted'
  | 'phase_ready'
  | 'file_uploaded'
  | 'project_created'

export interface CreateNotificationInput {
  userId: string
  projectId?: string | null
  type: NotificationType
  title: string
  message?: string | null
  link?: string | null
}

export async function createNotification(input: CreateNotificationInput): Promise<void> {
  try {
    const admin = createAdminClient()
    await db(admin).from('notifications').insert({
      user_id: input.userId,
      project_id: input.projectId ?? null,
      type: input.type,
      title: input.title,
      message: input.message ?? null,
      link: input.link ?? null,
    })
  } catch (err) {
    console.error('[createNotification] error:', err)
  }
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<void> {
  if (inputs.length === 0) return
  try {
    const admin = createAdminClient()
    await db(admin).from('notifications').insert(
      inputs.map((input) => ({
        user_id: input.userId,
        project_id: input.projectId ?? null,
        type: input.type,
        title: input.title,
        message: input.message ?? null,
        link: input.link ?? null,
      })),
    )
  } catch (err) {
    console.error('[createNotifications] error:', err)
  }
}

// ── Project recipient helpers ─────────────────────────────────────

export interface ProjectRecipients {
  projectName: string
  /** Toujours 'Mostra' — agence unique. */
  agencyName: string
  shareToken: string | null
  /** CRM client id (projects.client_id → clients.id). NULL si projet non rattaché. */
  crmClientId: string | null
  /** Profile auth lié au client si un compte a été créé (clients.profile_id). */
  clientUserId: string | null
  clientEmail: string | null
  projectManagerId: string | null
  /** IDs des profiles avec is_admin = true. */
  adminIds: string[]
}

export async function getProjectRecipients(projectId: string): Promise<ProjectRecipients> {
  const empty: ProjectRecipients = {
    projectName: '',
    agencyName: 'Mostra',
    shareToken: null,
    crmClientId: null,
    clientUserId: null,
    clientEmail: null,
    projectManagerId: null,
    adminIds: [],
  }

  try {
    const admin = createAdminClient()

    const { data: rawProject } = await admin
      .from('projects')
      .select('id, name, client_id, project_manager_id, share_token')
      .eq('id', projectId)
      .maybeSingle()

    const project = rawProject as {
      id: string
      name: string
      client_id: string | null
      project_manager_id: string | null
      share_token: string | null
    } | null

    if (!project) return empty

    const [adminsResult, clientResult] = await Promise.all([
      admin.from('profiles').select('id').eq('is_admin', true),
      project.client_id
        ? admin
            .from('clients')
            .select('email, profile_id')
            .eq('id', project.client_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const adminIds = ((adminsResult.data as { id: string }[] | null) ?? []).map((a) => a.id)
    const clientRow = clientResult.data as { email: string | null; profile_id: string | null } | null

    return {
      projectName: project.name,
      agencyName: 'Mostra',
      shareToken: project.share_token,
      crmClientId: project.client_id,
      clientUserId: clientRow?.profile_id ?? null,
      clientEmail: clientRow?.email ?? null,
      projectManagerId: project.project_manager_id,
      adminIds,
    }
  } catch (err) {
    console.error('[getProjectRecipients] error:', err)
    return empty
  }
}
