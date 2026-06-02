import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import {
  getDailyWorkflow,
  getAllWorkflowTasks,
  getWorkflowStreak,
} from '@/lib/supabase/founder'
import WorkflowClient from './WorkflowClient'

export const metadata: Metadata = {
  title: 'Daily Workflow — MOSTRA',
  description: 'Checklist quotidienne avec score et streak.',
}

export default async function WorkflowPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const items = await getDailyWorkflow(supabase)
  const allTasks = await getAllWorkflowTasks(supabase)
  const streak = await getWorkflowStreak(supabase, items.length)

  return <WorkflowClient items={items} allTasks={allTasks} streak={streak} />
}
