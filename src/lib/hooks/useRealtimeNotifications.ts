'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db<T>(client: T): any { return client }

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

export function useRealtimeNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(next.filter((n) => !n.is_read).length)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }, [])

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const supabase = createClient()

    // Initial fetch via client (RLS: users only see own rows)
    db(supabase)
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }: { data: AppNotification[] | null }) => {
        const notifs = (data as AppNotification[]) ?? []
        setNotifications(notifs)
        setUnreadCount(notifs.filter((n) => !n.is_read).length)
        setLoading(false)
      })

    // Realtime — listen for new notifications pushed to this user
    const channelName = `notifications:${userId}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as AppNotification
          setNotifications((prev) => {
            if (prev.some((n) => n.id === notif.id)) return prev
            return [notif, ...prev].slice(0, 30)
          })
          setUnreadCount((c) => c + 1)
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as AppNotification
          setNotifications((prev) => {
            const next = prev.map((n) => (n.id === updated.id ? updated : n))
            setUnreadCount(next.filter((n) => !n.is_read).length)
            return next
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  return { notifications, unreadCount, loading, markRead, markAllRead }
}
