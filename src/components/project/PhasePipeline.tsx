'use client'

import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'
import PhaseCard from './PhaseCard'
import AddPhaseButton from './AddPhaseButton'
import type { PhaseFile, ProjectPhase, SubPhase, UserRole } from '@/lib/types'

interface Props {
  phases: ProjectPhase[]
  filesByPhase: Record<string, PhaseFile[]>
  subPhasesByPhase: Record<string, SubPhase[]>
  projectId: string
  userRole: UserRole
}

/**
 * Pipeline de phases + « Mode éditeur ». Par défaut, l'édition des étapes
 * (ajout / suppression / renommage) est VERROUILLÉE — on l'active via le
 * bouton « Mode éditeur » pour éviter les modifs accidentelles pendant la
 * gestion quotidienne du projet.
 */
export default function PhasePipeline({
  phases,
  filesByPhase,
  subPhasesByPhase,
  projectId,
  userRole,
}: Props) {
  const [editMode, setEditMode] = useState(false)
  const isAdmin = userRole === 'admin'

  return (
    <div>
      {isAdmin && (
        <div className="flex items-center justify-between mb-3">
          {editMode ? (
            <p className="text-[11px] text-brand">
              Édition activée — tu peux renommer, ajouter ou supprimer des étapes.
            </p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors flex-shrink-0
              ${
                editMode
                  ? 'bg-brand/10 border-brand/25 text-brand'
                  : 'bg-surface-2 border-line text-dim hover:text-ink hover:border-line-strong'
              }
            `}
          >
            {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
            {editMode ? "Terminer l'édition" : 'Mode éditeur'}
          </button>
        </div>
      )}

      {phases.length === 0 ? (
        <p className="text-xs text-faint italic mb-1">
          Aucune phase.{' '}
          {isAdmin && !editMode && 'Active le mode éditeur pour en ajouter.'}
        </p>
      ) : (
        phases.map((phase, i) => {
          const prev = phases[i - 1]
          const canStart =
            i === 0 || prev?.status === 'completed' || prev?.status === 'approved'
          return (
            <PhaseCard
              key={phase.id}
              phase={phase}
              projectId={projectId}
              isLast={i === phases.length - 1}
              canStart={canStart}
              files={filesByPhase[phase.id] ?? []}
              subPhases={subPhasesByPhase[phase.id] ?? []}
              userRole={userRole}
              editMode={editMode}
            />
          )
        })
      )}

      {isAdmin && editMode && <AddPhaseButton projectId={projectId} />}
    </div>
  )
}
