import Link from 'next/link'
import { formatRelative } from '@/lib/utils/dates'
import StatusBadge from '@/components/shared/StatusBadge'
import type { ProjectSummary } from '@/lib/types'

interface ProjectCardProps {
  project: ProjectSummary
}

export default function ProjectCard({ project }: ProjectCardProps) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="
        block bg-surface border border-line rounded-2xl p-5
        hover:border-line-strong hover:shadow-sm hover:-translate-y-0.5
        transition-all group
      "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-[14px] font-medium text-ink truncate group-hover:text-brand transition-colors">
            {project.name}
          </h3>
          {project.client && (
            <p className="text-[12px] text-faint mt-0.5 truncate">
              {project.client.company_name || project.client.contact_name}
            </p>
          )}
        </div>
        <StatusBadge status={project.status} className="flex-shrink-0" />
      </div>

      {/* Phase courante */}
      {project.current_phase && (
        <p className="text-[12px] text-dim mb-3">
          <span className="text-faint">Phase : </span>
          {project.current_phase.name}
        </p>
      )}

      {/* Progress */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${project.progress ?? 0}%`, background: 'rgb(var(--c-brand))' }}
          />
        </div>
        <span className="text-[11px] text-faint tnum w-8 text-right">{project.progress ?? 0}%</span>
      </div>

      {/* Footer */}
      <p className="text-[11px] text-faint">Mis à jour {formatRelative(project.updated_at)}</p>
    </Link>
  )
}
