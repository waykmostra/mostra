'use server'

import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/supabase/helpers'

export type NotificationActionResult = { success: true } | { success: false; error: string }

export interface AppNotification {
  id: string
  user_id: string
  project_id: string | null
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

export async function getNotifications(): Promise<AppNotification[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await db(supabase)
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (data as AppNotification[]) ?? []
}

export async function getUnreadCount(): Promise<number> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data } = await db(supabase)
    .from('notifications')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_read', false)

  return (data as { id: string }[] | null)?.length ?? 0
}

export async function markAsRead(notificationId: string): Promise<NotificationActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }

  const { error } = await db(supabase)
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', user.id)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function markAllAsRead(): Promise<NotificationActionResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Non authentifié' }

  const { error } = await db(supabase)
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false)

  if (error) return { success: false, error: error.message }
  return { success: true }
}
