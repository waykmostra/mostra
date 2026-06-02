import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/supabase/queries'
import DashboardClient from './DashboardClient'

export const metadata: Metadata = {
  title: 'Dashboard — MOSTRA',
  description: "Vue d'ensemble de vos projets de production vidéo.",
}

export default async function DashboardPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const projects = await getProjects(supabase)

  return <DashboardClient projects={projects} role="admin" />
}
