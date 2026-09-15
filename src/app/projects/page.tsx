import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { getCurrentProfile } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { getProjects } from '@/lib/supabase/queries'
import ProjectsListView from './ProjectsListView'

export const metadata: Metadata = {
  title: 'Projets — MOSTRA',
  description: 'Tous vos projets de production.',
}

export default async function ProjectsPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect('/login')
  if (!profile.is_admin) redirect('/client/dashboard')

  const supabase = createClient()
  const projects = await getProjects(supabase)

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
      <div className="flex flex-col gap-6 w-full">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-semibold text-[22px] tracking-tight text-ink">Projets</h1>
            <p className="text-[13px] text-dim mt-0.5">
              {projects.length} projet{projects.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/projects/new" className="btn-primary">
            <Plus className="h-4 w-4" />
            Nouveau projet
          </Link>
        </div>

        <ProjectsListView projects={projects} />
      </div>
    </div>
  )
}
