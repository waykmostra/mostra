'use client'

import { useState } from 'react'
import type { PhaseStatus, ProjectPhase, SubPhase } from '@/lib/types'

interface ProjectTimelineProps {
  phases: Pick<ProjectPhase, 'id' | 'name' | 'status' | 'sort_order'>[]
  subPhasesByPhase?: Record<string, Pick<SubPhase, 'id' | 'status' | 'name'>[]>
  mini?: boolean        // version compacte pour les cards dashboard
  showLegend?: boolean  // afficher ou masquer la légende (default: true)
}

const STATUS_COLOR: Record<PhaseStatus, string> = {
  pending:     '#2a2a2a',
  in_progress: '#3B82F6',
  in_review:   '#F59E0B',
  completed:   '#00D76B',
  approved:    '#00D76B',
}

const STATUS_LABEL: Record<PhaseStatus, string> = {
  pending:     'En attente',
  in_progress: 'En cours',
  in_review:   'En review',
  completed:   'Terminé',
  approved:    'Approuvé',
}

function SubPhaseDot({ status }: { status: PhaseStatus }) {
  return (
    <div
      className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
      style={{ backgroundColor: STATUS_COLOR[status] }}
    />
  )
}

function PhaseSegment({
  phase,
  subPhases,
  isFirst,
  isLast,
  mini,
  showDots,
}: {
  phase: Pick<ProjectPhase, 'id' | 'name' | 'status'>
  subPhases: Pick<SubPhase, 'id' | 'status' | 'name'>[]
  isFirst: boolean
  isLast: boolean
  mini: boolean
  showDots: boolean
}) {
  const [hovering, setHovering] = useState(false)
  const status = phase.status as PhaseStatus
  const color = STATUS_COLOR[status]
  const doneCount = subPhases.filter(
    (sp) => sp.status === 'completed' || sp.status === 'approved',
  ).length

  return (
    <div className="flex-1 relative" style={{ minWidth: 0 }}>
      {/* Tooltip */}
      {hovering && !mini && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <p className="text-xs font-medium text-white">{phase.name}</p>
            <p className="text-[10px] mt-0.5" style={{ color }}>
              {STATUS_LABEL[status]}
            </p>
            {subPhases.length > 0 && (
              <p className="text-[10px] text-[#555555] mt-0.5">
                {doneCount}/{subPhases.length} sous-phases
              </p>
            )}
          </div>
          {/* Arrow */}
          <div className="w-2 h-2 bg-[#1a1a1a] border-b border-r border-[#2a2a2a] rotate-45 mx-auto -mt-1" />
        </div>
      )}

      {/* Segment bar */}
      <div
        className={`relative h-full cursor-pointer transition-opacity hover:opacity-90 ${
          isFirst ? 'rounded-l-full' : ''
        } ${isLast ? 'rounded-r-full' : ''}`}
        style={{ backgroundColor: color }}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      />

      {/* Sub-phase dots */}
      {!mini && showDots && subPhases.length > 0 && (
        <div className="flex items-center justify-center gap-0.5 mt-1.5">
          {subPhases.map((sp) => (
            <SubPhaseDot key={sp.id} status={sp.status as PhaseStatus} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectTimeline({
  phases,
  subPhasesByPhase = {},
  mini = false,
  showLegend = true,
}: ProjectTimelineProps) {
  if (phases.length === 0) return null

  const sorted = [...phases].sort((a, b) => a.sort_order - b.sort_order)
  const barHeight = mini ? 'h-1.5' : 'h-2.5'

  return (
    <div className="w-full">
      {/* Phase labels — hidden in mini mode */}
      {!mini && (
        <div className="flex gap-0.5 mb-1.5">
          {sorted.map((phase) => (
            <div key={phase.id} className="flex-1 min-w-0">
              <p className="text-[9px] text-[#444444] truncate text-center px-0.5">
                {phase.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Bar */}
      <div className={`flex gap-0.5 ${barHeight} items-stretch`}>
        {sorted.map((phase, i) => (
          <PhaseSegment
            key={phase.id}
            phase={phase}
            subPhases={subPhasesByPhase[phase.id] ?? []}
            isFirst={i === 0}
            isLast={i === sorted.length - 1}
            mini={mini}
            showDots={showLegend}
          />
        ))}
      </div>

      {/* Legend — only in full mode and when enabled */}
      {!mini && showLegend && (
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {(
            [
              ['pending', 'En attente'],
              ['in_progress', 'En cours'],
              ['in_review', 'En review'],
              ['completed', 'Terminé'],
            ] as [PhaseStatus, string][]
          ).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLOR[status] }}
              />
              <span className="text-[10px] text-[#555555]">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
