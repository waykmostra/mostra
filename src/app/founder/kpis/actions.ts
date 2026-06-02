'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/supabase/helpers'
import { requireAdmin } from '@/lib/auth'

// ============================================================================
// KPIs hebdo (migration 022). Une ligne par semaine (week_start = lundi, UNIQUE).
// Upsert idempotent par week_start.
// ============================================================================

export type KpiResult = { success: true } | { success: false; error: string }

export interface WeeklyKpiInput {
  prospectsContacted: number
  replies: number
  callsHeld: number
  postsLinkedin: number
  postsInstagram: number
  whatWorked: string
  whatDidnt: string
  oneChange: string
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export async function upsertWeeklyKpi(weekStart: string, input: WeeklyKpiInput): Promise<KpiResult> {
  const auth = await requireAdmin()
  if ('error' in auth) return { success: false, error: auth.error }
  const { admin } = auth

  if (!ISO_DATE.test(weekStart)) return { success: false, error: 'Semaine invalide.' }

  const n = (v: number) => (Number.isFinite(v) && v >= 0 ? Math.round(v) : 0)

  const { error } = await db(admin)
    .from('weekly_kpis')
    .upsert(
      {
        week_start: weekStart,
        prospects_contacted: n(input.prospectsContacted),
        replies: n(input.replies),
        calls_held: n(input.callsHeld),
        posts_linkedin: n(input.postsLinkedin),
        posts_instagram: n(input.postsInstagram),
        what_worked: input.whatWorked.trim() || null,
        what_didnt: input.whatDidnt.trim() || null,
        one_change: input.oneChange.trim() || null,
      },
      { onConflict: 'week_start' },
    )

  if (error) return { success: false, error: error.message }

  revalidatePath('/founder/kpis')
  return { success: true }
}
