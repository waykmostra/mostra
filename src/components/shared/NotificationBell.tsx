'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Check,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Film,
  FolderPlus,
  MessageSquare,
  RotateCcw,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { useRealtimeNotifications } from '@/lib/hooks/useRealtimeNotifications'
import { markAllAsRead, markAsRead } from '@/app/notifications/actions'

interface NotificationBellProps {
  userId: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'il y a quelques secondes'
  const m = Math.floor(s / 60)
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  comment_added: MessageSquare,
  phase_ready: CheckCircle2,
  phase_approved: CheckCircle2,
  revision_requested: RotateCcw,
  form_submitted: ClipboardList,
  file_uploaded: Film,
  project_created: FolderPlus,
  member_joined: UserPlus,
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, markRead, markAllRead } = useRealtimeNotifications(userId)

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpen() {
    setOpen((o) => !o)
  }

  async function handleMarkAll() {
    markAllRead()
    await markAllAsRead()
  }

  async function handleNotifClick(id: string, isRead: boolean) {
    if (!isRead) {
      markRead(id)
      await markAsRead(id)
    }
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative h-9 w-9 flex items-center justify-center rounded-sm text-chrome-faint hover:text-chrome-text hover:bg-white/[0.06] transition-colors duration-[160ms]"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="tnum absolute top-1 right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-brand text-[#020302] text-[10px] font-semibold leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-[340px] rounded-lg bg-surface shadow-[var(--hairline),var(--e3)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="mono-label text-faint">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                className="flex items-center gap-1.5 text-[11.5px] font-medium text-dim hover:text-brand-text transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Tout marquer lu
              </button>
            )}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-faint">
                Rien de neuf pour l’instant.
              </p>
            ) : (
              notifications.map((notif) => {
                const Icon = TYPE_ICONS[notif.type] ?? Bell
                const inner = (
                  <div
                    className={`flex gap-3 px-4 py-3 border-t border-line transition-colors duration-[160ms] cursor-pointer ${
                      notif.is_read ? 'hover:bg-surface-2' : 'bg-brand/[0.06] hover:bg-brand/[0.1]'
                    }`}
                    onClick={() => handleNotifClick(notif.id, notif.is_read)}
                  >
                    <Icon
                      className={`h-4 w-4 flex-shrink-0 mt-0.5 ${
                        notif.is_read ? 'text-faint' : 'text-brand-text'
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-[13px] leading-snug ${
                          notif.is_read ? 'text-dim font-normal' : 'text-ink font-medium'
                        }`}
                      >
                        {notif.title}
                      </p>
                      {notif.message && (
                        <p className="text-[12px] text-faint mt-0.5 line-clamp-2">
                          {notif.message}
                        </p>
                      )}
                      <p className="text-[11px] text-faint mt-1.5">{timeAgo(notif.created_at)}</p>
                    </div>

                    {notif.link && (
                      <ExternalLink className="h-3.5 w-3.5 text-faint flex-shrink-0 mt-0.5" />
                    )}
                  </div>
                )

                return notif.link ? (
                  <Link key={notif.id} href={notif.link}>
                    {inner}
                  </Link>
                ) : (
                  <div key={notif.id}>{inner}</div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
