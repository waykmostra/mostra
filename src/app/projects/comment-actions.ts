'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireUser, requireProjectAccess } from '@/lib/auth'
import { createNotifications, getProjectRecipients } from '@/lib/notifications'
import { sendEmail } from '@/lib/email/send'

export type CommentActionResult = { success: true } | { success: false; error: string }

// ── addComment ─────────────────────────────────────────────────────

export async function addComment(input: {
  projectId: string
  phaseId?: string
  subPhaseId?: string
  blockId?: string
  content: string
  parentId?: string
}): Promise<CommentActionResult> {
  const auth = await requireProjectAccess(input.projectId)
  if ('error' in auth) return { success: false, error: auth.error }
  const { supabase, profile, user } = auth

  const { error } = await db(supabase)
    .from('comments')
    .insert({
      project_id: input.projectId,
      phase_id: input.phaseId ?? null,
      sub_phase_id: input.subPhaseId ?? null,
      block_id: input.blockId ?? null,
      user_id: user.id,
      content: input.content.trim(),
      parent_id: input.parentId ?? null,
      is_resolved: false,
    })

  if (error) return { success: false, error: error.message }

  await db(supabase)
    .from('activity_logs')
    .insert({
      project_id: input.projectId,
      user_id: user.id,
      action: 'comment_added',
      details: { preview: input.content.slice(0, 80) },
    })

  // Notifications (fire-and-forget)
  void (async () => {
    const r = await getProjectRecipients(input.projectId)
    if (!r.projectName) return

    const isClientComment = !profile.is_admin
    const preview = input.content.slice(0, 120)
    const link = `/projects/${input.projectId}`
    const title = `💬 Nouveau commentaire sur « ${r.projectName} »`
    const message = `${profile.full_name} : "${preview}"`

    if (isClientComment) {
      // Client a commenté → notifier admins + PM
      const recipientIds = [...new Set([
        ...r.adminIds,
        ...(r.projectManagerId ? [r.projectManagerId] : []),
      ])].filter((id) => id !== user.id)

      await createNotifications(
        recipientIds.map((userId) => ({
          userId,
          projectId: input.projectId,
          type: 'comment_added' as const,
          title,
          message,
          link,
        })),
      )
    } else {
      // Admin a commenté → notifier le client
      if (r.clientUserId && r.clientUserId !== user.id) {
        await createNotifications([{
          userId: r.clientUserId,
          projectId: input.projectId,
          type: 'comment_added' as const,
          title,
          message,
          link: r.shareToken ? `/client/${r.shareToken}` : null,
        }])

        if (r.clientEmail) {
          void sendEmail({
            to: r.clientEmail,
            template: 'comment_added',
            data: {
              projectName: r.projectName,
              agencyName: 'Mostra',
              authorName: profile.full_name,
              preview,
            },
            link: r.shareToken ? `/client/${r.shareToken}` : undefined,
          })
        }
      }
    }
  })()

  revalidatePath(`/projects/${input.projectId}`)
  return { success: true }
}

// ── toggleResolveComment ───────────────────────────────────────────

export async function toggleResolveComment(commentId: string): Promise<CommentActionResult> {
  const auth = await requireUser()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, profile, user } = auth

  const { data: rawComment } = await admin
    .from('comments')
    .select('id, project_id, user_id, is_resolved')
    .eq('id', commentId)
    .maybeSingle()

  const comment = rawComment as {
    id: string
    project_id: string
    user_id: string
    is_resolved: boolean
  } | null
  if (!comment) return { success: false, error: 'Commentaire introuvable' }

  // Non-admins ne peuvent résoudre que leurs propres commentaires
  if (!profile.is_admin && comment.user_id !== user.id) {
    return { success: false, error: 'Vous ne pouvez résoudre que vos propres commentaires' }
  }

  // Si client : vérifier qu'il a accès au projet
  if (!profile.is_admin) {
    const access = await requireProjectAccess(comment.project_id)
    if ('error' in access) return { success: false, error: access.error }
  }

  const { error } = await db(admin)
    .from('comments')
    .update({ is_resolved: !comment.is_resolved })
    .eq('id', commentId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${comment.project_id}`)
  return { success: true }
}

// ── deleteComment ──────────────────────────────────────────────────

export async function deleteComment(commentId: string): Promise<CommentActionResult> {
  const auth = await requireUser()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin, profile, user } = auth

  const { data: rawComment } = await admin
    .from('comments')
    .select('id, project_id, user_id')
    .eq('id', commentId)
    .maybeSingle()

  const comment = rawComment as { id: string; project_id: string; user_id: string } | null
  if (!comment) return { success: false, error: 'Commentaire introuvable' }

  const isAuthor = comment.user_id === user.id
  if (!isAuthor && !profile.is_admin) {
    return { success: false, error: 'Vous ne pouvez pas supprimer ce commentaire' }
  }

  const { error } = await db(admin).from('comments').delete().eq('id', commentId)
  if (error) return { success: false, error: error.message }

  revalidatePath(`/projects/${comment.project_id}`)
  return { success: true }
}
