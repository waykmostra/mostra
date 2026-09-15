'use client'

import { useState } from 'react'
import { FolderOpen } from 'lucide-react'
import ProjectCard from '@/components/dashboard/ProjectCard'
import ProjectFilters, { type FilterTab } from '@/components/dashboard/ProjectFilters'
import type { ProjectSummary } from '@/lib/types'

export default function ProjectsListView({ projects }: { projects: ProjectSummary[] }) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')

  const filtered = projects.filter((p) => {
    const matchFilter = activeFilter === 'all' || p.status === activeFilter
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  return (
    <div className="flex flex-col gap-4">
      <ProjectFilters
        activeFilter={activeFilter}
        search={search}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearch}
      />

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <div className="border border-dashed border-line rounded-2xl py-14 flex flex-col items-center gap-3 text-center">
          <FolderOpen className="h-8 w-8 text-faint" />
          <p className="text-[13.5px] text-dim">
            {search ? `Aucun résultat pour « ${search} »` : 'Aucun projet pour le moment.'}
          </p>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-[12.5px] font-medium text-brand hover:opacity-80 transition-opacity"
            >
              Effacer la recherche
            </button>
          )}
        </div>
      )}
    </div>
  )
}
