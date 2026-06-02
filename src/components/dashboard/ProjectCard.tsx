import Link from 'next/link'
import { formatRelative } from '@/lib/utils/dates'
import StatusBadge from '@/components/shared/StatusBadge'
import ProgressBar from '@/components/shared/ProgressBar'
import type { ProjectSummary } from '@/lib/types'

interface ProjectCardProps {
  project: ProjectSummary
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="
        block bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-5
        hover:bg-[#222222] hover:border-[#3a3a3a]
        transition-colors group
      "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-white truncate group-hover:text-white">
            {project.name}
          </h3>
          {project.client && (
            <p className="text-xs text-[#666666] mt-0.5 truncate">
              {project.client.company_name || project.client.contact_name}
            </p>
          )}
        </div>
        <StatusBadge status={project.status} className="flex-shrink-0" />
      </div>

      {/* Phase courante */}
      {project.current_phase && (
        <p className="text-xs text-[#a0a0a0] mb-3">
          <span className="text-[#666666]">Phase: </span>
          {project.current_phase.name}
        </p>
      )}

      {/* Progress */}
      <div className="mb-3">
        <ProgressBar value={project.progress} showLabel size="sm" />
      </div>

      {/* Footer */}
      <p className="text-[11px] text-[#444444]">Mis à jour {formatRelative(project.updated_at)}</p>
    </Link>
  )
}
