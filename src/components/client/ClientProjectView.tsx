import ClientPhaseCard from './ClientPhaseCard'
import ClientActionBanner from './ClientActionBanner'
import ProjectTimeline from '@/components/project/ProjectTimeline'
import type { Project, ProjectPhase, SubPhase } from '@/lib/types'

interface ClientProjectViewProps {
  project: Project
  phases: ProjectPhase[]
  subPhasesByPhase: Record<string, SubPhase[]>
  token: string
}

export default function ClientProjectView({
  project,
  phases,
  subPhasesByPhase,
  token,
}: ClientProjectViewProps) {
  return (
    <div className="space-y-5">
      {/* ── Bandeau d'action principale (au-dessus de tout) ──────── */}
      {phases.length > 0 && (
        <ClientActionBanner
          phases={phases}
          subPhasesByPhase={subPhasesByPhase}
          token={token}
        />
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        {project.description && (
          <p className="text-sm text-[#666666] mt-1">{project.description}</p>
        )}
      </div>

      {/* ── Progression globale ─────────────────────────────────── */}
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-[#444444] uppercase tracking-widest font-medium">
              Avancement global
            </p>
            <p className="text-xs text-[#666666] mt-0.5">
              {phases.filter((p) => p.status === 'completed' || p.status === 'approved').length}
              {' / '}
              {phases.length} phases complétées
            </p>
          </div>
          <span className="text-4xl font-black text-white tabular-nums">
            {project.progress}
            <span className="text-xl text-[#444444]">%</span>
          </span>
        </div>

        {/* Barre de progression */}
        <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00D76B] rounded-full transition-all duration-700"
            style={{ width: `${project.progress}%` }}
          />
        </div>

        {/* Timeline des phases — sans légende (bulles retirées) */}
        {phases.length > 0 && (
          <div className="mt-4">
            <ProjectTimeline
              phases={phases}
              subPhasesByPhase={subPhasesByPhase}
              showLegend={false}
            />
          </div>
        )}
      </div>

      {/* ── Pipeline ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-white mb-3">Étapes du projet</h2>
        <div className="space-y-3">
          {phases.length === 0 ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5">
              <p className="text-xs text-[#444444] italic">Aucune phase configurée.</p>
            </div>
          ) : (
            phases.map((phase, i) => (
              <ClientPhaseCard
                key={phase.id}
                phase={phase}
                token={token}
                isFirst={i === 0}
                isLast={i === phases.length - 1}
                subPhases={subPhasesByPhase[phase.id] ?? []}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}
