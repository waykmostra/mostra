import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth'
import { getProjects } from '@/lib/supabase/queries'
import SidebarNav, { type SidebarProject } from './SidebarNav'

/** Charge les projets récents pour le rail. La navigation elle-même est
 *  interactive et vit dans SidebarNav. */
export default async function AppSidebar() {
  const profile = await getCurrentProfile()
  if (!profile) return null

  const supabase = createClient()
  const summaries = await getProjects(supabase)

  const projects: SidebarProject[] = summaries
    .filter((p) => p.status !== 'archived')
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      currentPhase: p.current_phase
        ? { id: p.current_phase.id, name: p.current_phase.name, status: p.current_phase.status }
        : null,
    }))

  return <SidebarNav projects={projects} isAdmin={profile.is_admin} />
}
